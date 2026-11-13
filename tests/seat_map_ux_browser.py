"""Fit, single-zone navigation and interaction checks reused by the isolated browser suite."""
import base64
import json
from browser_qa import open_zone


def run_ux_checks(browser, artifacts):
    results = {'overviews': [], 'sections': [], 'interactions': []}
    for width in [320,375,390,768,1024,1280,1600]:
        browser.call('Emulation.setDeviceMetricsOverride', {'width':width,'height':900,'deviceScaleFactor':1,'mobile':width<768})
        for cid in range(1,12):
            browser.navigate(f'pages/concerts/tickets.html?id=c{cid}&ticketType=ignored')
            browser.wait(f"innerWidth==={width}")
            browser.wait('document.querySelector(".ticket-item p")?.textContent.includes("available") && document.querySelector(".venue-svg")')
            assert browser.evaluate('!document.getElementById("seat-card").hidden && document.querySelector(".map-card").getBoundingClientRect().height>0 && document.querySelectorAll(".seat").length===0 && document.getElementById("seat-picker").textContent.includes("Pick a zone")'), 'Overview or detail placeholder missing on first load'
            assert browser.evaluate('''(()=>{const v=document.getElementById('concert-map');return v.scrollWidth<=v.clientWidth+1 && v.scrollHeight<=v.clientHeight+1 && document.documentElement.scrollWidth<=innerWidth+1})()'''),f'Venue overflow c{cid}/{width}'
            sections=browser.evaluate(f'(async()=>{{const m=await new VenueLoader().load("c{cid}");return m.sections.filter(s=>s.bookingType==="seated").map(s=>({{id:s.id,name:s.name}}))}})()')
            browser.evaluate('window.__overviewNode=document.querySelector(".venue-svg");window.__overviewShapes=JSON.stringify([...document.querySelectorAll(".venue-section")].map(s=>({id:s.dataset.id,name:s.dataset.name,shape:s.querySelector(".seat-zone").outerHTML})))')
            assert browser.evaluate('Boolean(document.querySelector(".ticket-left .map-card") && document.querySelector(".ticket-right .selection-card"))'), 'Original layout changed'
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
                    zoomed:v.classList.contains('is-zoomed'),
                    hiddenOverview:document.querySelector('.map-card').getBoundingClientRect().height===0,
                    preview:!!document.querySelector('.seat-preview'),
                    outside:all.filter(s=>{const b=s.getBoundingClientRect();return b.left<r.left-.5 || b.right>r.right+.5 || b.top<r.top-.5 || b.bottom>r.bottom+.5}).length,
                    overflow:document.documentElement.scrollWidth-innerWidth,
                    seatIds:all.map(s=>Number(s.dataset.id))};
                })()''')
                assert metrics['sections']==1 and metrics['id']==section['id'],metrics
                assert metrics['x']<=1 and metrics['y']<=1 and metrics['outside']==0 and metrics['overflow']<=1,metrics
                assert not metrics['zoomed'] and not metrics['hiddenOverview'] and metrics['preview'],metrics
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
                browser.click('[data-seat-zoom="0.25"]')
                assert browser.evaluate('document.querySelector(".seat-rows").classList.contains("is-zoomed")')
                browser.click('[data-seat-zoom="reset"]')
                assert browser.evaluate('document.querySelector(".seat-rows").scrollWidth<=document.querySelector(".seat-rows").clientWidth+1')
                results['sections'].append({'concert':cid,'section':section['id'],'width':width,'fit':True,'singleSection':True})
    # Current UI retains seats within a category, but has no cross-category draft cart.
    for width in [390,1280]:
        browser.call('Emulation.setDeviceMetricsOverride',{'width':width,'height':900,'deviceScaleFactor':1,'mobile':width<768})
        browser.navigate('pages/concerts/tickets.html?id=c1')
        open_zone(browser,'Standard Tier 2','c1-left-bowl')
        first=browser.evaluate('document.querySelector(".seat:not(:disabled)").dataset.id')
        browser.click(f'.seat[data-id="{first}"]')
        open_zone(browser,'Standard Tier 2','c1-right-bowl')
        second=browser.evaluate('document.querySelector(".seat:not(:disabled)").dataset.id')
        browser.click(f'.seat[data-id="{second}"]')
        assert browser.evaluate('document.getElementById("quantity").textContent==="2"')
        open_zone(browser,'Standard Tier 2','c1-left-bowl')
        assert browser.evaluate('document.querySelector(".seat.selected").dataset.id')==first
        # Selecting a different category starts a fresh choice, as in the recovered UI.
        open_zone(browser,'Standard Tier 1')
        assert browser.evaluate('document.getElementById("quantity").textContent==="0" && document.querySelectorAll(".seat.selected").length===0')
        for _ in range(4):browser.click('[data-seat-zoom="0.25"]')
        before=browser.evaluate('document.querySelector(".seat").getBoundingClientRect().width')
        assert before>0
        browser.evaluate('document.querySelector(".seat-rows").scrollLeft=60')
        assert browser.evaluate('document.querySelector(".seat-rows").scrollLeft>0')
        if width<768:
            browser.evaluate('document.querySelector(".seat-rows").scrollIntoView({behavior:"instant",block:"center"})')
            point=browser.evaluate("(()=>{const v=document.querySelector('.seat-rows'),r=v.getBoundingClientRect();return {x:r.left+r.width*.7,y:Math.max(180,r.top+100),before:v.scrollLeft}})()")
            browser.call('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':point['x'],'y':point['y']}]})
            for offset in [15,30,50,70]:
                browser.call('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':point['x']-offset,'y':point['y']}]})
            browser.call('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
            browser.wait(f'document.querySelector(".seat-rows").scrollLeft>{point["before"]}')
        browser.click('[data-seat-zoom="reset"]')
        assert browser.evaluate('document.querySelector(".seat-rows").scrollLeft===0 && document.querySelector(".seat-rows").scrollTop===0')
        assert browser.evaluate('document.querySelector(".seat").getBoundingClientRect().width')<before
        browser.click('.seat:not(:disabled)')
        resize_width=375 if width<768 else 1024
        browser.call('Emulation.setDeviceMetricsOverride',{'width':resize_width,'height':900,'deviceScaleFactor':1,'mobile':width<768})
        browser.call('Emulation.setPageScaleFactor',{'pageScaleFactor':1})
        browser.wait(f'innerWidth==={resize_width} && document.querySelector(".seat-rows").scrollWidth<=document.querySelector(".seat-rows").clientWidth+1')
        assert browser.evaluate('document.querySelectorAll(".seat.selected").length===1')
        open_zone(browser,'VIP Diamond Experience')
        browser.click('#plus');browser.click('#plus')
        assert browser.evaluate('document.getElementById("quantity").textContent==="3" && document.querySelectorAll(".seat").length===0 && document.getElementById("seat-picker-tools").hidden && !document.querySelector(".quantity-control").hidden && document.querySelector(".venue-svg").getBoundingClientRect().height>0')
        results['interactions'].append({'width':width,'savedAcrossFragments':True,'categorySwitchResetsSelection':True,'standingQuantity':True,'resize':True,'zoomScrollReset':True,'touchPan':width<768})
    return results
