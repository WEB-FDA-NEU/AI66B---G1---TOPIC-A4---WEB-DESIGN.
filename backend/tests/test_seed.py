"""Seed script (issue #34): data consistency, idempotency and safety."""
import copy
import re
from pathlib import Path

import bcrypt
import pytest
from sqlalchemy import text

from scripts import seed as seed_module
from scripts.seed import SeedDataError, load_data, seat_labels, validate
from tests.conftest import scalar

REPO = Path(__file__).resolve().parents[2]
ENV = {"SEED_ADMIN_PASSWORD": "admin-secret-1", "SEED_USER_PASSWORD": "user-secret-1"}


@pytest.fixture(scope="module")
def data():
    return load_data()


def run_seed(db, data, **kwargs):
    kwargs.setdefault("env", ENV)
    kwargs.setdefault("out", lambda *_: None)
    created = seed_module.seed(db, data, **kwargs)
    db.commit()
    return created


def table_counts():
    return {
        t: scalar(f"SELECT count(*) FROM {t}")
        for t in ("users", "concerts", "zones", "seats", "orders", "tickets")
    }


# ------------------------------------------------------------------ the data file


def test_seed_data_is_valid(data):
    validate(data)


def test_concert_ids_are_c1_to_c11(data):
    assert sorted(c["id"] for c in data["concerts"]) == list(range(1, 12))
    assert all(c["slug"] == f"c{c['id']}" for c in data["concerts"])


def test_tier_capacities_add_up_to_ticket_capacity(data):
    for concert in data["concerts"]:
        assert sum(t["capacity"] for t in concert["tiers"]) == concert["ticketCapacity"], concert["slug"]


def test_tiers_match_mock_data_and_venue_maps(data):
    mock = (REPO / "js" / "mock-data.js").read_text(encoding="utf-8")
    blocks = re.split(r'\n\s*id:\s*"', mock)[1:]
    mock_tiers = {
        b.split('"', 1)[0]: {
            name: int(price) for name, price in re.findall(r'type:\s*"([^"]+)",\s*price:\s*"\$(\d+)"', b)
        }
        for b in blocks
    }
    for concert in data["concerts"]:
        tiers = {t["name"]: t["price"] for t in concert["tiers"]}
        assert tiers == mock_tiers[concert["slug"]], concert["slug"]
        venue = (REPO / "js" / "venues" / f"{concert['slug']}-map.js").read_text(encoding="utf-8")
        assert set(re.findall(r'\bname:\s*"([^"]+)"', venue)) == set(tiers), concert["slug"]


def test_sample_orders_cover_many_statuses(data):
    assert 10 <= len(data["orders"]) <= 15
    assert {o["status"] for o in data["orders"]} == {"paid", "pending", "failed", "cancelled", "refunded"}
    assert any(o.get("checkedInAt") for o in data["orders"])


def test_no_passwords_in_seed_data():
    raw = seed_module.DATA_FILE.read_text(encoding="utf-8").lower()
    assert '"password"' not in raw and "password_hash" not in raw


def test_validate_rejects_capacity_mismatch(data):
    bad = copy.deepcopy(data)
    bad["concerts"][0]["tiers"][0]["capacity"] += 1
    with pytest.raises(SeedDataError, match="ticketCapacity"):
        validate(bad)


def test_validate_rejects_double_sold_seat(data):
    bad = copy.deepcopy(data)
    paid = next(o for o in bad["orders"] if o["status"] == "paid")
    clone = copy.deepcopy(paid)
    clone["orderNumber"] = 19999
    bad["orders"].append(clone)
    with pytest.raises(SeedDataError, match="already sold"):
        validate(bad)


def test_row_labels():
    assert [seed_module.row_label(i) for i in (0, 25, 26, 27, 51, 52)] == ["A", "Z", "AA", "AB", "AZ", "BA"]
    assert len(set(seat_labels(450))) == 450


# ------------------------------------------------------------------- seeding the DB


def test_seed_twice_creates_no_duplicates(db, data):
    first = run_seed(db, data)
    counts = table_counts()
    second = run_seed(db, data)

    assert first["concerts"] == 11 and first["users"] == 3
    assert first["orders"] == len(data["orders"])
    assert second == {}
    assert table_counts() == counts
    assert counts["seats"] == sum(c["ticketCapacity"] for c in data["concerts"])


def test_database_matches_seed_data(db, data):
    run_seed(db, data)
    assert db.execute(text("SELECT array_agg(id ORDER BY id) FROM concerts")).scalar_one() == list(range(1, 12))
    rows = db.execute(
        text(
            "SELECT c.id, z.name, z.capacity, count(s.id) FROM concerts c "
            "JOIN zones z ON z.concert_id = c.id LEFT JOIN seats s ON s.zone_id = z.id "
            "GROUP BY c.id, z.name, z.capacity"
        )
    ).all()
    by_concert = {}
    for cid, name, capacity, seats in rows:
        assert seats == capacity, (cid, name)
        by_concert.setdefault(cid, {})[name] = capacity
    for concert in data["concerts"]:
        assert by_concert[concert["id"]] == {t["name"]: t["capacity"] for t in concert["tiers"]}
    # new concerts created by the app must not collide with the seeded ids
    assert scalar("SELECT nextval(pg_get_serial_sequence('concerts','id'))") == 12


def test_seeded_orders_are_consistent(db, data):
    run_seed(db, data)
    statuses = dict(db.execute(text("SELECT order_number, status FROM orders")).all())
    assert set(statuses.values()) == {"paid", "pending", "failed", "cancelled"}
    # order totals equal the sum of the tier prices of their seats
    for spec in data["orders"]:
        prices = {t["name"]: t["price"] for c in data["concerts"] if c["id"] == spec["concertId"] for t in c["tiers"]}
        total = scalar("SELECT total_amount FROM orders WHERE order_number = :n", n=spec["orderNumber"])
        assert total == sum(prices[s["tier"]] for s in spec["seats"])
    # every valid/used ticket sits on a sold seat; refunded tickets do not hold a seat
    assert scalar(
        "SELECT count(*) FROM tickets t JOIN seats s ON s.id = t.seat_id "
        "WHERE t.status IN ('valid','used') AND s.status <> 'sold'"
    ) == 0
    assert scalar(
        "SELECT count(*) FROM tickets t JOIN orders o ON o.id = t.order_id "
        "WHERE o.payment_status = 'refunded' AND t.status <> 'refunded'"
    ) == 0
    assert scalar("SELECT count(*) FROM tickets WHERE status = 'refunded'") > 0
    assert scalar("SELECT count(*) FROM tickets WHERE status = 'used' AND checked_in_at IS NOT NULL") > 0
    # pending / failed / unpaid-cancelled orders have no tickets
    assert scalar(
        "SELECT count(*) FROM tickets t JOIN orders o ON o.id = t.order_id WHERE o.payment_status IN ('unpaid','failed')"
    ) == 0
    # sample order numbers never collide with the live order sequence
    assert scalar("SELECT max(order_number) FROM orders") < 10483


def test_sold_out_tiers_have_no_available_seats(db, data):
    run_seed(db, data)
    for concert in data["concerts"]:
        for tier in concert["tiers"]:
            available = scalar(
                "SELECT count(*) FROM seats s JOIN zones z ON z.id = s.zone_id "
                "WHERE z.concert_id = :c AND z.name = :n AND s.status = 'available'",
                c=concert["id"],
                n=tier["name"],
            )
            assert (available == 0) == bool(tier.get("soldOut")), (concert["slug"], tier["name"])


def test_accounts_and_passwords(db, data):
    run_seed(db, data)
    roles = dict(db.execute(text("SELECT email, role FROM users")).all())
    assert roles["admin@concertly.dev"] == "admin"
    assert sorted(r for r in roles.values() if r == "customer") == ["customer", "customer"]
    admin_hash = scalar("SELECT password_hash FROM users WHERE email = 'admin@concertly.dev'")
    assert bcrypt.checkpw(b"admin-secret-1", admin_hash.encode())


def test_missing_password_env_generates_random_password(db, data):
    printed = []
    seed_module.seed(db, data, env={}, out=printed.append)
    db.commit()
    line = next(p for p in printed if "admin@concertly.dev" in p)
    password = line.rsplit("password: ", 1)[1].rstrip(")")
    assert len(password) >= 12
    stored = scalar("SELECT password_hash FROM users WHERE email = 'admin@concertly.dev'")
    assert bcrypt.checkpw(password.encode(), stored.encode())


def test_rerun_does_not_overwrite_application_changes(db, data):
    run_seed(db, data)
    db.execute(text("UPDATE users SET password_hash = 'changed' WHERE role = 'admin'"))
    db.execute(text("UPDATE concerts SET title = 'Edited', status = 'cancelled' WHERE id = 1"))
    db.execute(text("UPDATE orders SET status = 'cancelled' WHERE order_number = 10001"))
    db.commit()
    run_seed(db, data, env={"SEED_ADMIN_PASSWORD": "other"})
    assert scalar("SELECT password_hash FROM users WHERE role = 'admin'") == "changed"
    assert scalar("SELECT title || '/' || status FROM concerts WHERE id = 1") == "Edited/cancelled"
    assert scalar("SELECT status FROM orders WHERE order_number = 10001") == "cancelled"


def test_rerun_fills_in_missing_rows(db, data):
    run_seed(db, data)
    db.execute(text("DELETE FROM seats WHERE id IN (SELECT id FROM seats WHERE status = 'available' LIMIT 5)"))
    db.commit()
    assert run_seed(db, data) == {"seats": 5}


def test_without_sample_orders(db, data):
    created = run_seed(db, data, sample_orders=False)
    assert created["users"] == 1 and "orders" not in created
    assert scalar("SELECT count(*) FROM orders") == 0
    assert scalar("SELECT count(*) FROM users WHERE role = 'admin'") == 1


def test_invalid_data_writes_nothing(db, data):
    bad = copy.deepcopy(data)
    bad["orders"][0]["concertId"] = 999
    with pytest.raises(SeedDataError):
        seed_module.seed(db, bad, env=ENV, out=lambda *_: None)
    db.rollback()
    assert table_counts() == {t: 0 for t in ("users", "concerts", "zones", "seats", "orders", "tickets")}


def test_cli_check_does_not_touch_database(capsys):
    assert seed_module.main(["--check"]) == 0
    assert "is valid" in capsys.readouterr().out


@pytest.mark.parametrize('change', [
    lambda d:d.update(concerts=None),
    lambda d:d['concerts'][0]['tiers'][0].update(capacity=True),
    lambda d:d['concerts'][0]['tiers'][0].update(price='80'),
    lambda d:d['orders'][0].pop('createdAt'),
    lambda d:d['orders'][0].update(createdAt='not-a-date'),
    lambda d:d['orders'][0].update(paymentMethod='unsupported'),
    lambda d:d['orders'][0]['seats'].append(copy.deepcopy(d['orders'][0]['seats'][0])),
    lambda d:d['orders'][0].update(seats=[{'tier':d['concerts'][0]['tiers'][0]['name'],'row':'A','seat':i} for i in range(1,8)]),
    lambda d:d['concerts'][0]['tiers'][0].update(name='Wrong venue zone'),
    lambda d:d['concerts'][0]['tiers'][0].update(price=81),
    lambda d:d['demoExpectations'].update(totalRevenue=-1),
])
def test_validate_rejects_malformed_or_inconsistent_demo(data, change):
    bad=copy.deepcopy(data);change(bad)
    with pytest.raises(SeedDataError):validate(bad)


def test_mock_capacity_and_every_svg_section_price_match(data):
    mock=(REPO/'js/mock-data.js').read_text()
    blocks=re.split(r'\n\s*id:\s*"',mock)[1:]
    capacities={b.split('"',1)[0]:int(re.search(r'ticketCapacity:\s*(\d+)',b).group(1)) for b in blocks}
    for concert in data['concerts']:
        assert capacities[concert['slug']]==concert['ticketCapacity']
        source=(REPO/'js/venues'/f"{concert['slug']}-map.js").read_text()
        sections=re.findall(r'\bname\s*:\s*"([^"\n]+)".*?\bprice\s*:\s*"\$(\d+)"',source,re.S)
        prices={t['name']:t['price'] for t in concert['tiers']}
        assert sections and all(prices[name]==int(price) for name,price in sections)


def test_demo_dashboard_expected_totals(db, data):
    from app.services.admin import stats, concert_stats
    run_seed(db,data)
    expected=data['demoExpectations']
    report=stats(db)
    assert {k:report[k] for k in ['totalConcerts','totalOrders','ticketsSold','totalRevenue']} == {k:expected[k] for k in ['totalConcerts','totalOrders','ticketsSold','totalRevenue']}
    from fastapi.testclient import TestClient
    from app.main import app
    admin_id=scalar("SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1")
    with TestClient(app) as client:
        headers={'X-User-Id':str(admin_id)}
        response=client.get('/api/admin/stats',headers=headers)
        assert response.status_code==200
        assert all(response.json()[k]==expected[k] for k in ['totalConcerts','totalOrders','ticketsSold','totalRevenue'])
        page=client.get('/api/admin/orders',headers=headers)
        assert page.status_code==200 and page.json()['total']==14
        assert len(page.json()['items'])==14
        summary=client.get('/api/admin/stats/concerts',headers=headers)
        assert summary.status_code==200 and len(summary.json())==11
    assert sum(c['capacity'] for c in concert_stats(db))==expected['totalCapacity']
    assert table_counts()['zones']==expected['totalZones']


def test_seed_does_not_update_unrelated_concert_status(db, data):
    from app.models import Concert,Zone,Seat
    from datetime import datetime,timedelta,timezone
    other=Concert(id=999,title='User event',artist='User',venue='Venue',city='City',starts_at=datetime.now(timezone.utc)+timedelta(days=30),status='on_sale')
    db.add(other);db.flush()
    zone=Zone(concert_id=999,name='User tier',price=50,capacity=1);db.add(zone);db.flush()
    db.add(Seat(zone_id=zone.id,row_label='A',seat_number=1,status='sold'));db.commit()
    run_seed(db,data)
    assert scalar('SELECT status FROM concerts WHERE id=999')=='on_sale'
    assert run_seed(db,data)=={}


def test_rerun_preserves_password_ticket_code_and_checkin(db, data):
    run_seed(db,data)
    before=db.execute(text('SELECT id,password_hash FROM users ORDER BY id')).all()
    tickets=db.execute(text('SELECT id,ticket_code,status,checked_in_at FROM tickets ORDER BY id')).all()
    assert run_seed(db,data)=={}
    assert db.execute(text('SELECT id,password_hash FROM users ORDER BY id')).all()==before
    assert db.execute(text('SELECT id,ticket_code,status,checked_in_at FROM tickets ORDER BY id')).all()==tickets
