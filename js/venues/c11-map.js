const C11_MAP = {


viewBox:"0 0 1200 1000",





/* =====================
   OUTER VENUE SHAPE
===================== */


boundary:{


shape:"path",


d:

"M150 280 Q600 60 1050 280 Q1120 500 1050 760 Q600 950 150 760 Q80 500 150 280 Z"


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

name:"Midnight VIP Pass",

labelText:"VIP PASS",

category:"Midnight VIP Pass",

price:"$260",

shape:"polygon",

points:

"260,210 940,210 850,350 350,350",

label:{

x:600,

y:280

}

},







{
id:"front-row",

name:"Front Row Orchestra",

labelText:"FRONT ROW",

category:"Front Row Orchestra",

price:"$140",

shape:"polygon",

points:

"330,390 870,390 900,650 300,650",

label:{

x:600,

y:520

}

},







{
id:"balcony-left",

name:"Balcony Seated",

labelText:"BALCONY LEFT",

category:"Balcony Seated",

price:"$60",

shape:"polygon",

points:

"120,330 300,260 300,720 120,780",

label:{

x:210,

y:520

}

},







{
id:"balcony-right",

name:"Balcony Seated",

labelText:"BALCONY RIGHT",

category:"Balcony Seated",

price:"$60",

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

name:"Balcony Seated",

labelText:"UPPER LEFT",

category:"Balcony Seated",

price:"$60",

shape:"polygon",

points:

"220,760 420,680 420,830 260,900",

label:{

x:330,

y:800

}

},







{
id:"upper-right",

name:"Balcony Seated",

labelText:"UPPER RIGHT",

category:"Balcony Seated",

price:"$60",

shape:"polygon",

points:

"780,680 980,760 940,900 780,830",

label:{

x:870,

y:800

}

},







{
id:"back",

name:"Balcony Seated",

labelText:"BACK",

category:"Balcony Seated",

price:"$60",

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






window.C11_MAP = C11_MAP;