const C1_MAP = {


viewBox:"0 0 1200 1000",



/* =====================
   OUTER VENUE BOUNDARY
===================== */


boundary:{


shape:"path",


d:

"M120 260 Q600 40 1080 260 Q1160 520 1080 780 Q600 960 120 780 Q40 520 120 260 Z"


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




/*
VIP
Closest to stage
Highest price
*/


{
id:"c1-vip",

name:"VIP Diamond Experience",

labelText:"VIP EXPERIENCE",

category:"VIP Diamond Experience",

price:"$350",


shape:"polygon",


points:

"250,210 950,210 850,350 350,350",


label:{

x:600,

y:285

}

},






/*
Premium Center
Second highest
*/


{
id:"c1-center-premium",

name:"Standard Tier 1",

labelText:"CENTER PREMIUM",

category:"Standard Tier 1",

price:"$150",


shape:"polygon",


points:

"330,390 870,390 920,620 280,620",


label:{

x:600,

y:520

}

},






/*
Left Bowl
*/


{
id:"c1-left-bowl",

name:"Standard Tier 2",

labelText:"LEFT SIDE",

category:"Standard Tier 2",

price:"$80",


shape:"path",


path:

"M120 330 L280 260 L280 700 L120 780 Z",


label:{

x:200,

y:530

}

},






/*
Right Bowl
*/


{
id:"c1-right-bowl",

name:"Standard Tier 2",

labelText:"RIGHT SIDE",

category:"Standard Tier 2",

price:"$80",


shape:"path",


path:

"M920 260 L1080 330 L1080 780 L920 700 Z",


label:{

x:1000,

y:530

}

},






/*
Back Upper Left
*/


{
id:"c1-upper-left",

name:"Standard Tier 2",

labelText:"UPPER LEFT",

category:"Standard Tier 2",

price:"$80",


shape:"polygon",


points:

"180,760 400,650 400,820 250,900",


label:{

x:290,

y:800

}

},






/*
Back Upper Right
*/


{
id:"c1-upper-right",

name:"Standard Tier 2",

labelText:"UPPER RIGHT",

category:"Standard Tier 2",

price:"$80",


shape:"polygon",


points:

"800,650 1020,760 950,900 800,820",


label:{

x:910,

y:800

}

},






/*
Back Stadium
*/


{
id:"c1-back",

name:"Standard Tier 2",

labelText:"BACK STADIUM",

category:"Standard Tier 2",

price:"$80",


shape:"polygon",


points:

"400,820 800,820 700,930 500,930",


label:{

x:600,

y:875

}

}





]



};





window.C1_MAP = C1_MAP;