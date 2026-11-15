import './load.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';

// All public state, including navigation buffers/caches, is checked outside
// the measured preparation. Functions are stable and cannot be serialized.
const hash=value=>createHash('sha256').update(JSON.stringify(value,(_,v)=>ArrayBuffer.isView(v)?{type:v.constructor.name,bytes:Buffer.from(v.buffer,v.byteOffset,v.byteLength).toString('base64')}:v instanceof Map?[...v]:v instanceof Set?[...v]:v)).digest('hex');
const world=RADE.world.create(),report=[],mustNotCall=()=>{throw Error('prewarm emitted a gameplay callback');};
assert.equal(world.collisionQueriesPure,true);
for(const population of [480,960]){
 const warm=RADE.crowd.create(world,population,{hurt:mustNotCall,notify:mustNotCall}),cold=RADE.crowd.create(world,population,{hurt:mustNotCall,notify:mustNotCall});
 assert.equal(hash(warm),hash(cold));const before=hash(warm),worldBefore=hash({fleet:world.fleet,player:world.player});
 const start=performance.now(),prepared=warm.prewarmRouting(),milliseconds=performance.now()-start;
 assert.equal(prepared,population);assert.equal(hash(warm),before,'Every public crowd/nav value remains exact');assert.equal(hash({fleet:world.fleet,player:world.player}),worldBefore,'World actor and vehicle state unchanged');
 assert.equal(warm.prewarmRouting(),population);assert.equal(hash(warm),before,'Repeated explicit calls stay read-only');
 for(let i=0;i<24;i++){warm.people[i].hp=0;cold.people[i].hp=0;}
 const injured=hash(warm);assert.equal(warm.prewarmRouting(),population-24);assert.equal(hash(warm),injured,'Dead actors are skipped without touching their data');
 for(let tick=0;tick<21;tick++){
  const events=tick%7===0?[{name:'vehicleExplosion',x:61.5,z:181},{name:'shot',x:45,z:145}]:[];
  cold.update(7/120,events);warm.update(7/120,events);assert.equal(hash(warm),hash(cold),'Future trajectory/nav/packed/locomotion exact at tick '+tick);
 }
 report.push({population,prepared,milliseconds,comparedFutureTicks:21});
}
// Unmarked or explicitly impure worlds retain arbitrary custom callback
// semantics. Preparation must not invoke even one of those queries.
for(const flag of [false,undefined]){
 world.collisionQueriesPure=flag;const c=RADE.crowd.create(world,20),before=hash(c),blocked=world.blocked;
 world.blocked=()=>{throw Error('custom collision queried by prewarm');};
 try{assert.equal(c.prewarmRouting(),0);assert.equal(hash(c),before);}finally{world.blocked=blocked;}
}
console.log(JSON.stringify({pass:true,report,customQueriesSkipped:true,scope:'Explicit loading-only pass, actual route closure and real Marseille collisions; exact public crowd/nav buffers before/after and 21 subsequent updates. Node preparation cost is not a browser performance claim.'},null,2));
