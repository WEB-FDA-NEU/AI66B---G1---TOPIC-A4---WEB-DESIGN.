const TICKET_ID_CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function getTicketCodeWords(value) {
	return (
		String(value || "")
			.replace(/[.]/g, "")
			.replace(/[Đđ]/g, "D")
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.toUpperCase()
			.match(/[A-Z]+|\d+/g) || []
	);
}

function createEventCode(concert) {
	const year =
		String(concert.date || "").match(/(?:19|20)\d{2}/)?.[0] ||
		String(concert.title || "").match(/(?:19|20)\d{2}/)?.[0] ||
		"2000";
	const words = getTicketCodeWords(concert.title).filter(
		(word) => !/^(?:19|20)\d{2}$/.test(word),
	);
	let initials = "";

	for (const word of words) {
		if (initials.length >= 4) break;
		initials += initials.length === 0 && /^\d+$/.test(word)
			? word.slice(0, 2)
			: word[0];
	}

	return `${initials.slice(0, 4) || "EVNT"}${year.slice(-2)}`;
}

function createTicketTypeCode(type) {
	const words = getTicketCodeWords(type);
	const normalizedType = words.join(" ");
	const category = normalizedType.match(/\bCAT(?:EGORY)?\s*(\d+)\b/);
	const standardTier = normalizedType.match(/\bSTANDARD\s+TIER\s*(\d+)\b/);

	if (/\bVIP\b/.test(normalizedType)) return "VIP";
	if (category) return `CAT${category[1]}`;
	if (standardTier) return `ST${standardTier[1]}`;
	if (/\bGENERAL\b|\bFLOOR\s+STANDING\b|\bSTANDING\s+ROOM\b/.test(normalizedType)) {
		return "GA";
	}

	return words
		.map((word) => (/^\d+$/.test(word) ? word : word[0]))
		.join("");
}

function createRandomTicketCode() {
	const values = new Uint8Array(8);
	if (globalThis.crypto?.getRandomValues) {
		globalThis.crypto.getRandomValues(values);
	} else {
		values.forEach((_, index) => {
			values[index] = Math.floor(Math.random() * 256);
		});
	}

	return Array.from(
		values,
		(value) => TICKET_ID_CHARACTERS[value & 31],
	).join("");
}

function createConcertTicketId(concert, type) {
	return `TK-${createEventCode(concert)}-${createTicketTypeCode(type)}-${createRandomTicketCode()}`;
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
const concert = MOCK_CONCERTS.find((item) => item.id === data.concertId);
if (!concert) {
	window.alert("Concert not found. Please select your tickets again.");
	return;
}
const buyerNameInput = document.getElementById("buyer-name");
const customer = buyerNameInput?.value.trim();
if (!customer) {
	window.alert("Please enter the buyer's full name.");
	buyerNameInput?.focus();
	return;
}
const customerAccount = localStorage.getItem("concertlyUser") || "Guest";
const paymentMethod = document.querySelector("select")?.value || "Not selected";
const tickets = Array.from({ length: quantity }, (_, index) => ({
	id: createConcertTicketId(concert, data.ticket.type),
	concertId: data.concertId,
	seat: "Not assigned",
	type: data.ticket.type,
	orderId,
	status: "valid",
	customer,
	customerAccount,
}));
const order = {
	id: orderId,
	concertId: data.concertId,
	orderedAt: new Date(timestamp).toISOString(),
	status: "paid",
	customer,
	customerAccount,
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