import './load.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
const baseline='d22a5eb',live=RADE.world;
function factory(source){const marker=',withoutCar(fn)';assert(source.includes(marker));vm.runInThisContext(source.replace(marker,',__land:land'+marker));const result=RADE.world;RADE.world=live;return result;}
const before=factory(execFileSync('git',['show',baseline+':src/world.js'],{encoding:'utf8'})).create(),after=factory(readFileSync(new URL('../src/world.js',import.meta.url),'utf8')).create();
assert.equal(after.scenery.length,before.scenery.length);assert.equal(after.boxes.length,before.boxes.length);
let seed=43217,landChecks=0,collisionChecks=0;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296),radii=[0,-0,.24,.28,1.2,3.6,8.1,-.24];
const land=(x,z,r)=>{assert.equal(after.__land(x,z,r),before.__land(x,z,r),'land '+[x,z,r]);landChecks++;};
for(let i=0;i<20000;i++)land((random()-.5)*1600,(random()-.5)*1600,radii[i%radii.length]);
for(const p of before.city.eau)for(let i=0,j=p.length-2;i<p.length;j=i,i+=2){for(const [x,z] of [[p[i],p[i+1]],[(p[i]+p[j])/2,(p[i+1]+p[j+1])/2]])for(const e of [-1e-9,0,1e-9])for(const r of radii)land(x+e,z-e,r);}
for(const x of [-550.001,-550,-549.999,0,549.999,550,550.001])for(const z of [-550.001,-550,0,550,550.001])for(const r of radii)land(x,z,r);
// No stale polygon index: coordinates, ring membership and array length are live.
const originals=[before,after].map(w=>w.city.eau.map(p=>p.slice()));
for(const w of [before,after]){w.city.eau.push([58,178,66,178,66,188,58,188]);w.city.eau[0][0]+=.375;}
for(let i=0;i<2000;i++)land(50+random()*30,170+random()*30,radii[i%radii.length]);
for(const [i,w]of [before,after].entries())w.city.eau.splice(0,w.city.eau.length,...originals[i]);
const models=['gti','r5','tmax','scooter','bike','policebike'];
for(const w of [before,after]){w.fleet.length=0;for(let i=0;i<39;i++)w.fleet.push({id:i,model:models[i%models.length],x:35+i%13*7,z:110+Math.floor(i/13)*30,cap:i*.17,y:.08,v:2});}
const probe=q=>{assert.equal(after.blocked(...q),before.blocked(...q),'blocked '+q);collisionChecks++;};
for(let i=0;i<16000;i++){
 if(i%17===0){const j=i%39,pose={x:35+random()*100,z:100+random()*110,y:i%3? .08:NaN,cap:i%5?random()*Math.PI*2:-0,model:models[i%models.length]};for(const w of [before,after])Object.assign(w.fleet[j],pose);}
 probe([25+random()*130,90+random()*145,radii[i%radii.length],i%7===0?4:.08,i%9===0?.3:1.8]);
}
const spec=RADE.vehicles.SPECS.gti,old=[spec.length,spec.width,spec.height];
for(const dims of [[30,12,5],[.01,.02,.03],old]){[spec.length,spec.width,spec.height]=dims;for(let i=0;i<1000;i++)probe([40+random()*75,100+random()*100,.28,.08,1.8]);}
[spec.length,spec.width,spec.height]=old;
for(const w of [before,after])w.room={w:12,d:12,blocked:(x,z,r,y,h)=>x+r>1001||y+h>3};
for(const q of [[1000,1000,.24,.08,1.8],[1001,1000,.24,.08,1.8],[1000,1000,.24,3,2]])probe(q);
for(const w of [before,after])w.room=null;
// Contact order and returned obstacle snapshots stay exact under live motion.
const hitValue=h=>h?{nx:h.nx,nz:h.nz,depth:h.depth,obstacle:h.obstacle?{vehicle:h.obstacle.vehicle?.id,x:h.obstacle.x,z:h.obstacle.z,a:h.obstacle.a,b:h.obstacle.b,c:h.obstacle.c,s:h.obstacle.s,minY:h.obstacle.minY,maxY:h.obstacle.maxY,kind:h.obstacle.kind}:null}:null;
let vehicleContacts=0;
for(let i=0;i<4000;i++){
 const k=i%39,pose={x:45+random()*45,z:120+random()*60,cap:random()*Math.PI*2,y:i%11===0?5:.08};
 for(const w of [before,after])Object.assign(w.fleet[k],pose);
 assert.deepEqual(hitValue(after.carContact(after.fleet[k])),hitValue(before.carContact(before.fleet[k])));vehicleContacts++;
}
for(const w of [before,after]){
 Object.assign(w.fleet[0],{x:61.5,z:181,y:.08,cap:0,model:'gti'});Object.assign(w.fleet[1],{x:62,z:181,y:.08,cap:0,model:'r5'});
 const hit=w.carContact(w.fleet[0]);assert.equal(hit.obstacle.vehicle,w.fleet[1]);const held=hitValue(hit);w.fleet[1].x+=100;w.carBox(w.fleet[1]);w.blocked(62,181,.24);assert.deepEqual(hitValue(hit),held);
}
// Prove distant vehicles need no orientation evaluation without altering contacts.
let beforeReads=0,afterReads=0;
for(const [i,w]of [before,after].entries()){w.fleet.length=0;w.fleet.push({model:'gti',x:3000,z:3000,y:.08,get cap(){if(i)afterReads++;else beforeReads++;return .4;}});}
for(let i=0;i<100;i++)probe([61.5,211,.24,.08,1.8]);
assert(beforeReads>0);assert.equal(afterReads,0);
console.log(JSON.stringify({pass:true,baseline,landChecks,collisionChecks,vehicleContacts,livePolygonEdits:true,liveVehiclePosesAndDimensions:true,distantOrientationReads:{before:beforeReads,after:afterReads}}));
