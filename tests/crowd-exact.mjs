import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

// A frozen production oracle; no replacing its individual routines with the
// optimized implementation. Small synthetic navigation isolates steering and
// callback semantics without constructing or rendering the Marseille city.
const oracleRevision='d22a5eb';
const baseline=execFileSync('git',['show',oracleRevision+':src/crowd.js'],{encoding:'utf8',cwd:new URL('..',import.meta.url)});
const candidate=fs.readFileSync(new URL('../src/crowd.js',import.meta.url),'utf8');
const peopleSource=fs.readFileSync(new URL('../src/people.js',import.meta.url),'utf8');
const width=128,offset=64;
function context(source){
 const dirs=Array.from({length:12},(_,goal)=>Uint8Array.from({length:width*width},(_,i)=>i%101===0?255:i%167===0?254:(i+goal)%4));
 const PDR={nav:{AUCUN:255,BUT:254,DX:[1024,0,0,0,-1024,0,724,0],DZ:[0,0,1024,0,0,0,-724,0],creer:()=>({n:width*width,libre:Uint8Array.from({length:width*width},(_,i)=>i%257?1:0),champs:dirs.map(dir=>({dir})),demander:()=>0,prendre(){},avancer(){},centreX:i=>(i%width-offset)*1000,centreZ:i=>(Math.floor(i/width)-offset)*1000,caseDe:(x,z)=>{const ix=Math.round(x/1000)+offset,iz=Math.round(z/1000)+offset;return ix<0||ix>=width||iz<0||iz>=width?-1:iz*width+ix;},caseProche:()=>offset*width+offset})},villeReelle:{hasard:seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}},regles:{coder:(a,b,c,d,e)=>a+b*16+c*256+d*4096+e*262144}};
 const realm=vm.createContext({RADE:{},PDR});vm.runInContext(peopleSource,realm);vm.runInContext(source,realm);return realm.RADE.crowd;
}
const factories=[context(baseline),context(candidate)];
function fixture(factory,n){
 const contacts=[],effects=[],world={fleet:[],player:{x:0,z:0,hp:100000},room:null,playerSeated:false};
 let ignoreVehicle=false,crowd,armed=null,inside=false,invocations=0;
 const invoke=kind=>{if(armed?.kind===kind&&!inside&&crowd){const task=armed;armed=null;inside=true;invocations++;try{if(task.throw)throw Error('deliberate callback failure');crowd.update(task.dt,task.events);}finally{inside=false;}}};
 world.blocked=(x,z,r)=>{contacts.push(['blocked',x,z,r,ignoreVehicle]);invoke('blocked');
  if(Math.abs(x)>56||Math.abs(z)>56)return true;
  if(x+r>8&&x-r<8.4&&Math.abs(z)>2&&Math.abs(z)<22)return true;
  if(z+r>13&&z-r<13.3&&x>-25&&x<-5)return true;
  if(!ignoreVehicle)for(const c of world.fleet)if(Math.abs(x-c.x)<1.7+r&&Math.abs(z-c.z)<.8+r)return true;
  return false;
 };
 world.withoutCar=callback=>{contacts.push(['withoutCar','enter',ignoreVehicle]);const old=ignoreVehicle;ignoreVehicle=true;try{return callback();}finally{ignoreVehicle=old;contacts.push(['withoutCar','exit',ignoreVehicle]);}};
 world.ray=(origin,dir,range)=>{contacts.push(['ray',...origin,...dir,range]);return origin[0]>10?range*.5:range;};
 crowd=factory.create(world,n,{allowAggression:true,hurt:(damage,p)=>{effects.push(['hurt',damage,crowd.people.indexOf(p)]);world.player.hp-=damage;invoke('hurt');},notify:text=>{effects.push(['notify',text]);invoke('notify');}});
 for(let i=0;i<n;i++){const p=crowd.people[i];Object.assign(p,{x:-23+(i%48)*.92,z:-14+Math.floor(i/48)*1.12,goal:i%12,provocationCooldown:i%3?0:8,blocked:i%7?.0:.5});if(i%47===0)p.hp=0;if(i%31===0)p.injury={leg:true};if(i%29===0)p.injury={arm:true};}
 for(let i=0;i<39;i++)world.fleet.push({id:i,x:-35+i%13*5.5,z:-22+Math.floor(i/13)*20,cap:i*.31,u:i%3?-5:5,v:i%9===0?.3:3+(i%4),hidden:i%17===0});
 contacts.length=effects.length=0;
 return {world,crowd,contacts,effects,get invocations(){return invocations;},arm:task=>armed=task,clear(){contacts.length=effects.length=0;}};
}
let comparedTicks=0,comparedContacts=0;
function check(a,b,label){
 assert.deepEqual(b.contacts,a.contacts,label+' exact collision/ray/withoutCar order');comparedContacts+=a.contacts.length;
 assert.deepEqual(b.effects,a.effects,label+' callbacks');assert.equal(b.world.player.hp,a.world.player.hp,label+' player damage');
 assert.deepEqual(structuredClone([...b.crowd.people]),structuredClone([...a.crowd.people]),label+' every behavioural/gait field');
 for(const name of ['packed','locomotion'])assert.equal(Buffer.compare(Buffer.from(b.crowd[name].buffer),Buffer.from(a.crowd[name].buffer)),0,label+' '+name+' exact float bytes');
 assert.equal(b.crowd.version,a.crowd.version,label+' tick');assert.equal(b.crowd.avoids,a.crowd.avoids,label+' avoids');comparedTicks++;
 a.clear();b.clear();
}
const pair=factories.map(factory=>fixture(factory,960));check(...pair,'initial');
for(let t=0;t<120;t++){
 const dt=[7/120,7/120,0,.2,.05,-.1,NaN,Infinity][t%8];
 const events=t%7===0?[{name:'shot',x:-8,z:0},{name:'vehicleExplosion',x:10,z:8},{name:'not-noise',x:0,z:0},{name:'enemyShot',x:NaN,z:0},{name:'explosion',x:0,z:Infinity}]:[];
 for(const f of pair){
  for(let i=0;i<f.world.fleet.length;i++){const c=f.world.fleet[i];c.x+=Math.cos(t*.1+i)*.05;c.z+=Math.sin(t*.1+i)*.05;c.cap+=(i%3-1)*.007;c.v=t%11===0?0:2+i%5;c.u=t%9<5?c.v:-c.v;c.hidden=(t+i)%19===0;}
  f.world.playerSeated=t>=30&&t<38;f.world.room=t>=40&&t<45?{}:null;
  const p=f.crowd.people[(t*37)%960];if(t%13===0)p.hp=0;if(t%17===0){p.hp=100;p.injury=null;}if(t%19===0)p.injury={leg:true,arm:t%2===0};
  // Move between cells and far outside the nav grid; cached rows must not
  // retain any old membership as populations die, recover and teleport.
  if(t%23===0){p.x=t%46?-.0001:1000;p.z=t%46?-.0001:1000;}
  f.crowd.update(dt,structuredClone(events));
 }
 check(...pair,'dense tick '+t);
}

// Reentrant callbacks used to have independent local arrays. Reused buffers
// must keep that contract, including exceptions and subsequent normal calls.
for(const kind of ['blocked','notify','hurt']){
 const q=factories.map(factory=>fixture(factory,32));
 for(const f of q){for(const p of f.crowd.people)Object.assign(p,{hp:100,injury:null,x:20,z:20,aggression:0,temperament:'civil'});Object.assign(f.crowd.people[0],{x:.7,z:0,temperament:'provocateur',provocationCooldown:0,encounter:.79,aggression:kind==='hurt'?12:0,attackWait:0});f.world.fleet.length=0;f.arm({kind,dt:.2,events:[{name:'explosion',x:1,z:1}]});}
 for(let t=0;t<7;t++){for(const f of q)f.crowd.update(7/120,[{name:'shot',x:-3,z:2}]);check(...q,'reentrant '+kind+' '+t);}
 assert(q.every(f=>f.invocations===1),'Nested '+kind+' callback actually ran in both versions');
}
const failed=factories.map(factory=>fixture(factory,48));
for(const f of failed){f.arm({kind:'blocked',throw:true});assert.throws(()=>f.crowd.update(7/120),/deliberate callback failure/);}
assert(failed.every(f=>f.invocations===1));
check(...failed,'throw state');
for(let t=0;t<8;t++){for(const f of failed)f.crowd.update(7/120,[{name:'explosion',x:1,z:1}]);check(...failed,'after throw '+t);}
assert.deepEqual(Array.from({length:2000},(_,i)=>factories[1].temperament(i-1000)),Array.from({length:2000},(_,i)=>factories[0].temperament(i-1000)));
console.log(JSON.stringify({pass:true,oracleRevision,oracleSha256:createHash('sha256').update(baseline).digest('hex'),comparedTicks,comparedContacts,population:960,vehicles:39,scope:'Exact per-tick people, packed and locomotion bytes, collision call order, effects, nested callbacks and exception recovery. No timing/FPS claim.'},null,2));
