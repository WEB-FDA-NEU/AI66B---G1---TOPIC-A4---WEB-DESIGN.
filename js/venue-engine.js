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


data-id="${section.id}"


data-name="${section.name}"


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



document

.querySelectorAll(".venue-section")

.forEach(section=>{





section.onclick=()=>{






document

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