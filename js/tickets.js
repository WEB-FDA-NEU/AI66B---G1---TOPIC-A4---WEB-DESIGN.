document.addEventListener("DOMContentLoaded",()=>{



/* =====================
   GET CONCERT ID
===================== */


const params =
new URLSearchParams(
    window.location.search
);


const concertId =
params.get("id");



const concert =
MOCK_CONCERTS.find(
    item=>item.id===concertId
);




if(!concert){

    console.error(
        "Concert not found"
    );

    return;

}








/* =====================
   ELEMENT
===================== */


const banner =
document.getElementById(
    "concert-banner"
);


const title =
document.getElementById(
    "concert-title"
);


const artist =
document.getElementById(
    "concert-artist"
);


const meta =
document.getElementById(
    "concert-meta"
);



const description =
document.getElementById(
    "concert-description"
);



const ticketList =
document.getElementById(
    "ticket-list"
);



const eventInfo =
document.getElementById(
    "event-information"
);



const mapContainer =
document.getElementById(
    "concert-map"
);



const selectedTicket =
document.getElementById(
    "selected-ticket"
);



const quantityText =
document.getElementById(
    "quantity"
);



const total =
document.getElementById(
    "total"
);



const minus =
document.getElementById(
    "minus"
);



const plus =
document.getElementById(
    "plus"
);



const continueBtn =
document.getElementById(
    "continue-payment"
);








let currentTicket = null;

let quantity = 0;









/* =====================
   CONCERT INFO
===================== */


banner.src =
concert.banner;



title.textContent =
concert.title;



artist.textContent =
concert.artist;



meta.textContent =

`${concert.location} • ${concert.date} • ${concert.time}`;





description.textContent =
concert.description;









/* =====================
   EVENT INFO
===================== */


eventInfo.innerHTML = `


<div class="info-row">

<span>Date</span>

<strong>
${concert.date}
</strong>

</div>




<div class="info-row">

<span>Time</span>

<strong>
${concert.time}
</strong>

</div>




<div class="info-row">

<span>Venue</span>

<strong>
${concert.location}
</strong>

</div>




<div class="info-row">

<span>Price Range</span>

<strong>
${concert.priceRange}
</strong>

</div>


`;









/* =====================
   TICKET CATEGORY
===================== */


ticketList.innerHTML =


concert.tickets.map(

(ticket,index)=>{


return `


<div

class="ticket-item"

data-index="${index}">


<div>

<h3>
${ticket.type}
</h3>


<p>
${ticket.status}
</p>


</div>



<strong>

${ticket.price}

</strong>


</div>


`;



}

).join("");









/* =====================
   SELECT FROM CATEGORY
===================== */


document

.querySelectorAll(".ticket-item")

.forEach(item=>{


item.onclick=()=>{


document

.querySelectorAll(".ticket-item")

.forEach(x=>

x.classList.remove(
"active"
)

);



item.classList.add(
"active"
);





const index =
item.dataset.index;




currentTicket =
concert.tickets[index];



quantity = 1;



updateSelection();



};



});









/* =====================
   MAP LOAD
===================== */


if(mapContainer && window.VenueLoader){



const loader =
new VenueLoader();



loader.load(concert.id)

.then(map=>{


if(!map)
return;



const engine =
new VenueEngine(
mapContainer
);



engine.render(map);



});


}









/* =====================
   ZONE CLICK
===================== */


document.addEventListener(

"zoneSelected",

(e)=>{


const zone =
e.detail;



const ticket =
concert.tickets.find(

item =>

item.type === zone.name

);





if(!ticket)
return;





currentTicket =
ticket;



quantity = 1;



updateSelection();






document

.querySelectorAll(".ticket-item")

.forEach(item=>{


item.classList.remove(
"active"
);



if(
item.dataset.index ==
concert.tickets.indexOf(ticket)

){


item.classList.add(
"active"
);


}



});





}

);









/* =====================
   QUANTITY
===================== */


plus.onclick=()=>{


if(!currentTicket)
return;


quantity++;


updateSelection();


};






minus.onclick=()=>{


if(quantity<=0)
return;


quantity--;


updateSelection();


};









/* =====================
   UPDATE SELECTION
===================== */


function updateSelection(){



if(!currentTicket){


selectedTicket.innerHTML = `

No ticket selected

`;



quantityText.textContent =
"0";


total.textContent =
"$0";


continueBtn.disabled =
true;



return;


}





if(quantity===0){

return;

}







selectedTicket.innerHTML = `


<h3>

${currentTicket.type}

</h3>



<p>

Price: ${currentTicket.price}

</p>


`;






quantityText.textContent =
quantity;





const price =

Number(

currentTicket.price.replace(
"$",
""
)

);





total.textContent =

"$" +

(price * quantity);





continueBtn.disabled =
false;



}









/* =====================
   CHECKOUT
===================== */


continueBtn.onclick=()=>{



const checkoutData = {


concertId:concert.id,

concertTitle:concert.title,

artist:concert.artist,

banner:concert.banner,

location:concert.location,

date:concert.date,

time:concert.time,


ticket:currentTicket,

quantity:quantity,

total:total.textContent


};



localStorage.setItem(

"checkoutData",

JSON.stringify(checkoutData)

);





window.location.href =

"../checkout/index.html";



};





});