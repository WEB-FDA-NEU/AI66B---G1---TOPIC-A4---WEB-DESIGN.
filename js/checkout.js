let checkoutData = null;
let checkoutConcert = null;


// ===============================
// GET CHECKOUT DATA
// ===============================

function getCheckoutData() {

  const saved =
    localStorage.getItem(
      "concertlyCheckout"
    );


  if (!saved) {

    return false;

  }


  checkoutData =
    JSON.parse(saved);



  checkoutConcert =
    MOCK_CONCERTS.find(
      concert =>
        concert.id === checkoutData.concertId
    );



  return !!checkoutConcert;

}



// ===============================
// PRICE FORMAT
// ===============================

function priceToNumber(price) {

  return Number(
    price.replace("$", "")
  );

}



// ===============================
// RENDER CONCERT
// ===============================

function renderCheckoutConcert() {


  const container =
    document.getElementById(
      "checkout-concert"
    );


  container.innerHTML = `


    <div class="card-media">

      <img

      src="${checkoutConcert.banner}"

      alt="${checkoutConcert.title}"

      style="
      width:100%;
      height:260px;
      object-fit:cover;
      "

      >

    </div>



    <div style="padding:24px">


      <h2>
      ${checkoutConcert.title}
      </h2>


      <h3>
      ${checkoutConcert.artist}
      </h3>



      <p>
      ${checkoutConcert.location}
      </p>


      <p>
      ${checkoutConcert.date}
      ·
      ${checkoutConcert.time}
      </p>


    </div>


  `;


}



// ===============================
// RENDER SELECTED TICKETS
// ===============================

function renderCheckoutTickets(){


  const list =
    document.getElementById(
      "checkout-ticket-list"
    );



  list.innerHTML =
    checkoutData.tickets
    .map(ticket=>`


      <div class="selected-row">


        <span>

          ${ticket.type}

          x${ticket.quantity}

        </span>



        <strong>

        $${

          priceToNumber(ticket.price)

          *

          ticket.quantity

        }

        </strong>


      </div>


    `)
    .join("");



  let quantity = 0;


  checkoutData.tickets.forEach(ticket=>{

    quantity += ticket.quantity;

  });



  document.getElementById(
    "checkout-quantity"
  )
  .textContent =
  `${quantity} Tickets`;



  document.getElementById(
    "checkout-total"
  )
  .textContent =
  checkoutData.total;


}



// ===============================
// CONFIRM PAYMENT
// ===============================

function confirmPayment(){


  alert(
    "Payment confirmed successfully!"
  );


}



// ===============================
// INIT
// ===============================

document.addEventListener(
"DOMContentLoaded",
()=>{


  if(!getCheckoutData()){


    window.location.replace(
      "../concerts/index.html"
    );


    return;

  }



  renderCheckoutConcert();


  renderCheckoutTickets();



  document
  .getElementById(
    "confirm-payment"
  )
  .addEventListener(
    "click",
    confirmPayment
  );


});