const C7_MAP = {


viewBox:"0 0 1200 1000",







/* =====================
   OUTER VENUE SHAPE
===================== */


boundary:{


shape:"path",


d:

"M140 270 Q600 60 1060 270 Q1120 500 1060 760 Q600 960 140 760 Q80 500 140 270 Z"


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







{
id:"vip",

name:"24K Magic VIP Experience",

labelText:"VIP EXPERIENCE",

category:"24K Magic VIP Experience",

price:"$390",

shape:"polygon",

points:

"260,210 940,210 830,350 370,350",

label:{

x:600,

y:280

}

},







{
id:"center",

name:"Gold Standing Pit",

labelText:"GOLD STANDING PIT",

category:"Gold Standing Pit",

price:"$180",

shape:"polygon",

points:

"350,390 850,390 900,680 300,680",

label:{

x:600,

y:530

}

},







{
id:"left",

name:"Silver Tribune",

labelText:"SILVER LEFT",

category:"Silver Tribune",

price:"$85",

shape:"polygon",

points:

"120,330 300,260 300,720 120,780",

label:{

x:210,

y:520

}

},







{
id:"right",

name:"Silver Tribune",

labelText:"SILVER RIGHT",

category:"Silver Tribune",

price:"$85",

shape:"polygon",

points:

"900,260 1080,330 1080,780 900,720",

label:{

x:990,

y:520

}

},







{
id:"upper-left",

name:"Silver Tribune",

labelText:"UPPER LEFT",

category:"Silver Tribune",

price:"$85",

shape:"polygon",

points:

"220,760 420,680 420,830 270,900",

label:{

x:330,

y:800

}

},







{
id:"upper-right",

name:"Silver Tribune",

labelText:"UPPER RIGHT",

category:"Silver Tribune",

price:"$85",

shape:"polygon",

points:

"780,680 980,760 930,900 780,830",

label:{

x:870,

y:800

}

},







{
id:"back",

name:"Silver Tribune",

labelText:"BACK",

category:"Silver Tribune",

price:"$85",

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






window.C7_MAP = C7_MAP;