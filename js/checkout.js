function escapeHtml(value) {
	return String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}

// Mirror a server order into the localStorage purchases the "My tickets / My orders"
// pages still read, so a real purchase shows up there until those pages call the API.
function saveServerOrderLocally(order, data, paymentName) {
	const orderId = `#CT-${order.order_number}`;
	const customer = localStorage.getItem("concertlyUser") || "Guest";
	const tickets = order.tickets.map((ticket, index) => ({
		id: `CT${order.order_number}-${index + 1}`,
		serverTicketId: ticket.id,
		ticketCode: ticket.ticket_code,
		concertId: data.concertId,
		seat: `${ticket.zone} ${ticket.row}${ticket.seat_number}`,
		type: ticket.zone,
		orderId,
		status: "valid",
		customer,
	}));
	saveConcertlyPurchase(
		{
			id: orderId,
			serverOrderId: order.id,
			concertId: data.concertId,
			orderedAt: order.created_at,
			status: "paid",
			customer,
			paymentMethod: { name: paymentName, sub: "Payment completed" },
			tickets: tickets.map((ticket, index) => ({
				id: ticket.id,
				seat: ticket.seat,
				type: ticket.type,
				price: order.tickets[index].price,
			})),
			fees: 0,
			discount: 0,
		},
		tickets,
	);
}

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

// ---------------------------------------------------------------------------------
// Server-backed checkout: runs when the seats were held through the booking API
// (data.reservationId). It replaces the mock handler above; without a reservation the
// original localStorage-only flow is untouched.
// ---------------------------------------------------------------------------------
if (data.reservationId && window.ConcertlyAPI) {
	const api = window.ConcertlyAPI;
	const confirmBtn = document.getElementById("confirm-payment");
	const methodSelect = document.querySelector("select");
	const timer = document.createElement("div");
	timer.className = "checkout-timer";
	timer.setAttribute("role", "timer");
	payment.before(timer);

	const seatLabels = (data.seats || []).map((seat) => seat.zone + " " + seat.label);
	concertInfo.insertAdjacentHTML(
		"beforeend",
		`<p>Seats: <strong>${seatLabels.map(escapeHtml).join(", ")}</strong></p>`,
	);

	const expire = () => {
		localStorage.removeItem("checkoutData");
		window.location.href = "session-expired.html";
	};

	let deadline = 0;
	let tick = null;
	const render = () => {
		const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
		timer.textContent = `Seats held for ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
		timer.classList.toggle("urgent", left <= 60);
		if (left === 0) {
			clearInterval(tick);
			api.release(data.reservationId).catch(() => {}).finally(expire);
		}
	};

	// Ask the server how long is really left (the browser clock may be off).
	confirmBtn.disabled = true;
	api.getReservation(data.reservationId).then((hold) => {
		if (hold.status !== "active") return expire();
		deadline = Date.now() + hold.seconds_left * 1000;
		confirmBtn.disabled = false;
		render();
		tick = setInterval(render, 1000);
	}).catch((error) => {
		if (error.code === "network") {
			timer.textContent = "Cannot reach the booking server. Please try again.";
		} else {
			expire();
		}
	});

	confirmBtn.onclick = async () => {
		confirmBtn.disabled = true;
		try {
			const order = await api.checkout(data.reservationId, methodSelect.value);
			clearInterval(tick);
			saveServerOrderLocally(order, data, methodSelect.options[methodSelect.selectedIndex].text);
			localStorage.removeItem("checkoutData");
			alert("Payment Successful!");
			window.location.href = "../me/tickets.html";
		} catch (error) {
			if (error.code === "reservation_expired" || error.code === "seat_unavailable") {
				expire();
				return;
			}
			alert(error.message);
			confirmBtn.disabled = false;
		}
	};
}

});