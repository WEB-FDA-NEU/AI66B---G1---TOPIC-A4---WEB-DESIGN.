const C8_MAP = {


viewBox:"0 0 1200 1000",







/* =====================
   OUTER VENUE
===================== */


boundary:{


shape:"path",


d:

"M160 220 Q600 40 1040 220 Q1120 450 1080 760 Q600 950 120 760 Q80 450 160 220 Z"


},


/* =====================
   STAGE
===================== */


stage:{


x:300,

y:70,

width:600,

height:90,

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
id:"c8-vip",

name:"Ghost VIP Lounge",

labelText:"VIP LOUNGE",

category:"Ghost VIP Lounge",

price:"$350",


shape:"polygon",


points:

"280,210 920,210 820,340 380,340",


label:{

x:600,

y:280

}

},







/* =====================
   STANDING PIT
===================== */


{
id:"c8-pit",

name:"Belieber Standing Pit",

labelText:"STANDING PIT",

category:"Belieber Standing Pit",

price:"$160",


shape:"polygon",


points:

"360,400 840,400 900,650 300,650",


label:{

x:600,

y:520

}

},







/* =====================
   LEFT GENERAL
===================== */


{
id:"c8-left",

name:"General Admission",

labelText:"GENERAL LEFT",

category:"General Admission",

price:"$75",


shape:"path",


path:

"M130 330 Q230 250 320 300 L320 700 Q220 760 130 720 Z",


label:{

x:220,

y:520

}

},







/* =====================
   RIGHT GENERAL
===================== */


{
id:"c8-right",

name:"General Admission",

labelText:"GENERAL RIGHT",

category:"General Admission",

price:"$75",


shape:"path",


path:

"M880 300 Q970 250 1070 330 L1070 720 Q980 760 880 700 Z",


label:{

x:980,

y:520

}

},







/* =====================
   UPPER LEFT
===================== */


{
id:"c8-upper-left",

name:"General Admission",

labelText:"UPPER LEFT",

category:"General Admission",

price:"$75",


shape:"polygon",


points:

"220,760 420,680 420,820 280,900",


label:{

x:330,

y:800

}

},







/* =====================
   UPPER RIGHT
===================== */


{
id:"c8-upper-right",

name:"General Admission",

labelText:"UPPER RIGHT",

category:"General Admission",

price:"$75",


shape:"polygon",


points:

"780,680 980,760 920,900 780,820",


label:{

x:870,

y:800

}

},







/* =====================
   BACK
===================== */


{
id:"c8-back",

name:"General Admission",

labelText:"BACK AREA",

category:"General Admission",

price:"$75",


shape:"polygon",


points:

"420,830 780,830 700,920 500,920",


label:{

x:600,

y:875

}

}





]



};





window.C8_MAP = C8_MAP;