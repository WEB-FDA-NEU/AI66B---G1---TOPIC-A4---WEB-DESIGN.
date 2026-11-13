const C5_MAP = {


viewBox:"0 0 1200 1000",







/* =====================
   OUTER VENUE
===================== */


boundary:{


shape:"path",


d:

"M160 180 Q600 50 1040 180 L1100 780 Q600 960 100 780 Z"


},







/* =====================
   STAGE
===================== */


stage:{


x:260,

y:70,

width:680,

height:100,

label:"STAGE"


},







/* =====================
   ZONES
===================== */


sections:[







/* =====================
   VIP
===================== */


{
id:"c5-vip",

name:"LLOUD Ultimate VIP Meet & Greet",
bookingType:"standing",

labelText:"VIP MEET & GREET",

category:"LLOUD Ultimate VIP Meet & Greet",

price:"$450",


shape:"polygon",


points:

"300,220 900,220 820,350 380,350",


label:{

x:600,

y:285

}

},







/* =====================
   CENTER PREMIUM
===================== */


{
id:"c5-center",

name:"Tier 1 Center Seated",
bookingType:"seated",

labelText:"CENTER PREMIUM",

category:"Tier 1 Center Seated",

price:"$200",


shape:"polygon",


points:

"300,400 900,400 850,620 350,620",


label:{

x:600,

y:520

}

},







/* =====================
   LEFT OUTER
===================== */


{
id:"c5-left",

name:"Rockstar Standing Zone",
bookingType:"standing",

labelText:"LEFT STANDING",

category:"Rockstar Standing Zone",

price:"$95",


shape:"polygon",


points:

"120,330 280,260 280,700 120,760",


label:{

x:200,

y:520

}

},







/* =====================
   RIGHT OUTER
===================== */


{
id:"c5-right",

name:"Rockstar Standing Zone",
bookingType:"standing",

labelText:"RIGHT STANDING",

category:"Rockstar Standing Zone",

price:"$95",


shape:"polygon",


points:

"920,260 1080,330 1080,760 920,700",


label:{

x:1000,

y:520

}

},







/* =====================
   BACK
===================== */


{
id:"c5-back",

name:"Rockstar Standing Zone",
bookingType:"standing",

labelText:"BACK STANDING",

category:"Rockstar Standing Zone",

price:"$95",


shape:"polygon",


points:

"350,760 850,760 720,900 480,900",


label:{

x:600,

y:830

}

}





]



};





window.C5_MAP = C5_MAP;