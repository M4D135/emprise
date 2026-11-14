/* RADE — one metric world. x east, z south, y up. Body cap=atan2(z,x); camera yaw=cap+PI/2. */
(function(G){
'use strict';const R=G.RADE=G.RADE||{},clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mesh=(p,s,color=[.2,.25,.27],mat=0,cap=0)=>({shape:'box',p,s,r:[0,-cap,0],color,mat,outdoor:true});
function create(){
 const city=PDR.villeReelle.creerVille('marseille',{ilots:9});
 // Remove only RTS headquarters and resource-site decoration; geographic city stays intact.
 let at=0;const scenery=[];for(const [section,n] of Object.entries(city.mesures.comptes.parSection)){if(section!=='qg'&&section!=='sites')scenery.push(...city.objets.slice(at,at+n));at+=n;}
 // RADE : the RTS tree placement can cross a junction. Clear complete trees from road centres.
 function roadCentre(x,z){return city.surChaussee(x,z)||city.surChaussee(x+.7,z)||city.surChaussee(x-.7,z)||city.surChaussee(x,z+.7)||city.surChaussee(x,z-.7);}
 let clearedTrees=0;
 for(let i=scenery.length-3;i>=0;i--){const m=scenery[i];if(m.shape==='cylinder'&&m.mat===10&&scenery[i+1]?.shape==='foliage'&&scenery[i+2]?.shape==='foliage'&&roadCentre(m.p[0],m.p[2])){scenery.splice(i,3);clearedTrees++;}}
 const bounds={minX:-325,maxX:325,minZ:-325,maxZ:325};
 const boxes=[],buckets=new Map(),key=(x,z)=>Math.floor(x/8)+','+Math.floor(z/8);
 function addBox(q){
  q.c=Math.cos(q.cap);q.s=Math.sin(q.cap);
  const hx=Math.abs(q.c*q.a)+Math.abs(q.s*q.b),hz=Math.abs(q.s*q.a)+Math.abs(q.c*q.b);
  q.minX=q.x-hx;q.maxX=q.x+hx;q.minZ=q.z-hz;q.maxZ=q.z+hz;boxes.push(q);
  for(let z=Math.floor(q.minZ/8);z<=Math.floor(q.maxZ/8);z++)for(let x=Math.floor(q.minX/8);x<=Math.floor(q.maxX/8);x++){const k=x+','+z;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(q);}
  return q;
 }
 function fromMesh(m){
  if(m.fx||m.shape==='foliage'||m.shape==='ring'||m.s[1]<.12||m.p[1]+m.s[1]/2<.4)return;
  if(Math.abs(m.p[0])>355||Math.abs(m.p[2])>355)return;
  const rx=m.r?.[0]||0,rz=m.r?.[2]||0,s=m.s;
  // Sloping roof pieces get a conservative envelope; vertical façades keep their exact yaw and dimensions.
  const h=Math.abs(Math.cos(rx)*Math.cos(rz)*s[1])+Math.abs(Math.sin(rx)*s[2])+Math.abs(Math.sin(rz)*s[0]);
  const sx=Math.abs(Math.cos(rz)*s[0])+Math.abs(Math.sin(rz)*s[1]);
  const sz=Math.abs(Math.cos(rx)*s[2])+Math.abs(Math.sin(rx)*s[1]);
  addBox({x:m.p[0],z:m.p[2],a:sx/2,b:sz/2,minY:m.p[1]-h/2,maxY:m.p[1]+h/2,cap:-(m.r?.[1]||0),kind:'urban'});
 }
 scenery.forEach(fromMesh);
 const rings=city.eau;
 function inRing(p,x,z){let inside=false;for(let i=0,j=p.length-2;i<p.length;j=i,i+=2){if((p[i+1]>z)!==(p[j+1]>z)&&x<(p[j]-p[i])*(z-p[i+1])/(p[j+1]-p[i+1])+p[i])inside=!inside;}return inside;}
 const water=(x,z)=>rings.some(p=>inRing(p,x,z));
 function land(x,z,r=0){if(x-r<bounds.minX||x+r>bounds.maxX||z-r<bounds.minZ||z+r>bounds.maxZ)return false;for(const [dx,dz]of [[0,0],[r,0],[-r,0],[0,r],[0,-r]])if(water(x+dx,z+dz))return false;return true;}
 function candidates(x,z,r){const set=new Set();for(let j=Math.floor((z-r)/8);j<=Math.floor((z+r)/8);j++)for(let i=Math.floor((x-r)/8);i<=Math.floor((x+r)/8);i++)for(const q of buckets.get(i+','+j)||[])set.add(q);return set;}
 function disk(q,x,z,r){const dx=x-q.x,dz=z-q.z,u=dx*q.c+dz*q.s,v=-dx*q.s+dz*q.c;return (u-clamp(u,-q.a,q.a))**2+(v-clamp(v,-q.b,q.b))**2<r*r;}
 let vehicle=null,ignoreVehicle=false;const fleet=[];
 function blocked(x,z,r=.28,y=0,height=1.8){
  if(!land(x,z,r))return true;
  for(const q of candidates(x,z,r))if(q.maxY>y+.22&&q.minY<y+height&&disk(q,x,z,r))return true;
  if(!ignoreVehicle)for(const c of fleet)if(y<R.vehicles.SPECS[c.model].height&&disk(carBox(c),x,z,r))return true;return false;
 }
 const ground=()=>.08;
 const carBox=c=>({x:c.x,z:c.z,a:R.vehicles.SPECS[c.model].length/2,b:R.vehicles.SPECS[c.model].width/2,c:Math.cos(c.cap),s:Math.sin(c.cap),cap:c.cap,minY:.1,maxY:R.vehicles.SPECS[c.model].height});
 function overlap(a,b){
  if(b.minY>1.4||b.maxY<.28)return null;
  let best=Infinity,nx=0,nz=0;
  for(const [x,z]of [[a.c,a.s],[-a.s,a.c],[b.c,b.s],[-b.s,b.c]]){
   const r1=a.a*Math.abs(x*a.c+z*a.s)+a.b*Math.abs(-x*a.s+z*a.c),r2=b.a*Math.abs(x*b.c+z*b.s)+b.b*Math.abs(-x*b.s+z*b.c);
   const d=(a.x-b.x)*x+(a.z-b.z)*z,depth=r1+r2-Math.abs(d);if(depth<=0)return null;if(depth<best){best=depth;nx=x*(d<0?-1:1);nz=z*(d<0?-1:1);}
  }return {nx,nz,depth:best};
 }
 function carContact(c){
  const a=carBox(c);
  for(const other of fleet)if(other!==c){const h=overlap(a,carBox(other));if(h)return h;}
  for(const q of candidates(c.x,c.z,3.6)){const h=overlap(a,q);if(h)return h;}
  for(const u of [-a.a,0,a.a])for(const v of [-a.b,a.b])if(!land(c.x+u*a.c-v*a.s,c.z+u*a.s+v*a.c,.08))return {nx:-Math.cos(c.cap)*(c.u>=0?1:-1),nz:-Math.sin(c.cap)*(c.u>=0?1:-1),depth:.1};
  return null;
 }
 function moveVehicle(c,dx,dz,cap){
  const old=c.cap,turn=Math.atan2(Math.sin(cap-old),Math.cos(cap-old)),n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.15),Math.ceil(Math.abs(turn)/.025));let hit=null;
  for(let i=0;i<n;i++){const x=c.x,z=c.z,a=c.cap;c.x+=dx/n;c.z+=dz/n;c.cap+=turn/n;const h=carContact(c);if(h){c.x=x;c.z=z;c.cap=a;hit=h;break;}}
  return hit;
 }
 function rayBox(q,o,d,far){const dx=o[0]-q.x,dz=o[2]-q.z,oo=[dx*q.c+dz*q.s,o[1],-dx*q.s+dz*q.c],dd=[d[0]*q.c+d[2]*q.s,d[1],-d[0]*q.s+d[2]*q.c],loB=[-q.a,q.minY,-q.b],hiB=[q.a,q.maxY,q.b];let lo=0,hi=far;
  for(let k=0;k<3;k++){if(Math.abs(dd[k])<1e-9){if(oo[k]<loB[k]||oo[k]>hiB[k])return far;}else{let a=(loB[k]-oo[k])/dd[k],b=(hiB[k]-oo[k])/dd[k];if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);if(lo>hi)return far;}}return lo;
 }
 function ray(o,d,far=120){let hit=far;const seen=new Set();for(let t=0;t<=far;t+=4)for(const q of candidates(o[0]+d[0]*t,o[2]+d[2]*t,4))if(!seen.has(q)){seen.add(q);hit=Math.min(hit,rayBox(q,o,d,hit));}
  if(!ignoreVehicle)for(const c of fleet)hit=Math.min(hit,rayBox(carBox(c),o,d,hit));if(d[1]<-1e-6)hit=Math.min(hit,Math.max(0,(ground()-o[1])/d[1]));return hit;
 }
 function freeNear(x,z,r=.4){for(let d=0;d<24;d+=.5)for(let i=0;i<(d?32:1);i++){const a=i*Math.PI/16,xx=x+Math.cos(a)*d,zz=z+Math.sin(a)*d;if(!blocked(xx,zz,r))return [xx,zz];}throw new Error('Aucun point libre près de '+x+','+z);}
 function addMesh(m){scenery.push(m);fromMesh(m);}
 // Port maintenance encounter: fictional METAL sentinels, reusable cover and a signal mast.
 const goal=freeNear(-91,0,2.5);const mission={x:goal[0],z:goal[1],radius:24};
 for(const [dx,dz,w]of [[-9,-4,4],[8,-5,3],[-6,8,3]]){const p=freeNear(goal[0]+dx,goal[1]+dz,2);addMesh(mesh([p[0],.8,p[1]],[w,1.45,1.8],[.24,.32,.34],0));}
 addMesh(mesh([goal[0],2.2,goal[1]],[.16,4.4,.16],[.5,.53,.48],0));
 const detailCount=R.details.add({scenery,city,blocked,addMesh});
 const types=['gti','r5','tmax','scooter','bike'];
 for(let i=0;i<types.length;i++){
  const c=BITUME.conduite.creer(78.3+i*1.4,130+i*7,-1.692);Object.assign(c,{model:types[i],color:R.vehicles.PALETTE[i],y:.08,id:i});
  if(carContact(c)){let found=false;const ox=c.x,oz=c.z;for(let d=.5;d<20&&!found;d+=.5)for(let j=0;j<32;j++){c.x=ox+Math.cos(j*Math.PI/16)*d;c.z=oz+Math.sin(j*Math.PI/16)*d;if(!carContact(c)){found=true;break;}}if(!found)throw new Error('Stationnement indisponible');}
  fleet.push(c);
 }
 const car=fleet[0];vehicle=car;
 const spawn=freeNear(car.x-3.8,car.z, .4);
 const enemies=[[-8,-9],[7,-8],[2,11]].map(([dx,dz],i)=>{const p=freeNear(goal[0]+dx,goal[1]+dz,.8);return {x:p[0],z:p[1],type:i===1?1:0,y:ground(),yaw:0};});
 const combatWorld={seed:135,stage:0,generation:6,combat:true,navCell:2,bounds,spawn:{x:spawn[0],z:spawn[1],yaw:Math.atan2(car.x-spawn[0],spawn[1]-car.z)},enemies,cores:[],pickups:[],colliders:[],exit:{x:0,z:0},spatial:{ground,blocked,ray}};
 // The crowd's PDR grid is derived from exactly the same physical world, excluding only the moving car.
 const navCity={etendue:city.etendue,sol:ground,praticable:(x,z)=>{ignoreVehicle=true;const ok=!blocked(x,z,.34);ignoreVehicle=false;return ok;},surChaussee:city.surChaussee};
 return {city,scenery,clearedTrees,bounds,boxes,fleet,get car(){return vehicle;},select(c){vehicle=c;},detailCount,mission,combatWorld,navCity,ground,blocked,ray,rayBox,carContact,moveVehicle,freeNear,addMesh,addBox,carBox,overlap,water,surface:(x,z)=>({mu:city.surChaussee(x,z)?1.15:.9,type:city.surChaussee(x,z)?'piste':'pave',pente:0,devers:0}),withoutCar(fn){ignoreVehicle=true;try{return fn();}finally{ignoreVehicle=false;}}};
}
R.world={create,mesh};
})(globalThis);
