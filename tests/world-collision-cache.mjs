import './load.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {performance} from 'node:perf_hooks';

// Keep the exact previous routines as the differential oracle. Everything else
// (actual Marseille geometry, water, streamed city, debris contacts) is shared.
const oldStatic=` function staticBlocked(x,z,r=.28,y=ground(x,z),height=1.8){
  if(roomRegion(x,z))return room.blocked(x,z,r,y,height);
  if(!land(x,z,r))return true;if(!inCore(x-r,z-r)||!inCore(x+r,z+r))if(cityStream?.blocked?.(x,z,r,y,height))return true;
  for(const q of candidates(x,z,r))if(q.maxY>y+.22&&q.minY<y+height&&disk(q,x,z,r))return true;
  if(!ignoreVehicle)for(const c of fleet){const q=carBox(c);if(q.maxY>y+.22&&q.minY<y+height&&disk(q,x,z,r))return true;}return false;
 }
`;
const oldCar=` const carBox=c=>{const base=Number.isFinite(c.y)?c.y:ground(c.x,c.z);return {vehicle:c,x:c.x,z:c.z,a:R.vehicles.SPECS[c.model].length/2,b:R.vehicles.SPECS[c.model].width/2,c:Math.cos(c.cap),s:Math.sin(c.cap),cap:c.cap,minY:base+.1,maxY:base+R.vehicles.SPECS[c.model].height};};`;
const source=fs.readFileSync(new URL('../src/world.js',import.meta.url),'utf8');
const start=source.indexOf(' function staticBlocked('),end=source.indexOf(' const clearance=',start),carStart=source.indexOf(' const carBounds='),carEnd=source.indexOf('\n function overlap(',carStart);
assert(start>=0&&end>start&&carStart>=end&&carEnd>carStart);
const baselineSource=source.slice(0,start)+oldStatic+source.slice(end,carStart)+oldCar+source.slice(carEnd);
const currentFactory=RADE.world;
vm.runInThisContext(baselineSource,{filename:'world-collision-cache.baseline.js'});const baselineFactory=RADE.world;RADE.world=currentFactory;
const before=baselineFactory.create(),after=currentFactory.create();
assert.equal(before.boxes.length,after.boxes.length);assert.equal(before.scenery.length,after.scenery.length);
const worlds=[before,after],types=['gti','r5','tmax','scooter','bike'];
function debris(p,s,r){const axes=BITUME.voiture.euler(...r),half=s.map(v=>v/2),extent=[0,1,2].map(i=>axes.reduce((sum,a,k)=>sum+Math.abs(a[i])*half[k],0));return {x:p[0],z:p[2],a:extent[0],b:extent[2],minY:p[1]-extent[1],maxY:p[1]+extent[1],mesh:{p,s,r},body:{}};}
for(const w of worlds){
 w.fleet.length=0;
 for(let i=0;i<39;i++)w.fleet.push({id:i,model:types[i%types.length],x:38+i%13*7.5,z:120+Math.floor(i/13)*25,y:.08,cap:(i%7)*.39,v:4,u:4});
 w.dynamicBodies=Array.from({length:180},(_,i)=>debris([42+i%15*4.3,.6+(i%4)*.37,135+Math.floor(i/15)*5.7],[.3+(i%5)*.14,.24,.5+(i%3)*.2],[(i%5)*.17,(i%7)*.31,(i%3)*.12]));
}
const checks=[],normal=q=>Object.fromEntries(Object.entries(q).map(([key,value])=>[key,key==='vehicle'?value.id:value]));
const compareBox=(a,b)=>assert.deepEqual(normal(a),normal(b));
for(let i=0;i<2000;i++){
 const index=i%39,values={x:38+index%13*7.5+(i%11)*.003,z:120+Math.floor(index/13)*25+(i%13)*.002,cap:i%9===0?-0:(i%23)*.217,y:i%5===0?NaN:.08+(i%4)*1.7,model:types[(i+index)%5]};
 for(const w of worlds)Object.assign(w.fleet[index],values);
 compareBox(before.carBox(before.fleet[index]),after.carBox(after.fleet[index]));
}
checks.push('2000 vehicle pose/model/altitude mutations: exact bounds, trig and signed-zero parity');
for(const w of worlds){
 const c=w.fleet[0],a=w.carBox(c),b=w.carBox(c),saved=normal(b);
 assert.notEqual(a,b);a.x=999999;a.a=999;a.c=NaN;compareBox(w.carBox(c),b);
 const extra=w.carBox(c,true);assert.notEqual(extra,w.carBox(c,true));extra.z=999999;compareBox(w.carBox(c),b);
 c.x+=3;c.cap+=.2;c.y=12;w.carBox(c);assert.deepEqual(normal(b),saved);
 c.cap=0;assert(Object.is(w.carBox(c).s,0));c.cap=-0;assert(Object.is(w.carBox(c).s,-0));
}
checks.push('Public carBox results remain fresh mutable snapshots; neither caller mutation nor later vehicle movement leaks through aliases');
const spec=RADE.vehicles.SPECS.gti,savedLength=spec.length;spec.length+=.125;
for(const w of worlds)w.fleet[1].model='gti';compareBox(before.carBox(before.fleet[1]),after.carBox(after.fleet[1]));spec.length=savedLength;
compareBox(before.carBox(before.fleet[1]),after.carBox(after.fleet[1]));checks.push('Vehicle dimensions are read live, including spec changes and restoration');

let seed=846173;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const queries=[];
// 960 pedestrian positions with the same current/X/Z probes used by crowd.js.
for(let i=0;i<960;i++){const x=35+random()*108,z=110+random()*125;for(const [dx,dz] of [[0,0],[.067,0],[.067,-.031]])queries.push([x+dx,z+dz,.24,.08,1.8]);}
for(let i=0;i<5000;i++)queries.push([(random()-.5)*1110,(random()-.5)*1110,[.24,.28,.5,1.2,3.6][i%5],i%7===0?6:.08,i%4===0?.35:1.8]);
// Bucket/core edges, zero-radius contacts, high clearance and streamed regions.
for(const x of [-550.1,-550,-549.9,-16,-8,-.001,0,.001,7.999,8,16,549.9,550,550.1,800,1000])for(const r of [0,.24,.5,3.6,8.1])for(const z of [-550,0,8,130,550,1000])queries.push([x,z,r,.08,1.8]);
let checked=0;
for(const query of queries){assert.equal(after.blocked(...query),before.blocked(...query),'Collision '+JSON.stringify(query));checked++;if(checked%7===0){assert.equal(after.withoutCar(()=>after.blocked(...query)),before.withoutCar(()=>before.blocked(...query)));checked++;}}
checks.push(checked+' exact collision results across 960 pedestrian probes, 39 vehicles, 180 rotated debris pieces, bucket boundaries, core edges and streamed terrain');
for(const w of worlds){w.room={w:10,d:12,blocked:(x,z,r,y,h)=>x+r>1001||y+h>4};}
for(const q of [[1000,1000,.24,.08,1.8],[1001,1000,.24,.08,1.8],[1000,1000,.24,3,2]])assert.equal(before.blocked(...q),after.blocked(...q));
for(const w of worlds)w.room=null;checks.push('Interior collision delegation unchanged');
for(const w of worlds){
 w.dynamicBodies=[];Object.assign(w.fleet[0],{x:61.5,z:181,y:.08,cap:0,model:'gti'});Object.assign(w.fleet[1],{x:62,z:181,y:.08,cap:0,model:'r5'});
 const result=w.carContact(w.fleet[0]);assert(result?.obstacle?.vehicle===w.fleet[1]);const saved=normal(result.obstacle);
 w.fleet[1].x+=50;w.blocked(65,181,.24);w.carBox(w.fleet[1]);assert.deepEqual(normal(result.obstacle),saved);
}
checks.push('Returned vehicle-contact obstacle remains the original snapshot after cached probes and movement');
for(const w of worlds){const q=w.addBox({x:60.5,z:183.5,a:.4,b:.4,cap:.3,minY:.08,maxY:2.4});assert(w.blocked(q.x,q.z,.24));}
assert.equal(before.blocked(60.5,183.5,.24),after.blocked(60.5,183.5,.24));checks.push('Single-bucket path sees freshly added colliders immediately');

const percentile=(a,q)=>a.slice().sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(a.length*q))];
function bench(w,probes,loops){let hits=0;const start=performance.now();for(let k=0;k<loops;k++)for(const q of probes)hits+=w.blocked(...q)?1:0;return {ms:performance.now()-start,hits};}
// Build once, then compare identical calls with alternating execution order.
// This is a CPU collision microbenchmark, not a claim about game FPS or GPU time.
const probes=queries.slice(0,960*3),benchmarks=[];
for(const count of [0,180]){
 for(const w of worlds)w.dynamicBodies=Array.from({length:count},(_,i)=>debris([42+i%15*4.3,.6+(i%4)*.37,135+Math.floor(i/15)*5.7],[.3+(i%5)*.14,.24,.5+(i%3)*.2],[(i%5)*.17,(i%7)*.31,(i%3)*.12]));
 bench(before,probes,2);bench(after,probes,2);const old=[],next=[];
 for(let trial=0;trial<8;trial++){let a,b;if(trial%2){b=bench(after,probes,3);a=bench(before,probes,3);}else{a=bench(before,probes,3);b=bench(after,probes,3);}assert.equal(a.hits,b.hits);old.push(a.ms);next.push(b.ms);}
 benchmarks.push({population:960,vehicles:39,debris:count,queriesPerTrial:probes.length*3,beforeMs:old,afterMs:next,beforeMedianMs:percentile(old,.5),afterMedianMs:percentile(next,.5),ratio:percentile(next,.5)/percentile(old,.5)});
}
const report={checks,benchmarks,scope:'Real Marseille collision functions and geometry; deterministic differential probes and CPU microbenchmark only. Population, AI frequencies, geometry/LOD, animation and effects unchanged.'};
fs.writeFileSync(new URL('../docs/world-collision-cache.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
