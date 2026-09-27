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

name:"OA VIP Soundcheck Package",

labelText:"VIP SOUNDCHECK",

category:"OA VIP Soundcheck Package",

price:"$380",


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

labelText:"CENTER PREMIUM",

category:"Tier 1 Center Seated",

price:"$170",


shape:"polygon",


points:

"320,400 880,400 930,620 270,620",


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