class VenueEngine {


constructor(container){

    this.container = container;

}







render(map){


if(!map){

console.error(
"Venue map missing"
);

return;

}




let svg = `


<svg

class="venue-svg"

viewBox="${map.viewBox}"

style="font-family:var(--font-family);">





<defs>



<pattern

id="stage-grid"

width="20"

height="20"

patternUnits="userSpaceOnUse">


<rect

width="20"

height="20"

fill="#ff4f9a">

</rect>



<path

d="M20 0 L0 0 0 20"

fill="none"

stroke="rgba(255,255,255,.25)"

stroke-width="1">

</path>


</pattern>



</defs>



`;









/* =====================
   OUTER VENUE BORDER
===================== */


if(map.boundary){



if(map.boundary.shape==="path"){



svg += `



<path


class="venue-boundary"


d="${map.boundary.d}">

</path>



`;



}





if(map.boundary.shape==="ellipse"){



svg += `



<ellipse


class="venue-boundary"


cx="${map.boundary.cx}"


cy="${map.boundary.cy}"


rx="${map.boundary.rx}"


ry="${map.boundary.ry}">

</ellipse>



`;



}


}









/* =====================
   STAGE
===================== */


if(map.stage){



svg += `



<rect


class="stage-box"


fill="url(#stage-grid)"


x="${map.stage.x}"


y="${map.stage.y}"


width="${map.stage.width}"


height="${map.stage.height}"


rx="25">

</rect>





<text


class="stage-label"


font-family="inherit"


x="${map.stage.x + map.stage.width/2}"


y="${map.stage.y + map.stage.height/2 + 10}"


text-anchor="middle">


${map.stage.label}


</text>



`;



}









/* =====================
   ZONES
===================== */


map.sections.forEach(section=>{


svg += this.renderSection(section);


});







svg += `

</svg>

`;







this.container.innerHTML = svg;



this.bindEvents();



}









renderSection(section){



let shape = "";







if(section.shape==="polygon"){



shape = `



<polygon


points="${section.points}"


class="seat-zone">

</polygon>



`;



}






if(section.shape==="path"){



shape = `



<path


d="${section.path}"


class="seat-zone">

</path>



`;



}






return `



<g


class="venue-section"
role="button"
tabindex="0"
aria-label="${section.labelText || section.name} · ${section.bookingType || 'standing'}"


data-id="${section.id}"


data-name="${section.name}"
data-booking-type="${section.bookingType || 'standing'}"


data-label="${section.labelText || section.name}"


data-category="${section.category || ''}"


data-price="${section.price || ''}"

>



${shape}






<text


class="section-name"


font-family="inherit"


x="${section.label?.x || 600}"


y="${section.label?.y || 500}"


text-anchor="middle">


${section.labelText || section.name}


</text>




</g>



`;



}









bindEvents(){



this.container

.querySelectorAll(".venue-section")

.forEach(section=>{





section.onkeydown = event => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    // SVG <g> elements do not expose HTMLElement.click() in every browser.
    section.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }
};
section.onclick=()=>{






this.container

.querySelectorAll(".venue-section")

.forEach(item=>{


item.classList.remove(
"active"
);


});






section.classList.add(
"active"
);








const zone = {



id:

section.dataset.id,



name:

section.dataset.name,

bookingType: section.dataset.bookingType,



label:

section.dataset.label,



category:

section.dataset.category,



price:

section.dataset.price



};









document.dispatchEvent(


new CustomEvent(

"zoneSelected",

{

detail:zone

}

)


);







};



});




}



}





window.VenueEngine = VenueEngine;

// Presentation geometry only. Never creates, renumbers or filters database seats.
window.SeatGeometry = (() => {
  const NS = "http://www.w3.org/2000/svg";
  const outlines = new WeakMap();
  const layouts = new WeakMap();
  const rowOrder = (a, b) => a.row.length - b.row.length || a.row.localeCompare(b.row) || a.number - b.number || a.id - b.id;
  function outline(section) {
    if (outlines.has(section)) return outlines.get(section);
    if (section.shape === "polygon") {
      const points = section.points.trim().split(/\s+/).map(pair => pair.split(",").map(Number));
      outlines.set(section, points);
      return points;
    }
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", section.path);
    const length = path.getTotalLength();
    const count = Math.min(1536, Math.max(256, Math.ceil(length * 2)));
    const points = Array.from({ length: count }, (_, i) => {
      const point = path.getPointAtLength(length * i / count);
      return [point.x, point.y];
    });
    outlines.set(section, points);
    return points;
  }
  function area(points) {
    return Math.abs(points.reduce((sum, p, i) => {
      const q = points[(i + 1) % points.length]; return sum + p[0] * q[1] - q[0] * p[1];
    }, 0)) / 2;
  }
  function inside(points, x, y) {
    let result = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i], b = points[j];
      if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
    }
    return result;
  }
  function fits(points, x, y, size) {
    // Corners + edge midpoints: an entire selectable square stays inside the zone.
    const h = size * .57;
    return [[-h,-h],[0,-h],[h,-h],[h,0],[h,h],[0,h],[-h,h],[-h,0],[0,0]]
      .every(([dx,dy]) => inside(points, x + dx, y + dy));
  }
  function quotas(total, weights) {
    const sum = weights.reduce((a,b) => a+b, 0);
    const raw = weights.map(w => total * w / sum);
    const result = raw.map(Math.floor);
    const order = raw.map((value, i) => ({i, fraction: value - result[i]})).sort((a,b) => b.fraction - a.fraction || a.i - b.i);
    for (let left = total - result.reduce((a,b) => a+b, 0), i = 0; i < left; i++) result[order[i].i]++;
    return result;
  }
  function layout(section, seats, stage) {
    const world = outline(section);
    const center = world.reduce((p,q) => [p[0]+q[0]/world.length,p[1]+q[1]/world.length], [0,0]);
    const origin = [stage.x + stage.width/2, stage.y + stage.height/2];
    const distance = Math.hypot(center[0]-origin[0],center[1]-origin[1]) || 1;
    const v = [(center[0]-origin[0])/distance,(center[1]-origin[1])/distance];
    const u = [v[1],-v[0]];
    // All detail maps face the stage: smaller y means closer to the stage.
    const points = world.map(p => [(p[0]-origin[0])*u[0]+(p[1]-origin[1])*u[1],(p[0]-origin[0])*v[0]+(p[1]-origin[1])*v[1]]);
    const xs=points.map(p=>p[0]), ys=points.map(p=>p[1]);
    const bounds={left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys)};
    const curved = section.shape === "path" && /[QCATS]/i.test(section.path.replace(/[eE][+-]?\d+/g,""));
    let size = Math.sqrt(area(points) / Math.max(seats.length * 3, 1));
    let rows=[];
    for (let attempt=0; attempt<45; attempt++,size*=.88) {
      rows=[];
      const pitch=size*1.5;
      if (curved) {
        const radii=points.map(p=>Math.hypot(...p));
        const angles=points.map(p=>Math.atan2(p[0],p[1]));
        const lo=Math.min(...angles), hi=Math.max(...angles);
        for (let r=Math.min(...radii)+pitch; r<Math.max(...radii)-size*.5; r+=pitch) {
          const count=Math.max(1,Math.floor((hi-lo)*r/pitch));
          const candidates=[];
          for(let i=0;i<count;i++) {
            const angle=lo+(hi-lo)*(i+.5)/count, x=r*Math.sin(angle),y=r*Math.cos(angle);
            if(fits(points,x,y,size)) candidates.push({x,y});
          }
          if(candidates.length)rows.push(candidates);
        }
      } else {
        for(let y=bounds.top+pitch;y<bounds.bottom-size*.6;y+=pitch) {
          const candidates=[];
          for(let x=bounds.left+pitch;x<bounds.right-size*.6;x+=pitch) if(fits(points,x,y,size))candidates.push({x,y});
          if(candidates.length)rows.push(candidates);
        }
      }
      if(rows.reduce((sum,row)=>sum+row.length,0)>=seats.length) break;
    }
    if(rows.reduce((sum,row)=>sum+row.length,0)<seats.length) throw new Error("This zone geometry cannot fit every existing seat.");
    const counts=quotas(seats.length,rows.map(row=>row.length));
    const sorted=[...seats].sort(rowOrder);
    const scale=44/size, margin=24;
    let index=0;
    const positions=[];
    rows.forEach((row,rank)=>{
      for(let i=0;i<counts[rank];i++) {
        const point=row[Math.floor((i+.5)*row.length/counts[rank])];
        const seat=sorted[index++];
        positions.push({seat,x:(point.x-bounds.left)*scale+margin,y:(point.y-bounds.top)*scale+margin,rank,geometryX:point.x,geometryY:point.y});
      }
    });
    return {section,positions,points,bounds,size,scale,margin,curved,origin,u,v,
      width:(bounds.right-bounds.left)*scale+margin*2,height:(bounds.bottom-bounds.top)*scale+margin*2};
  }
  function zone(map, name, seats) {
    const sections=map.sections.filter(s=>s.name===name && s.bookingType==="seated");
    if(!sections.length)throw new Error("No seated geometry is configured for this zone.");
    const sorted=[...seats].sort(rowOrder);
    const counts=quotas(sorted.length,sections.map(s=>area(outline(s))));
    const signature = JSON.stringify(sorted.map(s => [s.id,s.row,s.number]));
    if (!layouts.has(map)) layouts.set(map,new Map());
    const cache = layouts.get(map);
    let cached = cache.get(name);
    if (!cached || cached.signature !== signature) {
      let offset=0;
      const geometry = sections.map((section,i)=>{
        const group=sorted.slice(offset,offset+counts[i]);offset+=counts[i];
        return layout(section,group,map.stage);
      });
      cached = {signature,geometry};
      cache.set(name,cached);
    }
    // Reuse coordinates, but always bind current availability objects from the API.
    const current = new Map(seats.map(seat => [seat.id,seat]));
    return cached.geometry.map(view => ({...view,positions:view.positions.map(p => ({...p,seat:current.get(p.seat.id)}))}));
  }
  return {outline,area,inside,fits,layout,zone};
})();
