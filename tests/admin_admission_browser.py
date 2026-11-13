"""Chrome regression: admin creates/renames arbitrary Standing and Seated zones.

Run with browser_qa.py prerequisites. Uses a disposable QA DB and backend on 18000.
"""
import json
import os
import subprocess
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone

import psycopg2
from psycopg2 import sql

from browser_qa import Browser, ROOT, API, QA_PORT, request, login


def main():
    name = 'concertly_admin_admission_test_' + uuid.uuid4().hex[:8]
    admin = psycopg2.connect(host='127.0.0.1', port=55439, user='concertly_qa', dbname='postgres')
    admin.autocommit = True
    with admin.cursor() as cur:
        cur.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(name)))
    db = psycopg2.connect(host='127.0.0.1', port=55439, user='concertly_qa', dbname=name)
    with db.cursor() as cur:
        cur.execute((ROOT / 'backend/schema.sql').read_text())
    db.commit()
    env = dict(os.environ, DATABASE_URL=f'postgresql+psycopg2://concertly_qa@127.0.0.1:55439/{name}',
               JWT_SECRET='qa-only-admission-test', DISABLE_SWEEPER='1', PYTHONDONTWRITEBYTECODE='1',
               SEED_ADMIN_PASSWORD='qa-only-password-123', SEED_USER_PASSWORD='qa-only-password-123')
    subprocess.run([sys.executable, '-B', 'scripts/seed.py'], cwd=ROOT/'backend', env=env, check=True, capture_output=True)
    log = open('/private/tmp/concertly-admin-admission-backend.log', 'w')
    server = subprocess.Popen([sys.executable, '-B', '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', QA_PORT], cwd=ROOT/'backend', env=env, stdout=log, stderr=log)
    browser = None
    try:
        for _ in range(100):
            try:
                if request('/health')[0] == 200: break
            except OSError: pass
            time.sleep(.1)
        else: raise RuntimeError('QA backend did not start')
        session = login('admin@concertly.dev')
        browser = Browser()
        browser.call('Page.addScriptToEvaluateOnNewDocument', {'source': f'window.CONCERTLY_API_BASE={json.dumps(API)};'})
        browser.navigate('index.html')
        browser.evaluate(f'localStorage.setItem("token",{json.dumps(session["access_token"])});localStorage.setItem("concertlyUser","QA Admin");localStorage.setItem("userRole","admin")')
        browser.navigate('pages/admin/concerts.html')
        browser.wait('typeof openNewConcertForm === "function"')
        browser.evaluate('openNewConcertForm()')
        future = datetime.now(timezone.utc) + timedelta(days=90)
        values = {'concert-name':'Admission Chrome QA', 'artist-name':'QA Artist', 'concert-date':future.strftime('%Y-%m-%d'),
                  'concert-time':'20:00', 'concert-status':'on_sale', 'venue':'QA Hall', 'concert-city':'Hanoi'}
        browser.evaluate(f'Object.entries({json.dumps(values)}).forEach(([id,value])=>document.getElementById(id).value=value);addEmptyTicketRow();')
        browser.evaluate('''(() => {
          document.querySelectorAll('.ticket-type-row').forEach((row,i) => {
            const inputs = row.querySelectorAll('input');
            inputs[0].value = i ? 'Custom seats' : 'Custom standing';
            inputs[1].value = '100'; inputs[2].value = '4';
            row.querySelector('select').value = i ? 'seated' : 'standing';
          });
        })()''')
        for width in [320,375,390,768,1024,1440]:
            browser.call('Emulation.setDeviceMetricsOverride', {'width':width,'height':900,'deviceScaleFactor':1,'mobile':width<768})
            assert browser.evaluate('document.documentElement.scrollWidth <= innerWidth+1'), width
        browser.click('#concert-form button[type="submit"]')
        browser.wait('document.getElementById("concert-form").hidden')
        status, catalogue = request('/admin/concerts', session['access_token'])
        assert status == 200
        concert = next(c for c in catalogue if c['title'] == 'Admission Chrome QA')
        assert [z['booking_type'] for z in concert['zones']] == ['standing','seated']
        browser.evaluate(f'loadConcertIntoForm({concert["id"]})')
        assert browser.evaluate('[...document.querySelectorAll(".ticket-type-row select")].map(e=>e.value)') == ['standing','seated']
        browser.evaluate('document.querySelector(".ticket-type-row input").value="Renamed standing"')
        browser.click('#concert-form button[type="submit"]')
        browser.wait('document.getElementById("concert-form").hidden')
        status, seats = request(f'/concerts/{concert["id"]}/seats')
        assert status == 200 and seats['zones'][0]['booking_type'] == 'standing'
        assert seats['zones'][0]['name'] == 'Renamed standing' and seats['zones'][0]['seats'] == []
        buyer = login('minhanh@concertly.dev')['access_token']
        status, hold = request('/reservations', buyer, {'concert_id':concert['id'],'standing':[{'zone_id':concert['zones'][0]['id'],'quantity':1}]})
        assert status == 201
        status, order = request('/checkout', buyer, {'reservation_id':hold['id'],'payment_method':'card','buyer':{'full_name':'QA Buyer','email':'qa@example.com','phone':'0912345678'}})
        assert status == 201 and order['tickets'][0]['booking_type'] == 'standing'
        assert order['tickets'][0]['row'] is None and order['tickets'][0]['qr_data']
        assert not browser.errors, browser.errors
        print('PASS Chrome: create Standing/Seated, persist/rename, 6 responsive widths, Standing checkout and QR')
    finally:
        if browser: browser.ws.close()
        server.terminate(); server.wait(timeout=10); log.close(); db.close(); admin.close()


if __name__ == '__main__':
    main()
