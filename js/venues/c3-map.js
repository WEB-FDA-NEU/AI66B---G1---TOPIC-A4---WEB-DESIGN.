const C3_MAP = {


viewBox:"0 0 1200 1000",







/* =====================
   OUTER VENUE
===================== */


boundary:{


shape:"ellipse",


cx:600,

cy:520,

rx:520,

ry:420


},







/* =====================
   STAGE CENTER
===================== */


stage:{


x:500,

y:330,

width:200,

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
id:"c3-vip",

name:"Cactus Jack VIP Pass",

labelText:"VIP EXPERIENCE",

category:"Cactus Jack VIP Pass",

price:"$300",


shape:"path",


path:

"M350 260 Q600 150 850 260 L780 340 Q600 270 420 340 Z",


label:{

x:600,

y:250

}

},







/* =====================
   MOSH PIT
===================== */


{
id:"c3-mosh",

name:"Floor Standing Mosh",

labelText:"MOSH PIT",

category:"Floor Standing Mosh",

price:"$75",


shape:"polygon",


points:

"420,450 780,450 780,650 420,650",


label:{

x:600,

y:560

}

},







/* =====================
   LEFT BALCONY
===================== */


{
id:"c3-left",

name:"Balcony Seating",

labelText:"BALCONY LEFT",

category:"Balcony Seating",

price:"$120",


shape:"path",


path:

"M120 300 Q250 200 380 220 L380 760 Q240 820 120 700 Z",


label:{

x:240,

y:500

}

},







/* =====================
   RIGHT BALCONY
===================== */


{
id:"c3-right",

name:"Balcony Seating",

labelText:"BALCONY RIGHT",

category:"Balcony Seating",

price:"$120",


shape:"path",


path:

"M820 220 Q950 200 1080 300 L1080 700 Q960 820 820 760 Z",


label:{

x:960,

y:500

}

},







/* =====================
   BACK BALCONY
===================== */


{
id:"c3-back",

name:"Balcony Seating",

labelText:"BACK BALCONY",

category:"Balcony Seating",

price:"$120",


shape:"path",


path:

"M300 780 Q600 900 900 780 L820 900 Q600 960 380 900 Z",


label:{

x:600,

y:850

}

}





]



};





window.C3_MAP = C3_MAP;