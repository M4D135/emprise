globalThis.RADE={};
await import('../src/loot.js');
import assert from 'node:assert/strict';
const fixture=(saved=null)=>{
 const world={bounds:{minX:-20,maxX:20,minZ:-20,maxZ:20},playerSeated:false,ground:()=>.08,ray:(_,__,far)=>far};
 const sim={state:{player:{x:0,z:0,y:.08,hp:100},enemies:[{id:4,x:.8,z:0,hp:100,deployed:true}]}};
 const campaign={state:{cash:200}},business={inventory:{bandage:0,provision:0,valuable:0}},interiors={active:null};
 const loot=RADE.loot.create(world,sim,{campaign,business,interiors,saved});return {world,sim,campaign,business,interiors,loot,e:sim.state.enemies[0]};
};
let s=fixture();s.e.hp=0;s.loot.update();const bag=s.loot.bags[0];assert(bag);const item=bag.item,amount=bag.cash;
for(let i=0;i<120;i++)s.loot.update();assert.equal(s.loot.bags.length,1);assert(s.loot.context());
s.world.ray=()=>.1;assert.equal(s.loot.context(),null);assert(!s.loot.take());s.world.ray=(_,__,far)=>far;
s.world.playerSeated=true;assert(!s.loot.take());s.world.playerSeated=false;s.interiors.active={};assert(!s.loot.take());s.interiors.active=null;
s.sim.state.player.hp=0;assert(!s.loot.take());s.sim.state.player.hp=100;
assert(s.loot.take());assert.equal(s.campaign.state.cash,200+amount);assert.equal(s.business.inventory[item],1);assert(!s.loot.take());
const saved=s.loot.save();s=fixture(saved);s.e.hp=0; // Match the restored campaign before constructing the loot system.
s.loot=RADE.loot.create(s.world,s.sim,{campaign:s.campaign,business:s.business,interiors:s.interiors,saved});s.loot.update();assert.equal(s.loot.bags.length,0);
s.e.hp=100;s.loot.update();s.e.hp=0;s.loot.update();assert.equal(s.loot.bags.length,1,'A new encounter on a reused reserve slot has its own bag');
s.business.inventory[s.loot.bags[0].item]=99;const before=s.campaign.state.cash;assert(s.loot.take());assert(s.campaign.state.cash>before);assert.equal(s.loot.bags.length,1);assert(!s.loot.take());
s.business.inventory[s.loot.bags[0].item]--;assert(s.loot.take());assert.equal(s.loot.bags.length,0);
for(let i=0;i<70;i++){s.e.hp=100;s.loot.update();s.e.hp=0;s.loot.update();}assert.equal(s.loot.bags.length,64);
const state=s.loot.save();const copy=fixture(state);assert.equal(copy.loot.bags.length,64);assert.deepEqual(copy.loot.save(),state);
const bad=fixture({...state,bags:[...state.bags,{...state.bags[0]},{...state.bags[1],x:NaN},{...state.bags[2],cash:Infinity},{...state.bags[3],item:'free-cash'}]});assert(bad.loot.bags.length<=64);assert(bad.loot.bags.every(q=>Number.isFinite(q.x)&&Number.isInteger(q.cash)));assert.equal(new Set(bad.loot.bags.map(q=>q.id)).size,bad.loot.bags.length);
s=fixture();s.e.civil=true;s.e.hp=0;s.loot.update();assert.equal(s.loot.bags.length,0,'No civilian rewards');
console.log('Loot: death/respawn, one-time claim, range/LOS, seat/interior/dead gates, capacity, persistence, invalid saves, no civilian rewards — passed');

// Partial ammunition pickup stays in the bag and survives a reload without duplication.
s=fixture();s.sim.state.inventory={ammo:[178,36,12]};s.sim.ammoCaps=[180,36,12];s.e.hp=0;s.loot.update();assert.equal(s.loot.bags[0].ammo.amount,12);assert(s.loot.take());assert.equal(s.sim.state.inventory.ammo[0],180);assert.equal(s.loot.bags[0].ammo.amount,10);assert(!s.loot.take());
const ammoSave=s.loot.save();const loaded=fixture(ammoSave);loaded.sim.state.inventory={ammo:[160,36,12]};loaded.sim.ammoCaps=[180,36,12];assert(loaded.loot.take());assert.equal(loaded.sim.state.inventory.ammo[0],170);assert.equal(loaded.loot.bags.length,0);assert(!loaded.loot.take());
console.log('Ammunition: capacity, partial pickup, persistence, no duplicate — passed');
