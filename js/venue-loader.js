class VenueLoader {


constructor(){


this.loadedMap = null;


}







load(concertId){



return new Promise((resolve,reject)=>{



const mapFiles = {


c1:"c1-map.js",

c2:"c2-map.js",

c3:"c3-map.js",

c4:"c4-map.js",

c5:"c5-map.js",

c6:"c6-map.js",

c7:"c7-map.js",

c8:"c8-map.js",

c9:"c9-map.js",

c10:"c10-map.js",

c11:"c11-map.js"

};






const file = mapFiles[concertId];





// concert chưa có map

if(!file){


console.log(
"No venue map for:",
concertId
);


resolve(null);

return;


}








const script = document.createElement("script");



script.src =

`../../js/venues/${file}`;







script.onload = ()=>{



const mapName =

concertId.toUpperCase()

+"_MAP";




this.loadedMap =

window[mapName];





if(this.loadedMap){


resolve(this.loadedMap);


}

else{


reject(
"Map data not found"
);


}



};








script.onerror = ()=>{


reject(
"Cannot load map file"
);


};






document.body.appendChild(script);



});



}



}






window.VenueLoader = VenueLoader;
