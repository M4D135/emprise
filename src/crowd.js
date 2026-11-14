/* RADE — civilian behaviour over Point de rupture's shared navigation and GPU protocol. */
(function(R){'use strict';
function create(world,n=480){
 const nav=PDR.nav.creer(world.navCity,{capaciteChamps:16}),random=PDR.villeReelle.hasard(135),people=[],packed=new Float32Array(n*4),goals=[];
 const free=[];for(let i=0;i<nav.n;i++)if(nav.libre[i])free.push(i);
 for(let i=0;i<12;i++){const cell=free[Math.floor(random()*free.length)];goals.push(cell);const k=nav.demander(cell,0);nav.prendre(k);}nav.avancer(12);
 for(let i=0;i<n;i++){
  let cell=free[Math.floor(random()*free.length)];if(i<140){const x=60+(random()-.5)*70,z=20+random()*180;cell=nav.caseProche(x*1000,z*1000);if(cell<0)cell=free[i];}
  const x=nav.centreX(cell)/1000,z=nav.centreZ(cell)/1000;
  people.push({x,z,cap:0,goal:i%goals.length,speed:.85+random()*.6,panic:0,blocked:0});
 }
 let tick=0,avoids=0;
 function update(dt,events=[]){
  tick++;const car=world.car,cc=Math.cos(car.cap),ss=Math.sin(car.cap),nearCar=car.v>.3,hash=new Map();
  for(let i=0;i<n;i++){const p=people[i],key=Math.floor(p.x/2)+','+Math.floor(p.z/2);if(!hash.has(key))hash.set(key,[]);hash.get(key).push(i);}
  for(let i=0;i<n;i++){
   const p=people[i],cell=nav.caseDe(p.x*1000,p.z*1000),field=nav.champs[p.goal],code=field.dir[cell];
   if(code===PDR.nav.BUT||(code===PDR.nav.AUCUN&&tick%20===i%20)){p.goal=(p.goal+1+(i%3))%goals.length;}
   let vx=0,vz=0;if(code<128){vx=PDR.nav.DX[code*2]/1024;vz=PDR.nav.DZ[code*2]/1024;}
   const dx=p.x-car.x,dz=p.z-car.z,u=dx*cc+dz*ss,v=-dx*ss+dz*cc;
   p.panic=Math.max(0,p.panic-dt);
   if(nearCar&&Math.abs(v)<4&&u*Math.sign(car.u||1)>-4&&Math.abs(u)<6+car.v*.7){const side=v>=0?1:-1;vx=-ss*side*3;vz=cc*side*3;p.panic=.8;avoids++;}
   for(const e of events)if(e.name==='shot'&&Math.hypot(p.x-e.x,p.z-e.z)<35){p.panic=3;vx=(p.x-e.x)/8;vz=(p.z-e.z)/8;}
   for(let zz=-1;zz<=1;zz++)for(let xx=-1;xx<=1;xx++)for(const j of hash.get((Math.floor(p.x/2)+xx)+','+(Math.floor(p.z/2)+zz))||[]){if(j===i)continue;const q=people[j],a=p.x-q.x,b=p.z-q.z,d=Math.hypot(a,b);if(d>0&&d<.8){vx+=a/d*(.8-d)*2;vz+=b/d*(.8-d)*2;}}
   const d=Math.hypot(vx,vz)||1,speed=p.panic?3.1:p.speed,dx2=vx/d*speed*dt,dz2=vz/d*speed*dt,ox=p.x,oz=p.z;
   const escape=world.blocked(p.x,p.z,.24);const move=()=>{if(!world.blocked(p.x+dx2,p.z,.24))p.x+=dx2;if(!world.blocked(p.x,p.z+dz2,.24))p.z+=dz2;};if(escape)world.withoutCar(move);else move();
   const moved=Math.hypot(p.x-ox,p.z-oz);p.blocked=moved<.002?p.blocked+dt:0;
   if(p.blocked>2){p.goal=(p.goal+1)%goals.length;p.blocked=0;}
   if(moved>.001)p.cap=Math.atan2(p.x-ox,p.z-oz);
   packed[i*4]=p.x;packed[i*4+1]=p.z;packed[i*4+2]=p.cap;
   packed[i*4+3]=PDR.regles.coder(i%3,2,moved>.001?(p.panic?8:1):0,63,0);
  }
 }
 update(0);return {people,packed,nav,update,get avoids(){return avoids;},n,get version(){return tick;}};
}R.crowd={create};})(globalThis.RADE=globalThis.RADE||{});
