const C10_MAP = {


viewBox:"0 0 1200 1000",







/* =====================
   OUTER VENUE SHAPE
===================== */


boundary:{


shape:"path",


d:

"M120 280 Q600 50 1080 280 Q1140 500 1080 760 Q600 960 120 760 Q60 500 120 280 Z"


},







/* =====================
   STAGE
===================== */


stage:{


x:280,

y:70,

width:640,

height:90,

label:"STAGE"


},







/* =====================
   ZONES
===================== */


sections:[







{
id:"vip",

name:"One of a Kind VIP",

labelText:"VIP EXPERIENCE",

category:"One of a Kind VIP",

price:"$420",

shape:"polygon",

points:

"250,210 950,210 850,350 350,350",

label:{

x:600,

y:280

}

},







{
id:"pit",

name:"Coup D'Etat Pit",

labelText:"COUP D'ETAT PIT",

category:"Coup D'Etat Pit",

price:"$210",

shape:"polygon",

points:

"340,390 860,390 900,660 300,660",

label:{

x:600,

y:520

}

},







{
id:"standard-left",

name:"Standard Tier",

labelText:"STANDARD LEFT",

category:"Standard Tier",

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
id:"standard-right",

name:"Standard Tier",

labelText:"STANDARD RIGHT",

category:"Standard Tier",

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

name:"Standard Tier",

labelText:"UPPER LEFT",

category:"Standard Tier",

price:"$85",

shape:"polygon",

points:

"200,760 420,680 420,830 260,900",

label:{

x:320,

y:800

}

},







{
id:"upper-right",

name:"Standard Tier",

labelText:"UPPER RIGHT",

category:"Standard Tier",

price:"$85",

shape:"polygon",

points:

"780,680 1000,760 940,900 780,830",

label:{

x:880,

y:800

}

},







{
id:"back",

name:"Standard Tier",

labelText:"BACK",

category:"Standard Tier",

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






window.C10_MAP = C10_MAP;