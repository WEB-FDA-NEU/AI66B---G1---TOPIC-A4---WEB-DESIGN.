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


const quantity = Math.max(1, Math.floor(Number(data.quantity) || 1));
const price = Number(String(data.ticket.price).replace(/[^\d.]/g, ""));
const timestamp = Date.now();
const orderId = createConcertlyOrderId();
const ticketIdPrefix = orderId.slice(1);
const customer = localStorage.getItem("concertlyUser") || "Guest";
const paymentMethod = document.querySelector("select")?.value || "Not selected";
const tickets = Array.from({ length: quantity }, (_, index) => ({
	id: `${ticketIdPrefix}-${index + 1}`,
	concertId: data.concertId,
	seat: "Not assigned",
	type: data.ticket.type,
	orderId,
	status: "valid",
	customer,
}));
const order = {
	id: orderId,
	concertId: data.concertId,
	orderedAt: new Date(timestamp).toISOString(),
	status: "paid",
	customer,
	paymentMethod: { name: paymentMethod, sub: "Payment completed" },
	tickets: tickets.map((ticket) => ({
		id: ticket.id,
		seat: ticket.seat,
		type: ticket.type,
		price,
	})),
	fees: 0,
	discount: 0,
};

document.getElementById("confirm-payment").disabled = true;
saveConcertlyPurchase(order, tickets);

localStorage.removeItem(
"checkoutData"
);



alert(
"Payment Successful!"
);



window.location.href =
"../me/tickets.html";




};




});