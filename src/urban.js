/* RADE — material damage, FERRO rigid bodies, persistent fires and municipal fire response.
   Destruction solver: METAL. Fire spread / suppression rules adapted from PDR (metres/seconds here). */
(function(R){'use strict';const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n)),angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
const materials={metal:{density:7800,strength:20,fuel:.08},stone:{density:2200,strength:60,fuel:.10},wood:{density:550,strength:7,fuel:1},glass:{density:2500,strength:3,fuel:0},dirt:{density:1500,strength:12,fuel:0}};
const material=m=>m.material||(m.mat>=8.5&&m.mat<=9.5||m.mat>12.5&&m.mat<13.5||m.mat>=2.5&&m.mat<=3.5?'stone':m.mat===19||m.window?'glass':m.mat===10||m.mat===7||m.shape==='foliage'?'wood':m.mat===8||m.mat===11?'dirt':'metal');
function describe(m){const mat=material(m),v=m.s[0]*m.s[1]*m.s[2]*({sphere:.524,cylinder:.785,foliage:.12,ring:.05}[m.shape]||1),shell=m.s[0]>3&&m.s[1]>3&&m.s[2]>3?.18:mat==='metal'&&Math.min(...m.s)>.05?.08:1;return {material:mat,mass:Math.max(.035,v*materials[mat].density*shell),fuel:materials[mat].fuel};}
function controller(meshes,boxes,seed){const index=new Map(meshes.map((m,i)=>[m,i])),colliders=boxes.filter(q=>index.has(q.mesh)).map(q=>({minX:q.minX??q.x-q.a,maxX:q.maxX??q.x+q.a,minY:q.minY,maxY:q.maxY,minZ:q.minZ??q.z-q.b,maxZ:q.maxZ??q.z+q.b,mesh:index.get(q.mesh)})),byMesh=new Map(colliders.map((c,i)=>[c.mesh,i])),definitions=[];
 for(let i=0;i<meshes.length;i++){const m=meshes[i];if(m.boundary||m.fx||m.ground||m.terrain||m.p[1]+m.s[1]/2<.15||m.s[1]<.45&&Math.max(m.s[0],m.s[2])>10)continue;const d=describe(m);m.material=d.material;m.mass=d.mass;
  definitions.push({id:'piece-'+i,kind:m.shape==='foliage'||m.mat===10?'tree':m.s[1]>3&&m.s[0]>3&&m.s[2]>3?'wall':'decor',strength:Math.min(180,materials[d.material].strength+Math.sqrt(d.mass)*.035),meshes:[i],colliders:byMesh.has(i)?[byMesh.get(i)]:[]});
 }
 const pillars=definitions.filter(d=>d.kind==='wall').map(d=>({id:d.id,m:meshes[d.meshes[0]]})),grid=new Map();for(const q of pillars){const m=q.m,r=Math.hypot(m.s[0],m.s[2])/2+1;for(let x=Math.floor((m.p[0]-r)/8);x<=Math.floor((m.p[0]+r)/8);x++)for(let z=Math.floor((m.p[2]-r)/8);z<=Math.floor((m.p[2]+r)/8);z++){const key=x+','+z;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(q);}}
 for(const d of definitions){if(d.kind==='wall')continue;const m=meshes[d.meshes[0]];if(m.p[1]<2.5)continue;const supports=[];for(const q of grid.get(Math.floor(m.p[0]/8)+','+Math.floor(m.p[2]/8))||[]){const b=q.m,c=Math.cos(-(b.r?.[1]||0)),ss=Math.sin(-(b.r?.[1]||0)),dx=m.p[0]-b.p[0],dz=m.p[2]-b.p[2],u=dx*c+dz*ss,v=-dx*ss+dz*c;if(Math.abs(u)<b.s[0]/2+1&&Math.abs(v)<b.s[2]/2+1&&m.p[1]<b.p[1]+b.s[1]/2+3)supports.push(q.id);}if(supports.length){d.kind='roof';d.supports=supports;d.supportRatio=.38;}}
 return FDestruction.create({seed,stage:0,generation:6,meshes,colliders,destructibles:definitions});
}
function create(world,sim,{saved=null,interiors,campaign,traffic,notify=()=>{}}={}){
 const p=sim.state.player,roomStates=new Map(Object.entries(saved?.rooms||{})),charred=new Set(saved?.charred||[]),fires=[],bodies=[],dust=[],crew=[],report={breaches:0,ignitions:0,extinguished:0,dispatches:0,impacts:0,vehicleExplosions:0,crumbleVolume:0};let outdoor=null,indoor=null,roomKey=null,version=0,clock=0,fireClock=0,physicsClock=0,staticClock=0,held=null,truck=null,alarm=0,job=null;
 const baseMeshes=world.scenery.slice(),baseBoxes=world.boxes.slice(),physicsOptions={cell:8,ground:null,gravity:-9.81,capacity:256,maxStatics:8192,maxContacts:4096,maxAwake:96,maxJoints:0,massMin:.035,massMax:12000,iterations:4,maxSubsteps:4},engines=new Map(),ZONE=1024,PADDING=128,MAX_ZONES=24;
 const projectedRooms=new Map(),breaches=R.breaches?.create(world,interiors,baseMeshes,{saved:saved?.openings,legacyDamage:saved?.damage,onProject:prepareProjected});
 let projectionMembers=null,projectionRoom=null,projectedSyncDepth=0,projectedSyncPending=false;
 // Transient reads never escape this owner. Render/collider poses copy their
 // position; persistence and engine migration still request independent bodies.
 const bodyRead={};
 const readBody=q=>q.engine.bodyInto(q.handle,bodyRead);
 const publishBodies=value=>{if(world.publishBodies)world.publishBodies(value);else world.dynamicBodies=value;};
 const currentScene=()=>world.room?(world.room.sceneId||world.room.building.id+':'+world.room.floor):'street';
 const sceneGround=(scene,x,z)=>scene==='street'?world.ground(x,z):.08,fireHeight=f=>{const c=f.vehicleId!==undefined?world.fleet.find(c=>c.id===f.vehicleId):null;return c?(c.y??world.ground(c.x,c.z)):sceneGround(f.scene,f.x,f.z);};
 function cleanEngines(){const used=new Set(bodies.map(q=>q.engine));for(const [key,record]of engines)if(!used.has(record.engine))engines.delete(key);}
 function physicsFor(scene,pos=[p.x,p.y,p.z],exclude=null){
  const ix=Math.floor(pos[0]/ZONE),iz=Math.floor(pos[2]/ZONE),key=scene==='street'?'street:'+ix+','+iz:'room:'+scene;
  const direct=engines.get(key);if(direct&&direct.engine!==exclude)return direct.engine;
  // Fragments of one blast at a grid seam share the overlapping engine, so
  // neighbouring pieces still collide instead of living in two separate solvers.
  if(scene==='street')for(const record of engines.values()){const b=record.bounds;if(record.scene==='street'&&record.engine!==exclude&&pos[0]>b.minX+32&&pos[0]<b.maxX-32&&pos[2]>b.minZ+32&&pos[2]<b.maxZ-32)return record.engine;}
  cleanEngines();if(engines.size>=MAX_ZONES)return null;
  const bounds=scene==='street'?{minX:ix*ZONE-PADDING,maxX:(ix+1)*ZONE+PADDING,minZ:iz*ZONE-PADDING,maxZ:(iz+1)*ZONE+PADDING}:{minX:896,maxX:1104,minZ:896,maxZ:1104};
  const engine=FPhysics.create({...physicsOptions,bounds});engines.set(key,{key,scene,bounds,engine});return engine;
 }
 function addToEngine(engine,mesh,mass,velocity,spin,asleep=false){return engine.addBody({shape:mesh.shape==='sphere'?'sphere':'box',size:mesh.s,radius:mesh.s[0]/2,pos:mesh.p,rot:mesh.r||[0,0,0],vel:velocity,ang:spin,mass,material:material(mesh),asleep});}
 function rebuildEngine(record){
  const previous=record.engine,remaining=bodies.filter(q=>q.engine===previous),snapshots=remaining.map(q=>({q,b:previous.body(q.handle)})).filter(v=>v.b&&!v.b.lost);
  if(!snapshots.length){engines.delete(record.key);return;}
  const next=FPhysics.create({...physicsOptions,bounds:record.bounds});record.engine=next;
  for(const {q,b}of snapshots){q.handle=addToEngine(next,{...q.mesh,p:b.pos,r:FPhysics.quatToEuler(...b.quat)},q.mass,b.vel,b.ang,b.asleep);q.engine=next;}
  staticClock=0;
 }
 function migrateBodies(){
  const rebuild=new Set();
  for(let i=bodies.length-1;i>=0;i--){const q=bodies[i],b=readBody(q);if(!b||b.lost){if(held===q)held=null;for(const record of engines.values())if(record.engine===q.engine)rebuild.add(record);bodies.splice(i,1);continue;}
   if(q.scene!=='street')continue;const record=[...engines.values()].find(r=>r.engine===q.engine),bounds=record?.bounds;if(!bounds)continue;
   if(b.pos[0]>bounds.minX+48&&b.pos[0]<bounds.maxX-48&&b.pos[2]>bounds.minZ+48&&b.pos[2]<bounds.maxZ-48)continue;
   const next=physicsFor(q.scene,b.pos,q.engine);
   if(!next){q.engine.setVelocity(q.handle,0,b.vel[1],0,...b.ang);continue;}
   const handle=addToEngine(next,{...q.mesh,p:b.pos,r:FPhysics.quatToEuler(...b.quat)},q.mass,b.vel,b.ang,b.asleep);
   if(handle<0)continue;q.engine=next;q.handle=handle;rebuild.add(record);staticClock=0;
  }
  for(const record of rebuild)rebuildEngine(record);cleanEngines();
 }
 function scorch(dc,scene){if(charred.size)world.invalidateSceneryRender?.();for(const value of charred){const [part,id]=value.split('|');if(part===scene)for(const m of dc.describe(id)?.meshes||[]){m.color=(m.color||[.4,.4,.4]).map(n=>n*.55);m.renderRevision=(m.renderRevision||0)+1;}}}
 function streetController(){if(!outdoor){outdoor=controller(baseMeshes,baseBoxes,135);if(saved?.damage&&outdoor.restore(saved.damage))sync(outdoor);scorch(outdoor,'street');}return outdoor;}
 function applyRoom(dc,room){room.scenery=dc.meshes;room.colliders.splice(0,room.colliders.length,...dc.colliders.map(q=>({x:(q.minX+q.maxX)/2,z:(q.minZ+q.maxZ)/2,a:(q.maxX-q.minX)/2,b:(q.maxZ-q.minZ)/2,c:1,s:0,cap:0,minY:q.minY,maxY:q.maxY,mesh:dc.meshes[q.mesh]})));}
 function prepareProjected(bridge){const room=bridge.room,key=room.sceneId;let record=projectedRooms.get(key);if(!record){let dc;if(indoor&&roomKey===key)dc=indoor;else{const source=roomStates.has(key)?interiors.roomFor(room.building,room.floor,room.placeIndex):room;dc=controller(source.scenery,source.colliders,key);if(roomStates.has(key))dc.restore(roomStates.get(key));scorch(dc,key);}record={dc,rooms:new Set()};projectedRooms.set(key,record);}record.rooms.add(room);applyRoom(record.dc,room);return record.dc;}
 function activeController(){if(world.room){const key=world.room.sceneId||world.room.building.id+':'+world.room.floor;if(key!==roomKey){if(indoor&&roomKey)roomStates.set(roomKey,indoor.snapshot());roomKey=key;const record=projectedRooms.get(key);if(record){indoor=record.dc;record.rooms.add(world.room);applyRoom(indoor,world.room);}else{indoor=controller(world.room.scenery,world.room.colliders,key);if(roomStates.has(key)&&indoor.restore(roomStates.get(key)))applyRoom(indoor,world.room);}scorch(indoor,key);held=null;}return indoor;}return streetController();}
 function sync(dc){if(dc===outdoor){if(breaches)breaches.sync(dc,world.room?interiors?.outside:p);else world.replaceScenery(dc.meshes,{meshDelta:dc.meshDelta});}else{if(dc===indoor&&world.room)applyRoom(dc,world.room);for(const record of projectedRooms.values())if(record.dc===dc)for(const room of record.rooms){applyRoom(dc,room);breaches?.roomChanged(room);}if(!world.room&&outdoor&&breaches){if(projectedSyncDepth)projectedSyncPending=true;else breaches.update(1,p);}}version++;staticClock=0;}
 function exposedDamage(bridge,point,power,radius,direction){const dc=prepareProjected(bridge),local=bridge.toRoom(point),end=direction?bridge.toRoom(point.map((v,i)=>v+direction[i])):null,delta=end?.map((v,i)=>v-local[i]),length=delta?Math.hypot(...delta):1,result=radius>0?dc.blast(local,radius/Math.min(...bridge.scale),power):dc.hit(local,power,delta?.map(v=>v/(length||1)));if(result.changed)sync(dc);structuralDebris(result.debris,bridge.room.sceneId);return {...result,debris:[],events:result.events.map(e=>{const at=bridge.toWorld([e.x,e.y,e.z]);return {...e,x:at[0],y:at[1],z:at[2],sourceRoom:bridge.room.sceneId};})};}

 function bodyMesh(q){const b=readBody(q);if(!b||b.lost)return null;const r=FPhysics.quatToEuler(...b.quat);return {...q.mesh,p:b.pos.slice(),r,material:q.material,mass:q.mass};}
 function spawnBody(mesh,velocity=[0,0,0],spin=[.3,.1,.2],mass=describe(mesh).mass,scene=currentScene()){if(bodies.length>=240)return null;const engine=physicsFor(scene,mesh.p);if(!engine)return null;const h=addToEngine(engine,mesh,mass,velocity,spin);if(h<0)return null;const q={handle:h,engine,mesh:{...mesh,collision:false},mass,material:material(mesh),scene};if(!bodies.length)physicsClock=0;bodies.push(q);staticClock=0;return q;}
 function addDust(scene,pos,size,volume=0){
  if(!(volume>0))return;report.crumbleVolume+=volume;
  const near=dust.find(q=>q.scene===scene&&Math.hypot(q.pos[0]-pos[0],q.pos[2]-pos[2])<6);
  if(near){near.age=0;near.volume+=volume;near.size=near.size.map((v,i)=>Math.min(i===1?7:18,Math.max(v,size[i])));return;}
  if(dust.length>=16)dust.shift();dust.push({scene,pos:pos.slice(),size:size.map((v,i)=>clamp(v,.5,i===1?7:18)),volume,age:0});
 }
 function structuralDebris(items,scene){
  let overflow=0,center=[0,0,0],count=0;
  const masonry=(items||[]).filter(q=>q.structural&&q.material==='stone'&&q.sourceId?.startsWith('city:')),masonrySlots=Math.min(48,Math.max(0,240-bodies.length));let masonryIndex=0;
  for(const q of items||[]){
   if(q.dust){addDust(scene,[q.x,q.y,q.z],q.size,q.volume);continue;}
   if(!q.structural)continue;
   if(q.material==='stone'&&q.sourceId?.startsWith('city:')){
    // Intact grid cells touch every neighbour and the original jamb/lintel.
    // Break masonry into smaller blocks, with a real pulverised fracture gap;
    // the lost volume is dust and the retained mass follows the retained volume.
    const allocation=Math.floor(masonrySlots/masonry.length)+(masonryIndex++<masonrySlots%masonry.length?1:0),source={shape:q.shape,p:[q.x,q.y,q.z],s:q.size,r:q.rotation,color:q.color,mat:q.mat,material:q.material,structural:true},parts=FDestruction.fragment(source,allocation,.5);let retained=0;
    for(const part of parts.pieces){const mesh=part.mesh;mesh.s=mesh.s.map(v=>v-Math.min(.04,v*.2));const volume=mesh.s.reduce((a,b)=>a*b,1),mass=q.mass*volume/parts.volume;if(spawnBody(mesh,q.velocity,q.angularVelocity,mass,scene))retained+=volume;}
    addDust(scene,source.p,source.s,Math.max(0,parts.volume-retained));continue;
   }
   if(!q.size.every(n=>n>.035&&n<=1.400001)){overflow+=q.volume||q.size.reduce((v,n)=>v*n,1);center[0]+=q.x;center[1]+=q.y;center[2]+=q.z;count++;continue;}
   const body=spawnBody({shape:q.shape,p:[q.x,q.y,q.z],s:q.size,r:q.rotation,color:q.color,mat:q.mat,material:q.material,structural:true},q.velocity,q.angularVelocity,q.mass,scene);
   if(!body){overflow+=q.volume||q.size.reduce((v,n)=>v*n,1);center[0]+=q.x;center[1]+=q.y;center[2]+=q.z;count++;}
  }
  if(count)addDust(scene,center.map(v=>v/count),[4,3,4],overflow);
 }
 function restoreDebris(q){
  const scene=typeof q.scene==='string'?q.scene:'street',mesh={...q.mesh,p:q.pos,r:q.rot},largest=Math.max(...mesh.s),mat=material(mesh),structural=mesh.structural||mesh.fragment||mat==='stone'||q.mass>65||mat==='wood'&&largest>2;
  if(largest<=1.400001||!structural){spawnBody(mesh,[0,0,0],[0,0,0],q.mass,scene);return;}
  const parts=FDestruction.fragment(mesh,Math.min(40,Math.max(0,240-bodies.length)));let lost=parts.crumbleVolume;
  for(const part of parts.pieces)if(!spawnBody(part.mesh,[0,0,0],[0,0,0],Math.max(.035,q.mass*part.volume/parts.volume),scene))lost+=part.volume;
  if(lost)addDust(scene,q.pos,mesh.s,lost);
 }
 function bodyBox(q){const m=bodyMesh(q);if(!m)return null;const h=m.s.map(n=>n/2),r=BITUME.voiture.euler(...m.r),hx=Math.abs(r[0][0])*h[0]+Math.abs(r[1][0])*h[1]+Math.abs(r[2][0])*h[2],hy=Math.abs(r[0][1])*h[0]+Math.abs(r[1][1])*h[1]+Math.abs(r[2][1])*h[2],hz=Math.abs(r[0][2])*h[0]+Math.abs(r[1][2])*h[1]+Math.abs(r[2][2])*h[2];return {x:m.p[0],z:m.p[2],a:hx,b:hz,c:1,s:0,cap:0,minY:m.p[1]-hy,maxY:m.p[1]+hy,body:q,mesh:m};}
 // A foot can step onto settled rubble, but not onto its enclosing AABB or a
 // falling slab. Vertical rays test the actual OBB faces under the foot disc.
 // The simulation still checks the whole capsule against walls and ceilings.
 function rubbleSupport(x,z,previous,r,ground,maxRise=.42){
  let y=ground;
  for(const q of world.dynamicBodies){
   if(q.maxY<=y||q.minY>previous+maxRise||Math.abs(x-q.x)>q.a+r||Math.abs(z-q.z)>q.b+r)continue;
   const body=q.body,b=body?readBody(body):null;if(!b||b.lost||Math.hypot(...b.vel)>.35||Math.hypot(...b.ang)>.5)continue;
   const m=q.mesh,axes=BITUME.voiture.euler(...m.r),half=m.s.map(v=>v/2);
   for(let sample=0;sample<17;sample++){
    const a=(sample-1)*Math.PI/8,px=x+(sample?Math.cos(a)*(r+.025):0),pz=z+(sample?Math.sin(a)*(r+.025):0);let low=-Infinity,high=Infinity,slope=0,valid=true;
    for(let k=0;k<3;k++){
     const axis=axes[k],offset=(px-m.p[0])*axis[0]+(pz-m.p[2])*axis[2];
     if(Math.abs(axis[1])<1e-8){if(Math.abs(offset)>half[k]){valid=false;break;}continue;}
     const u=(-half[k]-offset)/axis[1]+m.p[1],v=(half[k]-offset)/axis[1]+m.p[1],top=Math.max(u,v);low=Math.max(low,Math.min(u,v));if(top<high){high=top;slope=Math.abs(axis[1]);}
    }
    if(valid&&low<=high&&slope>=.7&&high>y&&high<=previous+maxRise+1e-7)y=high;
   }
  }
  return y;
 }
 if(world.combatWorld.spatial)world.combatWorld.spatial.support=rubbleSupport;
 function damage(point,power,radius=0,direction){
  if(!radius){const target=world.fleet.find(c=>{const q=world.carBox(c),dx=point[0]-q.x,dz=point[2]-q.z,u=dx*q.c+dz*q.s,v=-dx*q.s+dz*q.c;return Math.hypot(Math.max(0,Math.abs(u)-q.a),Math.max(0,Math.abs(v)-q.b),Math.max(0,q.minY-point[1],point[1]-q.maxY))<.32;});if(target){hitVehicle(target,power*.65,point);return {changed:false,debris:[],events:[]};}}
  const scene=world.room?.contains(point[0],point[2])?currentScene():'street',dc=scene==='street'?streetController():activeController();const exposed=scene==='street'?breaches?.inside(point):null;if(exposed&&!radius)return exposedDamage(exposed,point,power,0,direction);const core=world.coreBounds||{minX:-550,maxX:550,minZ:-550,maxZ:550},outside=scene==='street'&&(point[0]<core.minX||point[0]>core.maxX||point[2]<core.minZ||point[2]>core.maxZ),streamed=outside?world.cityStream?.damage?.(point,power,radius,direction):null,result=streamed?.changed?streamed:radius>0?dc.blast(point,radius,power):dc.hit(point,power,direction);if(scene==='street'&&!streamed?.changed)breaches?.observe(result);if(result.changed){if(streamed?.changed){version++;staticClock=0;}else sync(dc);report.breaches++;}if(scene==='street'&&radius>0){
   // Each room controller, collision set and debris stream changes in order.
   // Publish their projected street geometry once, before any outer impulses
   // or vehicle chain reactions can query it. Always flush completed changes.
   projectedSyncDepth++;
   try{for(const bridge of breaches?.projections||[]){const local=bridge.toRoom(point),r=radius/Math.min(bridge.scale[0],bridge.scale[2]),distance=Math.hypot(Math.max(0,Math.abs(local[0]-1000)-bridge.room.w/2),Math.max(0,Math.abs(local[2]-1000)-bridge.room.d/2));if(distance<r&&point[1]+radius>bridge.void.minY&&point[1]-radius<bridge.void.maxY){const interior=exposedDamage(bridge,point,power,radius,direction);result.changed||=interior.changed;result.events.push(...interior.events);}}}
   finally{projectedSyncDepth--;if(!projectedSyncDepth&&projectedSyncPending){projectedSyncPending=false;breaches.update(1,p);}}
  }
  structuralDebris(result.debris,scene);
  for(const q of bodies){if(q.scene!==scene)continue;const b=readBody(q);if(!b||b.lost)continue;const d=Math.hypot(...b.pos.map((n,i)=>n-point[i]));if(d<Math.max(radius,1.2)){const dir=direction||b.pos.map((n,i)=>(n-point[i])/(d||1));const impulse=q.mesh.structural&&power>=25?Math.max(power*6,q.mass*Math.min(2.5,power*.018)):power*6;q.engine.impulse(q.handle,...point,...dir.map((n,i)=>n*impulse+(q.mesh.structural&&i===1&&power>=25?q.mass*.35:0)));}}
  for(const c of world.fleet){const base=c.y??world.ground(c.x,c.z),spec=R.vehicles.SPECS[c.model],d=Math.hypot(point[0]-c.x,point[2]-c.z,Math.max(0,base-point[1],point[1]-base-spec.height));if(d<(radius||0)+spec.width)hitVehicle(c,power*(radius?clamp(1-d/(radius+2)):1)*.65,point);}
  if(radius>2&&power>25){ignite(point[0],point[2],scene,.75);campaign?.crime(1.4);}
  return {...result,debris:[]};
 }
 world.combatWorld.damage=damage;
 function aim(range=3){const origin=[p.x,p.y+1.62,p.z],cp=Math.cos(p.pitch),dir=[Math.sin(p.yaw)*cp,Math.sin(p.pitch),-Math.cos(p.yaw)*cp];return {origin,dir,hit:activeController().raycast(origin,dir,range)};}
 function grab(){if(held){held=null;notify('Objet posé.');return true;}const {origin,dir,hit}=aim(3.2);let q=bodies.filter(q=>q.scene===currentScene()).map(q=>({q,b:bodyBox(q)})).filter(o=>o.b).map(o=>({...o,d:world.rayBox(o.b,origin,dir,3.2)})).sort((a,b)=>a.d-b.d)[0];if(q&&q.d<3.2&&(!hit||q.d<hit.distance)){if(q.q.mass>65){notify('Trop lourd à porter · '+Math.round(q.q.mass)+' kg');return false;}held=q.q;return true;}
  if(!hit){notify('G · viser un petit objet à portée.');return false;}const dc=activeController(),item=dc.describe(hit.id),mesh=item.meshes[0],mass=mesh.mass||describe(mesh).mass;
  if(item.meshes.length!==1||mass>65||Math.max(...mesh.s)>1.8){notify('Élément ancré ou trop lourd · '+Math.round(mass)+' kg');return false;}
  if(bodies.length>=240){notify('Trop de débris physiques actifs dans ce secteur.');return false;}dc.detach(hit.id);sync(dc);held=spawnBody(mesh,[0,0,0],[0,0,0],mass);notify('Objet saisi · '+Math.round(mass*10)/10+' kg · G poser · B lancer');return !!held;
 }
 function throwHeld(){if(!held)return false;const {dir}=aim(3),b=readBody(held),speed=clamp(150/Math.max(5,held.mass),2,12);held.engine.impulse(held.handle,...b.pos,...dir.map(n=>n*held.mass*speed));held=null;return true;}
 function ignite(x,z,scene='street',strength=1){if(fires.length>=32||fires.some(f=>f.scene===scene&&Math.hypot(f.x-x,f.z-z)<2&&f.heat>0))return false;const f={id:++report.ignitions,x,z,scene,heat:strength,age:0,fuel:110,spread:false};fires.push(f);alarm=Math.max(alarm,1);return true;}
 function igniteAhead(){const {hit}=aim(4);if(!hit){notify('Aucun objet combustible à portée.');return false;}const item=activeController().describe(hit.id);if(!item.meshes.some(m=>describe(m).fuel>.05)){notify('Ce matériau ne prend pas feu.');return false;}if(ignite(hit.point[0],hit.point[2],world.room?roomKey:'street')){campaign?.crime(1);notify('Incendie déclenché.');return true;}return false;}
 function startVehicleFire(c){
  if(c.exploded||c.burning)return;c.burning=true;c.fireAge=0;c.blowFuse=undefined;
  let f=fires.find(f=>f.vehicleId===c.id);if(!f){f={id:++report.ignitions,x:c.x,z:c.z,scene:'street',vehicleId:c.id,heat:.18,age:0,fuel:100,spread:false};fires.push(f);}else Object.assign(f,{heat:.18,age:0,fuel:100,spread:false});
  alarm=Math.max(alarm,1);if(Math.hypot(c.x-p.x,c.z-p.z)<20)notify('Le véhicule prend feu. Éloignez-vous !');
 }
 function hitVehicle(c,amount,point=[c.x,(c.y??world.ground(c.x,c.z))+1,c.z]){if(c.exploded||!Number.isFinite(amount)||amount<=0)return;const d=c.condition||(c.condition={body:1,engine:1,tires:1,steering:1}),front=(point[0]-c.x)*Math.cos(c.cap)+(point[2]-c.z)*Math.sin(c.cap)>0,q=amount/100;d.body=clamp(d.body-q);d.engine=clamp(d.engine-q*(front?.75:.25));d.tires=clamp(d.tires-q*.28);d.steering=clamp(d.steering-q*(front?.55:.12));c.mass=R.vehicles.SPECS[c.model].mass;if(d.engine<.08||d.body<=0)c.moteur=false;if(d.body<=.28)startVehicleFire(c);report.impacts++;}
 function vehicleFireStep(c,dt){
  if(!c.burning||c.exploded)return;let f=fires.find(f=>f.vehicleId===c.id);if(!f){c.burning=false;startVehicleFire(c);f=fires.find(f=>f.vehicleId===c.id);}
  f.x=c.x;f.z=c.z;if(f.heat<=0){c.burning=false;c.fireAge=0;return;}
  c.fireAge=(c.fireAge||0)+dt;f.heat=clamp(f.heat+dt*.15,0,1.5);const d=c.condition;d.body=clamp(d.body-dt*.012);d.engine=clamp(d.engine-dt*.035);
  // Further damage never skips the visible fire stage. Extinction can still stop it.
  const delay=c.model==='firetruck'?10:R.vehicles.SPECS[c.model].two?7:8.5;
  if(c.fireAge>=delay&&f.heat>=.65)detonateVehicle(c);
 }
 function detonateVehicle(c){if(c.exploded)return false;const spec=R.vehicles.SPECS[c.model],base=c.y??world.ground(c.x,c.z),co=Math.cos(c.cap),si=Math.sin(c.cap),paint=R.vehicles.rgb(c.color||'#403b35'),parts=[];
  const piece=(x,y,z,size,mass,shape='bevel',color=paint)=>parts.push({shape,p:[c.x+x*co-z*si,base+y,c.z+x*si+z*co],s:size,r:[0,-c.cap,0],color,mat:7,material:'metal',mass});
  if(!spec.two){piece(spec.length*.30,1.2,0,[spec.length*.27,.055,spec.width*.86],12);piece(-.3,1.55,0,[spec.length*.36,.06,spec.width*.80],18);for(const side of [-1,1]){piece(0,1,side*spec.width*.52,[1.15,.6,.055],24);piece(side*spec.wheelbase/2,.7,-side*spec.width*.46,[.58,.19,.58],14,'cylinder',[.025,.025,.025]);}piece(-spec.length*.5,.5,0,[.15,.18,spec.width*.95],9);}
  else{piece(-.3,.8,0,[.65,.12,.35],7);piece(.5,1,0,[.5,.4,.22],5);piece(-.65,.5,0,[.55,.15,.55],6,'cylinder',[.025,.025,.025]);}
  for(let i=0;i<18;i++){const a=i*2.399;piece(Math.cos(a)*.8,.8+i%4*.18,Math.sin(a)*.5,[.10+i%3*.07,.035,.16+i%4*.05],.6+i%5*.6);}
  c.exploded=true;c.burned=true;c.burning=false;c.moteur=false;c.ai=false;c.emergency=false;c.u=c.w=c.v=c.omega=0;c.condition={body:0,engine:0,tires:0,steering:0};report.vehicleExplosions++;
  if(c.driver?.inside){c.driver.hp=0;c.driver.injury={dead:true};}const radius=c.model==='firetruck'?10:!spec.two?8:(c.model==='tmax'||c.model==='policebike')?5:3.2;
  world.withoutCar(()=>sim.detonate([c.x,base+1.1,c.z],radius,radius*16));if(world.car===c&&world.playerSeated)sim.hurt(100);
  parts.forEach((m,i)=>{const a=i*2.399+c.cap,speed=m.mass>8?6:10;spawnBody(m,[Math.cos(a)*speed,5+i%5,Math.sin(a)*speed],[1+i%3,.8+i%2,1.2],m.mass,'street');});
  let f=fires.find(f=>f.vehicleId===c.id);if(f)Object.assign(f,{heat:1.35,fuel:48});else ignite(c.x,c.z,'street',1.35);campaign?.crime(1.6);notify('Véhicule détruit.');return true;
 }
 function vehicleImpact(c,h){const speed=Math.abs((c.u||0)*Math.cos(c.cap)*h.nx+(c.u||0)*Math.sin(c.cap)*h.nz),mass=R.vehicles.SPECS[c.model].mass,energy=.5*mass*speed*speed,point=[c.x-h.nx*R.vehicles.SPECS[c.model].length*.4,(c.y??world.ground(c.x,c.z))+.8,c.z-h.nz*R.vehicles.SPECS[c.model].length*.4];if(speed<1.5)return;hitVehicle(c,energy/4500,point);const other=h.obstacle?.vehicle;if(other)hitVehicle(other,energy/4500,point);if(h.obstacle?.body){const q=h.obstacle.body,b=readBody(q);q.engine.impulse(q.handle,...b.pos,-h.nx*mass*speed*.65,0,-h.nz*mass*speed*.65);}else if(speed>3&&h.obstacle?.mesh)damage(point,Math.min(150,energy/1800),Math.min(2.7,1+speed*.07),[-h.nx,0,-h.nz]);}
 function repair(c){if(c.exploded){notify('Épave irréparable.');return false;}const site=campaign?.near(),room=interiors?.active;if(!(site?.name.includes('Garage')||room?.building.type==='garage')){notify('Réparation dans un garage · 180 €');return false;}if(campaign.state.cash<180){notify('Il faut 180 €.');return false;}campaign.state.cash-=180;c.condition={body:1,engine:1,tires:1,steering:1};c.burned=false;c.burning=false;c.glassBroken=false;c.fireAge=0;c.blowFuse=undefined;for(const f of fires)if(f.vehicleId===c.id)f.heat=0;notify('Véhicule réparé · −180 €');return true;}
 function dispatch(){const f=fires.find(f=>f.heat>0);if(!f||!traffic)return;const door=f.scene==='street'?f:interiors.entries.find(b=>f.scene.startsWith(b.id+':')),target=door||f,choices=traffic.nodes.filter(n=>n.links.length&&Math.hypot(n.x-target.x,n.z-target.z)<120).sort((a,b)=>Math.abs(Math.hypot(a.x-target.x,a.z-target.z)-65)-Math.abs(Math.hypot(b.x-target.x,b.z-target.z)-65));
  for(const n of choices){const next=traffic.nodes[n.links[0]],c=BITUME.conduite.creer(n.x,n.z,Math.atan2(next.z-n.z,next.x-n.x));Object.assign(c,{id:900,model:'firetruck',color:'#b72d21',y:world.ground(n.x,n.z),moteur:true,mass:5200,ai:false,emergency:true});if(world.carContact(c))continue;const path=traffic.route(n.x,n.z,target.x,target.z);if(!path.length)continue;const first=traffic.nodes[path[0]];c.cap=Math.atan2(first.z-c.z,first.x-c.x);if(world.carContact(c))continue;truck=c;world.fleet.push(c);job={target,path,stuck:0,scene:f.scene};report.dispatches++;notify('Sirène des pompiers dans le quartier.');break;}
 }
 function crewStep(dt){if(!truck||!job||!truck.emergency)return;if(!crew.length){job.delay=(job.delay||0)+dt;const goal=job.path.length?traffic.nodes[job.path[0]]:job.target,d=Math.hypot(goal.x-truck.x,goal.z-truck.z);if(d<4&&job.path.length)job.path.shift();const near=Math.hypot(truck.x-job.target.x,truck.z-job.target.z)<22;if(truck.v<.3)job.stuck+=dt;else job.stuck=0;
   if(near||job.delay>12&&job.stuck>2){truck.u=truck.w=truck.v=0;if(truck.driver)truck.driver.inside=false;for(let i=0;i<3;i++){const pos=world.freeNear(truck.x+3,truck.z+i*1.2,.4);crew.push({...(i===0?truck.driver||{}:{}),x:pos[0],z:pos[1],baseY:world.ground(pos[0],pos[1]),yaw:0,hp:100,civil:true,id:i===0&&truck.driver?truck.driver.id:700+i,firefighter:true});}truck.driver=null;truck.parked=true;}
   else{const err=angle(Math.atan2(goal.z-truck.z,goal.x-truck.x)-truck.cap),speed=6*Math.max(.22,1-Math.abs(err)*.6);if(job.stuck>4){job.reverse=1.7;job.stuck=0;}job.reverse=Math.max(0,(job.reverse||0)-dt);R.vehicles.step(truck,{gaz:job.reverse?.4:truck.v<speed?.6:0,frein:!job.reverse&&truck.v>speed+.2?.4:0,volant:clamp(err*2,-1,1)*(job.reverse?-1:1),marcheArriere:!!job.reverse},world,dt);}return;}
  for(const man of crew){if(man.hp<=0){man.spray=null;continue;}const fire=fires.filter(f=>f.heat>0).sort((a,b)=>Math.hypot(a.x-man.x,a.z-man.z)-Math.hypot(b.x-man.x,b.z-man.z))[0];if(!fire){man.spray=null;continue;}if(fire.scene!=='street'){const b=interiors.entries.find(b=>fire.scene.startsWith(b.id+':'));if(b&&Math.hypot(man.x-b.x,man.z-b.z)<4){man.x=1000;man.z=1008;man.scene=fire.scene;}}
   const target=fire.scene==='street'||man.scene===fire.scene?fire:job.target,dx=target.x-man.x,dz=target.z-man.z,d=Math.hypot(dx,dz);man.baseY=sceneGround(man.scene||'street',man.x,man.z);man.yaw=Math.atan2(dx,-dz);
   const dy=fireHeight(fire)-man.baseY,d3=Math.hypot(dx,dy,dz),clear=d3<16&&(man.scene||'street')===fire.scene&&world.ray([man.x,man.baseY+1.3,man.z],[dx/(d3||1),dy/(d3||1),dz/(d3||1)],Math.max(0,d3-2.3))>=Math.max(0,d3-2.4);
   if(clear){man.spray={x:fire.x,z:fire.z,y:fireHeight(fire)+.6};fire.heat=Math.max(0,fire.heat-dt*.18);if(!fire.heat){report.extinguished++;notify('Les pompiers ont maîtrisé un foyer.');}}
   else{man.spray=null;let best=null;for(const off of [0,.5,-.5,1,-1,1.57,-1.57]){const a=Math.atan2(dz,dx)+off,x=man.x+Math.cos(a)*(man.injury?.leg?.35:2.4)*dt,z=man.z+Math.sin(a)*(man.injury?.leg?.35:2.4)*dt;if(!world.blocked(x,z,.27)&&(!best||Math.hypot(x-target.x,z-target.z)<best.d))best={x,z,d:Math.hypot(x-target.x,z-target.z)};}if(best){man.x=best.x;man.z=best.z;man.baseY=sceneGround(man.scene||'street',man.x,man.z);}}
  }
 }
 function update(dt,events=[]){clock+=dt;for(let i=dust.length-1;i>=0;i--){dust[i].age+=dt;if(dust[i].age>=3.5)dust.splice(i,1);}for(const c of world.fleet)vehicleFireStep(c,dt);for(const c of world.fleet)c.impactHandler=h=>vehicleImpact(c,h);if(world.room)activeController();else if(roomKey){if(indoor)roomStates.set(roomKey,indoor.snapshot());roomKey=null;indoor=null;held=null;}
  if(breaches?.update(dt,world.room?interiors?.outside:p)){version++;staticClock=0;}if(breaches&&(projectionMembers!==breaches.projections||projectionRoom!==world.room)){projectionMembers=breaches.projections;projectionRoom=world.room;const exposedKeys=new Set(projectionMembers.map(b=>b.room.sceneId)),retainedRooms=new Set(projectionMembers.map(b=>b.room));if(world.room)retainedRooms.add(world.room);for(const [key,record]of projectedRooms){if(!exposedKeys.has(key)&&key!==roomKey){roomStates.set(key,record.dc.snapshot());projectedRooms.delete(key);}else for(const room of record.rooms)if(!retainedRooms.has(room))record.rooms.delete(room);}}
  if(held){const b=readBody(held),{origin,dir}=aim(3),want=origin.map((v,i)=>v+dir[i]*1.8);if(b){const force=want.map((v,i)=>(v-b.pos[i])*18-b.vel[i]*6);held.engine.impulse(held.handle,...b.pos,...force.map(v=>v*held.mass*dt));if(Math.hypot(...b.pos.map((v,i)=>v-want[i]))>3)held=null;}}
  physicsClock+=dt;if(bodies.length&&physicsClock>=1/60){
   staticClock-=physicsClock;
   migrateBodies();
   for(const {scene,engine}of [...engines.values()]){if(scene!=='street'&&scene!==currentScene())continue;
    if(staticClock<=0){const set=new Set(),floors=new Map();for(const q of bodies){if(q.engine!==engine)continue;const b=readBody(q);if(!b||b.lost)continue;if(scene!=='street'){for(const k of world.room?.colliders||[])set.add(k);}else for(const k of world.candidates(b.pos[0],b.pos[2],8))set.add(k);
      const fx=Math.floor(b.pos[0]/8),fz=Math.floor(b.pos[2]/8);for(let x=fx-1;x<=fx+1;x++)for(let z=fz-1;z<=fz+1;z++){const key=x+','+z;if(floors.has(key))continue;const px=x*8+4,pz=z*8+4,y=scene==='street'?world.ground(px,pz):.08;floors.set(key,{x:px,z:pz,w:8,d:8,y:Number.isFinite(y)?y:.08});}
     }
     let floorList=[...floors.values()];if(floorList.length&&floorList.every(f=>Math.abs(f.y-floorList[0].y)<1e-6)){const x0=Math.min(...floorList.map(f=>f.x-4)),x1=Math.max(...floorList.map(f=>f.x+4)),z0=Math.min(...floorList.map(f=>f.z-4)),z1=Math.max(...floorList.map(f=>f.z+4));floorList=[{x:(x0+x1)/2,z:(z0+z1)/2,w:x1-x0,d:z1-z0,y:floorList[0].y}];}
     engine.setStatics([...set].filter(q=>q.a>0&&q.b>0&&q.maxY>q.minY).slice(0,8100-floorList.length).map(q=>({center:[q.x,(q.minY+q.maxY)/2,q.z],half:[q.a,(q.maxY-q.minY)/2,q.b],rotation:[q.c,0,-q.s,0,1,0,q.s,0,q.c]})),floorList);
    }engine.step(physicsClock);
   }if(staticClock<=0)staticClock=.3;physicsClock=0;
  }
  publishBodies(bodies.filter(q=>q!==held&&q.scene===currentScene()).map(bodyBox).filter(Boolean));
  for(const q of bodies){if(q.scene!==currentScene())continue;const b=readBody(q);if(!b||b.lost||q===held)continue;const dx=b.pos[0]-p.x,dz=b.pos[2]-p.z,d=Math.hypot(dx,dz),rad=Math.min(.7,Math.max(q.mesh.s[0],q.mesh.s[2])/2)+.35;if(d<rad&&b.pos[1]<world.ground(p.x,p.z)+2&&b.mass<400)q.engine.impulse(q.handle,...b.pos,dx/(d||1)*90*dt,0,dz/(d||1)*90*dt);}
  if(fires.some(f=>f.heat>0)){if(!truck){alarm+=dt;if(alarm>6)dispatch();}crewStep(dt);if(Math.floor(clock/.8)!==Math.floor((clock-dt)/.8)&&truck)events.push({name:'policeSiren',level:.15});}
  fireClock+=dt;if(fireClock>=1){const elapsed=fireClock;fireClock=0;for(const f of fires){if(f.heat<=0)continue;f.age+=elapsed;f.fuel-=elapsed;f.heat=clamp(f.heat+elapsed*(.012-(f.scene==='street'?(world.weather?.rain||0)*.04:0)),0,1.5);if(f.fuel<=0)f.heat=0;const here=f.scene==='street'?!world.room:roomKey===f.scene;
    if((here||f.scene==='street')&&f.age%4<elapsed){const dc=f.scene==='street'?streetController():activeController(),point=[f.x,fireHeight(f)+1.3,f.z],streamed=f.scene==='street'?world.cityStream?.damage?.(point,9*f.heat,2.3):null,result=streamed?.changed?streamed:dc.blast(point,2.3,9*f.heat);let recolored=false;for(const e of result.events){charred.add((f.scene||'street')+'|'+e.sourceId);const item=streamed?.changed?null:dc.describe(e.sourceId);for(const m of item?.meshes||[]){m.color=(m.color||[.4,.4,.4]).map(n=>n*.88);m.renderRevision=(m.renderRevision||0)+1;recolored=true;}}if(result.changed){if(streamed?.changed){version++;staticClock=0;}else{if(f.scene==='street')breaches?.observe(result);sync(dc);}report.breaches++;structuralDebris(result.debris,f.scene);}else if(recolored)version++;if(recolored)world.invalidateSceneryRender?.();}
    if((here||f.scene==='street')&&!f.spread&&f.age>7){f.spread=true;const dc=f.scene==='street'?streetController():activeController();for(let j=0;j<8;j++){const a=j*Math.PI/4,hit=dc.raycast([f.x,fireHeight(f)+1.2,f.z],[Math.sin(a),0,Math.cos(a)],6);if(hit&&dc.describe(hit.id)?.meshes.some(m=>describe(m).fuel>.4)){ignite(hit.point[0],hit.point[2],f.scene,.6);break;}}}
    if(here&&Math.hypot(p.x-f.x,p.z-f.z,p.y-fireHeight(f))<2)sim.hurt(4*elapsed*f.heat);for(const c of world.fleet)if(f.scene==='street'&&f.vehicleId!==c.id&&Math.hypot(c.x-f.x,c.z-f.z)<3)hitVehicle(c,elapsed*2,[f.x,fireHeight(f)+1,f.z]);
  }}
 }
 function geometry(){const out=[];for(const q of dust)if(q.scene===currentScene()){const t=q.age/3.5;for(let i=0;i<4;i++){const a=i*2.399,spread=.12+.25*t;out.push({shape:'sphere',p:[q.pos[0]+Math.cos(a)*q.size[0]*spread,Math.max(.2,q.pos[1])+.5+t*q.size[1]*.3,q.pos[2]+Math.sin(a)*q.size[2]*spread],s:[q.size[0]*(.35+t*.25),q.size[1]*(.35+t*.3),q.size[2]*(.35+t*.25)],color:[.38,.34,.28],mat:7,fx:true,fxSmoke:true,fxDust:true,collision:false,alpha:(1-t)*.30});}}if(!world.room)for(const c of world.fleet){if(!c.condition||c.exploded||c.condition.body>.65)continue;const intensity=clamp((.65-c.condition.body)*2),co=Math.cos(c.cap),si=Math.sin(c.cap),x=c.x+co*R.vehicles.SPECS[c.model].length*.30,z=c.z+si*R.vehicles.SPECS[c.model].length*.30;for(let i=0;i<6;i++){const rise=(clock*.7+i/6)%1;out.push({shape:'sphere',p:[x+Math.sin(i+clock)*rise*.25,(c.y??world.ground(c.x,c.z))+1+rise*2.4,z+Math.cos(i+clock*.8)*rise*.25],s:[.15+rise*.65,.20+rise*.65,.15+rise*.65],color:c.burning?[.045,.04,.035]:[.24,.25,.25],mat:7,fx:true,fxSmoke:true,alpha:(1-rise)*intensity*.4});}}for(const q of bodies){if(q.scene!==(world.room?roomKey:'street'))continue;const m=bodyMesh(q);if(m)out.push(m);}for(const f of fires){if(f.heat<=0||f.scene!==(world.room?roomKey:'street'))continue;for(let i=0;i<7;i++){const a=i*2.4+clock*.7,h=(.6+Math.sin(clock*8+i)*.25)*f.heat,spread=f.vehicleId!==undefined?1.0:.55;out.push({shape:'sphere',p:[f.x+Math.sin(a)*spread,fireHeight(f)+.4+h,f.z+Math.cos(a)*spread],s:[.55,h*2,.55],color:[1,.22+i*.05,.025],mat:6,emissive:2.2,fx:true,fxFire:true,alpha:.65});}for(let i=0;i<5;i++)out.push({shape:'sphere',p:[f.x+Math.sin(clock+i)*.4,fireHeight(f)+2+i*.7+(clock*.6%1),f.z],s:[1+i*.3,1.2,1+i*.3],color:[.08,.075,.07],mat:7,fx:true,alpha:.22});}
  for(const man of crew){if((man.scene||'street')!==(world.room?roomKey:'street'))continue;out.push(...R.people.build({...man,renderBody:true},{time:clock,distance:0}));if(man.hp>0&&!man.injury?.leg)out.push({shape:'sphere',p:[man.x,(man.baseY??.08)+1.83,man.z],s:[.34,.23,.34],color:[.9,.72,.13],mat:7});if(man.spray){const dx=man.spray.x-man.x,dz=man.spray.z-man.z;for(let i=0;i<18;i++){const t=(i/18+clock*1.4)%1;out.push({shape:'sphere',p:[man.x+dx*t,(man.baseY??.08)+1.2+(man.spray.y-((man.baseY??.08)+1.2))*t+Math.sin(t*Math.PI)*.4,man.z+dz*t],s:[.12,.12,.12],mat:19,color:[.46,.70,.84],fx:true,alpha:.7});}}}return out;
 }
 function save(){if(indoor&&roomKey)roomStates.set(roomKey,indoor.snapshot());for(const [key,record]of projectedRooms)roomStates.set(key,record.dc.snapshot());return {version:1,playerSupport:{x:p.x,y:p.y,z:p.z,scene:currentScene()},openings:breaches?.save()||[],damage:outdoor?.snapshot()||saved?.damage||null,rooms:Object.fromEntries(roomStates),charred:[...charred],fires:fires.filter(f=>f.heat>0),vehicles:world.fleet.filter(c=>c.condition).map(c=>({id:c.id,condition:c.condition,glassBroken:!!c.glassBroken,burned:!!c.burned,exploded:!!c.exploded,burning:!!c.burning,fireAge:c.fireAge||0})),bodies:bodies.map(q=>{const b=q.engine.body(q.handle);return b&&!b.lost?{mesh:q.mesh,pos:b.pos,rot:FPhysics.quatToEuler(...b.quat),mass:q.mass,scene:q.scene}:null;}).filter(Boolean).slice(-240)};}
 if(saved?.version===1){for(const d of saved.vehicles||[]){const c=world.fleet.find(c=>c.id===d.id);if(c&&['body','engine','tires','steering'].every(k=>Number.isFinite(d.condition?.[k])))Object.assign(c,{condition:Object.fromEntries(['body','engine','tires','steering'].map(k=>[k,clamp(d.condition[k])])),glassBroken:!!d.glassBroken,burned:!!d.burned,exploded:!!d.exploded,burning:!d.exploded&&(!!d.burning||Number.isFinite(d.blowFuse)),fireAge:clamp(Number.isFinite(d.fireAge)?d.fireAge:0,0,30)});}for(const f of saved.fires||[])if(fires.length<32&&Number.isFinite(f.x)&&Number.isFinite(f.z)&&Number.isFinite(f.heat)&&typeof f.scene==='string')fires.push({...f,heat:clamp(f.heat,0,1.5),age:Number.isFinite(f.age)?f.age:0,fuel:Number.isFinite(f.fuel)?clamp(f.fuel,0,120):60});if(saved.damage)activeController();for(const q of saved.bodies||[])if(q.mesh?.s?.every(v=>Number.isFinite(v)&&v>.01&&v<10)&&q.pos?.every(Number.isFinite)&&q.rot?.every(Number.isFinite)&&Number.isFinite(q.mass)&&q.mass>0)restoreDebris(q);}
 // Campaign restores horizontal position before urban bodies exist. Preserve a
 // legitimate saved foot support only after those exact solids are available.
 if(saved?.playerSupport&&world.combatWorld.spatial){const q=saved.playerSupport;if(q.scene===currentScene()&&[q.x,q.y,q.z].every(Number.isFinite)&&Math.hypot(p.x-q.x,p.z-q.z)<.05){publishBodies(bodies.filter(b=>b.scene===currentScene()).map(bodyBox).filter(Boolean));const y=rubbleSupport(p.x,p.z,q.y,.28,sceneGround(q.scene,p.x,p.z),.06);if(Math.abs(y-q.y)<.06&&!world.blocked(p.x,p.z,.28,y,1.8))p.y=y;}}
 return {prepare(){const dc=streetController();world.prepareSceneryDelta?.(dc.meshes);},get physicsZones(){return [...engines.values()].map(r=>({key:r.key,scene:r.scene,bounds:{...r.bounds},bodies:bodies.filter(q=>q.engine===r.engine).length}));},crossBreach(previous,current){return breaches?.cross(previous,current)||false;},get breachProjections(){return breaches?.projections||[];},get breachLights(){return breaches?.lights||[];},materials,describe,damage,grab,throwHeld,ignite,igniteAhead,repair,hitVehicle,detonateVehicle,spawnBody,get physics(){return physicsFor(currentScene());},bodies,fires,crew,report,geometry,save,update,get held(){return held;},get truck(){return truck;},get revision(){return version;},get controller(){return activeController();}};
}
R.urban={create,describe,materials};
})(globalThis.RADE);
/* Condition modifies the existing BITUME tyre/drivetrain solver, including traffic. */
(function(R){'use strict';const V=R.vehicles,step=V.step,render=V.render;V.SPECS.firetruck={name:'Fourgon des marins-pompiers',length:5.8,width:2.15,height:2.8,wheelbase:3.3,mass:5200};
const vehicleModel=V.model;V.model=function(type,color){return type==='firetruck'?{eye:[1.35,2,-.36]}:vehicleModel(type,color);};
V.step=function(c,cmd,world,dt){const d=c.condition;c.mass=V.SPECS[c.model].mass;if(!d)return step(c,cmd,world,dt);if(d.engine<.08||d.body<=0)c.moteur=false;const next={...cmd,gaz:(cmd.gaz||0)*(.25+.75*d.engine),volant:(cmd.volant||0)*(.5+.5*d.steering)+Math.sin(c.id*7||1)*(1-d.steering)*.13,frein:(cmd.frein||0)*(.55+.45*d.tires)},surface=world.surface;const contact={ground:world.ground,moveVehicle:world.moveVehicle,weather:world.weather,surface:(x,z)=>{const s=surface?surface(x,z):{mu:1,type:'pave'};return {...s,mu:s.mu*(.45+.55*d.tires)};}};return step(c,next,contact,dt);};
function wreck(c,out){const spec=V.SPECS[c.model],base=c.y??.08,co=Math.cos(c.cap),si=Math.sin(c.cap),char=[.065,.061,.055],rust=[.14,.10,.065],add=(shape,x,y,z,size,rot=[0,0,0],color=char)=>{const matrix=BITUME.voiture.mulM(BITUME.voiture.euler(0,-c.cap,0),BITUME.voiture.euler(...rot));out.push({shape,p:[c.x+x*co-z*si,base+y,c.z+x*si+z*co],s:size,r:BITUME.voiture.angles(matrix),color,mat:7,surface:'object'});};
 if(spec.two){add('bevel',0,.24,0,[spec.length*.65,.17,spec.width*.5]);add('cylinder',.4,.55,0,[.07,.7,.07],[0,0,-.45]);add('cylinder',.65,.22,0,[.45,.1,.45],[Math.PI/2,0,0]);return;}
 const L=spec.length,W=spec.width;add('bevel',0,.26,0,[L*.84,.18,W*.76]);add('bevel',L*.3,.52,0,[.65,.42,.65],[0,.1,.13],rust);
 for(const side of [-1,1]){add('bevel',0,.36,side*W*.43,[L*.83,.18,.12],[.06,0,side*.045]);for(const x of [-L*.35,L*.34]){add('bevel',x,.55,side*W*.42,[L*.19,.36,.12],[side*.15,.07,side*.12],rust);}add('bevel',-.5,.57,side*.35,[.22,.38,.35],[0,0,-.3]);add('cylinder',side*spec.wheelbase/2,.30,side*W*.43,[.43,.16,.43],[Math.PI/2,0,.14]);add('cylinder',side*.55,.86,side*W*.34,[.04,.62,.04],[side*.2,0,side*.4]);}
 for(let i=0;i<5;i++)add('bevel',-L*.3+i*L*.15,.4,0,[.055,.065,W*.72],[0,.03*i,.04],rust);
}
V.render=function(c,out,opt){if(c.exploded){wreck(c,out);return;}if(c.model==='firetruck'){
 const base=c.y??.08,co=Math.cos(c.cap),si=Math.sin(c.cap),paint=c.exploded?[.12,.11,.10]:[.65,.035,.025],box=(x,y,z,size,color,mat=7)=>out.push({shape:'bevel',p:[c.x+x*co-z*si,base+y,c.z+x*si+z*co],s:size,r:[0,-c.cap,0],color,mat});
 box(0,.58,0,[5.4,.65,2.02],paint,17);box(0,.38,0,[5.3,.18,1.8],[.07,.08,.08]);
 if(!c.exploded){
  box(-.78,1.67,0,[3.65,1.65,2.02],paint,17);box(1.83,.99,0,[1.67,.48,2.02],paint,17);box(1.83,2.47,0,[1.74,.12,2.02],paint,17);
  box(2.62,1.36,0,[.09,.35,1.92],[.11,.13,.14]);box(1.12,1.59,0,[.14,1.75,1.92],paint,17);
  box(2.63,1.97,0,[.025,.85,1.78],[.17,.28,.31],19);
  for(const side of [-1,1]){
   for(const x of [1.1,2.64])box(x,1.98,side*.94,[.10,.88,.09],paint,17);
   box(1.85,1.97,side*1.005,[1.48,.84,.02],[.17,.28,.31],19);
   box(1.72,1.03,side*.43,[.55,.17,.52],[.07,.085,.09]);box(1.4,1.39,side*.43,[.16,.65,.50],[.07,.085,.09]);
   box(-.65,1.65,side*1.02,[2.7,1.1,.03],[.55,.57,.55],0);for(let j=0;j<5;j++)box(-.65,1.22+j*.19,side*1.05,[2.7,.025,.02],[.16,.18,.19]);
   box(-.7,2.57,side*.65,[3.4,.10,.08],[.55,.60,.62],0);box(1.7,2.59,side*.7,[.3,.2,.28],[.12,.35,.9],5);
  }
 }
 box(0,1.1,0,[5.5,.18,2.06],c.exploded?[.17,.17,.15]:[.84,.85,.77]);for(const side of [-1,1])for(const x of [-1.65,1.65])box(x,.47,side*1.05,[.83,.88,.22],[.03,.035,.04]);return;
 }
 const start=out.length,result=render(c,out,opt),d=c.condition;if(d){for(let i=out.length-1;i>=start;i--){const m=out[i];if(m.window&&(d.body<.6||c.glassBroken)||c.exploded&&m.p[1]>1.08){out.splice(i,1);continue;}if(m.mat===17&&d.body<.95){const dx=m.p[0]-c.x,dz=m.p[2]-c.z,u=dx*Math.cos(c.cap)+dz*Math.sin(c.cap),dent=(1-d.body)*Math.max(0,Math.abs(u)-.7)*.3;m.p=[m.p[0]-Math.sign(u)*Math.cos(c.cap)*dent,m.p[1]-(1-d.body)*.04,m.p[2]-Math.sign(u)*Math.sin(c.cap)*dent];m.color=m.color?.map(v=>v*(.35+.65*d.body)*Math.max(.22,1-(c.fireAge||0)*.075));if(m.shape.includes('-hood')&&d.body<.6){m.p[1]+=(.6-d.body)*.25;m.r=[...(m.r||[0,0,0])];m.r[2]+=(.6-d.body)*.18;}}}}return result;};
})(globalThis.RADE);
