"""Independent SQL/API reconciliation for #56, using an isolated seed snapshot."""
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app
from scripts.seed import load_data
from tests.test_seed import run_seed

SQL = Path(__file__).resolve().parents[2] / 'docs/dashboard-reconciliation.sql'


def test_dashboard_matches_read_only_snapshot(db):
    data = load_data()
    run_seed(db, data)
    # Execute the documented oracle itself, in a separate read-only snapshot.
    queries = [q.strip() for q in SQL.read_text().split(';') if q.strip()]
    with db.bind.connect() as conn:
        results = []
        for query in queries:
            result = conn.execute(text(query))
            if result.returns_rows:
                results.append([dict(row) for row in result.mappings()])
    clock, metrics, concerts, orders, blocked, inconsistent = results
    assert clock[0]['database_timezone']
    admin = db.execute(text("SELECT id FROM users WHERE role='admin'")).scalar_one()
    with TestClient(app) as client:
        headers = {'X-User-Id': str(admin)}
        response = client.get('/api/admin/stats', headers=headers)
        assert response.status_code == 200
        actual = response.json()
        assert actual == metrics[0]
        response = client.get('/api/admin/stats/concerts', headers=headers)
        assert response.status_code == 200
        by_id = {c['id']: c for c in response.json()}
    for row in concerts:
        api = by_id[row['id']]
        for key, column in [('capacity','capacity'), ('ticketsSold','tickets_sold'),
                            ('revenue','revenue'), ('checkedIn','checked_in'), ('upcoming','upcoming'),
                            ('availableInventory','available_inventory'),
                            ('heldInventory','held_inventory'), ('soldInventory','sold_inventory')]:
            assert api[key] == row[column]
    assert sum(c['revenue'] for c in concerts) == actual['totalRevenue']
    assert sum(c['tickets_sold'] for c in concerts) == actual['ticketsSold']
    assert sum(c['upcoming'] for c in concerts) == actual['upcomingConcerts']
    assert sum(c['capacity'] for c in concerts) == 7200
    assert len(orders) == 11 and all(o['amount_matches'] for o in orders)
    assert not inconsistent
    expected_blocked = sum(t['capacity'] for c in data['concerts'] for t in c['tiers'] if t.get('soldOut'))
    assert sum(z['sold_without_active_ticket'] for z in blocked) == expected_blocked
    assert sum(c['sold_inventory'] for c in concerts) == actual['ticketsSold'] + expected_blocked
    print('RECONCILIATION', dict(actual), 'blocked_seed_inventory=', expected_blocked,
          'sold_inventory=', sum(c['sold_inventory'] for c in concerts))
