"""Read-only Chrome regression for the recovered Seat Selection UI.
Uses local backend 8000; no reservation, checkout, seed or database writes.
Credentials stay in-process and are never included in the report.
"""
import base64
import json
from pathlib import Path
import sys
import urllib.parse

from dotenv import dotenv_values
from browser_qa import Browser, ROOT

API = 'http://localhost:8000/api'
ARTIFACTS = Path('/private/tmp/concertly-restored-ui-qa')
ARTIFACTS.mkdir(exist_ok=True)


def run():
    results = {'login': {}, 'session': {}, 'viewports': [], 'sections': [], 'standing': [], 'stage': 'login'}
    browser = Browser()
    original = browser.call
    auth_requests = []
    credentials = dotenv_values(ROOT/'backend/.env')
    password = credentials.get('SEED_USER_PASSWORD')
    assert password, 'SEED_USER_PASSWORD is missing; no account changes made'
    # Observe only sanitized login metadata, never request bodies/tokens.
    def call(method, params=None):
        browser.sequence += 1
        sequence = browser.sequence
        browser.ws.send(json.dumps({'id':sequence,'method':method,'params':params or {}}))
        while True:
            event = json.loads(browser.ws.recv())
            data = event.get('params', {})
            if event.get('method') == 'Network.requestWillBeSent' and data['request']['url'].endswith('/api/auth/login'):
                request = data['request']; headers = {k.lower():v for k,v in request.get('headers',{}).items()}
                fields = urllib.parse.parse_qs(request.get('postData',''),keep_blank_values=True)
                auth_requests.append({'requestId':data['requestId'],'method':request['method'],
                    'content_type':headers.get('content-type'), 'fields':sorted(fields),
                    'email_matches':fields.get('username')==['quocbao@concertly.dev'],
                    'password_matches_env':fields.get('password')==[password]})
            if event.get('method') == 'Network.responseReceived':
                for request in auth_requests:
                    if request['requestId']==data['requestId']:request['status']=data['response']['status']
            if event.get('method') == 'Runtime.exceptionThrown':browser.errors.append(data['exceptionDetails'])
            if event.get('id') == sequence:
                if 'error' in event:raise RuntimeError('Chrome command failed')
                return event.get('result',{})
    browser.call = call
    try:
        browser.call('Page.addScriptToEvaluateOnNewDocument',{'source':'window.CONCERTLY_API_BASE='+json.dumps(API)+';'})
        browser.call('Network.setBlockedURLs',{'urls':[API+'/reservations*',API+'/checkout*',API+'/admin*']})
        browser.navigate('pages/auth/login.html')
        browser.evaluate('ConcertlyAPI.clearSession()')
        browser.evaluate('document.getElementById("username").value="quocbao@concertly.dev";document.getElementById("password").value='+json.dumps(password)+';document.getElementById("password").form.querySelector("button[type=submit]").click()')
        browser.wait('location.pathname.endsWith("/index.html") && document.querySelector(".auth-menu-greeting")')
        assert auth_requests and auth_requests[-1].get('status')==200, 'Frontend login did not return 200'
        results['login']={k:v for k,v in auth_requests[-1].items() if k!='requestId'}
        me='''(async()=>{const r=await fetch(CONCERTLY_API_BASE+'/auth/me',{headers:{Authorization:'Bearer '+localStorage.getItem('token')}});const data=await r.json();return {status:r.status,correctAccount:data.email==='quocbao@concertly.dev'}})()'''
        results['session']['after_login']=browser.evaluate(me)
        assert results['session']['after_login']=={'status':200,'correctAccount':True}, 'Wrong session after login'
        results['stage']='venue and detailed seat maps'
        for width in [320,375,390,768,1024,1280]:
            browser.call('Emulation.setDeviceMetricsOverride',{'width':width,'height':900,'deviceScaleFactor':1,'mobile':width<768})
            for cid in range(1,12):
                browser.navigate(f'pages/concerts/tickets.html?id=c{cid}')
                browser.wait('document.querySelector(".venue-svg") && document.querySelector(".ticket-item p")?.textContent.includes("available")')
                assert browser.evaluate('innerWidth')==width, 'Unexpected CSS viewport'
                assert browser.evaluate('Boolean(!document.querySelector(".ticket-seat-workspace") && document.querySelector(".ticket-left .map-card") && document.querySelector(".ticket-right .selection-card"))'), 'Original layout not restored'
                browser.evaluate('window.__venue=document.querySelector(".venue-svg");window.__shapes=JSON.stringify([...document.querySelectorAll(".venue-section")].map(s=>({id:s.dataset.id,name:s.dataset.name,shape:s.querySelector(".seat-zone").outerHTML})))')
                assert browser.evaluate('document.documentElement.scrollWidth<=innerWidth+1'), 'Page overflow before selection'
                if width>=1024:
                    assert browser.evaluate('document.querySelector(".selection-card").getBoundingClientRect().left>=document.querySelector(".map-card").getBoundingClientRect().right'), 'Original summary column moved'
                inventory=browser.evaluate(f'(async()=>{{const r=await ConcertlyAPI.seatMap({cid});return r.zones.map(z=>({{name:z.name,type:z.booking_type,available:z.available+(z.held_by_me_count||0)}}))}})()')
                sections=browser.evaluate(f'(async()=>{{const m=await new VenueLoader().load("c{cid}");return m.sections.filter(s=>s.bookingType==="seated").map(s=>({{id:s.id,name:s.name}}))}})()')
                count=0
                for section in sections:
                    if not any(z['name']==section['name'] and z['available']>0 for z in inventory):continue
                    selector='.venue-section[data-id="'+section['id']+'"]'
                    browser.evaluate('document.querySelector('+json.dumps(selector)+').dispatchEvent(new MouseEvent("click",{bubbles:true}))')
                    browser.wait('document.querySelector(".geometry-section")?.dataset.sectionId==='+json.dumps(section['id']))
                    metrics=browser.evaluate('''(()=>{const v=document.querySelector('.seat-rows'),r=v.getBoundingClientRect();return {sections:document.querySelectorAll('.geometry-section').length,dx:v.scrollWidth-v.clientWidth,dy:v.scrollHeight-v.clientHeight,
                      allInside:[...v.querySelectorAll('.seat')].every(s=>{const b=s.getBoundingClientRect();return b.left>=r.left-.5 && b.right<=r.right+.5 && b.top>=r.top-.5 && b.bottom<=r.bottom+.5}),
                      pageOverflow:document.documentElement.scrollWidth-innerWidth,overview:document.querySelector('.venue-svg')===window.__venue && window.__venue.getBoundingClientRect().height>0,
                      shapes:__shapes===JSON.stringify([...document.querySelectorAll('.venue-section')].map(s=>({id:s.dataset.id,name:s.dataset.name,shape:s.querySelector('.seat-zone').outerHTML})))}})()''')
                    assert metrics['sections']==1 and metrics['dx']<=1 and metrics['dy']<=1 and metrics['allInside'] and metrics['pageOverflow']<=1 and metrics['overview'] and metrics['shapes'], str(metrics)
                    # Exact existing polygon allocation and seat IDs, no hidden/lost duplicates.
                    expected=browser.evaluate(f'''(async()=>{{const m=await new VenueLoader().load('c{cid}');const d=await ConcertlyAPI.seatMap({cid});const z=d.zones.find(z=>z.name==={json.dumps(section['name'])});return SeatGeometry.zone(m,z.name,z.seats).find(v=>v.section.id==={json.dumps(section['id'])}).positions.map(p=>p.seat.id)}})()''')
                    actual=browser.evaluate('[...document.querySelectorAll(".seat")].map(s=>Number(s.dataset.id))')
                    assert sorted(actual)==sorted(expected), 'Changed/missing/duplicate seat IDs'
                    assert browser.evaluate('document.querySelector(".venue-section.active").dataset.id')==section['id']
                    # Select/deselect on the restored renderer; do not hold or buy seats.
                    available=browser.evaluate('document.querySelector(".seat:not(:disabled)")?.dataset.id')
                    if available:
                        browser.click(f'.seat[data-id="{available}"]')
                        assert browser.evaluate(f'document.querySelector(\'.seat[data-id="{available}"]\').classList.contains("selected")')
                        browser.click(f'.seat[data-id="{available}"]')
                        assert browser.evaluate(f'!document.querySelector(\'.seat[data-id="{available}"]\').classList.contains("selected")')
                    browser.click('[data-seat-zoom="0.25"]')
                    assert browser.evaluate('document.querySelector(".seat-rows").classList.contains("is-zoomed")')
                    browser.click('[data-seat-zoom="reset"]')
                    assert browser.evaluate('document.querySelector(".seat-rows").scrollWidth<=document.querySelector(".seat-rows").clientWidth+1')
                    count+=1;results['sections'].append({'concert':cid,'section':section['id'],'width':width,'fit':True})
                standing=next((z for z in inventory if z['type']=='standing' and z['available']>0),None)
                if standing:
                    selector='.venue-section[data-name="'+standing['name']+'"]'
                    browser.evaluate('document.querySelector('+json.dumps(selector)+').dispatchEvent(new MouseEvent("click",{bubbles:true}))')
                    assert browser.evaluate('document.querySelectorAll(".seat").length===0 && !document.querySelector(".quantity-control").hidden && document.querySelector(".venue-svg").getBoundingClientRect().height>0')
                    browser.click('#plus');browser.click('#minus')
                    results['standing'].append({'concert':cid,'width':width,'quantityOnly':True})
                results['viewports'].append({'concert':cid,'width':width,'sectionsChecked':count})
        results['stage']='session after navigation'
        results['session']['after_navigation']=browser.evaluate(me)
        assert results['session']['after_navigation']=={'status':200,'correctAccount':True}, 'Session lost across navigation'
        results['session']['unauthenticated_status']=browser.evaluate('(async()=>{const r=await fetch(CONCERTLY_API_BASE+"/auth/me");return r.status})()')
        assert results['session']['unauthenticated_status']==401
        results['js_error_count']=len(browser.errors)
        assert not browser.errors, 'Browser JavaScript exception'
        results['stage']='complete'
        print(json.dumps({'login':results['login'],'session':results['session'],'viewports':len(results['viewports']),'sections':len(results['sections']),'standing':len(results['standing']),'js_errors':len(browser.errors)},ensure_ascii=False))
    except Exception as error:
        # Never echo Runtime.evaluate source (it may contain the password assignment).
        results['failure_type']=type(error).__name__
        if isinstance(error,AssertionError):results['failure']=str(error)
        print('FAIL',results['stage'],type(error).__name__)
        raise SystemExit(1)
    finally:
        (ARTIFACTS/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
        browser.ws.close()


if __name__=='__main__':run()
