const C6_MAP = {


viewBox:"0 0 1200 1000",







/* =====================
   OUTER VENUE SHAPE
===================== */


boundary:{


shape:"path",


d:

"M100 260 Q600 20 1100 260 Q1160 500 1100 780 Q600 1000 100 780 Q40 500 100 260 Z"


},







/* =====================
   STAGE
===================== */


stage:{


x:250,

y:70,

width:700,

height:90,

label:"STAGE"


},







/* =====================
   ZONES
===================== */


sections:[







{
id:"vip",

name:"Karma Is My Boyfriend VIP",

labelText:"VIP EXPERIENCE",

category:"Karma Is My Boyfriend VIP",

price:"$490",

shape:"polygon",

points:

"220,210 980,210 860,350 340,350",

label:{

x:600,

y:280

}

},







{
id:"center",

name:"Lower Bowl Reserved",

labelText:"CENTER PREMIUM",

category:"Lower Bowl Reserved",

price:"$220",

shape:"polygon",

points:

"350,390 850,390 900,680 300,680",

label:{

x:600,

y:530

}

},







{
id:"side-left",

name:"Standard Floor GA",

labelText:"SIDE LEFT",

category:"Standard Floor GA",

price:"$95",

shape:"polygon",

points:

"100,330 280,250 280,720 100,780",

label:{

x:190,

y:540

}

},







{
id:"side-right",

name:"Standard Floor GA",

labelText:"SIDE RIGHT",

category:"Standard Floor GA",

price:"$95",

shape:"polygon",

points:

"920,250 1100,330 1100,780 920,720",

label:{

x:1010,

y:540

}

},







{
id:"upper-left",

name:"Standard Floor GA",

labelText:"UPPER LEFT",

category:"Standard Floor GA",

price:"$95",

shape:"polygon",

points:

"180,790 420,690 420,840 260,920",

label:{

x:320,

y:820

}

},







{
id:"upper-right",

name:"Standard Floor GA",

labelText:"UPPER RIGHT",

category:"Standard Floor GA",

price:"$95",

shape:"polygon",

points:

"780,690 1020,790 940,920 780,840",

label:{

x:880,

y:820

}

},







{
id:"back",

name:"Standard Floor GA",

labelText:"BACK STADIUM",

category:"Standard Floor GA",

price:"$95",

shape:"polygon",

points:

"420,840 780,840 700,930 500,930",

label:{

x:600,

y:890

}

}





]



};






window.C6_MAP = C6_MAP;