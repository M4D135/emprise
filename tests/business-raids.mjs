// Component fixture: an open, bounded street; actual METAL actors and combat.
import './load.mjs';
import assert from 'node:assert/strict';
const key='raid-fixture/shop',baseSave={version:2,clock:1000,nextRaidAt:1000,records:{[key]:{status:'protected',rivalGang:2,eligibleAt:1000}},inventory:{}};
function fixture(saved=baseSave,cash=200){
 const bounds={minX:-150,maxX:150,minZ:-150,maxZ:150},world={bounds,city:{rues:{aretes:[]}},ground:()=>.08,blocked:()=>false,ray:(_,__,far)=>far,freeNear:(x,z)=>[x,z]};
 world.combatWorld={seed:3,generation:6,combat:true,bounds,spawn:{x:100,z:100,yaw:0},enemies:[],cores:[],pickups:[],colliders:[],exit:{x:0,z:0},spatial:{ground:()=>.08,blocked:world.blocked,ray:world.ray,contains:(x,z)=>Math.abs(x)<150&&Math.abs(z)<150}};
 RADE.business.prepare(world);const sim=FSimulation.create(world.combatWorld,{finiteAmmo:true}),p=sim.state.player;world.player=p;
 const building={id:'raid-fixture',x:0,z:0,nx:1,nz:0,address:'Adresse de fixture',places:[{id:'shop',name:'Commerce de fixture',type:'armurerie',address:'Adresse de fixture'}]},interiors={entries:[building],active:null};
 const campaign={state:{cash,xp:0,mapOwned:true,nextRaid:115,raid:null,active:null},law:{},crime(){}},messages=[];
 const business=RADE.business.create(world,sim,{interiors,campaign,saved:structuredClone(saved),notify:m=>messages.push(m)});
 return {world,sim,p,interiors,campaign,business,messages,building};
}
function deployed(s){return s.sim.state.enemies.filter(e=>e.deployed&&e.hp>0);}
function assault(s){assert.equal(s.business.raid.stage,'warning');s.business.update(90);assert.equal(s.business.raid.stage,'assault');assert.equal(deployed(s).length,2);}
let s=fixture();assert.equal(s.business.raid.timer,90);assert.equal(deployed(s).length,0);assert(s.messages[0].includes('90 s'));assert(s.messages[0].includes('Adresse de fixture'));const rate=s.business.income,cash=s.campaign.state.cash;
assault(s);assert.equal(s.business.income,0);assert(Math.abs(s.campaign.state.cash-cash-rate*1.5)<1e-6,'warning keeps revenue until occupation starts');
for(const e of deployed(s)){assert(Math.hypot(e.x,e.z)<8);assert(e.hasMemory&&!e.seen);assert.equal(e.lastSeenX,0);assert.equal(e.lastSeenZ,0);assert.notEqual(e.lastSeenX,s.p.x);}
const savedWarning=fixture().business.save(),warningReload=fixture(savedWarning);assert.equal(warningReload.business.raid.timer,90);assert.equal(warningReload.messages.length,0,'loading does not repeat alert');
s.business.update(19);assert.equal(s.business.raid.hold,19);const assaultSave=s.business.save(),ids=assaultSave.raid.ids;s.sim.state.enemies[ids[0]].hp-=1;const damaged=s.business.save();const beforeReloadCash=s.campaign.state.cash;
s=fixture(damaged,beforeReloadCash);assert.equal(s.business.raid.hold,19);assert.equal(s.business.raid.timer,131);assert.equal(s.sim.state.enemies[ids[0]].hp,damaged.raid.actors[0].hp);assert.equal(deployed(s).length,2);assert.equal(s.campaign.state.cash,beforeReloadCash);
// Being inside or dead is never treated as defending an outdoor door.
s.p.hp=0;s.business.update(20);assert.equal(s.business.raid.hold,19);assert(s.business.raid.paused);s.p.hp=100;
const room={sceneId:'fixture-room',building:s.building,type:'public',floor:0,place:null,civil:[],services:[],portals:[],stairs:{},spawn:{x:1000,z:1000},exit:{x:1000,z:1000},zones:[],blocked:()=>true};s.interiors.active=room;s.p.x=s.p.z=1000;s.business.update(41);assert.equal(s.business.raid,null);assert.equal(s.business.records.get(key).status,'independent');assert.equal(s.business.income,0);assert.equal(s.campaign.state.cash,beforeReloadCash);
const lost=fixture(s.business.save());assert.equal(lost.business.raid,null);assert.equal(lost.business.records.get(key).status,'independent');assert(lost.business.save().nextRaidAt>lost.business.time+470);
// Visible spawn is delayed; watching the entrance must not pop actors into view.
s=fixture();s.p.x=0;s.p.z=9;s.business.update(90);assert.equal(s.business.raid.stage,'warning');assert.equal(deployed(s).length,0);for(let i=0;i<59;i++)s.business.update(1);assert.equal(deployed(s).length,0);s.business.update(3);assert.equal(s.business.raid,null);assert.equal(s.business.records.get(key).status,'protected');
// Already visible enemies remain physical when a defended raid ends.
s=fixture();assault(s);s.p.x=0;s.p.z=9;const standingCash=s.campaign.state.cash;s.business.update(150);assert.equal(s.business.raid,null);assert.equal(s.business.records.get(key).status,'protected');assert.equal(s.campaign.state.cash,standingCash,'no cash victory bounty');assert.equal(deployed(s).length,2,'survivors retreat without vanishing in view');
const retreatStart=deployed(s).map(e=>Math.hypot(e.x,e.z)),retreatHP=s.p.hp;for(let i=0;i<240;i++){s.sim.step(1/120,{});s.business.update(1/120);}assert.equal(s.p.hp,retreatHP,'ordered withdrawal stops fire');for(const [i,e] of deployed(s).entries()){assert(!e.seen&&e.windup===0&&e.burstLeft===0);assert(Math.hypot(e.x,e.z)>retreatStart[i]+1,'survivors use normal navigation to withdraw');}
const retreatSave=s.business.save();assert.equal(retreatSave.retreats.length,2);let r=fixture(retreatSave);r.p.x=-140;r.p.z=-140;r.business.update(0); // Move beyond visibility: safe cleanup, no fresh raid.
assert.equal(r.business.raid,null);assert.equal(deployed(r).length,0);assert(r.business.save().nextRaidAt>r.business.time+470);
// A wall blocks defensive presence and occupation; no distance-only capture through walls.
s=fixture();assault(s);s.p.x=0;s.p.z=9;s.world.ray=(origin,dir,far)=>origin[2]===9?0:far;s.business.update(30);assert.equal(s.business.raid.hold,30,'player behind wall does not contest');s.world.ray=()=>0;s.business.update(5);assert(s.business.income>0,'attackers behind wall no longer occupy threshold');assert(s.business.raid.hold<30);
// Campaign raids/contracts and business warnings do not advance concurrently.
s=fixture();s.campaign.state.raid={site:'other'};const timer=s.business.raid.timer;s.business.update(90);assert.equal(s.business.raid.timer,timer);assert.equal(deployed(s).length,0);s.campaign.state.raid=null;s.business.update(90);assert.equal(s.business.raid.stage,'assault');assert(s.campaign.state.nextRaid>=180);
// Standard METAL fire resolves the physical raid, without a synthetic victory API.
s=fixture();assault(s);s.sim.relocate(0,12,0);let elapsed=0;const shots=s.sim.state.shots;
while(s.business.raid&&elapsed<20&&s.p.hp>0){const e=deployed(s)[0];assert(e);const dx=e.x-s.p.x,dz=e.z-s.p.z,dy=e.y-(s.p.y+1.62),d=Math.hypot(dx,dz),yaw=Math.atan2(dx,-dz);s.sim.step(1/120,{lookX:Math.atan2(Math.sin(yaw-s.p.yaw),Math.cos(yaw-s.p.yaw)),lookY:Math.atan2(dy,d)-s.p.pitch,fire:true,weapon:0});s.business.update(1/120);elapsed+=1/120;}
assert.equal(s.business.raid,null,'ordinary shots defend shop');assert(s.sim.state.shots>shots);assert.equal(s.business.records.get(key).status,'protected');const defended=fixture(s.business.save());assert.equal(defended.business.raid,null);assert.equal(defended.business.records.get(key).lastRaid,'defended');
// Existing saves receive a grace period, malformed new raid state cannot spawn ghosts.
s=fixture({...baseSave,version:1});assert.equal(s.business.raid,null);s.business.update(479);assert.equal(s.business.raid,null);
for(const raid of [{key,stage:'assault',ids:[0,0],actors:[]},{key,stage:'assault',ids:[0,1],actors:[{id:0,x:Infinity,z:0,hp:100}]},{key:'unknown',stage:'warning'},null]){const x=fixture({...baseSave,nextRaidAt:1500,raid});assert.equal(x.business.raid,null);assert.equal(deployed(x).length,0);}
// Weapon-specific stock uses the real finite inventory; a full stock never debits.
s=fixture({...baseSave,nextRaidAt:1500});s.interiors.active={...room,type:'armurerie',place:s.building.places[0],services:[{kind:'ammo',x:1000,z:1000}],civil:[]};s.p.x=s.p.z=1000;s.p.hp=100;
for(const [weapon,pack] of [[0,24],[1,6],[2,2]]){s.sim.state.weapon=weapon;s.sim.state.inventory.ammo[weapon]=0;const old=s.campaign.state.cash;assert(s.business.context().actions.find(a=>a.id==='buy').label.includes(String(pack)));assert(s.business.act('buy'));assert.equal(s.sim.state.inventory.ammo[weapon],pack);assert.equal(s.campaign.state.cash,old-35);s.sim.state.inventory.ammo[weapon]=s.sim.ammoCaps[weapon];const fullCash=s.campaign.state.cash;assert(!s.business.act('buy'));assert.equal(s.campaign.state.cash,fullCash);}
console.log(JSON.stringify({checks:15,combatSeconds:elapsed,warningSeconds:90,occupationSeconds:60,maxAttackers:2,saveVersion:2,oldSaves:true,noHiddenPlayerEvidence:true,visibleSpawnPrevented:true,ammoPacks:[24,6,2]}));
