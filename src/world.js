/* RADE — one metric world. x east, z south, y up. Body cap=atan2(z,x); camera yaw=cap+PI/2. */
(function(G){
'use strict';const R=G.RADE=G.RADE||{},clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mesh=(p,s,color=[.2,.25,.27],mat=0,cap=0)=>({shape:'box',p,s,r:[0,-cap,0],color,mat,outdoor:true});
function create({savedCity=null}={}){
 R.coreHeights?.apply(PDR.plans.marseille);
 const city=PDR.villeReelle.creerVille('marseille',{ilots:15});
 // Remove only RTS headquarters and resource-site decoration; geographic city stays intact.
 let at=0;let scenery=[];for(const [section,n] of Object.entries(city.mesures.comptes.parSection)){if(section!=='qg'&&section!=='sites')scenery.push(...city.objets.slice(at,at+n));at+=n;}
 const coreBounds={minX:-550,maxX:550,minZ:-550,maxZ:550},coast=R.coast?.create(),landmarks=R.landmarks?.create(),cityStream=R.cityStream?.create(R.cityData,{groundAt:(x,z)=>landmarks?.groundHeight(x,z)??coast?.heightAt(x,z)??.08,excludeBuilding:b=>!!landmarks?.excludes(b),saved:savedCity}),cb=R.cityData?.bounds;
 const bounds=coast&&cb?{minX:Math.min(coast.bounds.minX,cb[0]),minZ:Math.min(coast.bounds.minZ,cb[1]),maxX:Math.max(coast.bounds.maxX,cb[2]),maxZ:Math.max(coast.bounds.maxZ,cb[3])}:coreBounds;
 const inCore=(x,z)=>x>=-550&&x<=550&&z>=-550&&z<=550;
 // Replace complete source silhouettes before collision construction; keep foliage and overhead branches non-solid.
 const vegetation=R.details.prepareVegetation(scenery,city,coreBounds),clearedTrees=vegetation.removed;
 const boxes=[],buckets=new Map(),key=(x,z)=>Math.floor(x/8)+','+Math.floor(z/8);
 function addBox(q){
  q.c=Math.cos(q.cap);q.s=Math.sin(q.cap);
  const hx=Math.abs(q.c*q.a)+Math.abs(q.s*q.b),hz=Math.abs(q.s*q.a)+Math.abs(q.c*q.b);
  q.minX=q.x-hx;q.maxX=q.x+hx;q.minZ=q.z-hz;q.maxZ=q.z+hz;boxes.push(q);
  for(let z=Math.floor(q.minZ/8);z<=Math.floor(q.maxZ/8);z++)for(let x=Math.floor(q.minX/8);x<=Math.floor(q.maxX/8);x++){const k=x+','+z;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(q);}
  return q;
 }
 function fromMesh(m){
  if(m.terrain||m.coast||m.collision===false)return;
  if(m.vegetationPart&&m.vegetationPart!=='trunk')return;
  if(m.fx||m.shape==='foliage'||m.shape==='ring'||m.s[1]<.12||m.p[1]+m.s[1]/2<.4)return;
  if(!m.boundary&&!m.landmark&&(Math.abs(m.p[0])>580||Math.abs(m.p[2])>580))return;
  const rx=m.r?.[0]||0,rz=m.r?.[2]||0,s=m.s;
  // Sloping roof pieces get a conservative envelope; vertical façades keep their exact yaw and dimensions.
  const h=Math.abs(Math.cos(rx)*Math.cos(rz)*s[1])+Math.abs(Math.sin(rx)*s[2])+Math.abs(Math.sin(rz)*s[0]);
  const sx=Math.abs(Math.cos(rz)*s[0])+Math.abs(Math.sin(rz)*s[1]);
  const sz=Math.abs(Math.cos(rx)*s[2])+Math.abs(Math.sin(rx)*s[1]);
  m.collision=true;addBox({mesh:m,x:m.p[0],z:m.p[2],a:sx/2,b:sz/2,minY:m.p[1]-h/2,maxY:m.p[1]+h/2,cap:-(m.r?.[1]||0),kind:'urban'});
 }
 if(landmarks)scenery.push(...landmarks.geometry);
 scenery.forEach(fromMesh);
 const rings=city.eau;
 function inRing(p,x,z){let inside=false;for(let i=0,j=p.length-2;i<p.length;j=i,i+=2){if((p[i+1]>z)!==(p[j+1]>z)&&x<(p[j]-p[i])*(z-p[i+1])/(p[j+1]-p[i+1])+p[i])inside=!inside;}return inside;}
 const water=(x,z)=>inCore(x,z)?rings.some(p=>inRing(p,x,z)):(coast?.water(x,z)??cityStream?.water(x,z)??false);
 function land(x,z,r=0){if(x-r<bounds.minX||x+r>bounds.maxX||z-r<bounds.minZ||z+r>bounds.maxZ)return false;for(const [dx,dz]of [[0,0],[r,0],[-r,0],[0,r],[0,-r]])if(water(x+dx,z+dz))return false;return true;}
 function candidates(x,z,r){const set=new Set();for(let j=Math.floor((z-r)/8);j<=Math.floor((z+r)/8);j++)for(let i=Math.floor((x-r)/8);i<=Math.floor((x+r)/8);i++)for(const q of buckets.get(i+','+j)||[])set.add(q);if(!inCore(x-r,z-r)||!inCore(x+r,z+r))for(const q of cityStream?.candidates(x,z,r)||[])set.add(q);return set;}
 function disk(q,x,z,r){const dx=x-q.x,dz=z-q.z,u=dx*q.c+dz*q.s,v=-dx*q.s+dz*q.c;return (u-clamp(u,-q.a,q.a))**2+(v-clamp(v,-q.b,q.b))**2<r*r;}
 let vehicle=null,ignoreVehicle=false,actor=null,actorSeated=false,weather=null,room=null,dynamicBodies=[];const fleet=[];
 const roomRegion=(x,z)=>room&&Math.abs(x-1000)<room.w/2+4&&Math.abs(z-1000)<room.d/2+4;
 const ground=(x=0,z=0)=>(roomRegion(x,z)||inCore(x,z)) ? .08 :(landmarks?.groundHeight(x,z)??coast?.heightAt(x,z)??.08);
 function staticBlocked(x,z,r=.28,y=ground(x,z),height=1.8){
  if(roomRegion(x,z))return room.blocked(x,z,r,y,height);
  if(!land(x,z,r))return true;if(!inCore(x-r,z-r)||!inCore(x+r,z+r))if(cityStream?.blocked?.(x,z,r,y,height))return true;
  for(const q of candidates(x,z,r))if(q.maxY>y+.22&&q.minY<y+height&&disk(q,x,z,r))return true;
  if(!ignoreVehicle)for(const c of fleet){const q=carBox(c);if(q.maxY>y+.22&&q.minY<y+height&&disk(q,x,z,r))return true;}return false;
 }
 const clearance=R.clearance.create({bodies:()=>dynamicBodies,staticBlocked});
 const blocked=(x,z,r=.28,y=ground(x,z),height=1.8)=>clearance.blocked(x,z,r,y,height);
 const carBox=c=>{const base=Number.isFinite(c.y)?c.y:ground(c.x,c.z);return {vehicle:c,x:c.x,z:c.z,a:R.vehicles.SPECS[c.model].length/2,b:R.vehicles.SPECS[c.model].width/2,c:Math.cos(c.cap),s:Math.sin(c.cap),cap:c.cap,minY:base+.1,maxY:base+R.vehicles.SPECS[c.model].height};};
 function overlap(a,b){
  if(b.minY>=a.maxY||b.maxY<=a.minY+.12)return null;
  let best=Infinity,nx=0,nz=0;
  for(const [x,z]of [[a.c,a.s],[-a.s,a.c],[b.c,b.s],[-b.s,b.c]]){
   const r1=a.a*Math.abs(x*a.c+z*a.s)+a.b*Math.abs(-x*a.s+z*a.c),r2=b.a*Math.abs(x*b.c+z*b.s)+b.b*Math.abs(-x*b.s+z*b.c);
   const d=(a.x-b.x)*x+(a.z-b.z)*z,depth=r1+r2-Math.abs(d);if(depth<=0)return null;if(depth<best){best=depth;nx=x*(d<0?-1:1);nz=z*(d<0?-1:1);}
  }return {nx,nz,depth:best,obstacle:b};
 }
 function carContact(c){
  const a=carBox(c);
  if(c.ai&&actor&&!actorSeated&&actor.y<a.maxY&&actor.y+1.8>a.minY&&disk(a,actor.x,actor.z,.36)){const dx=c.x-actor.x,dz=c.z-actor.z,d=Math.hypot(dx,dz)||1;return {nx:dx/d,nz:dz/d,depth:.05};}
  for(const other of fleet)if(other!==c){const h=overlap(a,carBox(other));if(h)return h;}
  for(const q of dynamicBodies){const h=overlap(a,q);if(h)return h;}
  for(const q of candidates(c.x,c.z,3.6)){const h=overlap(a,q);if(h)return h;}
  for(const u of [-a.a,0,a.a])for(const v of [-a.b,a.b])if(!land(c.x+u*a.c-v*a.s,c.z+u*a.s+v*a.c,.08))return {nx:-Math.cos(c.cap)*(c.u>=0?1:-1),nz:-Math.sin(c.cap)*(c.u>=0?1:-1),depth:.1};
  return null;
 }
 function moveVehicle(c,dx,dz,cap){
  const old=c.cap,turn=Math.atan2(Math.sin(cap-old),Math.cos(cap-old)),n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.15),Math.ceil(Math.abs(turn)/.025));let hit=null;
  for(let i=0;i<n;i++){const x=c.x,z=c.z,y=c.y,a=c.cap;c.x+=dx/n;c.z+=dz/n;c.y=ground(c.x,c.z);c.cap+=turn/n;const h=carContact(c);if(h){c.x=x;c.z=z;c.y=y;c.cap=a;hit=h;if(c.impactHandler&&c.choc<=0)c.impactHandler(h);break;}}
  return hit;
 }
 function rayBox(q,o,d,far){const dx=o[0]-q.x,dz=o[2]-q.z,oo=[dx*q.c+dz*q.s,o[1],-dx*q.s+dz*q.c],dd=[d[0]*q.c+d[2]*q.s,d[1],-d[0]*q.s+d[2]*q.c],loB=[-q.a,q.minY,-q.b],hiB=[q.a,q.maxY,q.b];let lo=0,hi=far;
  for(let k=0;k<3;k++){if(Math.abs(dd[k])<1e-9){if(oo[k]<loB[k]||oo[k]>hiB[k])return far;}else{let a=(loB[k]-oo[k])/dd[k],b=(hiB[k]-oo[k])/dd[k];if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);if(lo>hi)return far;}}return lo;
 }
 // Bound terrain work independently of the ray length. Core streets keep their exact flat fast path.
 function terrainRay(o,d,far,r=0){
  const end=[o[0]+d[0]*far,o[2]+d[2]*far];
  if(inCore(o[0],o[2])&&inCore(...end)){const t=d[1]<-1e-9?Math.max(0,(ground(o[0],o[2])+r-o[1])/d[1]):far;return {distance:Math.min(far,t),normal:[0,1,0]};}
  const gap=t=>o[1]+d[1]*t-ground(o[0]+d[0]*t,o[2]+d[2]*t)-r;
  if(gap(0)<-1e-6)return {distance:0,normal:[0,1,0]};
  const count=Math.min(256,Math.max(1,Math.ceil(far/4)));let previous=0;
  for(let i=1;i<=count;i++){const t=far*i/count;if(gap(t)<=0){let lo=previous,hi=t;for(let j=0;j<12;j++){const mid=(lo+hi)/2;if(gap(mid)>0)lo=mid;else hi=mid;}const x=o[0]+d[0]*hi,z=o[2]+d[2]*hi,normal=[ground(x-.25,z)-ground(x+.25,z),.5,ground(x,z-.25)-ground(x,z+.25)],length=Math.hypot(...normal);return {distance:hi,normal:normal.map(v=>v/length)};}previous=t;}
  return {distance:far,normal:[0,1,0]};
 }
 function ray(o,d,far=120,exceptVehicle=null){if(roomRegion(o[0],o[2]))return room.ray(o,d,far);let hit=far;const seen=new Set();for(let t=0;t<=far;t+=4)for(const q of candidates(o[0]+d[0]*t,o[2]+d[2]*t,4))if(!seen.has(q)){seen.add(q);hit=Math.min(hit,rayBox(q,o,d,hit));}
  for(const q of dynamicBodies)hit=Math.min(hit,rayBox(q,o,d,hit));
  if(!ignoreVehicle)for(const c of fleet)if(c!==exceptVehicle)hit=Math.min(hit,rayBox(carBox(c),o,d,hit));hit=Math.min(hit,terrainRay(o,d,hit).distance);return hit;
 }
 function castProjectile(o,d,far,r){let distance=far,normal=[0,1,0];const list=roomRegion(o[0],o[2])?room.colliders:[...candidates(o[0]+d[0]*far/2,o[2]+d[2]*far/2,far+r+1),...fleet.map(carBox),...dynamicBodies];for(const q of list){const hit=rayBox({...q,a:q.a+r,b:q.b+r,minY:q.minY-r,maxY:q.maxY+r},o,d,distance);if(hit<distance){distance=hit;const x=o[0]+d[0]*hit-q.x,z=o[2]+d[2]*hit-q.z,u=x*q.c+z*q.s,v=-x*q.s+z*q.c,y=o[1]+d[1]*hit,faces=[{d:Math.abs(Math.abs(u)-q.a-r),n:[Math.sign(u)*q.c,0,Math.sign(u)*q.s]},{d:Math.abs(Math.abs(v)-q.b-r),n:[-Math.sign(v)*q.s,0,Math.sign(v)*q.c]},{d:Math.min(Math.abs(y-q.minY+r),Math.abs(y-q.maxY-r)),n:[0,y<(q.minY+q.maxY)/2?-1:1,0]}];normal=faces.sort((a,b)=>a.d-b.d)[0].n;}}const terrain=terrainRay(o,d,distance,r);if(terrain.distance<distance){distance=terrain.distance;normal=terrain.normal;}return {distance,normal};}
 function roofHeight(x,z){if(roomRegion(x,z))return room.contains(x,z)?room.ceiling:0;let y=Math.max(ground(x,z),cityStream?.roofHeight(x,z)||0);for(const q of candidates(x,z,.1))if(disk(q,x,z,.05))y=Math.max(y,q.maxY);for(const c of fleet)if(disk(carBox(c),x,z,.05))y=Math.max(y,carBox(c).maxY);return y;}
 function freeNear(x,z,r=.4){for(let d=0;d<24;d+=.5)for(let i=0;i<(d?32:1);i++){const a=i*Math.PI/16,xx=x+Math.cos(a)*d,zz=z+Math.sin(a)*d;if(!blocked(xx,zz,r,ground(xx,zz)))return [xx,zz];}throw new Error('Aucun point libre près de '+x+','+z);}
 function addMesh(m){scenery.push(m);fromMesh(m);}
 function replaceScenery(value){scenery=value;boxes.length=0;buckets.clear();for(const m of scenery)if(m.collision)fromMesh(m);}
 // Port maintenance encounter: fictional METAL sentinels, reusable cover and a signal mast.
 const goal=freeNear(-91,0,2.5);const mission={x:goal[0],z:goal[1],radius:24};
 for(const [dx,dz,w]of [[-9,-4,4],[8,-5,3],[-6,8,3]]){const p=freeNear(goal[0]+dx,goal[1]+dz,2);addMesh(mesh([p[0],.8,p[1]],[w,1.45,1.8],[.24,.32,.34],0));}
 addMesh(mesh([goal[0],2.2,goal[1]],[.16,4.4,.16],[.5,.53,.48],0));
 const detailCount=R.details.add({scenery,city,blocked,addMesh,bounds:coreBounds,water});
 const architecture=R.architecture?.add({scenery,city,blocked,bounds:coreBounds})||null;
 const types=['gti','r5','tmax','scooter','bike'];
 for(let i=0;i<types.length;i++){
  const c=BITUME.conduite.creer(78.3+i*1.4,130+i*7,-1.692);Object.assign(c,{model:types[i],color:R.vehicles.PALETTE[i],y:.08,id:i});
  if(carContact(c)){let found=false;const ox=c.x,oz=c.z;for(let d=.5;d<20&&!found;d+=.5)for(let j=0;j<32;j++){c.x=ox+Math.cos(j*Math.PI/16)*d;c.z=oz+Math.sin(j*Math.PI/16)*d;if(!carContact(c)){found=true;break;}}if(!found)throw new Error('Stationnement indisponible');}
  fleet.push(c);
 }
 const car=fleet[0];vehicle=car;
 const spawn=freeNear(car.x-3.8,car.z, .4);
 const enemies=[[-8,-9],[7,-8],[2,11]].map(([dx,dz],i)=>{const p=freeNear(goal[0]+dx,goal[1]+dz,.8);return {x:p[0],z:p[1],type:i===1?1:0,y:ground(),yaw:0};});
 const combatWorld={seed:135,stage:0,generation:6,combat:true,navCell:2,bounds:coreBounds,spawn:{x:spawn[0],z:spawn[1],yaw:Math.atan2(car.x-spawn[0],spawn[1]-car.z)},enemies,cores:[],pickups:[],colliders:[],exit:{x:0,z:0},spatial:{ground:(x,z)=>water(x,z)?-3:ground(x,z),blocked,moveBlocked:clearance.moveBlocked,ray,castProjectile,coverBoxes:(x,z,r)=>candidates(x,z,r),contains:(x,z)=>(x>=bounds.minX&&x<=bounds.maxX&&z>=bounds.minZ&&z<=bounds.maxZ)||!!room?.contains(x,z)}};
 // The crowd's PDR grid is derived from exactly the same physical world, excluding only the moving car.
 const navCity={etendue:city.etendue,sol:ground,praticable:(x,z)=>{ignoreVehicle=true;const ok=!blocked(x,z,.34);ignoreVehicle=false;return ok;},surChaussee:city.surChaussee};
 const result={get dynamicBodies(){return dynamicBodies;},set dynamicBodies(v){dynamicBodies=v;},get room(){return room;},set room(v){room=v;},get weather(){return weather;},set weather(v){weather=v;},roofHeight,get player(){return actor;},set player(v){actor=v;},get playerSeated(){return actorSeated;},set playerSeated(v){actorSeated=!!v;},city,coast,landmarks,cityStream,streetLights:scenery.map((m,i)=>({m,id:'piece-'+i})).filter(({m})=>m.shape==='octa'&&m.p[1]>5.5&&m.p[1]<8&&m.s[0]<1.1&&m.color?.[0]>.7),coreBounds,navigationBounds:bounds,marineBuoys:[],expanded:!!cityStream,get scenery(){return scenery;},replaceScenery,candidates,clearedTrees,vegetation,bounds,boxes,fleet,get car(){return vehicle;},select(c){vehicle=c;},detailCount,architecture,mission,combatWorld,navCity,ground,blocked,resolveOverlap:clearance.resolve,ray,rayBox,carContact,moveVehicle,freeNear,addMesh,addBox,carBox,overlap,water,surface:(x,z)=>{const road=inCore(x,z)?city.surChaussee(x,z):!!cityStream?.roadAt(x,z);return {mu:(road?1.15:.9)*(1-.28*(weather?.wet||0)),type:road?'piste':'pave',pente:0,devers:0};},withoutCar(fn){const previous=ignoreVehicle;ignoreVehicle=true;try{return fn();}finally{ignoreVehicle=previous;}}};
 if(coast){const mx=(bounds.minX+bounds.maxX)/2,mz=(bounds.minZ+bounds.maxZ)/2;result.landscape=[{shape:'box',p:[mx,-.22,mz],s:[bounds.maxX-bounds.minX,.12,bounds.maxZ-bounds.minZ],color:[.15,.31,.36],mat:12,outdoor:true,collision:false,backgroundWater:true},...coast.geometry.filter(m=>m.p[0]+m.s[0]/2<-550||m.p[0]-m.s[0]/2>550||m.p[2]+m.s[2]/2<-550||m.p[2]-m.s[2]/2>550)];}else result.landscape=[];
 if(R.boundaries)result.boundary=R.boundaries.add(result);return result;
}
R.world={create,mesh};
})(globalThis);
