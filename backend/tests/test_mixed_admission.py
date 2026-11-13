"""Real PostgreSQL tests for mixed Standing/Seated admission without schema changes."""
from pathlib import Path
import re

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.main import app
from app.models import Seat, Zone
from app.services import reservations, checkout, orders
from app.services.seatmap import seat_map
from app.errors import DomainError
from app.venue_catalog import zone_catalog
from tests.conftest import expire_reservation, scalar
from tests.test_concurrency import race, wins, failures


@pytest.fixture
def mixed(db, concert):
    seated = Zone(concert_id=concert, name='Standard Tier 1', price=150, capacity=4)
    standing = Zone(concert_id=concert, name='VIP Diamond Experience', price=350, capacity=3)
    db.add_all([seated, standing]); db.flush()
    for zone, count in [(seated, 4), (standing, 3)]:
        db.add_all(Seat(zone_id=zone.id, row_label='A', seat_number=n) for n in range(1, count + 1))
    db.commit()
    ids = list(db.execute(select(Seat.id).where(Seat.zone_id == seated.id).order_by(Seat.id)).scalars())
    pool = list(db.execute(select(Seat.id).where(Seat.zone_id == standing.id).order_by(Seat.id)).scalars())
    return seated.id, standing.id, ids, pool


def test_all_venue_maps_match_explicit_backend_types_and_preserve_standing():
    root = Path(__file__).resolve().parents[2]
    catalog = zone_catalog()
    for cid, zones in catalog.items():
        source = (root / f'js/venues/c{cid}-map.js').read_text()
        actual = re.findall(r'name\s*:\s*"([^"]+)"\s*,\s*bookingType\s*:\s*"(standing|seated)"', source)
        assert actual
        assert {name for name, _ in actual} == set(zones)
        assert all(zones[name] == mode for name, mode in actual)
        assert all(mode == 'standing' for name, mode in zones.items() if 'Standing' in name or 'Mosh' in name or 'Floor GA' in name)
    assert set(catalog['8'].values()) == {'standing'}
    assert catalog['1']['Standard Tier 1'] == catalog['1']['Standard Tier 2'] == 'seated'
    assert catalog['10']['Standard Tier'] == 'seated'


def test_map_hides_standing_inventory_numbers_and_keeps_seat_identity(db, concert, users, mixed):
    seated, standing, ids, pool = mixed
    zones = {z['id']: z for z in seat_map(db, concert, users['a'])['zones']}
    assert zones[standing]['booking_type'] == 'standing' and zones[standing]['seats'] == []
    assert zones[standing]['available'] == 3
    assert zones[seated]['booking_type'] == 'seated'
    assert [(s['row'], s['number']) for s in zones[seated]['seats']] == [('A', n) for n in range(1, 5)]
    assert len({s['id'] for z in zones.values() for s in z['seats']}) == sum(len(z['seats']) for z in zones.values())


def test_mixed_checkout_issues_real_tickets_and_preserves_qr(db, concert, users, mixed):
    seated, standing, ids, pool = mixed
    hold = reservations.hold_tickets(db, users['a'], concert, ids[:1], [(standing, 2)])
    assert len(hold.seats) == 3 and int(hold.total_amount) == 850
    assert all(s.row_label is None and s.seat_number is None for s in hold.seats if s.booking_type == 'standing')
    order = checkout.checkout(db, users['a'], hold.id, 'card')
    numbered = [t for t in order['tickets'] if t['booking_type'] == 'seated']
    general = [t for t in order['tickets'] if t['booking_type'] == 'standing']
    assert len(numbered) == 1 and numbered[0]['row'] == 'A' and numbered[0]['seat_number'] == 1
    assert len(general) == 2 and all(t['row'] is None and t['seat_number'] is None for t in general)
    assert all(t['qr_data'] == t['ticket_code'] for t in order['tickets'])
    assert checkout.checkout(db, users['a'], hold.id, 'card')['id'] == order['id']
    for ticket in order['tickets']:
        assert orders.get_ticket(db, users['a'], ticket['id'])['qr_image'].startswith('data:image/svg+xml')
        assert orders.check_in_ticket(db, users['staff'], ticket['ticket_code'])['status'] == 'used'


def test_mixed_expiry_releases_seated_and_standing_inventory(db, concert, users, mixed):
    seated, standing, ids, pool = mixed
    hold = reservations.hold_tickets(db, users['a'], concert, ids[:1], [(standing, 2)])
    expire_reservation(hold.id)
    with pytest.raises(DomainError) as error:
        checkout.checkout(db, users['a'], hold.id, 'card')
    assert error.value.code == 'reservation_expired'
    again = reservations.hold_tickets(db, users['b'], concert, ids[:1], [(standing, 3)])
    assert len(again.seats) == 4


def test_two_buyers_cannot_hold_the_same_numbered_seat(db, concert, users, mixed):
    ids = mixed[2]
    results = race([lambda session, user=user: reservations.hold_tickets(session, user, concert, ids[:1], []) for user in [users['a'], users['b']]])
    assert len(wins(results)) == 1
    assert {error.code for error in failures(results)} == {'seat_unavailable'}


def test_standing_concurrency_never_oversells_capacity(db, concert, users, mixed):
    standing = mixed[1]
    results = race([lambda session, user=user: reservations.hold_tickets(session, user, concert, [], [(standing, 2)]) for user in [users['a'], users['b']]])
    assert len(wins(results)) == 1
    assert {error.code for error in failures(results)} == {'standing_unavailable'}
    assert scalar("SELECT count(*) FROM seats WHERE zone_id=:z AND status='held'", z=standing) == 2


def test_sold_seat_cannot_be_held_again_and_cancellation_restores_both_modes(db, concert, users, mixed):
    standing, ids = mixed[1], mixed[2]
    hold = reservations.hold_tickets(db, users['a'], concert, ids[:1], [(standing, 2)])
    paid = checkout.checkout(db, users['a'], hold.id, 'card')
    with pytest.raises(DomainError, match='no longer available'):
        reservations.hold_tickets(db, users['b'], concert, ids[:1], [])
    orders.cancel_order(db, users['a'], paid['id'])
    assert len(reservations.hold_tickets(db, users['b'], concert, ids[:1], [(standing, 3)]).seats) == 4


def test_api_rejects_mode_confusion_and_enforces_combined_limit(db, concert, users, mixed):
    seated, standing, ids, pool = mixed
    headers = {'X-User-Id': str(users['a'])}
    with TestClient(app) as client:
        for body, code in [({'seat_ids': pool[:1]}, 'zone_requires_quantity'), ({'standing': [{'zone_id': seated, 'quantity': 1}]}, 'zone_requires_seats')]:
            result = client.post('/api/reservations', json={'concert_id': concert, **body}, headers=headers)
            assert result.status_code == 400 and result.json()['error']['code'] == code
        assert client.post('/api/reservations', json={'concert_id': concert, 'seat_ids': ids, 'standing': [{'zone_id': standing, 'quantity': 5}]}, headers=headers).status_code == 422
        hold = client.post('/api/reservations', json={'concert_id': concert, 'seat_ids': ids[:1], 'standing': [{'zone_id': standing, 'quantity': 2}]}, headers=headers)
        assert hold.status_code == 201
        assert sorted(s['booking_type'] for s in hold.json()['seats']) == ['seated', 'standing', 'standing']

@pytest.mark.parametrize('body', [
    {'seat_ids': list(range(1, 7))},
    {'standing': [{'zone_id': 1, 'quantity': 6}]},
    {'seat_ids': [1, 2, 3], 'standing': [{'zone_id': 2, 'quantity': 3}]},
])
def test_six_ticket_schema_boundary(body):
    from app.schemas import HoldRequest
    from pydantic import ValidationError
    request = HoldRequest(concert_id=1, **body)
    assert len(request.seat_ids) + sum(s.quantity for s in request.standing) == 6
    for extra in [1, 2]:
        invalid = {'concert_id': 1, 'seat_ids': request.seat_ids + list(range(100, 100 + extra)),
                   'standing': [s.model_dump() for s in request.standing]}
        with pytest.raises(ValidationError):
            HoldRequest(**invalid)

@pytest.mark.parametrize('mode', ['seated', 'standing', 'mixed'])
def test_api_accepts_six_and_rejects_seven_eight_without_losing_hold(db, concert, users, seat_ids, mixed, mode):
    standing = mixed[1]
    zone = db.get(Zone, standing)
    zone.capacity = 8
    db.add_all(Seat(zone_id=standing, row_label='A', seat_number=n) for n in range(4, 9))
    db.commit()
    def body(count):
        if mode == 'seated':return {'seat_ids':seat_ids[:count]}
        if mode == 'standing':return {'standing':[{'zone_id':standing,'quantity':count}]}
        return {'seat_ids':mixed[2][:3], 'standing':[{'zone_id':standing,'quantity':count-3}]}
    with TestClient(app) as client:
        headers={'X-User-Id':str(users['a'])}
        accepted=client.post('/api/reservations',json={'concert_id':concert,**body(6)},headers=headers)
        assert accepted.status_code == 201
        assert len(accepted.json()['seats']) == 6
        for count in [7,8]:
            denied=client.post('/api/reservations',json={'concert_id':concert,**body(count)},headers=headers)
            assert denied.status_code == 422
        current=client.get('/api/reservations/'+accepted.json()['id'],headers=headers)
        assert current.json()['status']=='active' and len(current.json()['seats'])==6
