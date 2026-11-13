"""Real Chrome/CDP smoke tests against an isolated PostgreSQL cluster.

Requires backend/requirements-dev.txt + websocket-client, a local frontend server and
Chrome --headless --remote-debugging-port=9337. Creates its own disposable database.
"""
import base64
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.request
import urllib.parse
import uuid

import psycopg2
from psycopg2 import sql
import websocket

ROOT = Path(__file__).resolve().parents[1]
BASE = 'http://127.0.0.1:8765'
API = os.getenv('CONCERTLY_QA_API_BASE', 'http://127.0.0.1:18000/api')
QA_PORT = str(urllib.parse.urlsplit(API).port)
if urllib.parse.urlsplit(API).hostname != '127.0.0.1' or QA_PORT == '8000':
    raise RuntimeError('QA must use a separate loopback backend port, never the local backend on 8000.')
ARTIFACTS = Path('/private/tmp/concertly-qa-results')
ARTIFACTS.mkdir(exist_ok=True)
FOCUS_ONLY = '--focus' in sys.argv


class Browser:
    def __init__(self):
        pages = json.load(urllib.request.urlopen('http://127.0.0.1:9337/json/list'))
        target = next(p for p in pages if p['type'] == 'page')
        self.ws = websocket.create_connection(target['webSocketDebuggerUrl'], suppress_origin=True, timeout=20)
        self.sequence = 0
        self.errors = []
        self.network_failures = []
        for domain in ['Page', 'Runtime', 'Network']:
            self.call(f'{domain}.enable')
        self.call('Network.setBlockedURLs', {'urls': []})
        self.call('Network.setCacheDisabled', {'cacheDisabled': True})
        self.call('Runtime.discardConsoleEntries')
        # Runtime.enable can replay errors from a previous run in the reused tab.
        self.errors = []

    def call(self, method, params=None):
        self.sequence += 1
        request_id = self.sequence
        self.ws.send(json.dumps({'id': request_id, 'method': method, 'params': params or {}}))
        while True:
            item = json.loads(self.ws.recv())
            if item.get('method') == 'Network.loadingFailed':
                self.network_failures.append({k:item['params'].get(k) for k in ['type','errorText','blockedReason']})
            if item.get('method') == 'Runtime.exceptionThrown':
                self.errors.append(item['params']['exceptionDetails'])
            if item.get('id') == request_id:
                if 'error' in item:
                    raise RuntimeError(item['error'])
                return item.get('result', {})

    def evaluate(self, source):
        result = self.call('Runtime.evaluate', {'expression': source, 'returnByValue': True, 'awaitPromise': True})
        if 'exceptionDetails' in result:
            raise RuntimeError(result['exceptionDetails'])
        return result.get('result', {}).get('value')

    def wait(self, expression, seconds=15):
        end = time.monotonic() + seconds
        while time.monotonic() < end:
            # Navigation can expose the new URL before its DOM has been installed.
            # A missing element is "not ready", not a product JavaScript exception.
            if self.evaluate(f'(() => {{try {{return Boolean({expression})}} catch {{return false}}}})()'):
                return
            time.sleep(.1)
        raise AssertionError(f'Timed out: {expression}; at {self.evaluate("location.href")}; network failures: {self.network_failures[-4:]}')

    def navigate(self, path):
        url = BASE + '/' + path
        self.call('Page.navigate', {'url': url})
        self.wait(f'(location.href === {json.dumps(url)} || location.pathname.endsWith("/session-expired.html")) && document.readyState === "complete"')
        time.sleep(.15)

    def click(self, selector):
        self.evaluate(f'document.querySelector({json.dumps(selector)}).click()')

    def screenshot(self, name):
        encoded = self.call('Page.captureScreenshot', {'format': 'png', 'captureBeyondViewport': False})['data']
        (ARTIFACTS / f'{name}.png').write_bytes(base64.b64decode(encoded))


def open_zone(browser, name, section_id=None):
    browser.wait('document.querySelector(".venue-svg") && (document.querySelector(".ticket-item p")?.textContent.includes("available") || (!document.getElementById("retry-seats").hidden && Boolean(document.getElementById("seat-message").textContent)))')
    selector = '.venue-section[data-id="'+section_id+'"]' if section_id else '.venue-section[data-name="'+name+'"]'
    browser.evaluate('document.querySelector('+json.dumps(selector)+').dispatchEvent(new MouseEvent("click",{bubbles:true}))')
    browser.wait('!document.getElementById("seat-card").hidden')


def request(path, token=None, body=None, method=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(API + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, json.load(error)


def login(email):
    import urllib.parse
    req = urllib.request.Request(API + '/auth/login', data=urllib.parse.urlencode({'username': email, 'password': 'qa-only-password-123'}).encode())
    return json.load(urllib.request.urlopen(req))


def main():
    dbname = f'concertly_browser_test_{uuid.uuid4().hex[:8]}'
    admin = psycopg2.connect(host='127.0.0.1', port=55439, user='concertly_qa', dbname='postgres')
    admin.autocommit = True
    with admin.cursor() as cursor:
        cursor.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(dbname)))
    dburl = f'postgresql+psycopg2://concertly_qa@127.0.0.1:55439/{dbname}'
    env = dict(os.environ, DATABASE_URL=dburl, JWT_SECRET='qa-only-random-secret-for-isolated-local-tests-2026', DISABLE_SWEEPER='1', PYTHONDONTWRITEBYTECODE='1', SEED_ADMIN_PASSWORD='qa-only-password-123', SEED_USER_PASSWORD='qa-only-password-123')
    db = psycopg2.connect(host='127.0.0.1', port=55439, user='concertly_qa', dbname=dbname)
    with db.cursor() as cursor:
        cursor.execute((ROOT / 'backend/schema.sql').read_text())
    db.commit()
    subprocess.run([sys.executable, '-B', 'scripts/seed.py'], cwd=ROOT / 'backend', env=env, check=True, capture_output=True)
    # Keep QA independent of the calendar without changing the repository's seed files.
    with db.cursor() as cursor:
        cursor.execute("UPDATE concerts SET starts_at=now()+interval '30 days', sale_start_at=now()-interval '1 day', status='on_sale'")
    db.commit()
    log = (ARTIFACTS / 'backend.log').open('w')
    server = subprocess.Popen([sys.executable, '-B', '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', QA_PORT], cwd=ROOT / 'backend', env=env, stdout=log, stderr=log)
    results = {'database': dbname, 'responsive': [], 'flows': [], 'errors': []}
    browser = None
    try:
        for _ in range(100):
            try:
                if request('/health')[0] == 200:
                    break
            except OSError:
                time.sleep(.1)
        else:
            raise RuntimeError('Backend did not start')
        customer, administrator = login('minhanh@concertly.dev'), login('admin@concertly.dev')
        token, admin_token = customer['access_token'], administrator['access_token']
        browser = Browser()
        browser.call('Page.addScriptToEvaluateOnNewDocument', {'source': f'window.CONCERTLY_API_BASE={json.dumps(API)};'})
        browser.navigate('index.html')
        browser.evaluate(f'localStorage.setItem("token",{json.dumps(token)});localStorage.setItem("concertlyUser",{json.dumps(customer["user"]["full_name"])});localStorage.setItem("userRole","customer");')
        status, seats = request('/concerts/1/seats', token)
        available = [s['id'] for z in seats['zones'] for s in z['seats'] if s['status'] == 'available']
        assert status == 200 and len(available) > 10
        for seat_ids, expected in [([], 422), (available[:9], 422)]:
            assert request('/reservations', token, {'concert_id': 1, 'seat_ids': seat_ids})[0] == expected
        results['flows'].append('API rejects 0 and 9 seats')
        assert request('/reservations', token, {'concert_id': 1, 'seat_ids': available[:8]})[0] == 201
        results['flows'].append('API accepts exactly 8 seats')
        # Browser: choose -> hold -> validate -> pay -> order -> QR.
        browser.navigate('pages/concerts/tickets.html?id=c1&ticketType=Standard%20Tier%202')
        browser.wait('document.querySelector(".venue-svg") !== null')
        browser.wait('document.querySelector(".ticket-item p")?.textContent.includes("available")')
        browser.click('[data-map-zoom="0.5"]')
        assert browser.evaluate('document.querySelector(".venue-svg").getBoundingClientRect().width > document.getElementById("concert-map").clientWidth * 1.4')
        browser.click('[data-map-zoom="reset"]')
        browser.evaluate('document.querySelector(".venue-section[data-name=\\"Standard Tier 2\\"]").dispatchEvent(new KeyboardEvent("keydown", {key:"Enter", bubbles:true}))')
        browser.evaluate('for(let i=0;i<9;i++)document.querySelectorAll(".seat:not(:disabled)")[i].click()')
        assert browser.evaluate('document.querySelectorAll(".seat.selected").length===8')
        browser.evaluate('while(document.querySelectorAll(".seat.selected").length>1)document.querySelector(".seat.selected").click()')
        results['flows'].append('SVG zoom/reset and keyboard zone selection work; API seat UI stops at 8 selections')
        browser.click('#continue-payment')
        browser.wait('location.pathname.endsWith("/checkout/index.html") && !document.getElementById("confirm-payment").disabled')
        assert browser.evaluate('document.getElementById("checkout-timer").textContent.includes("Seats held")')
        checkout_data = browser.evaluate('JSON.parse(localStorage.getItem("checkoutData"))')
        browser.click('#confirm-payment')
        assert browser.evaluate('location.pathname.endsWith("/checkout/index.html") && !document.getElementById("buyer-email").validity.valid')
        results['flows'].append('Browser blocks payment with missing buyer information')
        fill = '''document.getElementById("buyer-name").value="QA Buyer";
          document.getElementById("buyer-email").value="qa@example.com";
          document.getElementById("buyer-phone").value="+84 912 345 678";
          document.getElementById("payment-method").value="card";'''
        browser.evaluate(fill)
        browser.evaluate('document.getElementById("buyer-phone").value="invalid"')
        browser.click('#confirm-payment')
        assert browser.evaluate('!document.getElementById("checkout-feedback").hidden')
        browser.evaluate(fill)
        browser.click('#confirm-payment')
        browser.wait('location.pathname.endsWith("/me/order-detail.html") && document.querySelector(".line-ticket") !== null')
        order_id = browser.evaluate('new URLSearchParams(location.search).get("id")')
        status, order = request('/orders/' + order_id, token)
        assert status == 200 and order['status'] == 'paid'
        ticket_id = order['tickets'][0]['id']
        original_code = order['tickets'][0]['ticket_code']
        status, ticket = request('/tickets/' + str(ticket_id), token)
        assert status == 200 and ticket['qr_data'] == original_code and ticket['qr_image'].startswith('data:image/svg+xml')
        results['flows'].append('Real browser API purchase creates paid order and unchanged QR payload')
        # Reload of completed reservation must remain idempotent at the server.
        status, repeated = request('/checkout', token, {'reservation_id': checkout_data['reservationId'], 'payment_method': 'card', 'buyer': {'full_name': 'QA Buyer', 'email': 'qa@example.com', 'phone': '0912345678'}})
        assert status == 201 and repeated['id'] == order['id']
        results['flows'].append('Repeated checkout returns the same order')
        # Validation is also enforced by the API when buyer is supplied.
        invalid = {'reservation_id': checkout_data['reservationId'], 'payment_method': 'card', 'buyer': {'full_name': ' ', 'email': 'bad', 'phone': 'x'}}
        assert request('/checkout', token, invalid)[0] == 422
        assert request('/checkout', token, {'reservation_id': checkout_data['reservationId'], 'payment_method': 'card'})[0] == 422
        results['flows'].append('API rejects malformed buyer information')
        # Expire a fresh reservation in the dedicated test database.
        _, held = request('/reservations', token, {'concert_id': 1, 'seat_ids': [available[9]]})
        with db.cursor() as cursor:
            cursor.execute("UPDATE reservations SET created_at=now()-interval '10 minutes', expires_at=now()-interval '1 minute' WHERE id=%s", (held['id'],))
            cursor.execute("UPDATE seats SET held_until=now()-interval '1 minute' WHERE reservation_id=%s", (held['id'],))
        db.commit()
        assert request('/checkout', token, {'reservation_id': held['id'], 'payment_method': 'card', 'buyer': {'full_name': 'QA Buyer', 'email': 'qa@example.com', 'phone': '0912345678'}})[0] == 410
        results['flows'].append('API rejects an expired reservation with 410')
        # Render all requested public and admin screens at every requested width.
        pages = [
            ('home', 'index.html', 'document.querySelectorAll(".concert-card").length>0', customer),
            ('explore', 'pages/concerts/index.html', 'document.querySelectorAll(".concert-card").length>0', customer),
            ('tickets', 'pages/concerts/tickets.html?id=c1&ticketType=Standard%20Tier%202', 'document.querySelectorAll(".seat").length>0', customer),
            ('checkout', 'pages/checkout/index.html', 'document.getElementById("checkout-timer").textContent.includes("Seats held")', customer),
            ('ticket-detail', f'pages/me/ticket-detail.html?id={ticket_id}', 'document.querySelector(".digital-ticket-qr img")!==null', customer),
            ('admin', 'pages/admin/index.html', 'document.getElementById("stat-total-concerts").textContent==="11"', administrator),
            ('admin-concerts', 'pages/admin/concerts.html', 'document.querySelectorAll("#concert-table-body tr").length>0', administrator),
            ('admin-checkin', 'pages/admin/checkin.html', 'document.querySelectorAll("#event option").length===11', administrator),
        ]
        _, render_hold = request('/reservations', token, {'concert_id': 1, 'seat_ids': [available[10]]})
        checkout_snapshot = {**checkout_data, 'reservationId': render_hold['id'], 'expiresAt': render_hold['expires_at'],
                             'quantity': len(render_hold['seats']), 'seats': render_hold['seats']}
        if FOCUS_ONLY:
            pages = [p for p in pages if p[0] in ('tickets', 'checkout', 'ticket-detail', 'admin-checkin')]
        for width in ([320] if FOCUS_ONLY else [320, 375, 390, 768, 1024]):
            header_signature = None
            browser.call('Emulation.setDeviceMetricsOverride', {'width': width, 'height': 900, 'deviceScaleFactor': 1, 'mobile': width < 768})
            for name, path, ready, session in pages:
                browser.evaluate(f'localStorage.setItem("token",{json.dumps(session["access_token"])});localStorage.setItem("concertlyUser",{json.dumps(session["user"]["full_name"])});localStorage.setItem("userRole",{json.dumps(session["user"]["role"])});')
                if name == 'checkout':
                    browser.evaluate(f'localStorage.setItem("checkoutData", JSON.stringify({json.dumps(checkout_snapshot)}));')
                browser.navigate(path)
                if name == "tickets":open_zone(browser,"Standard Tier 2")
                browser.wait(ready)
                if name in ('home', 'explore'):
                    signature = browser.evaluate('JSON.stringify({height:document.querySelector("header").offsetHeight,nav:[...document.querySelectorAll(".site-nav a")].map(a=>a.textContent.trim()),search:document.querySelector(".header-search-input").placeholder})')
                    if name == 'home':
                        header_signature = signature
                    else:
                        assert signature == header_signature, f'Home/Explore headers differ at {width}px'
                if name.startswith('admin'):
                    assert browser.evaluate('getComputedStyle(document.querySelector(".admin-nav")).display!=="none"'), f'Admin navigation hidden at {width}px'
                if name == 'ticket-detail':
                    browser.wait('document.querySelector(".digital-ticket-qr img").naturalWidth>0')
                metrics = browser.evaluate('''(() => {
                  const width=document.documentElement.clientWidth;
                  const offenders=[...document.querySelectorAll("body *")].filter(el=>{
                    const r=el.getBoundingClientRect(); const s=getComputedStyle(el);
                    if(!r.width||s.display==="none"||s.position==="absolute") return false;
                    if(el.closest(".admin-table-scroll,.seat-rows,#concert-map,.category-pills,.hero-slider-wrapper"))return false;
                    return r.right>width+1 || r.left < -1;
                  }).map(el=>({tag:el.tagName,cls:el.className,id:el.id,right:el.getBoundingClientRect().right}));
                  return {viewport:innerWidth,client:width,scroll:document.documentElement.scrollWidth,offenders:offenders.slice(0,8),header:!!document.querySelector("header"),footer:!!document.querySelector("footer")};
                })()''')
                result = {'page': name, 'width': width, **metrics}
                result['passed'] = metrics['scroll'] <= metrics['client'] + 1 and not metrics['offenders'] and metrics['header'] and metrics['footer']
                results['responsive'].append(result)
                browser.screenshot(f'{name}-{width}')
                focus_selector = {'tickets': '#concert-map', 'checkout': '.payment-card',
                                  'ticket-detail': '.digital-ticket-qr', 'admin-checkin': '.admin-table-scroll'}.get(name)
                if focus_selector:
                    browser.evaluate(f'document.querySelector({json.dumps(focus_selector)}).scrollIntoView({{block:"center",behavior:"instant"}})')
                    browser.screenshot(f'{name}-detail-{width}')
                print(json.dumps(result), flush=True)
        # Check unchanged QR admission and duplicate rejection using the real API.
        assert request('/admin/checkin', admin_token, {'ticketId': original_code, 'concertId': 1})[0] == 200
        assert request('/admin/checkin', admin_token, {'ticketId': original_code, 'concertId': 1})[0] == 409
        assert request('/admin/checkin', admin_token, {'ticketId': original_code, 'concertId': 2})[0] == 400
        results['flows'].append('Original QR code admits once; duplicate and wrong-concert scans are rejected')
        # Explicit demo fallback after API failure, not a silent fake booking.
        browser.evaluate(f'localStorage.setItem("token",{json.dumps(token)});localStorage.setItem("userRole","customer")')
        browser.call('Network.setBlockedURLs', {'urls': [API + '/concerts/1/seats']})
        browser.navigate('pages/concerts/tickets.html?id=c1&ticketType=Standard%20Tier%202')
        open_zone(browser,'Standard Tier 2')
        browser.wait('!document.getElementById("retry-seats").hidden')
        assert browser.evaluate('document.getElementById("continue-payment").disabled')
        browser.call('Network.setBlockedURLs', {'urls': []})
        browser.click('#retry-seats')
        browser.wait('document.querySelectorAll(".seat").length>0')
        assert browser.evaluate('!document.getElementById("use-mock-seats")')
        results['flows'].append('Seat availability retry recovers after the API becomes reachable')
        browser.call('Network.setBlockedURLs', {'urls': [API + '/concerts/1/seats']})
        # Reload to test a fresh API failure after a successful retry.
        browser.navigate('pages/concerts/tickets.html?id=c1&ticketType=Standard%20Tier%202')
        open_zone(browser,'Standard Tier 2')
        browser.wait('!document.getElementById("retry-seats").hidden')
        assert browser.evaluate('document.getElementById("continue-payment").disabled && !document.getElementById("use-mock-seats")')
        browser.call('Network.setBlockedURLs', {'urls': []})
        results['flows'].append('An API failure cannot silently create a local purchase or numbered seats')
        expired_snapshot = {**checkout_snapshot, 'reservationId': held['id'], 'expiresAt': held['expires_at']}
        browser.evaluate(f'localStorage.setItem("checkoutData", JSON.stringify({json.dumps(expired_snapshot)}))')
        browser.navigate('pages/checkout/index.html')
        browser.wait('location.pathname.endsWith("/session-expired.html")')
        results['flows'].append('Expired API checkout redirects before payment')
        results['errors'] = browser.errors
    except Exception as error:
        results['fatal'] = str(error)
        raise
    finally:
        result_path = ARTIFACTS / ('focus-results.json' if FOCUS_ONLY else 'results.json')
        result_path.write_text(json.dumps(results, indent=2, ensure_ascii=False))
        if browser:
            browser.ws.close()
        server.terminate()
        server.wait(timeout=10)
        log.close()
        db.close()
        admin.close()
        print('QA results:', result_path, flush=True)
    assert all(row['passed'] for row in results['responsive']), 'Responsive overflow detected; see results.json'
    assert not results['errors'], 'Browser JavaScript errors detected; see results.json'
    print('PASS browser flows and all responsive viewports')


if __name__ == '__main__':
    if '--close-browser' in sys.argv:
        browser = Browser()
        try:
            browser.call('Browser.close')
        except websocket.WebSocketConnectionClosedException:
            pass
        finally:
            browser.ws.close()
    else:
        main()
