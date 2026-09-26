// =====================================
// ARIANA CONCERT MAP V4
// Stadium style layout
// =====================================


const ARIANA_MAP = {

viewBox:"0 0 1200 1000",



stage:{
x:430,
y:60,
width:340,
height:70,
label:"MAIN STAGE"
},



venue:{
shape:
"M120 260 Q120 120 300 100 H900 Q1080 120 1080 260 V820 Q1080 920 900 920 H300 Q120 920 120 820 Z"
},



sections:[



// =====================
// FLOOR
// =====================


{
id:"floor-a1",
name:"FLOOR A1",
type:"vip",

shape:"polygon",

points:
"390,230 810,230 860,410 340,410"
},




// =====================
// TIER 1 FRONT
// =====================


{
id:"cat1-left",
name:"CAT 1 LEFT",
type:"tier1",

shape:"polygon",

points:
"180,450 370,450 350,620 150,620"
},



{
id:"cat1-center",
name:"CAT 1 CENTER",
type:"tier1",

shape:"polygon",

points:
"400,450 800,450 800,620 400,620"
},



{
id:"cat1-right",
name:"CAT 1 RIGHT",
type:"tier1",

shape:"polygon",

points:
"830,450 1020,450 1050,620 850,620"
},





// =====================
// TIER 2
// =====================


{
id:"cat2-left",
name:"CAT 2 LEFT",
type:"tier2",

shape:"polygon",

points:
"150,650 350,630 400,800 210,800"
},



{
id:"cat2-center",
name:"CAT 2 CENTER",
type:"tier2",

shape:"polygon",

points:
"390,650 810,650 850,820 350,820"
},



{
id:"cat2-right",
name:"CAT 2 RIGHT",
type:"tier2",

shape:"polygon",

points:
"850,630 1050,650 990,800 800,800"
},





// =====================
// SIDE STADIUM
// =====================


{
id:"a4-left",
name:"A4",
type:"tier2",

shape:"polygon",

points:
"120,350 200,300 170,650 120,700"
},



{
id:"a5-right",
name:"A5",
type:"tier2",

shape:"polygon",

points:
"1000,300 1080,350 1080,700 1030,650"
},





// =====================
// BACK
// =====================


{
id:"general-standing",
name:"GENERAL STANDING",
type:"vip",

shape:"polygon",

points:
"300,850 900,850 820,910 380,910"
}



]

};




function getVenueMap(){

return ARIANA_MAP;

}