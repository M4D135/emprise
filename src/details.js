/* RADE — pedestrian-scale Marseille dressing. All props are checked against roads. */
(function(R){'use strict';
function add(w){const {city,scenery,blocked,addMesh}=w,rand=PDR.villeReelle.hasard(6513);let count=0;
 const add=(m,solid=true)=>{if(solid)addMesh(m);else scenery.push(m);count++;};
 const box=(p,s,c,cap=0,mat=0,solid=true)=>add({shape:'box',p,s,r:[0,-cap,0],color:c,mat,outdoor:true},solid);
 const cyl=(p,s,c)=>add({shape:'cylinder',p,s,color:c,mat:0,outdoor:true});
 // Drain covers, worn asphalt repairs and service paint: flush with the road.
 for(let i=0;i<950;i++){const x=(rand()-.5)*625,z=(rand()-.5)*625;if(!city.surChaussee(x,z)||blocked(x,z,.7))continue;
  if(i%3===0){box([x,.096,z],[.62,.012,.62],[.15,.19,.20],0,0,false);for(let j=0;j<5;j++)box([x-.24+j*.12,.105,z],[.025,.006,.5],[.07,.10,.11],0,0,false);}
  else box([x,.095,z],[.35+rand()*1.2,.007,.5+rand()*2],[.21,.23,.23],rand(),0,false);
 }
 // Façade attachments use the existing building footprints; they never occupy a traffic lane.
 for(let i=0;i<city.emprises.length;i++){
  const b=city.emprises[i];if(Math.abs(b.x)>320||Math.abs(b.z)>320||b.lx<4||b.lz<4)continue;
  const cap=-(b.lacet||0),c=Math.cos(cap),s=Math.sin(cap),local=(u,y,v)=>[b.x+c*u-s*v,y,b.z+s*u+c*v];
  for(const side of [-1,1]){
   const z=side*(b.lz/2+.08),face=local(0,0,z+side*.9);if(city.surChaussee(face[0],face[2])||blocked(face[0],face[2],.35))continue;
   // Shopfront, striped awning, shutter, brass door trim, service pipe.
   const width=Math.min(4.5,b.lx*.55),accent=[[.14,.30,.31],[.38,.18,.14],[.20,.28,.39],[.37,.35,.20]][i%4];
   box(local(0,1.25,z),[width,2.25,.12],accent,cap,7);
   box(local(0,1.27,z+side*.071),[width*.88,1.87,.04],[.10,.18,.20],cap,8);
   for(const u of [-width*.43,0,width*.43])box(local(u,1.27,z+side*.11),[.055,1.93,.07],[.55,.49,.34],cap,0);
   box(local(0,2.54,z+side*.08),[width+.2,.27,.18],accent,cap,7);
   box(local(0,2.78,z+side*.45),[width+.4,.07,.94],[.78,.71,.54],cap,18);
   for(let j=0;j<9;j++)box(local(-width/2+j*width/8,2.825,z+side*.45),[width/18,.012,.94],accent,cap,18,false);
   box(local(width/2+.32,1.1,z),[.055,2.2,.055],[.30,.33,.30],cap);
   // Upper-floor air conditioner and wrought iron balcony in a restrained density.
   box(local(width*.32,3.7,z+side*.22),[.75,.48,.37],[.67,.67,.58],cap);
   for(let j=0;j<7;j++)box(local(width*.32-.28+j*.09,3.7,z+side*.42),[.025,.32,.012],[.23,.28,.28],cap,0,false);
   if(i%3===0){box(local(-.6,4.0,z+side*.45),[2.1,.12,.8],[.60,.57,.48],cap);box(local(-.6,4.72,z+side*.83),[2.1,.04,.04],[.12,.17,.18],cap);for(let j=0;j<10;j++)box(local(-1.58+j*.22,4.40,z+side*.83),[.022,.65,.022],[.12,.17,.18],cap);}
  }
 }
 // Small groups of café tables, crates, bins, delivery pallets, bicycle stands on clear pavements.
 let groups=0;for(let i=0;i<3000&&groups<95;i++){
  const x=(rand()-.5)*580,z=(rand()-.5)*580;if(blocked(x,z,2.4)||city.surChaussee(x,z))continue;
  let road=false,safe=true;for(const [dx,dz]of [[2,0],[-2,0],[0,2],[0,-2]]){if(city.surChaussee(x+dx,z+dz))safe=false;if(city.surChaussee(x+dx*3,z+dz*3))road=true;}if(!safe||!road)continue;
  groups++;const kind=groups%4;
  if(kind===0){cyl([x,.73,z],[.83,.045,.83],[.65,.56,.39]);cyl([x,.39,z],[.055,.68,.055],[.18,.24,.24]);for(const side of [-1,1]){box([x,.43,z+side*.75],[.42,.065,.40],[.25,.34,.29]);box([x,.69,z+side*.93],[.42,.5,.04],[.25,.34,.29]);for(const dx of [-.15,.15])for(const dz of [-.13,.13])box([x+dx,.22,z+side*.75+dz],[.025,.4,.025],[.17,.21,.20]);}}
  else if(kind===1){box([x,.43,z],[.55,.78,.55],[.16,.28,.25]);box([x,.84,z],[.60,.06,.60],[.08,.15,.14]);box([x,.43,z-.285],[.17,.23,.015],[.54,.59,.48],0,0,false);}
  else if(kind===2){for(let j=0;j<3;j++){box([x+j*.45,.25,z],[.4,.4,.5],[.43,.30,.18]);for(let k=0;k<3;k++)box([x+j*.45,.16+k*.11,z+.255],[.38,.02,.01],[.23,.16,.10],0,0,false);}}
  else{for(let j=0;j<3;j++){box([x+j*.5,.43,z],[.035,.78,.035],[.42,.46,.45]);box([x+j*.5,.43,z+.6],[.035,.78,.035],[.42,.46,.45]);box([x+j*.5,.82,z+.3],[.035,.035,.6],[.42,.46,.45]);}}
 }
 return {meshes:count,groups};
}R.details={add};})(globalThis.RADE=globalThis.RADE||{});
