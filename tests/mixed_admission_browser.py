"""Real-browser mixed admission tests. See browser_qa.py for local prerequisites."""
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.parse
import uuid

import psycopg2
from psycopg2 import sql

from seat_map_ux_browser import run_ux_checks
from browser_qa import Browser, request, login, API, ROOT, QA_PORT, open_zone

ARTIFACTS = Path('/private/tmp/concertly-mixed-qa')
ARTIFACTS.mkdir(exist_ok=True)
BUYER = {'full_name': 'QA Buyer', 'email': 'qa@example.com', 'phone': '0912345678'}


def main():
    name = 'concertly_mixed_browser_test_' + uuid.uuid4().hex[:8]
    admin = psycopg2.connect(host='127.0.0.1', port=55439, user='concertly_qa', dbname='postgres')
    admin.autocommit = True
    with admin.cursor() as cur:
        cur.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(name)))
    db = psycopg2.connect(host='127.0.0.1', port=55439, user='concertly_qa', dbname=name)
    with db.cursor() as cur:
        cur.execute((ROOT / 'backend/schema.sql').read_text())
    db.commit()
    env = dict(os.environ, DATABASE_URL=f'postgresql+psycopg2://concertly_qa@127.0.0.1:55439/{name}',
               JWT_SECRET='qa-only-mixed-admission-local-secret-not-production', DISABLE_SWEEPER='1',
               PYTHONDONTWRITEBYTECODE='1', SEED_ADMIN_PASSWORD='qa-only-password-123', SEED_USER_PASSWORD='qa-only-password-123')
    subprocess.run([sys.executable, '-B', 'scripts/seed.py'], cwd=ROOT / 'backend', env=env, check=True, capture_output=True)
    with db.cursor() as cur:
        cur.execute("UPDATE concerts SET starts_at=now()+interval '30 days',sale_start_at=now()-interval '1 day',status='on_sale'")
    db.commit()
    log = (ARTIFACTS / 'backend.log').open('w')
    server = subprocess.Popen([sys.executable, '-B', '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', QA_PORT], cwd=ROOT / 'backend', env=env, stdout=log, stderr=log)
    results = {'flows': [], 'viewports': [], 'concerts': [], 'errors': []}
    browser = None
    try:
        for _ in range(100):
            try:
                if request('/health')[0] == 200: break
            except OSError: time.sleep(.1)
        else: raise RuntimeError('Backend failed to start')
        session = login('minhanh@concertly.dev')
        # A second seeded customer performs the competing hold through the real API.
        with db.cursor() as cur:
            cur.execute("SELECT email FROM users WHERE role='customer' AND email <> 'minhanh@concertly.dev' LIMIT 1")
            other = login(cur.fetchone()[0])
        token = session['access_token']
        browser = Browser()
        browser.call('Page.addScriptToEvaluateOnNewDocument', {'source': f'window.CONCERTLY_API_BASE={json.dumps(API)};'})
        browser.navigate('index.html')
        browser.evaluate(f'localStorage.setItem("token",{json.dumps(token)});localStorage.setItem("concertlyUser","QA Buyer");localStorage.setItem("userRole","customer")')
        browser.navigate("pages/concerts/tickets.html?id=c1")
        open_zone(browser,"Standard Tier 1")
        results["geometry"] = browser.evaluate((ROOT / "tests/seat-geometry.browser.js").read_text())
        results["ux"] = run_ux_checks(browser,ARTIFACTS)
        # Check every concert against its explicit demo configuration in PostgreSQL/API.
        for cid in range(1, 12):
            status, data = request(f'/concerts/{cid}/seats', token)
            assert status == 200
            modes = {z['booking_type'] for z in data['zones']}
            assert modes == ({'standing'} if cid == 8 else {'seated', 'standing'})
            assert all(not z['seats'] for z in data['zones'] if z['booking_type'] == 'standing')
            results['concerts'].append({'id': cid, 'seated': [z['name'] for z in data['zones'] if z['booking_type']=='seated'], 'standing': [z['name'] for z in data['zones'] if z['booking_type']=='standing']})
        # Pay for preserved seats from two SVG fragments, excluding another category's draft.
        browser.navigate('pages/concerts/tickets.html?id=c1')
        saved=[]
        for fragment in ['c1-left-bowl','c1-right-bowl']:
            open_zone(browser,'Standard Tier 2',fragment)
            seat=browser.evaluate('document.querySelector(".seat:not(:disabled)").dataset.id')
            saved.append(int(seat));browser.click(f'.seat[data-id="{seat}"]')
            browser.click('#change-zone')
        open_zone(browser,'Standard Tier 1');browser.click('.seat:not(:disabled)')
        browser.click('#change-zone');open_zone(browser,'Standard Tier 2','c1-right-bowl')
        assert browser.evaluate('document.getElementById("quantity").textContent==="2"')
        browser.click('#continue-payment')
        browser.wait('location.pathname.endsWith("/checkout/index.html") && !document.getElementById("confirm-payment").disabled')
        snapshot=browser.evaluate('JSON.parse(localStorage.getItem("checkoutData"))')
        assert sorted(s['id'] for s in snapshot['seats'])==sorted(saved)
        fill='document.getElementById("buyer-name").value="QA Buyer";document.getElementById("buyer-email").value="qa@example.com";document.getElementById("buyer-phone").value="0912345678";document.getElementById("payment-method").value="card";'
        browser.evaluate(fill);browser.click('#confirm-payment')
        browser.wait('location.pathname.endsWith("/order-detail.html") && document.querySelector(".line-ticket")!==null')
        oid=browser.evaluate('new URLSearchParams(location.search).get("id")')
        _, paid=request(f'/orders/{oid}',token)
        assert len(paid['tickets'])==2 and all(t['zone']=='Standard Tier 2' and t['qr_data']==t['ticket_code'] for t in paid['tickets'])
        with db.cursor() as cur:
            cur.execute('SELECT seat_id FROM tickets WHERE order_id=%s',(oid,))
            assert sorted(r[0] for r in cur.fetchall())==sorted(saved)
        results['flows'].append('Preserved choices across two fragments -> checkout exactly those 2 IDs -> paid order, unchanged QR; other category draft excluded')
        browser.navigate('pages/concerts/tickets.html?id=c1')
        open_zone(browser,'VIP Diamond Experience')
        browser.evaluate('for(let i=0;i<12;i++)document.getElementById("plus").click()')
        assert browser.evaluate('document.getElementById("quantity").textContent==="8"')
        # Real Standing order from the browser.
        browser.click('#continue-payment')
        browser.wait('location.pathname.endsWith("/checkout/index.html") && !document.getElementById("confirm-payment").disabled')
        assert browser.evaluate('document.getElementById("held-items").textContent.includes("Standing") && !document.getElementById("held-items").textContent.includes("Row")')
        fill = 'document.getElementById("buyer-name").value="QA Buyer";document.getElementById("buyer-email").value="qa@example.com";document.getElementById("buyer-phone").value="0912345678";document.getElementById("payment-method").value="card";'
        browser.evaluate(fill); browser.click('#confirm-payment')
        browser.wait('location.pathname.endsWith("/order-detail.html") && document.querySelector(".line-ticket")!==null')
        oid = browser.evaluate('new URLSearchParams(location.search).get("id")')
        _, order = request(f'/orders/{oid}', token)
        assert len(order['tickets'])==8 and all(t['booking_type']=='standing' and t['row'] is None and t['seat_number'] is None for t in order['tickets'])
        standing_ticket = order['tickets'][0]
        browser.navigate(f'pages/me/ticket-detail.html?id={standing_ticket["id"]}')
        browser.wait('document.querySelector(".digital-ticket-qr img")?.naturalWidth>0')
        assert browser.evaluate('document.querySelector(".digital-ticket-facts").textContent.includes("Standing (no assigned seat)")')
        results['flows'].append('Standing: quantity -> real hold -> checkout -> 8 issued tickets -> QR, no assigned rows or seats')
        # API-created hold by another customer renders Held and cannot be selected.
        _, data = request('/concerts/1/seats', token)
        zone = next(z for z in data['zones'] if z['name']=='Standard Tier 2')
        chosen = [s['id'] for s in zone['seats'] if s['status']=='available'][:2]
        _, other_hold = request('/reservations', other['access_token'], {'concert_id':1,'seat_ids':chosen[:1]})
        browser.navigate('pages/concerts/tickets.html?id=c1&ticketType=Standard%20Tier%202')
        open_zone(browser,'Standard Tier 2')
        browser.wait(f'document.querySelector(\'.seat[data-id="{chosen[0]}"]\')?.classList.contains("held")')
        assert browser.evaluate(f'document.querySelector(\'.seat[data-id="{chosen[0]}"]\').disabled')
        # Buying the same held seat is rejected; no fake fallback.
        assert request('/reservations',token,{'concert_id':1,'seat_ids':chosen[:1]})[0]==409
        with db.cursor() as cur:
            cur.execute("UPDATE reservations SET created_at=now()-interval '10 minutes',expires_at=now()-interval '1 minute' WHERE id=%s",(other_hold['id'],))
            cur.execute("UPDATE seats SET held_until=now()-interval '1 minute' WHERE reservation_id=%s",(other_hold['id'],))
        db.commit()
        browser.click('#retry-seats')
        browser.wait(f'document.querySelector(\'.seat[data-id="{chosen[0]}"]\')?.classList.contains("available")')
        browser.click(f'.seat[data-id="{chosen[0]}"]')
        browser.click('#continue-payment')
        browser.wait('location.pathname.endsWith("/checkout/index.html") && !document.getElementById("confirm-payment").disabled')
        assert browser.evaluate('document.getElementById("held-items").textContent.includes("Row") && document.getElementById("held-items").textContent.includes("Seat")')
        browser.evaluate(fill); browser.click('#confirm-payment')
        browser.wait('location.pathname.endsWith("/order-detail.html") && document.querySelector(".line-ticket")!==null')
        oid = browser.evaluate('new URLSearchParams(location.search).get("id")')
        _, order = request(f'/orders/{oid}',token)
        ticket = order['tickets'][0]
        assert ticket['booking_type']=='seated' and ticket['row'] and ticket['seat_number']
        browser.navigate(f'pages/me/ticket-detail.html?id={ticket["id"]}')
        browser.wait('document.querySelector(".digital-ticket-qr img")?.naturalWidth>0')
        assert browser.evaluate('document.querySelector(".digital-ticket-facts").textContent.includes("Row")')
        browser.navigate('pages/concerts/tickets.html?id=c1&ticketType=Standard%20Tier%202')
        open_zone(browser,'Standard Tier 2')
        browser.wait(f'document.querySelector(\'.seat[data-id="{chosen[0]}"]\')?.classList.contains("sold")')
        assert browser.evaluate(f'document.querySelector(\'.seat[data-id="{chosen[0]}"]\').disabled')
        results['flows'].append('Seated: select/deselect -> held by competitor -> 409 -> expiry -> available -> real purchase -> Sold -> QR')
        # API failure must disable booking, without fabricated seats or tickets.
        browser.call('Network.setBlockedURLs', {'urls':[API+'/concerts/1/seats']})
        browser.click('#retry-seats')
        browser.wait('!document.getElementById("retry-seats").hidden && document.getElementById("continue-payment").disabled')
        assert browser.evaluate('!document.getElementById("use-mock-seats") && document.querySelectorAll(".seat").length===0')
        results['flows'].append('API failure blocks booking; no mock purchase or fake seat grid')
        results['errors']=browser.errors
        assert not browser.errors, browser.errors
        print(json.dumps(results,ensure_ascii=False,indent=2),flush=True)
    except Exception as error:
        results['fatal']=str(error)
        if browser: results['errors']=browser.errors
        raise
    finally:
        (ARTIFACTS/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
        if browser:browser.ws.close()
        server.terminate();server.wait(timeout=10);log.close();db.close();admin.close()


if __name__=='__main__':main()
