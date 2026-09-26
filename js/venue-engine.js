// VENUE ENGINE V2
// Render concert map + fixed seat layout

class VenueEngine{

constructor(container){
this.container=container;
}



render(map){

let svg=`

<svg class="venue-svg" viewBox="${map.viewBox}">

<path 
class="venue-outline"
d="${map.venue.shape}">
</path>


<rect
class="stage-box"
x="${map.stage.x}"
y="${map.stage.y}"
width="${map.stage.width}"
height="${map.stage.height}"
rx="35">
</rect>


<text
class="stage-label"
x="${map.stage.x + map.stage.width/2}"
y="${map.stage.y + 42}"
text-anchor="middle">
${map.stage.label}
</text>

`;



map.sections.forEach(section=>{

svg+=this.renderSection(section);

});


svg+=`</svg>`;


this.container.innerHTML=svg;


this.bindEvents();

}





renderSection(section){


let html=`

<g 
class="venue-section ${section.type}"
data-id="${section.id}">

`;



if(section.shape==="polygon"){

html+=`

<polygon 
points="${section.points}">
</polygon>

`;

}



if(section.shape==="path"){

html+=`

<path 
d="${section.path}">
</path>

`;

}




const center=this.getCenter(section);


html+=`

<text
class="section-name"
x="${center.x}"
y="${center.y}"
text-anchor="middle">

${section.name}

</text>

`;




// chỉ render ghế cho khu seat

if(
section.type==="seat"
&&
typeof ARIANA_SEATS!=="undefined"
&&
ARIANA_SEATS[section.id]
){


const seats=
this.createSeats(
ARIANA_SEATS[section.id]
);


html+=seats;


}



html+=`</g>`;


return html;

}





createSeats(data){


let html="";


data.forEach(layout=>{


for(let r=0;r<layout.rows;r++){


for(let c=0;c<layout.cols;c++){



let curve =
Math.abs(
layout.cols/2-c
)*0.15;



let x=
layout.x+
c*13+
curve;



let y=
layout.y+
r*13;



html+=`

<circle

class="venue-seat"

cx="${x}"

cy="${y}"

r="4">

</circle>

`;



}

}

});


return html;

}






getCenter(section){


if(section.points){


let p=
section.points
.split(" ")[0]
.split(",");



return{

x:Number(p[0])+100,

y:Number(p[1])+100

};


}


return{

x:600,

y:500

};


}






bindEvents(){


document
.querySelectorAll(".venue-section")
.forEach(section=>{


section.onclick=()=>{


document
.querySelectorAll(".venue-section")
.forEach(s=>
s.classList.remove("active")
);



section.classList.add("active");


};


});


}


}