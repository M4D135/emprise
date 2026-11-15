import './load.mjs';
await import('../src/business.js');
import assert from 'node:assert/strict';
import fs from 'node:fs';
const checks=[],report={checks};

function fixture(saved=null){
 const world=RADE.world.create(),layout=RADE.campaign.layout(world);
 const before=world.combatWorld.enemies.length,slots=RADE.business.prepare(world);
 assert.equal(world.combatWorld.enemies.length,before+8);assert.deepEqual(RADE.business.prepare(world),slots);assert.equal(world.combatWorld.enemies.length,before+8);
 const sim=FSimulation.create(world.combatWorld),p=sim.state.player;
 world.player=p;
 const door=world.freeNear(70,130,.4),hotelDoor=world.freeNear(82,150,.4);
 const entry=(id,type,q)=>({id:'test-building-'+id,index:id,fixture:true,x:q[0],z:q[1],nx:1,nz:0,type,name:'Lieu de test '+type,floors:3,places:[{id:'test-place-'+id,type,name:'Lieu de test '+type,shop:true,fixture:true,source:'fixture'}]});
 world.addresses={entries:[entry(1,'commerce',door),entry(2,'hotel',hotelDoor)],shared:0};
 const campaign=RADE.campaign.create(world,sim,layout,{saved:saved?.campaign,now:saved?.campaign?.savedAt||Date.now()});
 const interiors=RADE.interiors.create(world,sim,{saved:saved?.interiors});
 const business=RADE.business.create(world,sim,{interiors,campaign,saved:saved?.business});
 const injuries=RADE.injuries.create(world,sim,{people:[]},{interiors,campaign});
 const s={world,sim,p,campaign,interiors,business,injuries,shop:world.addresses.entries[0],hotel:world.addresses.entries[1]};
 s.save=()=>({campaign:campaign.save(),interiors:interiors.save(),business:business.save()});
 s.enter=b=>{interiors.leave();sim.relocate(b.x,b.z,0);assert(interiors.enter(b));business.update(0);};
 s.counter=()=>{const room=interiors.active,q=room.services.find(q=>q.kind!=='weapon')||{x:room.merchant.x,z:room.merchant.z+1.65};sim.relocate(q.x,q.z,0);business.update(0);assert.equal(business.context()?.kind,'business');};
 s.floor=n=>{while(interiors.active.floor<n){const q=interiors.active.stairs.up;sim.relocate(q.x,q.z,0);assert(interiors.interact(campaign));business.update(0);}};
 s.step=(dt,input={})=>{sim.step(dt,input);const events=sim.state.events.splice(0);campaign.tick(dt,events);business.update(dt,events);injuries.update(dt,events);};
 return s;
}
let s=fixture();s.enter(s.shop);s.counter();
assert.equal(s.business.registry.size,2);assert.equal(s.business.slots.length,8);
const startCash=s.campaign.state.cash;s.p.hp=60;
assert(s.business.act('buy'));assert.equal(s.campaign.state.cash,startCash-25);assert.equal(s.business.inventory.bandage,1);
assert(s.business.act('use_bandage'));assert.equal(s.p.hp,95);assert.equal(s.business.inventory.bandage,0);assert(!s.business.act('use_bandage'));
assert(s.business.act('buy'));s.interiors.leave();s.p.hp=50;assert(s.business.consume('bandage'));assert.equal(s.p.hp,85);assert(!s.business.consume('bandage'));s.enter(s.shop);s.counter();
checks.push('Achat réel, débit unique, objet en inventaire et soin consommable dehors une seule fois');
const mapCash=s.campaign.state.cash;s.campaign.state.mapOwned=false;s.campaign.state.cash=59;assert(!s.business.act('buy_map'));assert.equal(s.campaign.state.cash,59);assert.equal(s.campaign.state.mapOwned,false);
s.campaign.state.cash=mapCash;s.sim.relocate(1000,1008,0);assert(!s.business.act('buy_map'));s.counter();assert(s.business.act('buy_map'));assert.equal(s.campaign.state.cash,mapCash-60);assert.equal(s.campaign.state.mapOwned,true);assert(!s.business.act('buy_map'));assert.equal(s.campaign.state.cash,mapCash-60);
checks.push('Plan papier : achat à portée uniquement, 60 € débités une fois, fonds insuffisants et répétition refusés');
assert(s.business.act('rob'));const robbed=s.campaign.state.cash;assert(!s.business.act('rob'));assert.equal(s.campaign.state.cash,robbed);
assert(s.campaign.law.wanted>0);assert(Math.abs(s.campaign.law.lastKnown.x)<550,'crime reports the real building entrance, never the room coordinate1000');
const persisted=s.save();s=fixture(persisted);assert(s.campaign.state.mapOwned);s.counter();assert(!s.business.act('rob'));assert.equal(s.campaign.state.cash,robbed);
assert(s.business.act('extort'));const extorted=s.campaign.state.cash;assert(!s.business.act('extort'));assert.equal(s.campaign.state.cash,extorted);
checks.push('Vol/racket : argent réel, menace réelle et temporisations conservées après sauvegarde');
s.sim.relocate(1000,1008,0);assert(!s.business.act('rob'));s.counter();
assert(s.business.act('protect'));assert(!s.business.act('protect'));assert(!s.business.act('claim'));assert.equal(s.business.income,0);
assert(s.business.mission.hint.includes('du commerce'));
const m=s.business.mission,boss=s.sim.state.enemies[m.enemyId];assert(boss.deployed&&boss.hp>0);assert(Math.abs(boss.x)<550&&Math.abs(boss.z)<550);
for(let i=0;i<60;i++)s.business.update(1/30);assert.equal(s.sim.state.enemies.filter(e=>e.businessReserve&&e.deployed).length,1);
const missionSave=s.save();s=fixture(missionSave);s.counter();assert.equal(s.business.mission.enemyId,m.enemyId);assert.equal(s.business.mission.stage,'hunt');
assert.equal(s.sim.state.enemies.filter(e=>e.businessReserve&&e.deployed).length,1);
checks.push('Protection : un vrai responsable rival METAL dehors, une seule mission, reprise sans doublon');
s.interiors.leave();s.business.update(0);
const target=s.sim.state.enemies[m.enemyId];let vantage=null;
for(let i=0;i<40&&!vantage;i++){
 const a=i*Math.PI/20,q=s.world.freeNear(target.x+Math.cos(a)*9,target.z+Math.sin(a)*9,.35),dx=target.x-q[0],dz=target.z-q[1],dy=target.y-1.7,d=Math.hypot(dx,dz,dy);
 if(d<5||d>20)continue;
 if(s.world.ray([q[0],1.7,q[1]],[dx/d,dy/d,dz/d],d)>=d-.15)vantage=q;
}
assert(vantage,'real clear shooting position');s.sim.relocate(vantage[0],vantage[1],0);s.p.hp=100;
const shotsBefore=s.sim.state.shots;let elapsed=0;
while(target.hp>0&&elapsed<12&&!s.sim.state.dead){
 const dx=target.x-s.p.x,dz=target.z-s.p.z,dy=target.y-(s.p.y+1.62),d=Math.hypot(dx,dz);
 s.step(1/120,{lookX:Math.atan2(Math.sin(Math.atan2(dx,-dz)-s.p.yaw),Math.cos(Math.atan2(dx,-dz)-s.p.yaw)),lookY:Math.atan2(dy,d)-s.p.pitch,fire:true,weapon:0});elapsed+=1/120;
}
assert(target.hp<=0,'boss defeated with normal aim/fire');assert(s.sim.state.shots>shotsBefore);assert.equal(s.business.mission.stage,'return');assert.equal(s.business.income,0);
s.enter(s.shop);s.counter();assert(s.business.act('claim'));assert(!s.business.act('claim'));s.business.update(0);
const rate=s.business.income;assert(rate>0);const cash=s.campaign.state.cash;s.interiors.leave();s.business.update(60);assert(Math.abs(s.campaign.state.cash-cash-rate)<1e-6);
report.combat={seconds:elapsed,shots:s.sim.state.shots-shotsBefore,rate};
checks.push('Mission jouée avec tirs normaux : chef éliminé, retour au commerçant obligatoire puis revenus hors du bâtiment');
const ownershipSave=s.save();s=fixture(ownershipSave);assert.equal(s.business.mission,null);assert.equal(s.business.income,rate);const restoredCash=s.campaign.state.cash;s.business.update(60);assert(Math.abs(s.campaign.state.cash-restoredCash-rate)<1e-6);
checks.push('Protection et revenus persistants, aucune récompense répétée lors du chargement');
s.enter(s.hotel);s.floor(1);
let room=s.interiors.active;assert(room.civil.some(e=>e.businessResident));const residents=room.civil.filter(e=>e.businessResident);
for(const e of residents){assert(!room.staticBlocked(e.x,e.z,.3));assert(room.blocked(e.x,e.z,.3),'live people occupy physical space');}
const person=residents[0];s.injuries.hurtCivil(person,1,'head');s.business.update(0);const personId=person.id;
const bag=room.zones.find(q=>q.kind==='bedroom');s.sim.relocate(bag.x,bag.z,0);const action=s.business.context().actions[0].id,beforeLoot=s.campaign.state.cash;assert(s.business.act(action));assert(s.campaign.state.cash>beforeLoot);assert(!s.business.act(action));
const hotelSave=s.save();s=fixture(hotelSave);room=s.interiors.active;assert.equal(room.floor,1);const restoredPerson=room.civil.find(e=>e.id===personId);assert(restoredPerson);assert.equal(restoredPerson.hp,0);assert(!s.business.act(action));
s.floor(2);const bag2=s.interiors.active.zones.find(q=>q.kind==='bedroom');s.sim.relocate(bag2.x,bag2.z,0);const action2=s.business.context().actions[0].id;assert.notEqual(action2,action);assert(s.business.act(action2));
checks.push('Hôtels : bagages par chambre et étage, argent/objets une seule fois, coffre vide après reprise');
checks.push('PNJ intérieurs visibles, collidants et blessables ; identités et morts conservées entre visites');
// Holding still indoors removes actual police visibility and the wanted level decays normally.
const traffic=RADE.traffic.create(s.world,{count:0});s.campaign.law.heat=0;s.campaign.crime(2);
for(let i=0;i<60*30;i++){s.campaign.tick(1/30,[]);traffic.update(1/30,s.campaign.law,s.p);assert(!traffic.arrestStatus(s.p).eligible);}
assert.equal(s.campaign.law.wanted,0);checks.push('Cache intérieure : pas de vision ni arrestation àx1000, menace retombée sans nouvelle infraction');
// Closed protected businesses never resume paying simply because the player leaves.
s.enter(s.shop);s.counter();s.interiors.active.merchant.hp=0;s.business.update(0);assert.equal(s.business.income,0);s.interiors.leave();const noIncome=s.campaign.state.cash;s.business.update(60);assert.equal(s.campaign.state.cash,noIncome);
checks.push('Commerce dont le commerçant est mort : revenus suspendus même après sortie');
for(const bad of [{version:1,clock:Infinity,inventory:{bandage:-6},records:{x:null},mission:{enemyId:999}},{version:1,residents:[null,{id:2,x:Infinity,z:1000,hp:99}],claimed:[null,7,{}],records:[]}])assert.doesNotThrow(()=>RADE.business.create(s.world,s.sim,{interiors:s.interiors,campaign:s.campaign,saved:bad}));
checks.push('Données partielles ou corrompues ignorées sans valeur invalide ni personnage répliqué');
fs.writeFileSync(new URL('../docs/business-acceptance.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
