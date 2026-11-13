"""Fit, single-zone navigation and interaction checks reused by the isolated browser suite."""
import base64
import json
from browser_qa import API, ROOT, open_zone


def run_ux_checks(browser, artifacts):
    results = {'overviews': [], 'sections': [], 'interactions': []}
    for width in [320,375,390,768,1024,1280,1600]:
        browser.call('Emulation.setDeviceMetricsOverride', {'width':width,'height':900,'deviceScaleFactor':1,'mobile':width<768})
        for cid in range(1,12):
            browser.navigate(f'pages/concerts/tickets.html?id=c{cid}&ticketType=ignored')
            browser.wait(f"innerWidth==={width}")
            browser.wait('document.querySelector(".ticket-item p")?.textContent.includes("available") && document.querySelector(".venue-svg")')
            assert browser.evaluate('!document.getElementById("seat-card").hidden && !document.getElementById("venue-overview").hidden && document.querySelectorAll(".seat").length===0 && document.getElementById("seat-picker").textContent==="Select a zone to view seats."'), 'Overview or detail placeholder missing on first load'
            assert browser.evaluate('''(()=>{const v=document.getElementById('concert-map');return v.scrollWidth<=v.clientWidth+1 && v.scrollHeight<=v.clientHeight+1 && document.documentElement.scrollWidth<=innerWidth+1})()'''),f'Venue overflow c{cid}/{width}'
            sections=browser.evaluate(f'(async()=>{{const m=await new VenueLoader().load("c{cid}");return m.sections.filter(s=>s.bookingType==="seated").map(s=>({{id:s.id,name:s.name}}))}})()')
            browser.evaluate('window.__overviewNode=document.querySelector(".venue-svg");window.__overviewShapes=JSON.stringify([...document.querySelectorAll(".venue-section")].map(s=>({id:s.dataset.id,name:s.dataset.name,shape:s.querySelector(".seat-zone").outerHTML})))')
            assert browser.evaluate('''(()=>{const o=document.getElementById('venue-overview'),d=document.getElementById('seat-card'),s=document.getElementById('ticket-summary');return o.getBoundingClientRect().bottom<=d.getBoundingClientRect().top && d.getBoundingClientRect().bottom<=s.getBoundingClientRect().top && !!d.querySelector('.quantity-control')})()''')
            results['overviews'].append({'concert':cid,'width':width,'fit':True})
            for section in sections:
                open_zone(browser,section['name'],section['id'])
                browser.wait('document.querySelector(".seat") !== null')
                metrics=browser.evaluate('''(()=>{
                  const v=document.querySelector('.seat-rows'),r=v.getBoundingClientRect();
                  const all=[...document.querySelectorAll('.seat')];
                  return {sections:document.querySelectorAll('.geometry-section').length,
                    id:document.querySelector('.geometry-section').dataset.sectionId,
                    x:v.scrollWidth-v.clientWidth,y:v.scrollHeight-v.clientHeight,
                    zoom:document.getElementById('seat-zoom-level').textContent,
                    hiddenOverview:document.getElementById('venue-overview').hidden,
                    duplicatePreview:!!document.querySelector('.seat-preview'),
                    outside:all.filter(s=>{const b=s.getBoundingClientRect();return b.left<r.left-.5 || b.right>r.right+.5 || b.top<r.top-.5 || b.bottom>r.bottom+.5}).length,
                    overflow:document.documentElement.scrollWidth-innerWidth,
                    seatIds:all.map(s=>Number(s.dataset.id))};
                })()''')
                assert metrics['sections']==1 and metrics['id']==section['id'],metrics
                assert metrics['x']<=1 and metrics['y']<=1 and metrics['outside']==0 and metrics['overflow']<=1,metrics
                assert metrics['zoom']=='Fit' and not metrics['hiddenOverview'] and not metrics['duplicatePreview'],metrics
                assert browser.evaluate('document.querySelector(".venue-svg")===window.__overviewNode && document.querySelector(".venue-svg").getBoundingClientRect().height>0'), 'Venue SVG was removed/replaced/hidden'
                assert browser.evaluate('window.__overviewShapes===JSON.stringify([...document.querySelectorAll(".venue-section")].map(s=>({id:s.dataset.id,name:s.dataset.name,shape:s.querySelector(".seat-zone").outerHTML})))'), 'Overview shapes or names changed'
                browser.wait('getComputedStyle(document.querySelector(".venue-section.active .seat-zone")).fill==="rgb(232, 67, 147)"')
                # The displayed subset must equal exactly the geometry allocation for this fragment.
                expected=browser.evaluate(f'''(async()=>{{const m=await new VenueLoader().load('c{cid}');const d=await (await fetch(CONCERTLY_API_BASE+'/concerts/{cid}/seats')).json();const z=d.zones.find(z=>z.name==={json.dumps(section['name'])});return SeatGeometry.zone(m,z.name,z.seats).find(v=>v.section.id==={json.dumps(section['id'])}).positions.map(p=>p.seat.id)}})()''')
                assert sorted(metrics['seatIds'])==sorted(expected)
                if width in [390,1280] and cid in [1,2,3,5,6] and section==sections[0]:
                    browser.evaluate('document.getElementById("seat-card").scrollIntoView({behavior:"instant",block:"start"})')
                    (artifacts/f'fit-c{cid}-{width}.png').write_bytes(base64.b64decode(browser.call('Page.captureScreenshot',{'format':'png'})['data']))
                # Manual zoom creates a scrollable surface; Fit always restores the full zone.
                browser.click('[data-seat-zoom="in"]')
                assert browser.evaluate('document.querySelector(".seat-rows").classList.contains("is-zoomed")')
                browser.click('[data-seat-zoom="reset"]')
                assert browser.evaluate('document.querySelector(".seat-rows").scrollWidth<=document.querySelector(".seat-rows").clientWidth+1')
                results['sections'].append({'concert':cid,'section':section['id'],'width':width,'fit':True,'singleSection':True})
                browser.click('#change-zone')
                assert browser.evaluate('!document.getElementById("venue-overview").hidden && !document.getElementById("seat-card").hidden && document.querySelectorAll(".seat").length===0')
                assert browser.evaluate(f'document.querySelector(".venue-section.active").dataset.id==={json.dumps(section["id"])}')
    # Same category across fragments, then another category, then Standing: retain all drafts.
    for width in [390,1280]:
        browser.call('Emulation.setDeviceMetricsOverride',{'width':width,'height':900,'deviceScaleFactor':1,'mobile':width<768})
        browser.navigate('pages/concerts/tickets.html?id=c1')
        # Click the actual SVG at screen coordinates. It must stay visible and in place.
        browser.wait('document.querySelector(".venue-svg") && document.querySelector(".ticket-item p")?.textContent.includes("available")')
        browser.evaluate('document.getElementById("concert-map").scrollIntoView({behavior:"instant",block:"center"})')
        target=browser.evaluate('''(()=>{const r=document.querySelector('.venue-section[data-id="c1-center-premium"] .seat-zone').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,scroll:scrollY}})()''')
        for event in ['mousePressed','mouseReleased']:
            browser.call('Input.dispatchMouseEvent',{'type':event,'x':target['x'],'y':target['y'],'button':'left','clickCount':1})
        browser.wait('document.querySelector(".geometry-section")?.dataset.sectionId==="c1-center-premium"')
        assert browser.evaluate('!document.getElementById("venue-overview").hidden && document.querySelector(".venue-svg").getBoundingClientRect().height>0')
        assert abs(browser.evaluate('scrollY')-target['scroll'])<2,'Zone click unexpectedly scrolled away from overview'
        clip=browser.evaluate('''(()=>{const r=document.querySelector('.ticket-seat-workspace').getBoundingClientRect();return {x:0,y:r.top+scrollY,width:innerWidth,height:r.height+8,scale:1}})()''')
        (artifacts/f'overview-and-seats-{width}.png').write_bytes(base64.b64decode(browser.call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':True,'clip':clip})['data']))
        open_zone(browser,'Standard Tier 2','c1-left-bowl')
        first=browser.evaluate('document.querySelector(".seat:not(:disabled)").dataset.id')
        browser.click(f'.seat[data-id="{first}"]')
        open_zone(browser,'Standard Tier 2','c1-right-bowl')
        second=browser.evaluate('document.querySelector(".seat:not(:disabled)").dataset.id')
        browser.click(f'.seat[data-id="{second}"]')
        assert browser.evaluate('document.getElementById("quantity").textContent==="2"')
        browser.click('#change-zone');open_zone(browser,'Standard Tier 1')
        browser.click('.seat:not(:disabled)')
        open_zone(browser,'VIP Diamond Experience')
        browser.click('#plus');browser.click('#plus')
        browser.click('#change-zone');open_zone(browser,'Standard Tier 2','c1-left-bowl')
        assert browser.evaluate(f'document.querySelector(\'.seat[data-id="{first}"]\').classList.contains("selected")')
        assert browser.evaluate('document.getElementById("quantity").textContent==="2"')
        # Resizing must refit without losing the two selected IDs.
        resize_width=375 if width<768 else 1024
        browser.call('Emulation.setDeviceMetricsOverride',{'width':resize_width,'height':900,'deviceScaleFactor':1,'mobile':width<768})
        browser.call('Emulation.setPageScaleFactor',{'pageScaleFactor':1})
        browser.wait(f'innerWidth==={resize_width}')
        browser.wait('document.querySelector(".seat-rows").scrollWidth<=document.querySelector(".seat-rows").clientWidth+1')
        assert browser.evaluate('document.getElementById("quantity").textContent==="2"')
        open_zone(browser,'VIP Diamond Experience')
        assert browser.evaluate('!document.getElementById("venue-overview").hidden && document.getElementById("quantity").textContent==="3" && document.querySelectorAll(".seat").length===0 && document.getElementById("seat-picker-tools").hidden && !document.getElementById("seat-card").querySelector(".quantity-control").hidden')
        browser.click('#change-zone');open_zone(browser,'Standard Tier 1')
        assert browser.evaluate('document.querySelectorAll(".seat.selected").length===1')
        # Zoom/pan by real pointer input; dragging must not toggle a seat.
        browser.click('[data-seat-zoom="actual"]');browser.click('[data-seat-zoom="in"]')
        browser.evaluate('document.querySelector(".seat-rows").scrollIntoView({behavior:"instant",block:"center"})')
        point=browser.evaluate('''(()=>{const v=document.querySelector('.seat-rows'),r=v.getBoundingClientRect();v.scrollLeft=100;v.scrollTop=50;return {x:r.left+r.width*.7,y:Math.max(160,r.top+80),before:v.scrollLeft,count:document.querySelectorAll('.seat.selected').length}})()''')
        browser.call('Input.dispatchMouseEvent',{'type':'mousePressed','x':point['x'],'y':point['y'],'button':'left','clickCount':1})
        browser.call('Input.dispatchMouseEvent',{'type':'mouseMoved','x':point['x']-65,'y':point['y']-20,'button':'left','buttons':1})
        browser.call('Input.dispatchMouseEvent',{'type':'mouseReleased','x':point['x']-65,'y':point['y']-20,'button':'left','clickCount':1})
        assert browser.evaluate('document.querySelector(".seat-rows").scrollLeft') > point['before'], f'Mouse pan failed at {width}'
        assert browser.evaluate('document.querySelectorAll(".seat.selected").length')==point['count'],'Drag selected a seat'
        if width<768:
            # Touch scrolling on a zoomed map uses the browser native pan gesture.
            viewport=browser.evaluate('''(()=>{const r=document.querySelector('.seat-rows').getBoundingClientRect();return {x:r.left+r.width*.7,y:Math.max(170,r.top+100),before:document.querySelector('.seat-rows').scrollLeft}})()''')
            browser.call('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':viewport['x'],'y':viewport['y']}]})
            for offset in [15,30,50,70]:
                browser.call('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':viewport['x']-offset,'y':viewport['y']}]})
            browser.call('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
            browser.wait(f'document.querySelector(".seat-rows").scrollLeft>{viewport["before"]}')
        browser.click('[data-seat-zoom="reset"]')
        assert browser.evaluate('document.querySelector(".seat-rows").scrollLeft===0 && document.querySelector(".seat-rows").scrollTop===0')
        results['interactions'].append({'width':width,'savedAcrossFragments':True,'savedAcrossCategories':True,'standingQuantitySaved':True,'resize':True,'mousePan':True,'touchPan':width<768})
    return results
