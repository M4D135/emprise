import './load.mjs';import assert from 'node:assert/strict';import fs from 'node:fs';
const checks=[],s=RADE.session.create({pedestrians:480}),hash=id=>{let h=Math.imul(id^0x6d2b79f5,0x45d9f3b);h=Math.imul(h^(h>>>16),0x45d9f3b);return(h^(h>>>16))>>>0;};
const cars=s.traffic.cars.filter(c=>!c.police&&c.driver&&!RADE.vehicles.SPECS[c.model].two),a=cars.find(c=>hash(c.id*7+3)%100<20),b=cars.find(c=>c!==a);
s.world.fleet.forEach(c=>{c.x=450;c.z=-450;c.ai=false;});s.crowd.people.forEach(p=>{p.x=400;p.z=-400;});
for(const [i,c] of [a,b].entries()){Object.assign(c,{x:61.5+i*5,z:181,cap:0,v:0,u:0,w:0,ai:true,moteur:true});Object.assign(c.driver,{x:c.x,z:c.z,inside:true,hp:100,fear:0,panic:0,grievance:0});}
s.sim.relocate(61.5,173,0);s.altercations.noticeTraffic([1,2].map(()=>({name:'carHorn',vehicleId:a.id,reason:'vehicle'})));
const drive=(q,seconds)=>{for(let i=0;i<seconds*120;i++){q.altercations.update(1/120,[]);q.injuries.update(1/120,[]);if(i%6===0)q.crowd.update(.05,[]);}};
drive(s,7);assert.equal(s.altercations.stats.activeScenes,1);assert(s.altercations.stats.strikes>0);assert(a.driver.hp<100&&b.driver.hp<100);assert.equal(s.campaign.law.heat,0);assert.equal(s.player.hp,100);checks.push('Real city collision/owner movement, both drivers punch, no player damage or police heat');
const snapshot=s.save(),r=RADE.session.create({pedestrians:480,saved:snapshot,now:snapshot.savedAt});assert.equal(r.altercations.stats.activeScenes,1);
for(const old of [a,b]){const c=r.world.fleet.find(c=>c.id===old.id);assert(!c.driver.inside&&!c.ai);assert.equal(c.driver.x,old.driver.x);assert.equal(c.driver.z,old.driver.z);assert.equal(c.driver.hp,old.driver.hp);}
drive(r,30);for(const old of [a,b]){const c=r.world.fleet.find(c=>c.id===old.id);assert(c.driver.inside&&c.ai&&c.moteur&&!c.driver.altercation);}assert(!r.altercations.scenes.some(scene=>[scene.a.c?.id,scene.b.c?.id].includes(a.id)));checks.push('Full session save/reload restores physical actors and both drivers return without teleporting');
// A controlled pedestrian uses exactly one body, with its posed heading preserved.
const p=s.crowd.people[0];Object.assign(p,{x:61.5,z:175,cap:0,yaw:1.2,altercation:{id:123,danger:false},aggression:0,injury:null,moveSpeed:0});s.crowd.update(.05,[]);assert.equal(Math.round(s.crowd.packed[3])%4,3);assert.equal(p.x,61.5);assert(s.injuries.geometry(10).length>0);p.altercation=null;s.crowd.update(.05,[]);assert.equal(p.yaw,undefined);checks.push('Controlled pedestrian excluded from instanced crowd and rendered by injury/interaction geometry; navigation restored');
// Early safe return must overwrite a prior displaced-driver record even at 100 HP.
const e=r.world.fleet.find(c=>c.id===a.id).driver;e.hp=100;e.inside=false;e.fear=0;e.grievance=0;r.injuries.save();e.inside=true;const record=r.injuries.save().people.find(x=>x.id===e.id);assert.equal(record.inside,true);checks.push('Recovered healthy driver updates earlier displaced record');
const report={pass:true,pedestrians:480,checks};fs.writeFileSync(new URL('../docs/altercations-session-validation.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(report);
