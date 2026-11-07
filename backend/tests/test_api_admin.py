"""Admin statistics and order management API (#35) and JWT authentication."""
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app
from app.models import Concert, Order, Seat, Ticket, Zone
from app.security import create_access_token
from tests.conftest import bearer, make_user, scalar

ENDPOINTS = ("/api/admin/stats", "/api/admin/orders", "/api/admin/orders/1")


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def admin(db):
    return make_user(db, "boss@test.dev", role="admin")


def add_concert(db, title, days, status):
    c = Concert(
        title=title,
        artist=f"{title} Artist",
        venue="Hall",
        city="Hanoi",
        starts_at=datetime.now(timezone.utc) + timedelta(days=days),
        status=status,
    )
    db.add(c)
    db.commit()
    return c.id


def add_order(db, user_id, concert_id, seat_ids, status, created_minutes_ago=0, used=False):
    """Insert an order in a given lifecycle state, like checkout/cancel would leave it."""
    prices = [db.execute(text("SELECT z.price FROM seats s JOIN zones z ON z.id = s.zone_id WHERE s.id = :i"), {"i": s}).scalar_one() for s in seat_ids]
    total = sum(prices)
    now = datetime.now(timezone.utc) - timedelta(minutes=created_minutes_ago)
    paid = status in ("paid", "refunded")
    order = Order(
        user_id=user_id,
        concert_id=concert_id,
        total_amount=total,
        status="cancelled" if status == "refunded" else status,
        payment_method="card",
        payment_status={"paid": "paid", "refunded": "refunded", "failed": "failed"}.get(status, "unpaid"),
        paid_at=now if paid else None,
        refund_status="refunded" if status == "refunded" else "none",
        refund_amount=total if status == "refunded" else 0,
        refunded_at=now if status == "refunded" else None,
        created_at=now,
    )
    db.add(order)
    db.flush()
    if paid:
        for i, (seat_id, price) in enumerate(zip(seat_ids, prices)):
            used_now = used and i == 0
            db.add(
                Ticket(
                    order_id=order.id,
                    concert_id=concert_id,
                    seat_id=seat_id,
                    ticket_code=f"T-{order.id}-{seat_id}",
                    price=price,
                    status="refunded" if status == "refunded" else ("used" if used_now else "valid"),
                    checked_in_at=now if used_now else None,
                )
            )
            if status == "paid":
                db.get(Seat, seat_id).status = "sold"
    db.commit()
    return order.id


@pytest.fixture
def shop(db, users, concert, seat_ids, admin):
    """Concerts: the on-sale fixture (+30d), a past completed one, a future draft, a
    future sold-out one and a future cancelled one. Orders of users a and b."""
    past = add_concert(db, "Past Show", -10, "completed")
    add_concert(db, "Draft Show", 40, "draft")
    add_concert(db, "Sold Out Show", 50, "sold_out")
    add_concert(db, "Cancelled Show", 60, "cancelled")
    zone = Zone(concert_id=past, name="GA", price=500, capacity=2)
    db.add(zone)
    db.flush()
    db.add_all([Seat(zone_id=zone.id, row_label="A", seat_number=n) for n in (1, 2)])
    db.commit()
    past_seats = list(db.execute(text("SELECT s.id FROM seats s WHERE s.zone_id = :z ORDER BY s.id"), {"z": zone.id}).scalars())

    ids = {
        # VIP seats cost 1000, GA seats 300 (see conftest.concert)
        "paid": add_order(db, users["a"], concert, seat_ids[:2], "paid", created_minutes_ago=50),
        "refunded": add_order(db, users["a"], concert, seat_ids[10:11], "refunded", created_minutes_ago=40),
        "pending": add_order(db, users["b"], concert, seat_ids[11:12], "pending", created_minutes_ago=30),
        "failed": add_order(db, users["b"], concert, seat_ids[12:13], "failed", created_minutes_ago=20),
        "past": add_order(db, users["b"], past, past_seats, "paid", created_minutes_ago=10, used=True),
    }
    return {"orders": ids, "concert": concert, "past": past}


# ------------------------------------------------------------------ authentication


@pytest.mark.parametrize("path", ENDPOINTS)
def test_missing_token_is_401(client, path):
    r = client.get(path)
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "unauthenticated"
    assert r.headers["www-authenticate"] == "Bearer"


@pytest.mark.parametrize("path", ENDPOINTS)
def test_customer_and_staff_get_403(client, db, users, path):
    for who in ("a", "staff"):
        r = client.get(path, headers=bearer(db, users[who]))
        assert r.status_code == 403, who
        assert r.json()["error"]["code"] == "forbidden"


def test_invalid_expired_and_unknown_tokens_are_401(client, db, admin):
    bad = [
        "not-a-jwt",
        create_access_token("boss@test.dev", expires_in=timedelta(seconds=-5)),
        create_access_token("ghost@test.dev"),
    ]
    for token in bad:
        r = client.get("/api/admin/stats", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 401, token
    db.execute(text("UPDATE users SET is_active = false WHERE id = :i"), {"i": admin})
    db.commit()
    assert client.get("/api/admin/stats", headers=bearer(db, admin)).status_code == 401


def test_token_signed_with_another_secret_is_401(client, admin, monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "some-other-secret-of-sufficient-length")
    forged = create_access_token("boss@test.dev")
    monkeypatch.setenv("JWT_SECRET", "test-only-jwt-secret-not-used-anywhere-else")
    assert client.get("/api/admin/stats", headers={"Authorization": f"Bearer {forged}"}).status_code == 401


def test_dev_header_is_ignored_unless_enabled(client, admin, monkeypatch):
    monkeypatch.delenv("ALLOW_DEV_USER_HEADER")
    r = client.get("/api/admin/stats", headers={"X-User-Id": str(admin)})
    assert r.status_code == 401


def test_admin_token_is_accepted_case_insensitively(client, admin):
    token = create_access_token("BOSS@test.dev")
    assert client.get("/api/admin/stats", headers={"Authorization": f"Bearer {token}"}).status_code == 200


def test_customer_endpoints_accept_bearer_tokens(client, db, users):
    assert client.get("/api/orders", headers=bearer(db, users["a"])).status_code == 200


# -------------------------------------------------------------------------- stats


def test_stats_follow_business_rules(client, db, shop, admin):
    r = client.get("/api/admin/stats", headers=bearer(db, admin))
    assert r.status_code == 200
    assert r.json() == {
        "totalConcerts": 5,
        "ticketsSold": 4,  # 2 paid VIP + 2 on the past show (one used); refunded excluded
        "totalOrders": 5,
        "totalRevenue": 2000 + 1000,  # paid orders only; refunded/pending/failed excluded
        "upcomingConcerts": 2,  # on-sale fixture + sold-out; not draft/cancelled/past
        "checkinsToday": scalar(
            "SELECT count(*) FROM tickets WHERE status = 'used' AND checked_in_at >= date_trunc('day', now())"
        ),
    }


def test_stats_on_empty_database(client, db, admin):
    assert client.get("/api/admin/stats", headers=bearer(db, admin)).json() == {
        "totalConcerts": 0,
        "ticketsSold": 0,
        "totalOrders": 0,
        "totalRevenue": 0,
        "upcomingConcerts": 0,
        "checkinsToday": 0,
    }


def test_stats_track_checkout_and_cancellation(client, db, users, concert, seat_ids, admin):
    a, boss = bearer(db, users["a"]), bearer(db, admin)
    hold = client.post("/api/reservations", json={"concert_id": concert, "seat_ids": seat_ids[:3]}, headers=a).json()
    order = client.post("/api/checkout", json={"reservation_id": hold["id"], "payment_method": "card"}, headers=a).json()
    s = client.get("/api/admin/stats", headers=boss).json()
    assert (s["ticketsSold"], s["totalOrders"], s["totalRevenue"]) == (3, 1, 3000)

    assert client.post(f"/api/orders/{order['id']}/cancel", headers=a).status_code == 200
    s = client.get("/api/admin/stats", headers=boss).json()
    assert (s["ticketsSold"], s["totalOrders"], s["totalRevenue"]) == (0, 1, 0)


def test_stats_match_seeded_database(client, db):
    from scripts import seed as seed_module

    seed_module.seed(db, seed_module.load_data(), env={}, out=lambda *_: None)
    db.commit()
    admin = scalar("SELECT id FROM users WHERE role = 'admin'")
    s = client.get("/api/admin/stats", headers=bearer(db, admin)).json()
    assert s["totalConcerts"] == 11
    assert s["totalOrders"] == scalar("SELECT count(*) FROM orders")
    assert s["ticketsSold"] == scalar("SELECT count(*) FROM tickets WHERE status IN ('valid','used')")
    assert s["totalRevenue"] == scalar("SELECT coalesce(sum(total_amount),0) FROM orders WHERE payment_status='paid'")
    assert s["upcomingConcerts"] == scalar("SELECT count(*) FROM concerts WHERE starts_at > now() AND status IN ('on_sale','sold_out')")


# ------------------------------------------------------------------------- orders


def list_orders(client, db, admin, **params):
    r = client.get("/api/admin/orders", params=params, headers=bearer(db, admin))
    assert r.status_code == 200, r.text
    return r.json()


def test_list_orders_newest_first_with_customer(client, db, shop, admin, users):
    page = list_orders(client, db, admin)
    assert page["total"] == 5 and page["pages"] == 1 and page["page"] == 1
    ids = [o["id"] for o in page["items"]]
    o = shop["orders"]
    assert ids == [o["past"], o["failed"], o["pending"], o["refunded"], o["paid"]]
    first = page["items"][-1]
    assert first["customer"] == {"id": users["a"], "email": "a@test.dev", "full_name": "a"}
    assert first["ticket_count"] == 2 and first["total_amount"] == 2000


def test_list_orders_pagination(client, db, shop, admin):
    pages = [list_orders(client, db, admin, page=p, page_size=2) for p in (1, 2, 3, 4)]
    assert [len(p["items"]) for p in pages] == [2, 2, 1, 0]
    assert all(p["total"] == 5 and p["pages"] == 3 for p in pages)
    seen = [o["id"] for p in pages for o in p["items"]]
    assert len(set(seen)) == 5


def test_list_orders_filters(client, db, shop, admin):
    o = shop["orders"]

    def ids(**params):
        return sorted(x["id"] for x in list_orders(client, db, admin, **params)["items"])

    assert ids(status="paid") == sorted([o["paid"], o["past"]])
    assert ids(status="pending") == [o["pending"]]
    assert ids(status="failed") == [o["failed"]]
    assert ids(status="refunded") == [o["refunded"]]
    assert ids(status="cancelled") == [o["refunded"]]
    assert ids(concert_id=shop["past"]) == [o["past"]]
    assert ids(status="paid", concert_id=shop["concert"]) == [o["paid"]]
    assert ids(q="b@test") == sorted([o["pending"], o["failed"], o["past"]])
    assert ids(q="past show") == [o["past"]]
    assert ids(q="TESTER") == sorted([o["paid"], o["refunded"], o["pending"], o["failed"]])
    number = scalar("SELECT order_number FROM orders WHERE id = :i", i=o["paid"])
    assert ids(q=f"#{number}") == [o["paid"]]
    assert ids(q="%") == [] and ids(q="_") == []  # LIKE wildcards are matched literally
    assert ids(q="nobody") == []


def test_list_orders_rejects_bad_parameters(client, db, admin):
    h = bearer(db, admin)
    for params in ({"status": "shipped"}, {"page": 0}, {"page_size": 101}, {"concert_id": "x"}):
        r = client.get("/api/admin/orders", params=params, headers=h)
        assert r.status_code == 422, params
        assert r.json()["error"]["code"] == "validation_error"


def test_order_detail_includes_customer_and_tickets(client, db, shop, admin, users):
    db.execute(text("UPDATE users SET phone = '0900000000' WHERE id = :i"), {"i": users["a"]})
    db.commit()
    r = client.get(f"/api/admin/orders/{shop['orders']['paid']}", headers=bearer(db, admin))
    assert r.status_code == 200
    d = r.json()
    assert d["customer"] == {"id": users["a"], "email": "a@test.dev", "full_name": "a", "phone": "0900000000"}
    assert d["status"] == "paid" and d["payment_status"] == "paid" and d["total_amount"] == 2000
    assert [(t["zone"], t["row"], t["price"], t["status"]) for t in d["tickets"]] == [
        ("VIP", "A", 1000, "valid"),
        ("VIP", "A", 1000, "valid"),
    ]
    assert all(t["ticket_code"] for t in d["tickets"])

    refunded = client.get(f"/api/admin/orders/{shop['orders']['refunded']}", headers=bearer(db, admin)).json()
    assert refunded["refund_status"] == "refunded" and refunded["refund_amount"] == 300
    assert refunded["tickets"][0]["status"] == "refunded"


def test_order_detail_404(client, db, admin):
    r = client.get("/api/admin/orders/999999", headers=bearer(db, admin))
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "not_found"


# ----------------------------------------------------------- per-concert stats (#38)


def test_checkins_today_counts_only_today(client, db, shop, admin):
    db.execute(text("UPDATE tickets SET checked_in_at = now() WHERE status = 'used'"))
    db.commit()
    assert client.get("/api/admin/stats", headers=bearer(db, admin)).json()["checkinsToday"] == 1
    db.execute(text("UPDATE tickets SET checked_in_at = now() - interval '2 days' WHERE status = 'used'"))
    db.commit()
    assert client.get("/api/admin/stats", headers=bearer(db, admin)).json()["checkinsToday"] == 0


def test_concert_stats(client, db, shop, admin):
    r = client.get("/api/admin/stats/concerts", headers=bearer(db, admin))
    assert r.status_code == 200
    rows = {c["id"]: c for c in r.json()}
    assert len(rows) == 5
    main = rows[shop["concert"]]
    assert (main["capacity"], main["ticketsSold"], main["checkedIn"], main["revenue"], main["upcoming"]) == (15, 2, 0, 2000, True)
    past = rows[shop["past"]]
    assert (past["capacity"], past["ticketsSold"], past["checkedIn"], past["revenue"], past["upcoming"]) == (2, 2, 1, 1000, False)
    titles = {c["title"]: c for c in rows.values()}
    assert titles["Draft Show"]["upcoming"] is False and titles["Sold Out Show"]["upcoming"] is True
    assert titles["Draft Show"]["capacity"] == 0 and titles["Draft Show"]["revenue"] == 0
    # soonest first
    starts = [c["starts_at"] for c in r.json()]
    assert starts == sorted(starts)
    # totals agree with the dashboard figures
    totals = client.get("/api/admin/stats", headers=bearer(db, admin)).json()
    assert sum(c["revenue"] for c in rows.values()) == totals["totalRevenue"]
    assert sum(c["ticketsSold"] for c in rows.values()) == totals["ticketsSold"]
    assert sum(c["upcoming"] for c in rows.values()) == totals["upcomingConcerts"]


def test_concert_stats_requires_admin(client, db, users):
    assert client.get("/api/admin/stats/concerts").status_code == 401
    assert client.get("/api/admin/stats/concerts", headers=bearer(db, users["a"])).status_code == 403
