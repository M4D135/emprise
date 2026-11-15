import './load.mjs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

// Actual session, navigation, traffic, capsule probes and physical debris.
// Only the clearance implementation changes between the two complete runs.
const baseline='22a330f',candidate=RADE.clearance,context=vm.createContext({RADE:{},BITUME});
vm.runInContext(execFileSync('git',['show',baseline+':src/clearance.js'],{encoding:'utf8'}),context);
const hash=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
function run(clearance){
 RADE.clearance=clearance;const s=RADE.session.create({pedestrians:960,now:1794700000000}),w=s.world;
 s.urban.prepare();s.weather.force('soleil');s.weather.setHour(14);s.weather.tick(0);s.sim.relocate(61.5,211,0);
 const nav=s.crowd.nav,cells=[];for(let i=0;i<nav.n;i++)if(nav.libre[i]){const x=nav.centreX(i)/1000,z=nav.centreZ(i)/1000;if(x>40&&x<85&&z>105&&z<195&&!w.blocked(x,z,.24))cells.push([x,z]);}
 assert(cells.length>80);for(let i=0;i<360;i++){const q=cells[i*17%cells.length];s.crowd.people[i].x=q[0];s.crowd.people[i].z=q[1];}s.crowd.update(0);
 const cars=w.fleet.filter(c=>c!==s.car&&!c.police&&!RADE.vehicles.SPECS[c.model].two).slice(0,3);
 cars.forEach((c,i)=>Object.assign(c,{x:61.5+(i%2)*4,z:181-i*18,cap:0,y:w.ground(61.5,181-i*18),ai:false,u:0,w:0,v:0,moteur:false}));
 const records=[],record=step=>records.push({step,people:hash(s.crowd.people),packed:hash(Buffer.from(s.crowd.packed.buffer)),locomotion:hash(Buffer.from(s.crowd.locomotion.buffer)),avoids:s.crowd.avoids,tick:s.crowd.version,player:hash(s.player),traffic:hash(w.fleet),physics:hash(s.urban.bodies.map(q=>q.engine.body(q.handle))),events:hash(s.events),urban:hash(s.urban.report)});
 record(0);let prior=s.crowd.version;
 for(let step=0;step<420;step++){
  if(step===180)for(const c of cars)assert(s.urban.detonateVehicle(c));
  s.player.hp=100;s.update(1/120,{});if(s.crowd.version!==prior){record(step+1);prior=s.crowd.version;}
 }
 assert.equal(s.urban.report.vehicleExplosions,3);assert(s.urban.bodies.length>0);
 return {records,save:hash(s.save()),population:s.crowd.n,vehicles:w.fleet.length,bodies:s.urban.bodies.length};
}
// The persisted wall-clock timestamp is intentionally fixed for both runs.
const realNow=Date.now;Date.now=()=>1794700000000;
let a,b;try{a=run(context.RADE.clearance);b=run(candidate);}finally{RADE.clearance=candidate;Date.now=realNow;}
for(let i=0;i<a.records.length;i++)assert.deepEqual(b.records[i],a.records[i],'Exact real session state at physics step '+a.records[i].step);
for(const key of ['save','population','vehicles','bodies'])assert.equal(b[key],a[key],'Exact final '+key);
console.log(JSON.stringify({pass:true,baseline,population:b.population,vehicles:b.vehicles,explosions:3,bodies:b.bodies,physicsTicks:420,comparedCrowdStates:b.records.length,finalState:b.records.at(-1),save:b.save,scope:'Two complete deterministic production sessions; only clearance changes. No frame-time claim.'},null,2));
