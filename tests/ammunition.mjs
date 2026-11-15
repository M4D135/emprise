import './load.mjs';import assert from 'node:assert/strict';import fs from 'node:fs';
const world={seed:135,stage:0,generation:6,combat:true,navCell:2,bounds:{minX:-25,maxX:25,minZ:-25,maxZ:25},spawn:{x:0,z:0,yaw:0},enemies:[],colliders:[],cores:[],pickups:[],exit:{x:24,z:24},spatial:{ground:()=>0,blocked:()=>false,ray:(_,__,far)=>far}};
const make=(ammo=[3,2,1],finiteAmmo=true)=>FSimulation.create(world,{finiteAmmo,inventory:{weapons:[true,true,true],ammo}});
const s=make(),events=[];function tick(seconds,input={}){for(let i=0;i<Math.round(seconds*120);i++){s.step(1/120,input);events.push(...s.state.events.splice(0));}}
for(let i=0;i<3;i++){assert(s.fire());tick(.5);}assert.equal(s.state.shots,3);assert.equal(s.state.inventory.ammo[0],0);
const before=s.state.shots;tick(3,{fire:true});assert.equal(s.state.shots,before);assert(events.filter(e=>e.name==='empty').length<=4);assert(!events.some(e=>e.name==='melee'),'Dry fire must not silently punch');
assert(s.selectWeapon(1));assert(s.fire());assert.equal(s.state.inventory.ammo[1],1);tick(1.4);assert(s.selectWeapon(2));assert(s.fire());assert.equal(s.state.inventory.ammo[2],0);tick(2);
const snap=s.snapshot();const restored=make();assert(restored.restore(snap));assert.deepEqual(restored.state.inventory,s.state.inventory);
for(let i=0;i<180;i++){s.step(1/120,{fire:true});restored.step(1/120,{fire:true});}assert.deepEqual(restored.snapshot(),s.snapshot());
for(const ammo of [[-1,1,1],[181,1,1],[1.5,1,1],[null,1,1],[1,1]]){const bad=structuredClone(snap);bad.state.ammunition.inventory.ammo=ammo;const before=restored.snapshot();assert(!restored.restore(bad));assert.deepEqual(restored.snapshot(),before);}
const infinite=make([0,0,0],false);assert(infinite.fire());assert.equal(infinite.state.shots,1,'Existing non-finite simulation users unchanged');
const legacy=make().snapshot();delete legacy.state.ammunition;assert(make().restore(legacy),'Legacy snapshot without ammo can be loaded');
const session=RADE.session.create({pedestrians:0});session.sim.state.inventory.ammo=[77,7,2];session.sim.selectWeapon(2);const save=session.save();const loaded=RADE.session.create({pedestrians:0,saved:save,now:save.savedAt});assert.deepEqual(loaded.sim.state.inventory.ammo,[77,7,2]);assert.equal(loaded.sim.state.weapon,2);
const old={...save};delete old.ammunition;const migrated=RADE.session.create({pedestrians:0,saved:old,now:save.savedAt});assert.deepEqual(migrated.sim.state.inventory.ammo,[180,36,12]);
const report={checks:['Actual shots consume exactly one round','Empty weapon blocks shooting without hidden melee; dry sound rate limited','Weapon swap uses independent stocks','Checkpoint continuation and invalid data atomic refusal','Solo reserve and selected weapon persist','Older saves migrate to starter reserves','Infinite-ammo base simulations unchanged']};fs.writeFileSync(new URL('../docs/ammunition-validation.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(report);
