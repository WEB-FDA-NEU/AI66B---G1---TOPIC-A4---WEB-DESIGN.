document.addEventListener(
"DOMContentLoaded",
()=>{


const data =
JSON.parse(
localStorage.getItem("checkoutData")
);



if(!data){

window.location.href =
"session-expired.html";

return;

}




const concertInfo =
document.getElementById(
"concert-info"
);



const payment =
document.getElementById(
"payment-summary"
);






const banner =
document.getElementById(
"concert-banner"
);



banner.innerHTML = `

<img 
src="${data.banner}"
alt="${data.concertTitle}"
>


`;





concertInfo.innerHTML = `


<h3>
${data.concertTitle}
</h3>



<p class="artist">
${data.artist}
</p>



<div class="event-meta">


<p>
📅 ${data.date}
</p>



<p>
⏰ ${data.time}
</p>



<p>
📍 ${data.location}
</p>


</div>



<hr>



<p>
Ticket:
<strong>
${data.ticket.type}
</strong>
</p>



<p>
Quantity:
${data.quantity}
</p>


`;






payment.innerHTML = `


<div class="checkout-row">

<span>
Ticket Price
</span>

<strong>
${data.ticket.price}
</strong>


</div>




<div class="checkout-row">

<span>
Total
</span>

<strong>
${data.total}
</strong>


</div>



`;







document
.getElementById(
"confirm-payment"
)
.onclick=()=>{



localStorage.removeItem(
"checkoutData"
);



alert(
"Payment Successful!"
);



window.location.href =
"../index.html";




};




});