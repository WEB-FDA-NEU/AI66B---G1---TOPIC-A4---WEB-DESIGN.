const C9_MAP = {


viewBox:"0 0 1200 1000",







/* =====================
   OUTER VENUE SHAPE
===================== */


boundary:{


shape:"path",


d:

"M100 250 Q600 20 1100 250 Q1170 500 1100 800 Q600 1000 100 800 Q30 500 100 250 Z"


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







{
id:"vip",

name:"ARMY Ultimate VIP Pass",

labelText:"ARMY VIP",

category:"ARMY Ultimate VIP Pass",

price:"$550",

shape:"polygon",

points:

"200,210 1000,210 850,360 350,360",

label:{

x:600,

y:290

}

},







{
id:"soundcheck",

name:"Soundcheck Standing",

labelText:"SOUNDCHECK",

category:"Soundcheck Standing",

price:"$280",

shape:"polygon",

points:

"320,400 880,400 920,680 280,680",

label:{

x:600,

y:540

}

},







{
id:"cat3-left",

name:"CAT 3 Seating",

labelText:"CAT 3 LEFT",

category:"CAT 3 Seating",

price:"$90",

shape:"polygon",

points:

"100,320 280,250 280,740 100,800",

label:{

x:190,

y:540

}

},







{
id:"cat3-right",

name:"CAT 3 Seating",

labelText:"CAT 3 RIGHT",

category:"CAT 3 Seating",

price:"$90",

shape:"polygon",

points:

"920,250 1100,320 1100,800 920,740",

label:{

x:1010,

y:540

}

},







{
id:"upper-left",

name:"CAT 3 Seating",

labelText:"UPPER LEFT",

category:"CAT 3 Seating",

price:"$90",

shape:"polygon",

points:

"180,800 420,690 420,850 260,930",

label:{

x:320,

y:830

}

},







{
id:"upper-right",

name:"CAT 3 Seating",

labelText:"UPPER RIGHT",

category:"CAT 3 Seating",

price:"$90",

shape:"polygon",

points:

"780,690 1020,800 940,930 780,850",

label:{

x:880,

y:830

}

},







{
id:"back",

name:"CAT 3 Seating",

labelText:"BACK STADIUM",

category:"CAT 3 Seating",

price:"$90",

shape:"polygon",

points:

"420,850 780,850 700,940 500,940",

label:{

x:600,

y:900

}

}





]



};






window.C9_MAP = C9_MAP;