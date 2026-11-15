import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

const baseline='d22a5eb',old=execFileSync('git',['show',baseline+':src/crowd.js'],{encoding:'utf8'}),current=fs.readFileSync(new URL('../src/crowd.js',import.meta.url),'utf8');
const angles=[0,.58,-.58,1.16,-1.16,1.8,-1.8,Math.PI],turns=[-1,1].map(sign=>angles.map(a=>[Math.cos(a*sign),Math.sin(a*sign)]));
function route(source,world,nav,pureQueries){
 const start=source.indexOf(' function route('),end=source.indexOf('\n function update(',start);assert(start>=0&&end>start);
 const scope=vm.createContext({world,nav,pureQueries,angles,turns});return vm.runInContext('(()=>{'+source.slice(start,end)+';return route;})()',scope);
}
let checked=0,oldCalls=0,newCalls=0;
function compare(label,p,vx,vz,i,{mask=0,navMask=0,pure=true}={}){
 const pair=[old,current].map(source=>{
  const contacts=[],cells=[],directions=angles.map(a=>{const d=Math.hypot(vx,vz),c=Math.cos(a*(i%2?1:-1)),s=Math.sin(a*(i%2?1:-1));return [vx/d*c-vz/d*s,vx/d*s+vz/d*c];});
  const directionAt=(x,z)=>{let at=-1,best=Infinity;for(let k=0;k<directions.length;k++){const d=Math.hypot((x-p.x)-directions[k][0]*1.35,(z-p.z)-directions[k][1]*1.35);if(d<best){best=d;at=k;}}return at;};
  const nav={n:8,libre:Uint8Array.from({length:8},(_,k)=>(navMask>>k)&1?0:1),caseDe(x,z){cells.push([x,z]);return directionAt(x/1000,z/1000);}};
  const world={blocked(x,z,r){contacts.push([x,z,r]);const d=Math.hypot(x-p.x,z-p.z),factor=d<1?1.35/.6:1,k=directionAt(p.x+(x-p.x)*factor,p.z+(z-p.z)*factor);return !!((mask>>k)&1);}};
  return {value:Array.from(route(source,world,nav,pure)({...p},vx,vz,i)),contacts,cells};
 });
 assert.deepEqual(pair[1].value,pair[0].value,label+' exact winner, including signed zero');
 for(const key of ['contacts','cells']){let at=0;for(const q of pair[1][key]){while(at<pair[0][key].length&&!q.every((v,k)=>Object.is(v,pair[0][key][at][k])))at++;assert(at<pair[0][key].length,label+' original '+key+' order');at++;}if(!pure)assert.deepEqual(pair[1][key],pair[0][key],label+' strict generic queries');}
 oldCalls+=pair[0].contacts.length;newCalls+=pair[1].contacts.length;checked++;return pair;
}
const p={x:0,z:0,escapeX:0,escapeZ:0};
const open=compare('open forward',p,1,0,0);assert.equal(open[0].contacts.length,16);assert.equal(open[1].contacts.length,2);
for(const parity of [0,1])for(let mask=0;mask<256;mask++)compare('blocked directions '+parity+':'+mask,p,1,0,parity,{mask});
for(const parity of [0,1])for(let mask=0;mask<256;mask++)compare('blocked nav cells '+parity+':'+mask,{...p,escapeX:-.7,escapeZ:.4},.3,-.8,parity,{navMask:mask,mask:85});
compare('symmetric ties keep first candidate',p,1,0,0,{mask:1});
compare('escape memory can make a later candidate win',{...p,escapeX:-100,escapeZ:30},.3,.7,1);
for(const [x,z]of [[0,0],[-0,0],[.000999999,0],[.001,0],[NaN,1],[Infinity,1],[1,-Infinity]])compare('nonfinite or normalization boundary '+x+','+z,p,x,z,0);
for(const x of [NaN,Infinity,-Infinity])compare('nonfinite memory '+x,{...p,escapeX:x},1,0,1);
for(let mask=0;mask<256;mask+=17)compare('generic callback order '+mask,p,.3,.7,1,{mask,pure:false});
let seed=135;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
for(let i=0;i<256;i++)compare('seeded geometry '+i,{x:random()*120-60,z:random()*120-60,escapeX:random()*8-4,escapeZ:random()*8-4},random()*4-2,random()*4-2,i%2,{mask:Math.floor(random()*256),navMask:Math.floor(random()*256)});
console.log(JSON.stringify({pass:true,baseline,routeCases:checked,probes:{before:oldCalls,after:newCalls},scope:'Exact direction and original relative query order, all blocked-direction masks, nav rejection, ties, escape memory, nonfinite inputs, generic strict fallback. No timing/FPS claim.'}));

if(process.argv.includes('--city')){
 // A single real Marseille world supplies identical geometry, traffic poses,
 // and evolving explosion rubble to both independent crowd implementations.
 await import('./load.mjs');
 const s=RADE.session.create({pedestrians:0,now:1794700000000}),w=s.world;
 assert.equal(w.collisionQueriesPure,true);s.urban.prepare();s.sim.relocate(61.5,211,0);
 const oracle=vm.createContext({RADE:{...RADE},PDR});vm.runInContext(old,oracle);
 const population=960,counts=[0,0],effects=[[],[]],originalBlocked=w.blocked;let side=0;
 w.blocked=(...args)=>{if(side>=0&&side<2)counts[side]++;return originalBlocked(...args);};
 const makers=[oracle.RADE.crowd,RADE.crowd],crowds=makers.map((maker,k)=>{side=k;return maker.create(w,population,{allowAggression:true,hurt:(damage,p)=>effects[k].push(['hurt',damage,crowds[k].people.indexOf(p)]),notify:t=>effects[k].push(['notify',t])});});
 const cars=w.fleet.filter(c=>c!==s.car&&!c.police&&!RADE.vehicles.SPECS[c.model].two).slice(0,3);
 cars.forEach((c,i)=>Object.assign(c,{x:61.5+(i%2)*4,z:181-i*18,cap:0,y:w.ground(61.5,181-i*18),ai:false,u:0,w:0,v:0,moteur:false}));
 const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength),compareCity=label=>{
  assert.deepEqual(structuredClone(crowds[1].people),structuredClone(crowds[0].people),label+' exact complete behaviour');
  for(const name of ['packed','locomotion'])assert.deepEqual(bytes(crowds[1][name]),bytes(crowds[0][name]),label+' exact GPU inputs');
  assert.deepEqual(effects[1],effects[0],label+' callbacks');assert.equal(crowds[1].version,crowds[0].version);assert.equal(crowds[1].avoids,crowds[0].avoids);
 };
 compareCity('initial real navigation');counts.fill(0);w.pedestrians=crowds[0].people;let ticks=0,clock=0,events=[];
 for(let step=0;step<420;step++){
  if(step===179){for(const c of cars){assert(s.urban.detonateVehicle(c));events.push({name:'vehicleExplosion',x:c.x,z:c.z});}}
  side=-1;s.update(1/120,{});events.push(...s.events);clock+=1/120;
  if(clock>=.05){for(side=0;side<2;side++)crowds[side].update(clock,events);clock=0;events=[];ticks++;compareCity('real city tick '+ticks);}
 }
 assert(s.urban.bodies.length>0);assert(counts[1]<counts[0]);w.blocked=originalBlocked;
 console.log(JSON.stringify({pass:true,baseline,population,traffic:w.fleet.length,exploded:cars.length,bodies:s.urban.bodies.length,ticks,physicsSteps:420,probes:{before:counts[0],after:counts[1]},scope:'Real Marseille navigation/collisions, live traffic and physics rubble after three vehicle explosions; exact whole crowd and GPU inputs each crowd tick.'}));
}
