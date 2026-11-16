// Spark's scenario checklist, exercised against the actual module/API.
import './load.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const checks=[];
const hash=id=>{let h=Math.imul(id^0x6d2b79f5,0x45d9f3b);h=Math.imul(h^(h>>>16),0x45d9f3b);return(h^(h>>>16))>>>0;};
const eligible=Array.from({length:200},(_,i)=>i+1).filter(id=>hash(id*7+3)%100<20);
const pedIds=Array.from({length:100},(_,i)=>10000+i).filter(id=>hash(id*11+5)%100<33);
const car=(id,x=0,z=0)=>({id,model:'gti',x,z,cap:0,v:0,u:0,w:0,ai:true,moteur:true,driver:{id:14000+id,x,z,hp:100,inside:true,fear:0,panic:0}});
const ped=(id,x,z)=>({id,x,z,hp:100,inside:false,fear:0,panic:0});
function fixture({fleet=[car(eligible[0]),car(1000,5)],people=[],saved}={}){
 const f={fleet,people,hits:[],moves:0,queries:0};
 const player={id:-1,x:0,z:-10,hp:100},world=f.world={fleet,room:null,player,ground:()=>.08,blocked:()=>false,ray:(o,d,far)=>{f.queries++;return far;}};
 const sim=f.sim={state:{player},hurt(){throw Error('Ambient fight damaged player');}};
 const injuries={ownerMove(e,t,speed,dt){const dx=t.x-e.x,dz=t.z-e.z,d=Math.hypot(dx,dz),step=Math.min(d,speed*dt);if(d){e.x+=dx/d*step;e.z+=dz/d*step;}e.moveSpeed=d?speed:0;f.moves++;},hurtAmbient(e,n){assert(e!==player&&!e.inside&&n>0&&n<=5);f.hits.push(e.id);e.hp=Math.max(25,e.hp-n);},hurtCivil(){throw Error('Ambient fight attributed crime');}};
 f.mod=RADE.altercations.create(world,sim,{people},injuries,{saved});
 f.step=(seconds,events=[])=>{for(let t=0;t<Math.round(seconds*120);t++)f.mod.update(1/120,events);};
 f.horn=(c=f.fleet[0],reason='vehicle',n=2)=>f.mod.noticeTraffic(Array.from({length:n},()=>({name:'carHorn',vehicleId:c.id,reason})));
 return f;
}
function check(name,fn){fn();checks.push(name);}
function triggered(f){f.horn();f.step(.1);assert.equal(f.mod.stats.activeScenes,1);return f;}
check('Two horns start a scene; one horn, player blockage, moving/empty/unsafe cars do not',()=>{
 let f=fixture();f.horn(undefined,'vehicle',1);f.step(2);assert.equal(f.mod.stats.created,0);f.horn(undefined,'vehicle',1);f.step(1.1);assert.equal(f.mod.stats.created,1);
 f=fixture();f.horn(undefined,'player');f.step(2);assert.equal(f.mod.stats.created,0);
 for(const change of [f=>f.fleet[1].v=2,f=>f.fleet[1].driver=null,f=>f.fleet[0].driver.fear=.8,f=>f.fleet[0].driver.grievance=90,f=>f.fleet[0].driver.injury={leg:true},f=>f.fleet[0].exploded=true,f=>f.fleet[0].condition={engine:.1},f=>{f.world.car=f.fleet[1];f.world.playerSeated=true;}]){f=fixture();change(f);f.horn();f.step(2);assert.equal(f.mod.stats.created,0);}

});
check('Driver choice depends on ID, not skin, sex or clothing; real movement, reciprocal punches and return',()=>{
 const run=(look)=>{const f=fixture();f.fleet.forEach(c=>Object.assign(c.driver,look));triggered(f);assert(f.fleet.every(c=>!c.driver.inside&&!c.ai));f.step(10);assert(f.moves>100);assert(f.fleet.every(c=>c.driver.hp<100));assert.equal(new Set(f.hits).size,2);f.step(30);assert.equal(f.mod.stats.activeScenes,0);assert(f.fleet.every(c=>c.driver.inside&&c.ai&&c.moteur&&c.driver.hp>=25&&!c.driver.altercation));return {stats:f.mod.stats,hp:f.fleet.map(c=>c.driver.hp)};};
 assert.deepEqual(run({skin:'dark',feminine:true,clothing:'dress'}),run({skin:'light',feminine:false,clothing:'jacket'}));
});
check('Only the obstruction ahead and in line of sight can trigger',()=>{
 for(const pos of [[-5,0],[5,4],[7,0]]){const f=fixture();Object.assign(f.fleet[1],{x:pos[0],z:pos[1]});Object.assign(f.fleet[1].driver,{x:pos[0],z:pos[1]});f.horn();f.step(2);assert.equal(f.mod.stats.created,0);}
 const f=fixture();f.world.ray=()=>0;f.horn();f.step(2);assert.equal(f.mod.stats.created,0);
});
check('No punch through walls or outside reach; witnesses react once at first punch',()=>{
 const w=ped(999,2,-4),f=triggered(fixture({people:[w]}));assert.equal(w.fear,0);f.step(10);assert(w.fear>0&&w.panic>0&&w.threat);const fear=w.fear,n=f.hits.length;f.world.ray=()=>0;f.step(2);assert.equal(f.hits.length,n);assert.equal(w.fear,fear);
});
check('Nearby gunfire disperses; distant shots do not; no reactivation of wreck/player vehicle/dead driver',()=>{
 const f=triggered(fixture());f.step(4);f.step(1,[{name:'shot',x:100,z:100}]);assert.equal(f.mod.stats.dispersed,0);f.step(5,[{name:'shot',x:1,z:0}]);assert(f.mod.stats.dispersed>0);assert.equal(f.mod.stats.activeScenes,0);
 for(const change of [f=>f.fleet[0].exploded=true,f=>{f.world.car=f.fleet[0];f.world.playerSeated=true;},f=>f.fleet[0].driver.hp=0]){const q=triggered(fixture());q.step(4);change(q);q.step(15);assert(!q.fleet[0].ai&&!q.fleet[0].driver.inside);assert(q.fleet.every(c=>!c.driver.altercation));}
});
check('Fear, leg wound, theft grievance and traffic danger have priority',()=>{
 for(const change of [e=>e.fear=.9,e=>e.injury={leg:true},e=>e.grievance=90,e=>e.altercation.danger=true]){const f=triggered(fixture());f.step(4);const e=f.fleet[0].driver;change(e);const n=f.hits.length;f.step(.1);assert(!e.altercation&&!e.inside);f.step(15);assert.equal(f.hits.length,n);assert.equal(f.mod.stats.activeScenes,0);}
});
check('Police intervenes only in line of sight; no endless return when a door becomes blocked',()=>{
 const f=triggered(fixture());f.step(4);const p=car(999,1,8);p.police=true;f.fleet.push(p);f.world.ray=(o,d,far,ignore)=>ignore===p?0:far;f.step(1.2);assert.equal(f.mod.stats.dispersed,0);f.world.ray=(o,d,far)=>far;f.step(1.2);assert(f.mod.stats.dispersed>0);
 const q=triggered(fixture());q.step(5);q.world.blocked=()=>true;q.step(40);assert.equal(q.mod.stats.activeScenes,0);assert(q.fleet.every(c=>!c.ai&&!c.driver.inside&&!c.driver.altercation));
});
check('Pedestrian disputes and road/pedestrian arguments occur without a quadratic crowd scan',()=>{
 const people=[ped(pedIds[0],0,0),ped(pedIds[1],2,0),...Array.from({length:478},(_,i)=>ped(20000+i,100+i,100))],f=fixture({fleet:[],people});f.step(36);assert(f.mod.stats.created>0&&f.mod.stats.strikes>0);const small=fixture({fleet:[],people:[ped(pedIds[0],0,0),ped(pedIds[1],2,0)]});small.step(36);assert.equal(f.queries,small.queries,'480 NPCs require the same LOS work as the two participants');
 const q=fixture({fleet:[car(eligible[0])],people:[ped(999,4,0)]});q.horn(q.fleet[0],'pedestrian');q.step(12);assert.equal(q.mod.stats.created,1);assert(q.hits.length>0);
});
check('At most two incidents; queues bounded; pause and interiors do not advance state',()=>{
 const fleet=[];for(let i=0;i<3;i++)fleet.push(car(eligible[i],0,i*12),car(1000+i,5,i*12));const f=fixture({fleet});for(let i=0;i<3;i++)f.horn(fleet[i*2]);f.step(.1);assert.equal(f.mod.stats.activeScenes,2);
 for(let i=0;i<200;i++)f.mod.noticeTraffic([{name:'carHorn',vehicleId:i+500,reason:'vehicle'}]);assert.equal(f.mod.save().horns.length,32);assert(f.mod.save().cooldowns.length<=64);
 const saved=JSON.stringify(f.mod.save());for(const dt of [0,-1,NaN,Infinity])f.mod.update(dt,[]);assert.equal(JSON.stringify(f.mod.save()),saved);f.world.room={};f.step(2);f.horn();assert.equal(JSON.stringify(f.mod.save()),saved);
});
check('Save/resume preserves participants, timer, random damage and physical return',()=>{
 const f=triggered(fixture());f.step(7);const saved=JSON.parse(JSON.stringify(f.mod.save()));
 const fleet=f.fleet.map(c=>({...c,driver:{...c.driver,altercation:null}})),q=fixture({fleet,saved});assert.equal(q.mod.stats.activeScenes,1);assert(q.fleet.every(c=>!c.driver.inside&&!c.ai));
 f.step(33);q.step(33);assert.deepEqual(q.mod.stats,f.mod.stats);assert.deepEqual(q.fleet.map(c=>[c.driver.hp,c.driver.inside,c.ai,c.driver.x,c.driver.z]),f.fleet.map(c=>[c.driver.hp,c.driver.inside,c.ai,c.driver.x,c.driver.z]));
});
const report={pass:true,checks,scope:'Actual state machine with deterministic collision/movement fixture; no graphical or physical iPhone claim'};
fs.writeFileSync(new URL('../docs/altercations-validation.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
