import './load.mjs';
await import('../src/phone.js');
import assert from 'node:assert/strict';
import fs from 'node:fs';
const checks=[];
function fixture(saved=null){
 const world=RADE.world.create(),layout=RADE.campaign.layout(world);RADE.business.prepare(world);
 const sim=FSimulation.create(world.combatWorld),p=sim.state.player;world.player=p;
 const entry=(id,type,x,z)=>{const q=world.freeNear(x,z,.4);return {id:'phone-building-'+id,index:id,x:q[0],z:q[1],nx:1,nz:0,type,floors:3,boxes:[],places:[{id:'phone-place-'+id,type,name:'Comptoir de test '+type,address:id+' rue de test',shop:true,fixture:true}]};};
 world.addresses={entries:[entry(1,'supermarche',70,130),entry(2,'commerce',82,150),entry(3,'garage',100,170)],shared:0};
 const campaign=RADE.campaign.create(world,sim,layout,{saved:saved?.campaign,now:saved?.campaign?.savedAt||Date.now()});
 const interiors=RADE.interiors.create(world,sim,{saved:saved?.interiors});
 const business=RADE.business.create(world,sim,{interiors,campaign,saved:saved?.business});
 const notifications=[];const phone=RADE.phone.create(world,sim,{campaign,business,interiors,saved:saved?.phone,notify:text=>notifications.push(text)});
 function counter(key){const e=business.registry.get(key);interiors.leave();sim.relocate(e.building.x,e.building.z,0);assert(interiors.enter(e.building));business.update(0);const q=interiors.active.services.find(q=>q.kind!=='weapon')||{x:interiors.active.merchant.x,z:interiors.active.merchant.z+1.65};assert(q);sim.relocate(q.x,q.z,0);business.update(0);assert(business.context());}
 return {world,sim,p,campaign,interiors,business,phone,notifications,counter,save:()=>({campaign:campaign.save(),interiors:interiors.save(),business:business.save(),phone:phone.save()})};
}
function advance(s,seconds,context={}){while(seconds>0){const dt=Math.min(1,seconds);s.phone.update(dt,[],context);seconds-=dt;}}
function latestOffer(s){return s.phone.messages.find(m=>m.status==='offered');}
let s=fixture();advance(s,14);assert.equal(s.phone.messages.length,0);advance(s,1);let offer=latestOffer(s);assert.equal(offer.contract.type,'delivery');assert.equal(s.phone.unread,1);advance(s,300);assert.equal(s.phone.messages.length,1);assert.equal(s.notifications.length,1);
const outside=s.phone.messages;outside[0].status='completed';assert.equal(latestOffer(s).status,'offered');assert(s.phone.read(offer.id));assert.equal(s.phone.unread,0);assert(s.phone.respond(offer.id,'accept'));assert(!s.phone.respond(offer.id,'accept'));assert(!s.phone.respond(offer.id,'decline'));
checks.push('Premier SMS à15s, offre unique sans rafale, lecture/conversation, vues isolées, réponse unique');
const c=s.phone.active;s.counter(c.targetKey);s.phone.update(0);assert.equal(s.phone.active.stage,'pickup');s.counter(c.sourceKey);s.phone.update(0);assert.equal(s.phone.active.stage,'pickup');
const beforeBuy=s.campaign.state.cash;assert(s.business.act('buy'));assert.equal(s.campaign.state.cash,beforeBuy-12);assert.equal(s.business.inventory.provision,1);s.phone.update(.1);assert.equal(s.business.inventory.provision,0);assert.equal(s.phone.active.stage,'deliver');s.phone.update(1);assert.equal(s.business.inventory.provision,0);
const savedCargo=s.save();s=fixture(savedCargo);assert.equal(s.phone.active.stage,'deliver');assert.equal(s.business.inventory.provision,0);const beforeDelivery=s.campaign.state.cash;s.counter(c.targetKey);s.phone.update(.1);assert.equal(s.phone.active,null);assert.equal(s.campaign.state.cash,beforeDelivery+150);advance(s,10);assert.equal(s.campaign.state.cash,beforeDelivery+150);
const finished=s.save();s=fixture(finished);assert.equal(s.campaign.state.cash,beforeDelivery+150);assert.equal(s.phone.active,null);assert(!s.phone.respond(offer.id,'accept'));
checks.push('Livraison liée à achat réel12€, comptoirs distincts, provision débitée une fois, cargo sauvegardé, paiement150€ sans doublon après reprise');
advance(s,160);offer=latestOffer(s);assert.equal(offer.contract.type,'vehicle');assert(s.phone.respond(offer.id,'accept'));s.interiors.leave();const car=s.world.fleet.find(c=>c.id===s.phone.active.vehicleId),wrong=s.world.fleet.find(c=>c.id!==car.id);car.ai=false;car.v=car.u=10;
const context={mode:'car',car};s.phone.update(.1,[],{mode:'car',car:wrong});assert.equal(s.phone.active.distance,0);s.phone.update(.1,[],context);car.x+=200;s.phone.update(.1,[],context);assert.equal(s.phone.active.distance,0,'teleport must not count as driving');
for(let i=0;i<360;i++){car.x+=1;s.phone.update(.1,[],context);}assert.equal(s.phone.active.stage,'return');assert(s.phone.active.distance>=350);
const vehicleSave=s.save();s=fixture(vehicleSave);assert.equal(s.phone.active.stage,'return');const restored=s.world.fleet.find(c=>c.id===s.phone.active.vehicleId),garage=s.business.registry.get(s.phone.active.targetKey);Object.assign(restored,{x:garage.building.x,z:garage.building.z,ai:false,v:0,u:0});const beforeCar=s.campaign.state.cash;
for(let i=0;i<12;i++)s.phone.update(.1,[],{mode:'car',car:restored});assert(s.phone.active);for(let i=0;i<12;i++)s.phone.update(.1,[],{mode:'car',car:restored});assert.equal(s.phone.active,null);assert.equal(s.campaign.state.cash,beforeCar+260);advance(s,10,{mode:'car',car:restored});assert.equal(s.campaign.state.cash,beforeCar+260);
checks.push('Essai mécanique : véhicule exact, faux saut refusé,350m mesurés, distance persistante, arrêt2s et260€ uniques');
advance(s,160);offer=latestOffer(s);assert.equal(offer.contract.type,'protection');assert(s.phone.respond(offer.id,'accept'));const protectedKey=s.phone.active.targetKey;s.counter(protectedKey);assert(s.business.act('protect'));s.phone.update(.1);assert(s.phone.active.started);const cashBeforeProtection=s.campaign.state.cash,boss=s.sim.state.enemies[s.business.mission.enemyId];boss.hp=0;s.business.update(0);s.phone.update(.1);assert.equal(s.campaign.state.cash,cashBeforeProtection,'rival defeated does not bypass claim');assert(s.business.act('claim'));s.phone.update(.1);assert.equal(s.phone.active,null);assert.equal(s.campaign.state.cash,cashBeforeProtection+180);s.business.update(0);assert(s.business.income>0);
checks.push('Protection raccordée au vrai business : protect, rival de fixture vaincu, retour/claim obligatoire,180€ puis revenus métier');
const declined=fixture();advance(declined,15);let message=latestOffer(declined);assert(declined.phone.respond(message.id,'decline'));assert(!declined.phone.respond(message.id,'accept'));advance(declined,119);assert.equal(latestOffer(declined),undefined);advance(declined,1);assert(latestOffer(declined));
const danger=fixture();danger.campaign.law.wanted=2;advance(danger,30);assert.equal(danger.phone.messages.length,0);danger.campaign.law.wanted=0;danger.phone.update(.1,[{name:'shot'}]);advance(danger,5);assert.equal(danger.phone.messages.length,0);advance(danger,2);assert(latestOffer(danger));danger.phone.open(latestOffer(danger).threadId);assert.equal(danger.phone.unread,0);
checks.push('Refus conservé, intervalle120s, SMS différés pendant poursuite et tirs récents');
const doomed=fixture();advance(doomed,15);message=latestOffer(doomed);assert(doomed.phone.respond(message.id,'accept'));const beforeDeath=doomed.campaign.state.cash;doomed.p.hp=0;doomed.phone.update(.1);assert.equal(doomed.phone.active,null);assert.equal(doomed.campaign.state.cash,beforeDeath);assert.equal(doomed.phone.messages.find(m=>m.id===message.id).status,'failed');
for(const bad of [{version:1,clock:Infinity,messages:[null,{id:'sms-1',status:'accepted',contract:{type:'delivery',sourceKey:'missing',targetKey:'missing',reward:1e20}}],paid:[null,{},'sms-1']},{version:1,messages:{},usedVehicles:{},nextOfferAt:NaN},{version:1,messages:[{id:'sms-1',status:'info',text:'x'.repeat(9000)},{id:'sms-1',status:'info'}]}]){
 const p=RADE.phone.create(s.world,s.sim,{campaign:s.campaign,business:s.business,interiors:s.interiors,saved:bad});assert.doesNotThrow(()=>p.update(.1));assert(Number.isFinite(p.time));assert.equal(p.active,null);assert(p.messages.length<=1);assert(p.messages.every(m=>m.text.length<=1600));
}
const replay=fixture(finished),cash=replay.campaign.state.cash;advance(replay,1);assert.equal(replay.campaign.state.cash,cash);assert.equal(replay.phone.messages.find(m=>m.id===finished.phone.paid[0]).status,'completed');
checks.push('Mort échoue sans argent, sauvegardes invalides bornées, déduplication des IDs et ledger anti-doublepaiement');
const report={checks,contractTypes:['delivery','vehicle','protection'],rewardEuros:RADE.phone.REWARDS,fixture:'Comptoirs et état de déplacement préparés. Achats/protection/claim et revenus exécutés par les modules business/campaign réels ; distance/arrêt du contrat testés avec positions contrôlées. Aucun test UI/manette revendiqué.'};
fs.writeFileSync(new URL('../docs/phone-acceptance.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
