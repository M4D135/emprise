import './load.mjs';import assert from 'node:assert/strict';import fs from 'node:fs';
const box=(p,size,r=[0,0,0])=>{const axes=BITUME.voiture.euler(...r),half=size.map(v=>v/2),extent=[0,1,2].map(i=>axes.reduce((v,a,k)=>v+Math.abs(a[i])*half[k],0));return {x:p[0],z:p[2],a:extent[0],b:extent[2],minY:p[1]-extent[1],maxY:p[1]+extent[1],mesh:{p,s:size,r},body:{}};};
const checks=[];
const slanted=box([0,1,0],[4,.3,.2],[0,Math.PI/4,0]);assert.equal(RADE.clearance.contact(slanted,1,1,.28,.08,1.8),0);assert(RADE.clearance.contact(slanted,1,-1,.28,.08,1.8)>0);checks.push('Rotated slab: empty corners of enclosing AABB remain walkable; actual plate blocks');
let bodies=[box([0,1,0],[4,2,4])];const solid=(x,z,r)=>x-r<-.35||Math.abs(z)+r>5;
const c=RADE.clearance.create({bodies:()=>bodies,staticBlocked:solid});const p={x:0,z:0,y:.08,hp:100};assert(c.blocked(p.x,p.z,.28,p.y));
assert(c.moveBlocked(0,0,-.1,0,.28,.08));let distance=0;
for(let i=0;i<360;i++){const before={...p};c.resolve(p,1/120);distance+=Math.hypot(p.x-before.x,p.z-before.z);assert(p.x>=-.07-1e-8,'Never cross adjacent solid wall');assert(Math.hypot(p.x-before.x,p.z-before.z)<=2/120+1e-8,'Recovery is a bounded nudge, not teleport');}
assert(!c.blocked(p.x,p.z,.28,p.y));assert(distance>2&&distance<3);assert(c.moveBlocked(p.x,p.z,0,0,.28,.08),'Cannot reenter escaped rubble');checks.push('Player enclosed by falling body escapes gradually without crossing adjacent wall or reentering debris');
bodies=[box([0,4,0],[2,.2,2],[0,0,.5])];assert(!c.blocked(0,0,.28,.08));checks.push('Raised rubble does not collide with player below it');
// Real street physics: release a heavy plate above the real player, then use ordinary session updates.
const s=RADE.session.create({pedestrians:0});s.urban.prepare();const point=s.world.freeNear(61.5,189,2);s.sim.relocate(...point);const start=[s.player.x,s.player.z];
s.urban.spawnBody({shape:'box',p:[s.player.x,3.5,s.player.z],s:[2.4,.45,2.4],r:[0,.3,.15],mat:3,material:'stone'},[0,0,0],[0,0,0],1600);
let maxStep=0,hadOverlap=false;
for(let i=0;i<720;i++){const x=s.player.x,z=s.player.z;s.update(1/120,{});maxStep=Math.max(maxStep,Math.hypot(s.player.x-x,s.player.z-z));hadOverlap||=s.world.blocked(s.player.x,s.player.z,.28,s.player.y);}
assert(hadOverlap,'A falling piece really overlaps the capsule during recovery');assert(!s.world.blocked(s.player.x,s.player.z,.28,s.player.y));assert(Math.hypot(s.player.x-start[0],s.player.z-start[1])>.5);assert(maxStep<.02);
const clear=[s.player.x,s.player.z];for(let i=0;i<120;i++)s.update(1/120,{moveY:1});assert(Math.hypot(s.player.x-clear[0],s.player.z-clear[1])>1,'Controls work again after collapse');checks.push('Real1600kg falling piece: normal session recovers and forward control moves player again');
const report={checks,maxRecoveryStep:maxStep,scope:'Capsule/OBB contacts and player recovery; vehicle collisions keep their conservative broad volumes.'};fs.writeFileSync(new URL('../docs/clearance-validation.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(report);
