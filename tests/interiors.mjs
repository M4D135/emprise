import './load.mjs';import assert from 'node:assert/strict';import fs from 'node:fs';
await import('../src/places-data.js');await import('../src/places.js');
const s=RADE.session.create({pedestrians:0}),i=s.interiors,C=1000,checks=[],types={};
const validTypes=new Set(RADE.interiors.types),retail=new Set(['commerce','supermarche','garage','armurerie']);
assert.equal(validTypes.size,10);
assert.equal(new Set(i.entries.map(b=>b.id)).size,i.entries.length);
for(const b of i.entries){
 types[b.type]=(types[b.type]||0)+1;assert(validTypes.has(b.type),b.id+' type');
 assert(Array.isArray(b.places),b.id+' places');assert.equal(b.name.startsWith('Immeuble')||!!b.places[0]?.name,true,b.id+' name');
 if(b.places.length){const p=b.places[0];assert.equal(b.type,p.type||'logement',b.id+' primary type');assert.equal(b.shop,!!p.shop,b.id+' primary shop');}
 else{assert.equal(b.type,'logement',b.id+' default type');assert.equal(b.shop,false,b.id+' default shop');}
 if(b.type==='hotel')assert(b.places.some(p=>p.type==='hotel'),b.id+' hotel must be sourced');
 assert(!s.world.blocked(b.x,b.z,.33),b.name+' door obstructed');
 assert(!i.entries.some(q=>q!==b&&Math.hypot(b.x-q.x,b.z-q.z)<.79),'Duplicate access point '+b.id);
 for(let f=0;f<b.floors;f++){
  const r=i.roomFor(b,f,0);
  assert.equal(r.reconstruction,'procedural');assert(Array.isArray(r.services)&&Array.isArray(r.portals)&&Array.isArray(r.features));assert(r.layoutVariant);
  for(const q of [r.spawn,r.exit,r.stairs.up,r.stairs.down])assert(!r.blocked(q.x,q.z,.32),b.id+' floor '+f+' blocked point');
 }
}
checks.push('Tous les bâtiments : identifiants/portes uniques, places sourcées, aucun hôtel inventé, tous les paliers libres');
function fixture(index=0,list=RADE.interiors.types){
 const places=list.map((type,k)=>({id:'fixture-'+index+'-'+type+'-'+k,name:(RADE.interiors.names[type]||type)+' '+index,kind:type,type,shop:retail.has(type),address:'',addressDetail:'',x:0,z:0,lat:null,lon:null,sourceUrl:'fixture://'+index+'/'+type,services:[]}));
 const start=s.world.combatWorld.spawn;return {id:'fixture-building-'+index,index,x:start.x,z:start.z,nx:0,nz:1,floors:5,h:16,area:220,boxes:[],type:places[0].type,name:places[0].name,address:'',shop:!!places[0].shop,places,fixture:true};
}
function reachable(room,target){
 const step=.5,minX=Math.ceil((C-room.w/2+.25)/step),maxX=Math.floor((C+room.w/2-.25)/step),minZ=Math.ceil((C-room.d/2+.25)/step),maxZ=Math.floor((C+room.d/2-.25)/step);
 const free=(ix,iz)=>ix>=minX&&ix<=maxX&&iz>=minZ&&iz<=maxZ&&!room.blocked(ix*step,iz*step,.23);
 const key=(ix,iz)=>ix+','+iz,start=[Math.round(room.spawn.x/step),Math.round(room.spawn.z/step)];
 assert(free(...start),'spawn cell free');const seen=new Set([key(...start)]),queue=[start];
 for(let head=0;head<queue.length;head++){const [ix,iz]=queue[head];for(const [nx,nz] of [[ix-1,iz],[ix+1,iz],[ix,iz-1],[ix,iz+1]]){if(!free(nx,nz)||seen.has(key(nx,nz)))continue;seen.add(key(nx,nz));queue.push([nx,nz]);}}
 const tx=Math.round(target.x/step),tz=Math.round(target.z/step);
 for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)if(seen.has(key(tx+dx,tz+dz)))return true;return false;
}
function points(room){return [...room.services,...room.portals,room.stairs.up,room.stairs.down,room.exit];}
const all=fixture(0),expected={logement:['hall','mailboxes'],hotel:['reception','lobby'],public:['reception','information-desk','queue'],bureau:['office','desk','monitor','storage'],commerce:['checkout','shelves'],supermarche:['aisles','checkout','cold-storage','food-counter'],garage:['vehicle-display','desk'],restaurant:['kitchen','plates','food-counter'],kebab:['rotisserie','food-counter','till'],armurerie:['weapon-rack','service-counter']};
for(let pi=0;pi<all.places.length;pi++){
 const type=all.places[pi].type,r=RADE.interiors.roomFor(all,0,s.world,pi);
 for(const tag of expected[type])assert(r.features.includes(tag),type+' feature '+tag);
 if(['restaurant','kebab','supermarche'].includes(type))assert(r.services.some(q=>q.kind==='food'),type+' food');
 if(retail.has(type))assert(r.services.some(q=>q.kind==='map'),type+' map');
 if(type==='public')assert(r.services.some(q=>q.kind==='plan'&&q.price===0),'public plan');
 if(type==='armurerie')assert(r.services.filter(q=>q.kind==='weapon').length>=3,'armory weapons');
 for(const q of points(r)){assert(!r.blocked(q.x,q.z,.26),type+' point blocked');assert(reachable(r,q),type+' point unreachable');}
}
checks.push('Types représentatifs : caractéristiques, services, portails et escaliers atteignables au maillage 0,5 m');
const aptVariants=new Set();
for(const index of [3,4,5])for(const floor of [1,2]){
 const b=fixture(index,['logement']),r=RADE.interiors.roomFor(b,floor,s.world,0);
 aptVariants.add(r.layoutVariant);for(const tag of ['kitchen','bathroom','living-room','bedroom'])assert(r.features.includes(tag),'apartment '+index+'/'+floor+' '+tag);
 assert(r.type==='logement');for(const q of [r.spawn,r.stairs.up,r.stairs.down,r.exit,...r.zones]){assert(!r.blocked(q.x,q.z,.3),'apartment '+index+'/'+floor+' blocked '+q.kind);assert(reachable(r,q),'apartment '+index+'/'+floor+' unreachable '+q.kind);}
}
assert(aptVariants.size>1,'apartment variants must differ');
const hotelUpper=RADE.interiors.roomFor(fixture(9),2,s.world,0);assert.equal(hotelUpper.type,'hotel');assert(hotelUpper.features.includes('hotel-room'));for(const q of hotelUpper.zones){assert(!hotelUpper.blocked(q.x,q.z,.3));assert(reachable(hotelUpper,q),'hotel suite '+q.kind);}
checks.push('Appartements : cuisine, salle de bain, séjour, chambre, variantes distinctes ; étages d’hôtel seulement si sourcés');
for(const b of i.entries)if(b.places.length)for(let pi=b.places.length>1?-1:0;pi<b.places.length;pi++){
 const r=i.roomFor(b,0,pi);for(const q of points(r)){assert(!r.blocked(q.x,q.z,.3),b.id+'/'+pi+' real POI blocked');assert(reachable(r,q),b.id+'/'+pi+' real POI unreachable');}
}
checks.push('Tous les POI réels : services, portails, escaliers et sortie atteignables');
const oldAddresses=s.world.addresses,messages=[];
const shopFixture=fixture(7);s.world.addresses={entries:[shopFixture],shared:0};
const t=RADE.interiors.create(s.world,s.sim,{notify:m=>messages.push(m)}),camp=s.campaign;
function enterType(type){const pi=shopFixture.places.findIndex(p=>p.type===type);assert(pi>=0);s.sim.relocate(shopFixture.x,shopFixture.z);assert(t.enter(shopFixture,pi),'enter '+type);return t.active;}
function at(q){s.sim.relocate(q.x,q.z);}
let room=enterType('restaurant'),food=room.services.find(q=>q.kind==='food');s.sim.state.player.hp=90;camp.state.cash=100;at(food);assert.equal(t.useService(food.id,camp),true);assert.equal(camp.state.cash,88);assert.equal(s.sim.state.player.hp,100);
s.sim.state.player.hp=60;camp.state.cash=100;at(food);assert.equal(t.useService(food.id,camp),true);assert.equal(s.sim.state.player.hp,85);assert.equal(camp.state.cash,88);
s.sim.state.player.hp=100;camp.state.cash=100;at(food);assert.equal(t.useService(food.id,camp),false);assert.equal(camp.state.cash,100);assert.equal(s.sim.state.player.hp,100);
s.sim.state.player.hp=50;camp.state.cash=11;at(food);assert.equal(t.useService(food.id,camp),false);assert.equal(camp.state.cash,11);assert.equal(s.sim.state.player.hp,50);
s.sim.state.player.hp=0;camp.state.cash=100;at(food);assert.equal(t.useService(food.id,camp),false);assert.equal(camp.state.cash,100);assert.equal(s.sim.state.player.hp,0);
assert(t.leave());checks.push('Restauration : soin borné à 100, débit 12 €, refus à PV pleins, sans argent ou à terre');
s.sim.state.player.hp=70;
room=enterType('public');const plan=room.services.find(q=>q.kind==='plan');camp.state.mapOwned=false;camp.state.cash=50;at(plan);assert.equal(t.useService(plan.id,camp),true);assert.equal(camp.state.mapOwned,false);assert.equal(camp.state.cash,50);assert.equal(t.useService(plan.id,camp),true);assert.equal(camp.state.mapOwned,false);assert.equal(camp.state.cash,50);assert(!t.purchased.has(plan.id));
assert(t.leave());checks.push('Accueil public : renseignements sans carte possédée ni débit, même après consultation répétée');
room=enterType('commerce');const map=room.services.find(q=>q.kind==='map');camp.state.mapOwned=false;camp.state.cash=100;at(map);assert.equal(t.useService(map.id,camp),true);assert.equal(camp.state.cash,40);assert.equal(t.useService(map.id,camp),false);assert.equal(camp.state.cash,40);
assert(t.leave());checks.push('Plan payant : un seul débit de 60 €, doublon refusé');
room=enterType('armurerie');const weapon=room.services.find(q=>q.kind==='weapon'&&q.weapon===0),inventory=s.sim.state.inventory,oldWeapons=inventory.weapons.slice(),oldWeapon=s.sim.state.weapon;assert(weapon);inventory.weapons[0]=true;camp.state.cash=77;at(weapon);assert.equal(t.useService(weapon.id,camp),true);assert.equal(s.sim.state.weapon,0);assert.equal(camp.state.cash,77);inventory.weapons=[...oldWeapons];if(typeof s.sim.selectWeapon==='function')s.sim.selectWeapon(oldWeapon);
assert(t.leave());checks.push('Armurerie : équipe un indice d’arme de simulation existant, sans débit ni munitions inventées');
const multi=fixture(8,['commerce','restaurant']);s.world.addresses={entries:[multi],shared:0};
const m=RADE.interiors.create(s.world,s.sim,{notify:()=>{}});s.sim.relocate(multi.x,multi.z);assert(m.enter(multi,0));const originalMerchant=m.active.merchant.id,oldScene=m.active.sceneId,oldId=m.active.building.id,hall=m.active.portals.find(q=>q.placeIndex===-1);assert(hall);s.sim.relocate(hall.x,hall.z);assert(m.interact(camp));assert.equal(m.active.placeIndex,-1);const portal=m.active.portals.find(q=>q.placeIndex===1);assert(portal);s.sim.relocate(portal.x,portal.z);const choice=m.context();assert.equal(choice.action,'local');assert.equal(choice.placeIndex,1);assert(m.interact(camp));assert.equal(m.active.placeIndex,1);assert.notEqual(m.active.merchant.id,originalMerchant);assert.notEqual(m.active.sceneId,oldScene);assert.equal(m.active.building.id,oldId);assert(m.leave());
checks.push('Plusieurs commerces : portail nommé change de placeIndex sans changer la porte extérieure');
s.world.addresses=oldAddresses;
s.sim.state.player.hp=63;const target=i.entries.find(b=>b.floors>1&&Math.abs(b.x)<300&&Math.abs(b.z)<300);assert(target);s.sim.relocate(target.x,target.z);assert(i.enter(target,0));s.sim.relocate(i.active.stairs.up.x,i.active.stairs.up.z);assert(i.interact(camp));assert.equal(i.active.floor,1);const placeIndex=i.active.placeIndex,save=s.save(),restored=RADE.session.create({pedestrians:0,saved:save});assert.equal(restored.interiors.active.building.id,target.id);assert.equal(restored.interiors.active.floor,1);assert.equal(restored.interiors.active.placeIndex,placeIndex);const outsideId=restored.interiors.active.building.id;assert(restored.interiors.leave());assert.equal(restored.interiors.active,null);assert.equal(restored.world.room,null);assert.equal(restored.player.x<900,true);assert.equal(outsideId,target.id);assert.equal(restored.player.hp,63);
checks.push('Escaliers, sauvegarde/reprise du placeIndex, sortie hors de l’ancien bâtiment, aucun soin gratuit');
const police=i.entries.find(b=>b.places.some(p=>p.kind==='police'));assert(police,'Real sourced police station in extended bounds');assert(i.respawnPolice());assert.equal(i.active.place.kind,'police');for(const feature of ['police','holding-cell','administration'])assert(i.active.features.includes(feature));assert(i.active.place.address.includes('42'));assert(i.leave());checks.push('Repopulation au commissariat réel, 42 La Canebière, accueil et cellule procéduraux');
for(const b of [fixture(10,['logement'])])assert.notEqual(i.roomFor(b,1).layoutVariant,i.roomFor(b,2).layoutVariant,'different apartment floors');
fs.writeFileSync(new URL('../docs/interiors-acceptance.json',import.meta.url),JSON.stringify({buildings:i.entries.length,passages:i.shared,types,checks},null,2)+'\n');
console.log({buildings:i.entries.length,passages:i.shared,types,checks});
