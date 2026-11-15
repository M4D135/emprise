/* RADE — one metric world. x east, z south, y up. Body cap=atan2(z,x); camera yaw=cap+PI/2. */
(function(G){
'use strict';const R=G.RADE=G.RADE||{},clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mesh=(p,s,color=[.2,.25,.27],mat=0,cap=0)=>({shape:'box',p,s,r:[0,-cap,0],color,mat,outdoor:true});
// Exact identity difference for derived building shells. Bounded anchor search
// avoids building a city-wide lookup; difficult edits use one exact tail splice.
function diffScenery(before,after){
 const splices=[];let a=0,b=0;
 while(a<before.length&&b<after.length){
  if(before[a]===after[b]){a++;b++;continue;}
  const oldSeen=new Map(),newSeen=new Map();let ai=-1,bi=-1;
  for(let k=0;k<4096&&(a+k<before.length||b+k<after.length);k++){
   if(a+k<before.length){const m=before[a+k];if(newSeen.has(m)){ai=a+k;bi=newSeen.get(m);break;}if(!oldSeen.has(m))oldSeen.set(m,a+k);}
   if(b+k<after.length){const m=after[b+k];if(oldSeen.has(m)){ai=oldSeen.get(m);bi=b+k;break;}if(!newSeen.has(m))newSeen.set(m,b+k);}
  }
  if(ai<0){splices.push({start:a,deleteCount:before.length-a,items:after.slice(b)});a=before.length;b=after.length;break;}
  splices.push({start:a,deleteCount:ai-a,items:after.slice(b,bi)});a=ai;b=bi;
 }
 if(a<before.length||b<after.length)splices.push({start:a,deleteCount:before.length-a,items:after.slice(b)});
 return {before,after,full:false,splices};
}
// Compose ordered producer splices without rescanning meshes. Ranges retain
// original occurrences; inserted fragments carry their actual references.
function composeSceneDeltas(before,changes){
 if(!changes.length)return null;let current=before,parts=[{start:0,count:before.length}];
 const split=position=>{let at=0;for(let i=0;i<parts.length;i++){const q=parts[i],count=q.items?q.items.length:q.count;if(position===at)return i;if(position<at+count){const offset=position-at;parts.splice(i,1,...(q.items?[{items:q.items.slice(0,offset)},{items:q.items.slice(offset)}]:[{start:q.start,count:offset},{start:q.start+offset,count:count-offset}]));return i+1;}at+=count;}return parts.length;};
 for(const delta of changes){if(!delta||delta.full||delta.before!==current)return null;
  for(let i=delta.splices.length-1;i>=0;i--){const q=delta.splices[i];split(q.start+q.deleteCount);const from=split(q.start),to=split(q.start+q.deleteCount);parts.splice(from,to-from,...(q.items.length?[{items:q.items}]:[]));}current=delta.after;
 }
 const splices=[];let cursor=0,items=[];
 for(const q of parts){if(q.items){for(const m of q.items)items.push(m);continue;}if(q.start>cursor||items.length){splices.push({start:cursor,deleteCount:q.start-cursor,items});items=[];}cursor=q.start+q.count;}
 if(cursor<before.length||items.length)splices.push({start:cursor,deleteCount:before.length-cursor,items});
 return {before,after:current,full:false,splices};
}
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
 const boxes=[],buckets=new Map(),key=(x,z)=>Math.floor(x/8)+','+Math.floor(z/8),meshBoxes=new WeakMap(),boxIndex=new WeakMap(),taintedBoxes=new Set();let colliderGeneration=0,stagedBoxes=null,colliderSource=null,colliderSourceWorld=null,colliderSlots=null,sceneryDelta=null,sceneryChanges=[],renderMutation=0;
 const boxFields=['x','z','a','b','c','s','cap','minY','maxY','minX','maxX','minZ','maxZ'];
 function cellsForBox(q){const cells=[];for(let z=Math.floor(q.minZ/8);z<=Math.floor(q.maxZ/8);z++)for(let x=Math.floor(q.minX/8);x<=Math.floor(q.maxX/8);x++)cells.push(x+','+z);return cells;}
 function appendBox(q){
  if(stagedBoxes){stagedBoxes.push(q);return q;}
  const cells=cellsForBox(q);let index=boxIndex.get(q);if(!index){index={active:false,cells:[],order:0,seen:-1,nextOrder:0};boxIndex.set(q,index);}
  if(index.active){taintedBoxes.add(q);for(const cell of cells)if(!index.cells.includes(cell))index.cells.push(cell);}else{index.active=true;index.cells=cells;index.order=boxes.length;}
  boxes.push(q);for(const k of cells){let list=buckets.get(k);if(!list){list=[];buckets.set(k,list);}list.push(q);}return q;
 }
 function addBox(q){
  q.c=Math.cos(q.cap);q.s=Math.sin(q.cap);
  const hx=Math.abs(q.c*q.a)+Math.abs(q.s*q.b),hz=Math.abs(q.s*q.a)+Math.abs(q.c*q.b);
  q.minX=q.x-hx;q.maxX=q.x+hx;q.minZ=q.z-hz;q.maxZ=q.z+hz;return appendBox(q);
 }
 function sameMeshBox(entry,m,rx,ry,rz){
  const v=entry.values,p=m.p,s=m.s;
  if(!Object.is(v[0],p[0])||!Object.is(v[1],p[1])||!Object.is(v[2],p[2])||!Object.is(v[3],s[0])||!Object.is(v[4],s[1])||!Object.is(v[5],s[2])||!Object.is(v[6],rx)||!Object.is(v[7],ry)||!Object.is(v[8],rz)||entry.box.mesh!==m||entry.box.kind!=='urban')return false;
  // Public collider records may have been edited by a caller. Such an edit must
  // not survive replaceScenery: the old implementation rebuilt from the mesh.
  for(let i=0;i<boxFields.length;i++)if(!Object.is(entry.box[boxFields[i]],v[i+9]))return false;return true;
 }
 function fromMesh(m,fresh=false){
  if(m.terrain||m.coast||m.collision===false)return;
  if(m.vegetationPart&&m.vegetationPart!=='trunk')return;
  if(m.fx||m.shape==='foliage'||m.shape==='ring'||m.s[1]<.12||m.p[1]+m.s[1]/2<.4)return;
  if(!m.boundary&&!m.landmark&&(Math.abs(m.p[0])>580||Math.abs(m.p[2])>580))return;
  const rx=m.r?.[0]||0,ry=m.r?.[1]||0,rz=m.r?.[2]||0,s=m.s,previous=meshBoxes.get(m);
  // Material/scorch revisions do not alter geometry. Keep unchanged boxes, but
  // create a new snapshot when a pose changes; previous contact records stay valid.
  // The generation guard also keeps duplicate mesh occurrences as distinct boxes.
  if(!fresh&&previous&&previous.generation!==colliderGeneration&&sameMeshBox(previous,m,rx,ry,rz)){previous.generation=colliderGeneration;m.collision=true;appendBox(previous.box);return;}
  // Sloping roof pieces get a conservative envelope; vertical façades keep their exact yaw and dimensions.
  const h=Math.abs(Math.cos(rx)*Math.cos(rz)*s[1])+Math.abs(Math.sin(rx)*s[2])+Math.abs(Math.sin(rz)*s[0]);
  const sx=Math.abs(Math.cos(rz)*s[0])+Math.abs(Math.sin(rz)*s[1]);
  const sz=Math.abs(Math.cos(rx)*s[2])+Math.abs(Math.sin(rx)*s[1]);
  m.collision=true;const q=addBox({mesh:m,x:m.p[0],z:m.p[2],a:sx/2,b:sz/2,minY:m.p[1]-h/2,maxY:m.p[1]+h/2,cap:-ry,kind:'urban'});
  if(!previous||previous.generation!==colliderGeneration)meshBoxes.set(m,{generation:colliderGeneration,box:q,values:[...m.p,...s,rx,ry,rz,...boxFields.map(k=>q[k])]});
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
  if(!land(x,z,r))return true;const core=inCore(x-r,z-r)&&inCore(x+r,z+r);if(!core&&cityStream?.blocked?.(x,z,r,y,height))return true;
  // Most capsule probes fit inside one existing spatial bucket. Scanning that
  // array directly preserves the same boolean contacts without a temporary Set.
  const ix0=Math.floor((x-r)/8),ix1=Math.floor((x+r)/8),iz0=Math.floor((z-r)/8),iz1=Math.floor((z+r)/8);
  const local=core&&ix0===ix1&&iz0===iz1,nearby=local?buckets.get(ix0+','+iz0):candidates(x,z,r);
  if(nearby)for(const q of nearby)if(q.maxY>y+.22&&q.minY<y+height&&disk(q,x,z,r))return true;
  if(!ignoreVehicle)for(const c of fleet){const q=carBox(c,carBounds);if(q.maxY>y+.22&&q.minY<y+height&&disk(q,x,z,r))return true;}return false;
 }
 const clearance=R.clearance.create({bodies:()=>dynamicBodies,staticBlocked});
 const blocked=(x,z,r=.28,y=ground(x,z),height=1.8)=>clearance.blocked(x,z,r,y,height);
 const carBounds=new WeakMap();
 const carBox=(c,privateProbe=false)=>{const spec=R.vehicles.SPECS[c.model],base=Number.isFinite(c.y)?c.y:ground(c.x,c.z);let q=carBounds.get(c);
  if(!q){q={vehicle:c,x:c.x,z:c.z,a:spec.length/2,b:spec.width/2,c:Math.cos(c.cap),s:Math.sin(c.cap),cap:c.cap,minY:base+.1,maxY:base+spec.height};carBounds.set(c,q);}
  else{if(!Object.is(q.cap,c.cap)){q.cap=c.cap;q.c=Math.cos(c.cap);q.s=Math.sin(c.cap);}q.x=c.x;q.z=c.z;q.a=spec.length/2;q.b=spec.width/2;q.minY=base+.1;q.maxY=base+spec.height;}
  // The shared box never escapes the boolean staticBlocked probe. Public boxes
  // and collision results remain independent mutable snapshots, as before.
  return privateProbe===carBounds?q:{...q};
 };
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
 function freeNear(x,z,r=.4,{required=true}={}){for(let d=0;d<24;d+=.5)for(let i=0;i<(d?32:1);i++){const a=i*Math.PI/16,xx=x+Math.cos(a)*d,zz=z+Math.sin(a)*d;if(!blocked(xx,zz,r,ground(xx,zz)))return [xx,zz];}if(!required)return null;throw new Error('Aucun point libre près de '+x+','+z);}
 function addMesh(m){scenery.push(m);fromMesh(m);}
 // Explicit producer fast path: retained meshes and their collision snapshots
 // keep their geometry. Generic replaceScenery calls always validate all fields.
 // Cache construction happens during loading, without replacing active colliders.
 function prepareSceneryDelta(value){
  colliderGeneration++;const slots=new Array(value.length),staged=[];stagedBoxes=staged;
  try{for(let i=0;i<value.length;i++){const at=staged.length,m=value[i];if(m.collision)fromMesh(m);slots[i]=staged.length>at?staged[at]:null;}}
  finally{stagedBoxes=null;}
  // Rebind only an identical occurrence sequence; active collisions stay intact.
  if(value.length===scenery.length&&value.every((m,i)=>m===scenery[i]))scenery=value;
  colliderSource=value;colliderSourceWorld=scenery;colliderSlots=slots;
 }
 function patchedColliderSlots(value,delta){
  if(!delta||delta.full||taintedBoxes.size||colliderSlots?.length!==delta.before?.length||delta.before!==colliderSource||delta.after!==value||colliderSourceWorld!==scenery||!colliderSlots||!Array.isArray(delta.splices))return null;
  let end=0,length=colliderSource.length,offset=0;
  for(const q of delta.splices){if(!q||!Number.isInteger(q.start)||!Number.isInteger(q.deleteCount)||q.start<end||q.deleteCount<0||q.start+q.deleteCount>colliderSource.length||!Array.isArray(q.items))return null;
   for(let i=0;i<q.items.length;i++)if(q.items[i]!==value[q.start+offset+i])return null;
   end=q.start+q.deleteCount;offset+=q.items.length-q.deleteCount;length+=q.items.length-q.deleteCount;
  }if(length!==value.length)return null;
  // Array copies retain occurrence order, including duplicate mesh references.
  const slots=new Array(length);let read=0,write=0;const staged=[];stagedBoxes=staged;
  try{for(const q of delta.splices){while(read<q.start)slots[write++]=colliderSlots[read++];read+=q.deleteCount;
    for(const m of q.items){const at=staged.length;if(m.collision)fromMesh(m,true);slots[write++]=staged.length>at?staged[at]:null;}
   }while(read<colliderSlots.length)slots[write++]=colliderSlots[read++];}
  finally{stagedBoxes=null;}
  return slots;
 }
 function replaceScenery(value,options){
  colliderGeneration++;const next=[];let slots=patchedColliderSlots(value,options?.meshDelta);
  sceneryDelta=slots?options.meshDelta:null;
  if(sceneryDelta&&(!sceneryChanges.length||sceneryChanges.at(-1).after===sceneryDelta.before)&&sceneryChanges.length<16)sceneryChanges.push(sceneryDelta);else sceneryChanges=sceneryDelta?[sceneryDelta]:[];
  if(slots){for(const q of slots)if(q)next.push(q);}else{
   slots=new Array(value.length);stagedBoxes=next;try{for(let i=0;i<value.length;i++){const at=next.length,m=value[i];if(m.collision)fromMesh(m);slots[i]=next.length>at?next[at]:null;}}finally{stagedBoxes=null;}
  }
  scenery=value;colliderSource=value;colliderSourceWorld=value;colliderSlots=slots;
  if(!taintedBoxes.size&&next.length===boxes.length&&next.every((q,i)=>q===boxes[i]))return;
  const dirty=new Set(),added=new Map();let previousOrder=-1,reordered=false;
  for(let i=0;i<next.length;i++){const q=next[i];let index=boxIndex.get(q);if(!index){index={active:false,cells:[],order:0,seen:-1,nextOrder:0};boxIndex.set(q,index);}
   if(index.active){if(index.order<previousOrder)reordered=true;previousOrder=index.order;}
   if(!index.active||taintedBoxes.has(q)){
    for(const cell of index.cells)dirty.add(cell);index.cells=cellsForBox(q);
    for(const cell of index.cells){dirty.add(cell);let list=added.get(cell);if(!list){list=[];added.set(cell,list);}list.push(q);}
   }
   index.seen=colliderGeneration;index.nextOrder=i;
  }
  for(const q of boxes){const index=boxIndex.get(q);if(index.seen!==colliderGeneration){index.active=false;for(const cell of index.cells)dirty.add(cell);}}
  if(reordered){
   // A reorder changes tie-breaking for overlapping boxes. It is uncommon in
   // destruction, so retain the exact full-order rebuild for that case.
   for(const list of buckets.values())list.length=0;
   for(const q of next)for(const cell of boxIndex.get(q).cells){let list=buckets.get(cell);if(!list){list=[];buckets.set(cell,list);}list.push(q);}
   for(const [cell,list]of buckets)if(!list.length)buckets.delete(cell);
  }else{
   // Retained boxes are still in the same relative order. Only buckets touched
   // by an insertion/removal need merging; all other arrays remain untouched.
   for(const cell of dirty){const list=buckets.get(cell)||[],seen=new Set();let at=0;
    for(let i=0,n=list.length;i<n;i++){const q=list[i];if(boxIndex.get(q).seen===colliderGeneration&&!seen.has(q)){seen.add(q);list[at++]=q;}}
    list.length=at;const insertions=added.get(cell);if(insertions)for(const q of insertions)if(!seen.has(q)){seen.add(q);list.push(q);}
    if(insertions?.length)list.sort((a,b)=>boxIndex.get(a).nextOrder-boxIndex.get(b).nextOrder);
    if(list.length)buckets.set(cell,list);else buckets.delete(cell);
   }
  }
  boxes.length=0;for(const q of next){const index=boxIndex.get(q);index.active=true;index.order=index.nextOrder;boxes.push(q);}taintedBoxes.clear();
 }
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
 const result={get dynamicBodies(){return dynamicBodies;},set dynamicBodies(v){dynamicBodies=v;clearance.prepareBodies?.(null);},publishBodies(v){dynamicBodies=v;clearance.prepareBodies?.(v);},get room(){return room;},set room(v){room=v;},get weather(){return weather;},set weather(v){weather=v;},roofHeight,get player(){return actor;},set player(v){actor=v;},get playerSeated(){return actorSeated;},set playerSeated(v){actorSeated=!!v;},city,coast,landmarks,cityStream,streetLights:scenery.map((m,i)=>({m,id:'piece-'+i})).filter(({m})=>m.shape==='octa'&&m.p[1]>5.5&&m.p[1]<8&&m.s[0]<1.1&&m.color?.[0]>.7),coreBounds,navigationBounds:bounds,marineBuoys:[],expanded:!!cityStream,get scenery(){return scenery;},get sceneryDelta(){return sceneryDelta;},get renderMutation(){return renderMutation;},invalidateSceneryRender(){renderMutation++;sceneryDelta=null;sceneryChanges=[];},takeSceneryDelta(before){const changes=sceneryChanges;sceneryChanges=[];if(!before)return null;const at=changes.findIndex(d=>d.before===before);return at<0?null:changes.length-at===1?changes[at]:composeSceneDeltas(before,changes.slice(at));},replaceScenery,prepareSceneryDelta,candidates,clearedTrees,vegetation,bounds,boxes,fleet,get car(){return vehicle;},select(c){vehicle=c;},detailCount,architecture,mission,combatWorld,navCity,ground,blocked,resolveOverlap:clearance.resolve,ray,rayBox,carContact,moveVehicle,freeNear,addMesh,addBox,carBox,overlap,water,surface:(x,z)=>{const road=inCore(x,z)?city.surChaussee(x,z):!!cityStream?.roadAt(x,z);return {mu:(road?1.15:.9)*(1-.28*(weather?.wet||0)),type:road?'piste':'pave',pente:0,devers:0};},withoutCar(fn){const previous=ignoreVehicle;ignoreVehicle=true;try{return fn();}finally{ignoreVehicle=previous;}}};
 if(coast){const mx=(bounds.minX+bounds.maxX)/2,mz=(bounds.minZ+bounds.maxZ)/2;result.landscape=[{shape:'box',p:[mx,-.22,mz],s:[bounds.maxX-bounds.minX,.12,bounds.maxZ-bounds.minZ],color:[.15,.31,.36],mat:12,outdoor:true,collision:false,backgroundWater:true},...coast.geometry.filter(m=>m.p[0]+m.s[0]/2<-550||m.p[0]-m.s[0]/2>550||m.p[2]+m.s[2]/2<-550||m.p[2]-m.s[2]/2>550)];}else result.landscape=[];
 if(R.boundaries)result.boundary=R.boundaries.add(result);return result;
}
R.world={create,mesh,composeSceneDeltas,diffScenery};
})(globalThis);
