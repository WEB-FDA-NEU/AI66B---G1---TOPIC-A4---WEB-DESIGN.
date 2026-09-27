const C4_MAP = {


viewBox:"0 0 1200 1000",







/* =====================
   OUTER VENUE SHAPE
===================== */


boundary:{


shape:"path",


d:

"M140 300 Q600 60 1060 300 Q1120 500 1060 760 Q600 950 140 760 Q80 500 140 300 Z"


},









/* =====================
   STAGE
===================== */


stage:{


x:320,

y:70,

width:560,

height:90,

label:"STAGE"


},







/* =====================
   ZONES
===================== */


sections:[







{
id:"vip",

name:"OA VIP Soundcheck Package",

labelText:"VIP SOUNDCHECK",

category:"OA VIP Soundcheck Package",

price:"$380",

shape:"polygon",

points:

"280,220 920,220 820,350 380,350",

label:{

x:600,

y:290

}

},







{
id:"floor",

name:"General Floor Standing",

labelText:"FLOOR",

category:"General Floor Standing",

price:"$85",

shape:"polygon",

points:

"380,380 820,380 850,650 350,650",

label:{

x:600,

y:520

}

},







{
id:"lower-left",

name:"Lower Bowl Seated",

labelText:"LOWER LEFT",

category:"Lower Bowl Seated",

price:"$170",

shape:"polygon",

points:

"120,350 330,280 330,680 120,730",

label:{

x:220,

y:520

}

},







{
id:"lower-right",

name:"Lower Bowl Seated",

labelText:"LOWER RIGHT",

category:"Lower Bowl Seated",

price:"$170",

shape:"polygon",

points:

"870,280 1080,350 1080,730 870,680",

label:{

x:980,

y:520

}

},







{
id:"upper-left",

name:"Lower Bowl Seated",

labelText:"UPPER LEFT",

category:"Lower Bowl Seated",

price:"$170",

shape:"polygon",

points:

"200,740 420,650 420,820 250,890",

label:{

x:320,

y:790

}

},







{
id:"upper-right",

name:"Lower Bowl Seated",

labelText:"UPPER RIGHT",

category:"Lower Bowl Seated",

price:"$170",

shape:"polygon",

points:

"780,650 1000,740 950,890 780,820",

label:{

x:880,

y:790

}

},







{
id:"back",

name:"Lower Bowl Seated",

labelText:"BACK",

category:"Lower Bowl Seated",

price:"$170",

shape:"polygon",

points:

"420,820 780,820 700,920 500,920",

label:{

x:600,

y:870

}

}





]



};






window.C4_MAP = C4_MAP;