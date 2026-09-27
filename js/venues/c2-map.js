const C2_MAP = {


viewBox:"0 0 1200 1000",







/* =====================
   OUTER VENUE
===================== */


boundary:{


shape:"path",


d:

"M150 220 Q600 80 1050 220 L1120 700 Q600 950 80 700 Z"


},







/* =====================
   STAGE
===================== */


stage:{


x:250,

y:60,

width:700,

height:100,

label:"STAGE"


},







/* =====================
   ZONES
===================== */


sections:[







/*
VIP FRONT
*/


{
id:"c2-vip",

name:"VIP After Hours Lounge",

labelText:"VIP LOUNGE",

category:"VIP After Hours Lounge",

price:"$420",


shape:"polygon",


points:

"300,200 900,200 820,350 380,350",


label:{

x:600,

y:280

}

},







/*
CENTER FLOOR
*/


{
id:"c2-floor",

name:"General Admission Standing",

labelText:"FLOOR STANDING",

category:"General Admission Standing",

price:"$90",


shape:"polygon",


points:

"400,400 800,400 850,700 350,700",


label:{

x:600,

y:540

}

},







/*
LEFT LOWER BOWL
*/


{
id:"c2-left",

name:"Cat 1 Seated",

labelText:"LOWER BOWL LEFT",

category:"Cat 1 Seated",

price:"$180",


shape:"path",


path:

"M120 300 Q260 250 330 400 L330 700 Q220 760 120 720 Z",


label:{

x:220,

y:520

}

},







/*
RIGHT LOWER BOWL
*/


{
id:"c2-right",

name:"Cat 1 Seated",

labelText:"LOWER BOWL RIGHT",

category:"Cat 1 Seated",

price:"$180",


shape:"path",


path:

"M870 400 Q940 250 1080 300 L1080 720 Q980 760 870 700 Z",


label:{

x:980,

y:520

}

},







/*
UPPER LEFT
*/


{
id:"c2-upper-left",

name:"Cat 1 Seated",

labelText:"UPPER LEFT",

category:"Cat 1 Seated",

price:"$180",


shape:"path",


path:

"M180 760 Q300 700 420 650 L420 820 Q300 900 200 880 Z",


label:{

x:300,

y:790

}

},







/*
UPPER RIGHT
*/


{
id:"c2-upper-right",

name:"Cat 1 Seated",

labelText:"UPPER RIGHT",

category:"Cat 1 Seated",

price:"$180",


shape:"path",


path:

"M780 650 Q900 700 1020 760 L1000 880 Q900 900 780 820 Z",


label:{

x:900,

y:790

}

},







/*
BACK
*/


{
id:"c2-back",

name:"General Admission Standing",

labelText:"BACK STANDING",

category:"General Admission Standing",

price:"$90",


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





window.C2_MAP = C2_MAP;