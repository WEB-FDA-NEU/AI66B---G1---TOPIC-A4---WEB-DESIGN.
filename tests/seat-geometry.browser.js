/* Run in real Chrome through mixed_admission_browser.py; uses read-only inventory GETs. */
(async () => {
  const results = [];
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  function check(map, zone, views) {
    const expected = zone.seats.map(s => s.id).sort((a,b)=>a-b);
    const actual = views.flatMap(v => v.positions.map(p => p.seat.id)).sort((a,b)=>a-b);
    assert(JSON.stringify(actual) === JSON.stringify(expected), `${map.id || 'map'} ${zone.name}: missing/duplicate seats`);
    for (const view of views) {
      const native = document.createElementNS('http://www.w3.org/2000/svg', view.section.shape);
      native.setAttribute(view.section.shape === 'path' ? 'd' : 'points', view.section.path || view.section.points);
      // Chrome path.isPointInFill needs a rendered SVG context.
      const probe=document.createElementNS(native.namespaceURI,'svg');
      probe.style.cssText='position:fixed;left:-20000px;pointer-events:none';
      probe.append(native);document.body.append(probe);
      for (const p of view.positions) {
        const original = zone.seats.find(s=>s.id === p.seat.id);
        assert(original === p.seat, 'Seat identity/data changed');
        // Native SVG fill checks are independent of the sampled outline algorithm.
        for (const dx of [-.5,0,.5]) for (const dy of [-.5,0,.5]) {
          const x = p.geometryX + view.size*dx, y = p.geometryY + view.size*dy;
          const point = new DOMPoint(view.origin[0]+view.u[0]*x+view.v[0]*y,view.origin[1]+view.u[1]*x+view.v[1]*y);
          assert(native.isPointInFill(point), `${zone.name}: seat ${p.seat.row}${p.seat.number} outside native SVG`);
        }
        assert(p.x >= 22 && p.y >=22 && p.x+22 <= view.width && p.y+22 <=view.height,'Seat outside canvas');
      }
      for (let i=0;i<view.positions.length;i++) for(let j=i+1;j<view.positions.length;j++) {
        const a=view.positions[i], b=view.positions[j];
        assert(Math.abs(a.x-b.x)>=44 || Math.abs(a.y-b.y)>=44,`${zone.name}: overlapping seats`);
      }
      probe.remove();
      // Database rows advance towards the back, even when a row spans visual strips.
      const rows = [...new Set(view.positions.map(p=>p.seat.row))];
      const rankRange = rows.map(row => view.positions.filter(p=>p.seat.row===row).map(p=>p.rank));
      for(let i=1;i<rankRange.length;i++) assert(Math.max(...rankRange[i-1])<=Math.min(...rankRange[i]),'Rows out of stage order');
      if (view.section.labelText === 'CENTER PREMIUM') {
        // The corrected center must not cover existing standing click areas.
        for(const standing of map.sections.filter(s=>s.bookingType==='standing')) {
          const boundary=SeatGeometry.outline(standing);
          assert(view.positions.every(p=>!SeatGeometry.inside(boundary,
            view.origin[0]+view.u[0]*p.geometryX+view.v[0]*p.geometryY,
            view.origin[1]+view.u[1]*p.geometryX+view.v[1]*p.geometryY)), 'CENTER PREMIUM overlaps standing');
        }
        const ranks = [...new Set(view.positions.map(p=>p.rank))];
        const count = rank => view.positions.filter(p=>p.rank===rank).length;
        assert(count(ranks[0]) > count(ranks.at(-1)), 'CENTER PREMIUM must narrow away from stage');
      }
    }
  }
  for(let cid=1;cid<=11;cid++) {
    const map=await new VenueLoader().load(`c${cid}`);
    const response=await fetch(`${CONCERTLY_API_BASE}/concerts/${cid}/seats`);
    assert(response.ok, `Inventory ${cid} failed`);
    const data=await response.json();
    for(const zone of data.zones.filter(z=>z.booking_type==='seated')) {
      const views=SeatGeometry.zone(map,zone.name,zone.seats);
      check(map,zone,views);
      // A cached layout must rebind live statuses, not retain an earlier snapshot.
      const fresh=zone.seats.map((s,i)=>({...s,status:i===0?'sold':s.status}));
      const refreshed=SeatGeometry.zone(map,zone.name,fresh);
      assert(refreshed.flatMap(v=>v.positions).find(p=>p.seat.id===fresh[0].id).seat.status==='sold','Stale availability in geometry cache');
      results.push({concert:`c${cid}`,zone:zone.name,seats:zone.seats.length,sections:views.length,curved:views.some(v=>v.curved),nativeBoundary:true,noOverlap:true});
    }
  }
  const stage={x:100,y:-80,width:200,height:40};
  for(const [name,points] of [['triangle','200,0 400,300 0,300'],['trapezoid','0,0 400,0 300,300 100,300']]) {
    const seats=Array.from({length:240},(_,i)=>({id:i+1,row:String.fromCharCode(65+Math.floor(i/20)),number:i%20+1,status:'available'}));
    const section={id:name,name,bookingType:'seated',shape:'polygon',points};
    const map={stage,sections:[section]};
    const views=SeatGeometry.zone(map,name,seats);
    check(map,{name,seats},views);
    const ranks=[...new Set(views[0].positions.map(p=>p.rank))];
    const count=r=>views[0].positions.filter(p=>p.rank===r).length;
    assert(name==='triangle'?count(ranks[0])<count(ranks.at(-1)):count(ranks[0])>count(ranks.at(-1)),'Synthetic shape widths incorrect');
    results.push({synthetic:name,seats:240,nativeBoundary:true,noOverlap:true});
  }
  return results;
})()
