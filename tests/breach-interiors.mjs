import './load.mjs';
import assert from 'node:assert/strict';
const C=1000;
function fixture(angle=.61,index=0){
 const q={x:20+index*60,z:-30,lx:20,lz:24,lacet:angle},n=[Math.sin(angle),Math.cos(angle)],b={id:'building-fixture-'+index,index,type:'restaurant',name:'Restaurant fixture',floors:4,h:12.4,boxes:[q],places:[{id:'fixture-place-'+index,name:'Restaurant fixture',type:'restaurant',kind:'restaurant',sourceUrl:'fixture://test',x:q.x,z:q.z}],x:q.x+n[0]*13,z:q.z+n[1]*13,nx:n[0],nz:n[1]};
 const mesh={shape:'box',p:[q.x,6.2,q.z],s:[q.lx,12.4,q.lz],r:[0,angle,0],mat:13};return {q,b,mesh};
}
function setup(fixtures=[fixture()]){
 let blocked=()=>false;const player={x:0,y:.08,z:0,yaw:.4,hp:100},world={addresses:{entries:fixtures.map(f=>f.b),shared:0},blocked:(...a)=>blocked(...a),freeNear:(x,z)=>[x,z],rayBox:()=>100,room:null},sim={state:{player,dead:false},relocate(x,z,yaw=0){Object.assign(player,{x,z,y:.08,yaw});}},i=RADE.interiors.create(world,sim);
 return {i,world,sim,player,fixtures,setBlocked:fn=>{blocked=fn;}};
}
const near=(a,b,eps=1e-7)=>assert(Math.abs(a-b)<eps,`${a} != ${b}`);
const vnear=(a,b)=>a.forEach((x,k)=>near(x,b[k]));
const s=setup(),f=s.fixtures[0],n=[f.b.nx,0,f.b.nz],hit=[f.q.x+n[0]*12,1.1,f.q.z+n[2]*12];
const bridge=s.i.breachProjection({mesh:f.mesh,point:hit,normal:n});assert(bridge);assert.equal(bridge.buildingId,f.b.id);assert.equal(bridge.footprint,f.q);assert.equal(bridge.floor,0);assert.equal(bridge.floorHeight,3.1);assert.equal(bridge.room.place,f.b.places[0]);
assert.equal(bridge.room.type,'restaurant');assert(bridge.room.features.includes('kitchen'));assert(bridge.scenery.length>100);assert(bridge.scenery.length<bridge.room.scenery.length);assert(!bridge.scenery.some(m=>m.interiorShell));assert(bridge.colliders.length>0);assert(bridge.lights.length>0);
for(const point of [[C,.08,C],[C+3,2,C-4],[C-5,3.1,C+6]])vnear(bridge.toRoom(bridge.toWorld(point)),point);
for(const yaw of [0,.3,2,-2.3])near(Math.sin(bridge.toRoomYaw(bridge.toWorldYaw(yaw))-yaw),0);
for(const m of bridge.scenery){assert(m.p.every(Number.isFinite)&&m.s.every(n=>Number.isFinite(n)&&n>0)&&m.r.every(Number.isFinite));assert(m.p[0]<900&&m.p[2]<900);assert.equal(m.breachInterior,true);}
assert(bridge.colliders.every(c=>c.mesh?.interiorShell!==true&&Number.isFinite(c.minY)&&Number.isFinite(c.maxY)));
assert.equal(s.i.breachProjection({mesh:f.mesh,point:hit,normal:n}),bridge,'same projection cached');assert.equal(s.i.breachProjection({mesh:{...f.mesh,p:[200,6.2,200]},point:hit}),null,'unrelated mesh rejected');assert.equal(s.i.breachProjection({mesh:{...f.mesh,s:[1,12.4,24]},point:hit}),null,'small props rejected');
const upper=s.i.breachProjection({mesh:f.mesh,point:[hit[0],4,hit[2]],normal:n});assert.equal(upper.floor,1);assert.equal(upper.room.type,'logement');assert(upper.room.features.includes('bedroom'));near(upper.toWorld([C,.08,C])[1],3.18);
const reverse=s.i.breachProjection({mesh:f.mesh,point:[f.q.x-n[0]*12,1,f.q.z-n[2]*12],normal:n.map(v=>-v)});assert.equal(reverse.room,bridge.room);vnear(reverse.toWorld([C+2,1,C-1]),bridge.toWorld([C+2,1,C-1]));
const at=distance=>[hit[0]+n[0]*distance,.08,hit[2]+n[2]*distance],a=at(-.20),b=at(-.47);
assert.equal(s.i.enterBreach(bridge,a,a),false,'no entry from proximity');assert.equal(s.i.enterBreach(bridge,b,a),false,'wrong crossing direction');assert.equal(s.i.enterBreach(bridge,at(3),b),false,'teleport-length sweep rejected');assert.equal(s.i.enterBreach(bridge,a.map((x,k)=>k===1?x+3.1:x),b.map((x,k)=>k===1?x+3.1:x)),false,'wrong floor rejected');
s.setBlocked(()=>true);assert.equal(s.i.enterBreach(bridge,a,b),false,'intact physical wall rejects crossing');s.setBlocked(()=>false);
// Furniture at the target must not be bypassed by nearest-free spawning.
const dest=bridge.toRoom(b),extra={x:dest[0],z:dest[2]-.5,a:1,b:1,minY:0,maxY:2};bridge.room.colliders.push(extra);assert.equal(s.i.enterBreach(bridge,a,b),false,'furniture blocks entry');bridge.room.colliders.pop();
const yaw=s.player.yaw;assert(s.i.enterBreach(bridge,a,b),'actual clear crossing enters');assert.equal(s.i.active,bridge.room,'same furnished room instance');assert.equal(s.world.room,bridge.room);assert(!bridge.room.blocked(s.player.x,s.player.z,.28));near(Math.sin(s.player.yaw-bridge.toRoomYaw(yaw)),0);assert(s.i.outside.breach);assert(s.i.outside.x<900);const saved=s.i.save();assert(saved.active.outside.breach);assert(s.i.leave());assert.equal(s.world.room,null);near(s.player.x,saved.active.outside.x);near(s.player.z,saved.active.outside.z);
const restored=RADE.interiors.create(s.world,s.sim,{saved});assert(restored.active);assert.equal(restored.outside.breach,true);near(restored.outside.x,saved.active.outside.x);assert(restored.leave());
const old=RADE.interiors.create(s.world,s.sim,{saved:{active:{id:f.b.id,floor:0,x:C,z:C+8,yaw:0}}});assert(old.active);assert.equal(old.outside.x,f.b.x);assert(old.leave());
// Several rooms are retained only while referenced by the bounded projection cache.
const many=Array.from({length:12},(_,k)=>fixture(k*.14,k)),bounded=setup(many);for(const f of many){assert(bounded.i.breachProjection({mesh:f.mesh,point:[f.q.x,1,f.q.z+10]}));assert(bounded.i.breachCacheSize<=8);}assert.equal(bounded.i.breachCacheSize,8);
// Destruction changes can be reprojected without regenerating the procedural plan.
const source=bridge.room.scenery.find(m=>!m.interiorShell),before=bridge.scenery.length;source.destroyed=true;bridge.refresh();assert.equal(bridge.scenery.length,before-1);delete source.destroyed;
console.log('PASS breach interiors: real footprint, rotated transforms, room identity, shell culling, physical swept entry, blockers, save compatibility, cache bound');
