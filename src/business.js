/* EMPRISE — fictional shop dealings, protection contracts and persistent hotel loot. */
(function(R){
'use strict';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const shops=new Set(['commerce','supermarche','restaurant','kebab','hotel','garage','armurerie']);
const hash=value=>{let n=2166136261;for(const c of String(value))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
const finite=(n,f=0)=>Number.isFinite(n)?n:f;
const itemNames={bandage:'bandage',provision:'provision',valuable:'objet de valeur',ammo:'boîte de munitions'};

function prepare(world){
 if(Array.isArray(world.businessSlots))return world.businessSlots;
 const enemies=world.combatWorld.enemies,spawn=world.combatWorld.spawn;
 world.businessSlots=[];
 for(let i=0;i<8;i++){
  world.businessSlots.push(enemies.length);
  enemies.push({x:spawn.x,z:spawn.z+35,y:.08,yaw:0,type:i%2,gang:1,radeReserve:true,businessReserve:true});
 }
 return world.businessSlots;
}

function create(world,sim,{interiors,campaign,saved=null,notify=()=>{}}={}){
 const p=sim.state.player,registry=new Map(),records=new Map(),claimed=new Set(),residents=new Map();
 const slots=(world.businessSlots||[]).filter(id=>sim.state.enemies[id]?.businessReserve);
 const initial=new Map(slots.map(id=>[id,structuredClone(sim.state.enemies[id])]));
 const inventory={bandage:0,provision:0,valuable:0,ammo:0};
 let clock=0,mission=null,roomRef=null,roomLoot=[],earned=0,income=0,raid=null,retreats=[],nextRaidAt=480,raidCount=0,raidCheckAt=0;
 for(const building of interiors?.entries||world.addresses?.entries||[]){
  for(const place of building.places||[]){
   if(place.kind==='police'||!shops.has(place.type)&&!place.shop)continue;
   const key=building.id+'/'+String(place.id);
   registry.set(key,{key,building,place});
  }
 }
 const keyFor=(building,place)=>building.id+'/'+String(place.id);
 function record(key){
  if(!records.has(key)){
   const n=hash(key);
   records.set(key,{status:'independent',gang:1+n%3,rivalGang:1+n%3,eligibleAt:clock+480+n%181,lastRaid:null,rate:24+n%25,robUntil:0,extortUntil:0,earned:0,closed:false});
  }
  return records.get(key);
 }
 function bank(amount){if(!campaign?.state||!Number.isFinite(campaign.state.cash))return false;campaign.state.cash=Math.max(0,campaign.state.cash+amount);return true;}
 function crime(amount,building){
  campaign?.crime(amount);
  if(building&&campaign?.law)campaign.law.lastKnown={x:building.x,z:building.z};
 }
 function rememberRoom(){
  if(!roomRef)return;
  for(const e of roomRef.civil||[])if(e.businessResident){
   residents.set(e.id,{id:e.id,x:e.x,z:e.z,hp:e.hp,yaw:e.yaw,injury:e.injury?{...e.injury}:null});
  }
 }
 function freeSpot(room,wanted,avoid=[]){
  for(let radius=0;radius<=2.5;radius+=.5)for(let k=0;k<(radius?12:1);k++){
   const a=k*Math.PI/6,x=wanted.x+Math.cos(a)*radius,z=wanted.z+Math.sin(a)*radius;
   if((room.staticBlocked||room.blocked)(x,z,.31)||avoid.some(q=>Math.hypot(q.x-x,q.z-z)<1.05))continue;
   return {x,z};
  }
  return null;
 }
 function ensureRoom(){
  const room=interiors?.active||null;
  if(room===roomRef)return room;
  rememberRoom();roomRef=room;roomLoot=[];
  if(!room)return null;
  // All residents are physical people using the existing rendering/hit system.
  const avoid=[p,room.spawn,room.exit,...Object.values(room.stairs||{}),...(room.services||[]),...(room.portals||[]),...(room.civil||[])];
  const anchors=room.zones?.length?room.zones.filter(q=>q.kind!=='bathroom'):[{x:1000-3,z:1000+1},{x:1000+3,z:1000+2}];
  const wantedCount=Math.min(room.type==='hotel'?3:2,anchors.length);
  for(let j=0;j<wantedCount;j++){
   const id=500000000+hash(room.sceneId+':resident:'+j),savedPerson=residents.get(id);
   const candidate=savedPerson&&!room.blocked(savedPerson.x,savedPerson.z,.31)?savedPerson:anchors[j];
   const spot=freeSpot(room,candidate,avoid);
   if(!spot)continue;
   const e={id,...spot,baseY:.08,y:.08,hp:100,yaw:0,civil:true,merchant:false,businessResident:true,moveSpeed:0,nextWalk:clock+2+j,homeX:spot.x,homeZ:spot.z};
   if(savedPerson)Object.assign(e,{hp:clamp(finite(savedPerson.hp,100),0,100),yaw:finite(savedPerson.yaw),injury:savedPerson.injury||null});
   room.civil.push(e);avoid.push(e);
  }
  const staticBlocked=room.blocked;
  room.staticBlocked=staticBlocked;
  room.blocked=(x,z,r=.28,y=.08,height=1.8)=>staticBlocked(x,z,r,y,height)||room.civil.some(e=>e.hp>0&&Math.hypot(e.x-x,e.z-z)<r+.24);
  if(room.type==='hotel'&&room.floor>0){
   const hotel=room.building.places.find(place=>place.type==='hotel');
   const hotelKey=hotel?keyFor(room.building,hotel):room.building.id;
   room.zones.filter(q=>q.kind==='bedroom').forEach((q,j)=>{
    roomLoot.push({id:hotelKey+':floor:'+room.floor+':room:'+j,x:q.x,z:q.z,room:j+1});
   });
  }
  return room;
 }
 function shopHere(){
  const room=ensureRoom();
  if(!room||room.floor!==0||!room.place)return null;
  const entry=registry.get(keyFor(room.building,room.place));
  if(!entry)return null;
  const anchors=(room.services||[]).filter(s=>s.kind!=='weapon');
  const fallback=room.merchant?{x:room.merchant.x,z:room.merchant.z+1.65}:{x:1000,z:1000-4.8};
  const candidates=anchors.length?anchors:[fallback];
  const anchor=candidates.map(q=>({...q,distance:Math.hypot(q.x-p.x,q.z-p.z)})).sort((a,b)=>a.distance-b.distance)[0];
  if(!anchor||anchor.distance>1.8)return null;
  return {...entry,room,anchor,distance:anchor.distance,data:record(entry.key)};
 }
 function nearestLoot(){
  ensureRoom();
  return roomLoot.map(q=>({...q,distance:Math.hypot(q.x-p.x,q.z-p.z)})).filter(q=>q.distance<1.6).sort((a,b)=>a.distance-b.distance)[0]||null;
 }
 function ammoOffer(){const weapon=sim.state.weapon||0,amount=[24,6,2][weapon]||24;return {item:'ammo',price:35,amount,label:amount+' '+['cartouches de mitraillette','cartouches de pompe','roquettes'][weapon]+' · 35 €'};}
 function ammoFull(){const weapon=sim.state.weapon||0;return !sim.state.inventory?.ammo||!Number.isFinite(sim.ammoCaps?.[weapon])||sim.state.inventory.ammo[weapon]>=sim.ammoCaps[weapon];}
 function offer(entry){
  const type=entry.place.type;
  if(type==='restaurant'||type==='kebab'||type==='supermarche'||type==='hotel')return {item:'provision',price:12,label:'Acheter une provision · 12 €'};
  if(type==='armurerie'){const goods=ammoOffer();return {...goods,label:'Acheter '+goods.label};}
  return {item:'bandage',price:25,label:'Acheter un bandage · 25 €'};
 }
 function streetAt(x,z){
  let best='',distance=25;
  for(const edge of world.city.rues.aretes){
   if(!edge.nom)continue;
   for(let i=2;i<edge.points.length;i+=2){
    const a=edge.points[i-2],b=edge.points[i-1],dx=edge.points[i]-a,dz=edge.points[i+1]-b;
    const t=clamp(((x-a)*dx+(z-b)*dz)/(dx*dx+dz*dz||1),0,1),d=Math.hypot(x-a-dx*t,z-b-dz*t);
    if(d<distance){distance=d;best=edge.nom;}
   }
  }
  return best;
 }
 function locationHint(entry,boss){
  const dx=boss.x-entry.building.x,dz=boss.z-entry.building.z;
  const dir=['est','sud-est','sud','sud-ouest','ouest','nord-ouest','nord','nord-est'][(Math.round(Math.atan2(dz,dx)/(Math.PI/4))+8)%8];
  const street=streetAt(boss.x,boss.z);
  return (street?street+' · ':'')+'environ '+Math.round(Math.hypot(dx,dz)/10)*10+' m au '+dir+' du commerce';
 }
 function consume(item){
  if(!['bandage','provision'].includes(item)||!inventory[item]||p.hp<=0||p.hp>=100)return false;
  inventory[item]--;p.hp=Math.min(100,p.hp+(item==='bandage'?35:20));notify('Soins utilisés.');return true;
 }
 function missionView(){
  if(!mission)return null;
  const entry=registry.get(mission.key),boss=sim.state.enemies[mission.enemyId];
  return {stage:mission.stage,placeId:entry?.place.id,buildingId:entry?.building.id,name:entry?.place.name||'Commerce',
   label:mission.stage==='return'?'Retourner voir '+(entry?.place.name||'le commerçant'):'Responsable de '+(R.campaign.GANGS[mission.gang]?.name||'la faction rivale')+' · '+mission.hint,hint:mission.hint,
   x:mission.stage==='return'?entry?.building.x:boss?.x,z:mission.stage==='return'?entry?.building.z:boss?.z,enemyId:mission.enemyId,fictional:true};
 }
 function context(){
  const loot=nearestLoot();
  if(loot)return {kind:'business',label:'E · Fouiller la chambre '+loot.room,distance:loot.distance,place:roomRef.building,
   status:claimed.has(loot.id)?'Déjà fouillée':'Bagage laissé dans la chambre',actions:[{id:'loot:'+loot.id,label:claimed.has(loot.id)?'Bagage vide':'Fouiller le bagage',disabled:claimed.has(loot.id)}],inventory:{...inventory},mission:missionView(),income};
  const q=shopHere();if(!q)return null;
  const living=!q.room.merchant||q.room.merchant.hp>0,owned=q.data.status==='protected',goods=offer(q);
  const actions=[{id:'buy',label:goods.label,disabled:!living||(campaign?.state.cash||0)<goods.price||inventory[goods.item]>=20||goods.item==='ammo'&&ammoFull()},
   {id:'rob',label:'Voler la caisse',disabled:owned||clock<q.data.robUntil},
   {id:'extort',label:'Racketter le commerçant',disabled:!living||owned||clock<q.data.extortUntil},
   {id:'protect',label:owned?'Protection en place':'Proposer sa protection',disabled:!living||owned||!!mission||!!raid}];
  if(owned)actions.push({id:'resupply',label:'Réapprovisionnement du réseau · '+ammoOffer().label,disabled:!living||(campaign?.state.cash||0)<35||ammoFull()});
  if(!campaign.state.mapOwned)actions.push({id:'buy_map',label:'Acheter un plan papier · 60 €',disabled:!living||campaign.state.cash<60});
  if(mission?.key===q.key&&mission.stage==='return')actions.push({id:'claim',label:'Confirmer la protection · +'+q.data.rate+' €/min',disabled:!living});
  if(inventory.provision)actions.push({id:'use_provision',label:'Consommer une provision · +20 PV',disabled:p.hp>=100});
  if(inventory.bandage)actions.push({id:'use_bandage',label:'Utiliser un bandage · +35 PV',disabled:p.hp>=100});
  if(inventory.valuable)actions.push({id:'sell',label:'Vendre un objet de valeur · 30 €',disabled:!living});
  return {kind:'business',label:'E · '+(q.place.name||'Commerce'),distance:q.distance,place:q.place,buildingId:q.building.id,
   status:owned?(raid?.key===q.key&&occupying()?'Seuil occupé · revenus suspendus':'Votre protection · '+q.data.rate+' €/min'):living?'Affaires de quartier':'Commerçant hors d’état de servir',actions,inventory:{...inventory},mission:missionView(),income};
 }
 // Retaliation targets a known shop entrance, never an unseen player position.
 const raidRules={warning:90,assault:150,occupation:60,globalCooldown:480,shopCooldown:1080};
 function inStreet(x,z,r=.5){const b=world.bounds;return Number.isFinite(x)&&Number.isFinite(z)&&(!b||x>b.minX+r&&x<b.maxX-r&&z>b.minZ+r&&z<b.maxZ-r)&&!world.blocked(x,z,r);}
 function clearStreet(a,b){const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);return d<.1||[.55,1.4].every(y=>world.ray([a.x,y,a.z],[dx/d,0,dz/d],d)>=d-.1);}
 function visibleSpawn(q){if(interiors?.active||p.hp<=0)return false;const dx=q.x-p.x,dz=q.z-p.z,d=Math.hypot(dx,dz);return d<12||d<135&&[.55,1.4].some(y=>{const dy=y-(finite(p.y,.08)+1.6),length=Math.hypot(d,dy);return world.ray([p.x,finite(p.y,.08)+1.6,p.z],[dx/length,dy/length,dz/length],length)>=length-.1;});}
 function raidActors(){return raid?raid.ids.map(id=>sim.state.enemies[id]).filter(e=>e?.hp>0&&e.deployed):[];}
 function occupying(){return !!raid&&raid.stage==='assault'&&raidActors().some(e=>Math.hypot(e.x-raid.x,e.z-raid.z)<8&&clearStreet(e,raid));}
 function defending(){return p.hp>0&&!interiors?.active&&Math.hypot(p.x-raid.x,p.z-raid.z)<12&&clearStreet(p,raid);}
 function guide(e,target){if(e.seen||e.hasMemory)return;Object.assign(e,{hasMemory:true,memory:8,lastSeenX:target.x,lastSeenZ:target.z,lastSeenY:1.45,awareness:'investigate',alert:.45,goalX:target.x,goalZ:target.z,planWait:0,thinkWait:0});}
 function guideRetreat(e,target){
  // A retreat order uses the normal navigator, but ends fire and perception of the player.
  if(e.seen||Math.hypot(e.lastSeenX-target.x,e.lastSeenZ-target.z)>.1)e.hasMemory=false;
  e.seen=false;e.senseWait=Math.max(finite(e.senseWait),1);e.windup=e.burstLeft=e.rushTime=0;e.cooldown=Math.max(finite(e.cooldown),1);e.attackState='recover';guide(e,target);
 }
 function actorSnapshot(e){return {id:e.id,x:e.x,z:e.z,hp:e.hp,yaw:e.yaw,injury:e.injury?{...e.injury}:null,hasMemory:!!e.hasMemory,lastSeenX:e.lastSeenX,lastSeenZ:e.lastSeenZ,memory:e.memory};}
 function restoreActor(v,key,gang,retreat=false){
  if(!v||!slots.includes(v.id)||![v.x,v.z,v.hp].every(Number.isFinite)||!inStreet(v.x,v.z,.1))return null;
  const e=sim.state.enemies[v.id],base=initial.get(v.id);Object.assign(e,structuredClone(base),{x:v.x,z:v.z,baseY:.08,y:.08+(base.type===1?1.05:1.35),yaw:finite(v.yaw),hp:clamp(v.hp,0,base.maxHp),gang,deployed:true,combatEnabled:true,encounterReleased:true,businessMission:false,businessRaid:!retreat,businessRetreat:retreat,businessKey:key,injury:v.injury||null,seen:false,hasMemory:false,memory:0,alert:0,goalX:v.x,goalZ:v.z});
  if(v.hasMemory&&Number.isFinite(v.lastSeenX)&&Number.isFinite(v.lastSeenZ)){const b=world.bounds;if(!b||v.lastSeenX>b.minX&&v.lastSeenX<b.maxX&&v.lastSeenZ>b.minZ&&v.lastSeenZ<b.maxZ)Object.assign(e,{hasMemory:true,lastSeenX:v.lastSeenX,lastSeenZ:v.lastSeenZ,lastSeenY:1.45,memory:clamp(finite(v.memory),0,10),awareness:'search'});}
  Object.assign(world.combatWorld.enemies[v.id],{x:v.x,z:v.z});return e;
 }
 function retireRaid(){
  for(const e of raidActors()){
   const dx=e.x-raid.x,dz=e.z-raid.z,d=Math.hypot(dx,dz)||1;let target={x:e.x+dx/d*24,z:e.z+dz/d*24};
   try{const q=world.freeNear(target.x,target.z,.6);target={x:q[0],z:q[1]};}catch{target={x:e.x,z:e.z};}
   retreats.push({id:e.id,key:raid.key,gang:raid.gang,...target});e.businessRaid=false;e.businessRetreat=true;guideRetreat(e,target);
  }
 }
 function finishRaid(result){
  const entry=registry.get(raid.key),data=record(raid.key);retireRaid();data.eligibleAt=clock+raidRules.shopCooldown;data.lastRaid=result;
  if(result==='lost'){data.status='independent';data.gang=raid.gang;notify('Protection perdue · '+entry.place.name+' · revenus interrompus. Le contrat peut être repris au comptoir.');}
  else notify((result==='deferred'?'Représailles reportées':'Commerce défendu')+' · '+entry.place.name+' · votre protection est conservée.');
  raid=null;nextRaidAt=clock+raidRules.globalCooldown+hash(entry.key+':'+raidCount)%181;
 }
 function updateRetreats(){
  retreats=retreats.filter(q=>{const e=sim.state.enemies[q.id];if(!e||e.hp<=0)return false;
   if(!e.seen&&!visibleSpawn(e)&&Math.hypot(e.x-p.x,e.z-p.z)>28){e.deployed=false;e.combatEnabled=false;e.encounterReleased=false;e.businessRetreat=false;e.hasMemory=false;e.memory=0;return false;}
   guideRetreat(e,q);return true;
  });
 }
 function deployRaid(){
  const available=slots.filter(id=>!sim.state.enemies[id].deployed||sim.state.enemies[id].hp<=0).slice(0,2);if(available.length<2)return false;
  const spots=[],entry=registry.get(raid.key),angle=Math.atan2(entry.building.nz||0,entry.building.nx||1);
  for(let ring=4;ring<=7&&spots.length<2;ring+=1.5)for(let j=0;j<24&&spots.length<2;j++){
   const a=angle+j*Math.PI/12,q={x:raid.x+Math.cos(a)*ring,z:raid.z+Math.sin(a)*ring};
   if(!inStreet(q.x,q.z,.6)||visibleSpawn(q)||!clearStreet(q,raid)||spots.some(s=>Math.hypot(q.x-s.x,q.z-s.z)<2)||sim.state.enemies.some(e=>e.deployed&&e.hp>0&&Math.hypot(q.x-e.x,q.z-e.z)<1.4))continue;spots.push(q);
  }
  if(spots.length<2)return false;
  raid.ids=available;raid.stage='assault';raid.remaining=raidRules.assault;raid.hold=0;
  for(let i=0;i<available.length;i++){const id=available[i],base=initial.get(id),e=restoreActor({id,...spots[i],hp:base.maxHp},raid.key,raid.gang);guide(e,raid);}
  notify('Représailles · '+entry.place.name+' · deux assaillants au seuil. Défendez la rue : 60 s d’occupation sans opposition font perdre la protection.');return true;
 }
 function updateRaids(dt){
  updateRetreats();
  if(raid&&campaign?.state)campaign.state.nextRaid=Math.max(finite(campaign.state.nextRaid),raid.remaining+30);
  if(p.hp<=0||campaign?.state.raid||campaign?.state.active)return;
  if(!raid){
   if(mission||clock<nextRaidAt||clock<raidCheckAt)return;raidCheckAt=clock+15;
   const candidates=[...records].filter(([key,v])=>v.status==='protected'&&!v.closed&&clock>=v.eligibleAt).sort((a,b)=>a[1].eligibleAt-b[1].eligibleAt||hash(a[0])-hash(b[0]));
   const selected=candidates.find(([key])=>{const b=registry.get(key).building;return inStreet(b.x,b.z,.35);});if(!selected)return;
   const [key,data]=selected,entry=registry.get(key);raidCount++;raid={key,gang:data.rivalGang,stage:'warning',remaining:raidRules.warning,retry:60,hold:0,x:entry.building.x,z:entry.building.z,ids:[]};
   if(campaign?.state)campaign.state.nextRaid=Math.max(finite(campaign.state.nextRaid),raidRules.warning+raidRules.assault+30);
   notify('Avertissement · '+entry.place.name+' · '+(entry.place.address||entry.building.address||'adresse du commerce')+' · '+R.campaign.GANGS[raid.gang].name+' prépare des représailles. Vous avez 90 s pour rejoindre le seuil extérieur.');return;
  }
  if(record(raid.key).closed||record(raid.key).status!=='protected'){finishRaid('deferred');return;}
  if(raid.stage==='warning'){
   if(raid.remaining>0){const before=raid.remaining;raid.remaining=Math.max(0,raid.remaining-dt);if(raid.remaining>0)return;dt=Math.max(0,dt-before);}
   raid.retry=Math.max(0,raid.retry-dt);if(clock<raidCheckAt)return;raidCheckAt=clock+3;
   if(!deployRaid()&&raid.retry<=0)finishRaid('deferred');return;
  }
  if(!raidActors().length){finishRaid('defended');return;}
  const occupied=occupying(),present=defending();raid.remaining=Math.max(0,raid.remaining-dt);raid.hold=occupied&&!present?Math.min(raidRules.occupation,raid.hold+dt):Math.max(0,raid.hold-dt*.5);
  for(const e of raidActors())guide(e,raid);
  if(raid.hold>=raidRules.occupation)finishRaid('lost');else if(raid.remaining<=0)finishRaid(present||!occupied?'defended':'lost');
 }
 function raidView(){if(!raid)return null;const entry=registry.get(raid.key),paused=p.hp<=0||!!campaign?.state.raid||!!campaign?.state.active;return {key:raid.key,stage:raid.stage,name:entry.place.name,address:entry.place.address||entry.building.address||'',buildingId:entry.building.id,placeId:entry.place.id,gang:raid.gang,timer:raid.remaining,hold:raid.hold,holdRequired:raidRules.occupation,attackers:raidActors().length,paused,occupied:occupying(),hint:'Seuil extérieur · '+(entry.place.address||entry.building.address||entry.place.name),label:raid.stage==='warning'?'Rejoindre le commerce menacé':'Défendre le seuil extérieur',fictional:true};}

 function spawnBoss(entry,gang){
  const id=slots.find(id=>{const e=sim.state.enemies[id];return !e.deployed||e.hp<=0;});
  if(id===undefined)return null;
  const b=entry.building,seed=hash(entry.key),baseAngle=Math.atan2(b.nz||0,b.nx||1);
  let spot=null;
  for(let j=0;j<24;j++){
   const a=baseAngle+j*Math.PI/12,radius=38+(seed%19),x=b.x+Math.cos(a)*radius,z=b.z+Math.sin(a)*radius;
   let q;try{q=world.freeNear(x,z,.65);}catch{continue;}const bounds=world.bounds;
   if(bounds&&(q[0]<bounds.minX+5||q[0]>bounds.maxX-5||q[1]<bounds.minZ+5||q[1]>bounds.maxZ-5))continue;
   if(Math.hypot(q[0]-b.x,q[1]-b.z)<24||world.blocked(q[0],q[1],.6))continue;
   spot={x:q[0],z:q[1]};break;
  }
  if(!spot)return null;
  const e=sim.state.enemies[id],base=initial.get(id);
  Object.assign(e,structuredClone(base),spot,{baseY:.08,y:.08+(base.type===1?1.05:1.35),hp:base.maxHp,deployed:true,combatEnabled:true,encounterReleased:true,
   gang,businessMission:true,businessRaid:false,businessRetreat:false,businessKey:entry.key,injury:null,hasMemory:false,seen:false,memory:0,alert:0,awareness:'patrol',goalX:spot.x,goalZ:spot.z});
  Object.assign(world.combatWorld.enemies[id],spot);
  return id;
 }
 function act(action){
  if(action==='use_provision'||action==='use_bandage')return consume(action.slice(4));
  const c=context();if(!c)return false;
  const chosen=c.actions.find(q=>q.id===action);if(!chosen||chosen.disabled||p.hp<=0)return false;
  if(action.startsWith('loot:')){
   const q=nearestLoot();if(!q||action!=='loot:'+q.id||claimed.has(q.id))return false;
   const n=hash(q.id),cash=18+n%63,item=['bandage','provision','valuable'][n%3];
   if(!bank(cash))return false;claimed.add(q.id);inventory[item]=Math.min(99,inventory[item]+1);
   crime(.5,roomRef.building);notify('Chambre fouillée · +'+cash+' € · '+itemNames[item]);return true;
  }
  const q=shopHere();if(!q)return false;
  if(action==='buy_map'){if(campaign.state.mapOwned||campaign.state.cash<60||!bank(-60))return false;campaign.state.mapOwned=true;notify('Plan acheté · M / Retour pour le consulter');return true;}
  if(action==='buy'||action==='resupply'){
   const goods=action==='resupply'?ammoOffer():offer(q);if((campaign?.state.cash||0)<goods.price)return false;
   if(goods.item==='ammo'){
    const weapon=sim.state.weapon||0,caps=sim.ammoCaps,bag=sim.state.inventory;
    if(!bag?.ammo||bag.ammo[weapon]>=caps[weapon]){notify('Munitions déjà au maximum.');return false;}
    if(!bank(-goods.price))return false;bag.ammo[weapon]=Math.min(caps[weapon],bag.ammo[weapon]+goods.amount);notify('Munitions achetées · −35 €');return true;
   }
   if(!bank(-goods.price))return false;inventory[goods.item]++;notify(itemNames[goods.item]+' acheté · −'+goods.price+' €');return true;
  }
  if(action==='sell'){if(!inventory.valuable||!bank(30))return false;inventory.valuable--;notify('Objet vendu · +30 €');return true;}
  if(action==='rob'||action==='extort'){
   const n=hash(q.key),cash=action==='rob'?25+n%56:45+n%46;
   if(!bank(cash))return false;
   if(action==='rob')q.data.robUntil=clock+180;else q.data.extortUntil=clock+300;
   q.room.merchant&&(q.room.merchant.panic=8);crime(action==='rob'?1.3:1,q.building);
   notify((action==='rob'?'Caisse volée':'Racket obtenu')+' · +'+cash+' € · la police est alertée');return true;
  }
  if(action==='protect'){
   if(mission||raid||q.data.status==='protected')return false;
   const id=spawnBoss(q,q.data.gang);if(id===null){notify('Le responsable rival est indisponible.');return false;}
   mission={key:q.key,gang:q.data.gang,enemyId:id,stage:'hunt',hint:locationHint(q,sim.state.enemies[id])};q.data.status='contested';
   notify('Protection proposée · éliminez le responsable de '+R.campaign.GANGS[q.data.gang].name+', puis revenez ici.');return true;
  }
  if(action==='claim'){
   if(!mission||mission.key!==q.key||mission.stage!=='return')return false;
   q.data.status='protected';q.data.rivalGang=mission.gang;q.data.gang=0;q.data.eligibleAt=clock+480+hash(q.key)%181;mission=null;campaign.state.xp+=60;
   notify('Protection confirmée · '+q.data.rate+' €/min ; des représailles restent possibles');return true;
  }
  return false;
 }
 function update(dt,events=[]){
  dt=clamp(finite(dt),0,3600);clock+=dt;
  const room=ensureRoom();
  if(mission?.stage==='hunt'){
   const boss=sim.state.enemies[mission.enemyId];
   if(boss&&boss.hp<=0){mission.stage='return';notify('Responsable éliminé · retournez confirmer la protection au commerce.');}
  }
  income=0;
  if(room?.place&&room.merchant?.hp<=0&&registry.has(keyFor(room.building,room.place)))record(keyFor(room.building,room.place)).closed=true;
  const suspendedAtStart=occupying()?raid.key:null;updateRaids(dt);
  for(const [key,data] of records){
   if(data.status!=='protected'||data.closed)continue;
   if(room&&room.floor===0&&room.place&&keyFor(room.building,room.place)===key&&room.merchant?.hp<=0)continue;
   if(!(raid?.key===key&&occupying()))income+=data.rate;if(key===suspendedAtStart)continue;const credit=data.rate*dt/60;data.earned+=credit;earned+=credit;bank(credit);
  }
  if(!room)return;
  for(const e of room.civil){
   if(!e.businessResident||e.hp<=0)continue;
   if(clock>=e.nextWalk){
    const a=(hash(e.id+':'+Math.floor(clock/4))%628)/100;
    const goal=freeSpot(room,{x:e.homeX+Math.cos(a)*1.4,z:e.homeZ+Math.sin(a)*1.4},[room.exit,...Object.values(room.stairs)]);
    e.walkGoal=goal;e.nextWalk=clock+3+(e.id%3);e.moveSpeed=0;
   }
   const goal=e.walkGoal;if(!goal)continue;
   const dx=goal.x-e.x,dz=goal.z-e.z,d=Math.hypot(dx,dz),step=Math.min(d,.42*Math.min(dt,.1));
   if(d<.1){e.moveSpeed=0;continue;}
   const x=e.x+dx/d*step,z=e.z+dz/d*step;
   if(!(room.staticBlocked||room.blocked)(x,z,.3)&&Math.hypot(x-p.x,z-p.z)>.65&&!room.civil.some(o=>o!==e&&o.hp>0&&Math.hypot(o.x-x,o.z-z)<.6)){
    e.x=x;e.z=z;e.yaw=Math.atan2(dx,-dz);e.moveSpeed=.42;
   }else{e.moveSpeed=0;e.walkGoal=null;}
  }
 }
 function geometry(){
  ensureRoom();const out=[];
  for(const q of roomLoot){const empty=claimed.has(q.id);out.push({shape:'box',p:[q.x,.29,q.z],s:[.55,.42,.4],color:empty?[.20,.20,.19]:[.40,.24,.11],mat:7,room:true,collision:false});out.push({shape:'box',p:[q.x,.52,q.z],s:[.15,.035,.08],color:[.65,.62,.44],mat:0,room:true,collision:false});}
  return out;
 }
 function save(){
  rememberRoom();const boss=mission?sim.state.enemies[mission.enemyId]:null;
  return {version:2,clock,earned,nextRaidAt,raidCount,raidCheckAt,raid:raid?{...raid,actors:raid.ids.map(id=>actorSnapshot(sim.state.enemies[id]))}:null,retreats:retreats.map(q=>({...q,actor:actorSnapshot(sim.state.enemies[q.id])})),inventory:{...inventory},records:Object.fromEntries(records),claimed:[...claimed],residents:[...residents.values()],
   mission:mission?{...mission,boss:boss?{x:boss.x,z:boss.z,hp:boss.hp,injury:boss.injury||null}:null}:null};
 }
 if(saved?.version===1||saved?.version===2){
  clock=clamp(finite(saved.clock),0,1e9);earned=Math.max(0,finite(saved.earned));nextRaidAt=saved.version===2?clock+clamp(finite(saved.nextRaidAt,clock+480)-clock,0,660):clock+480;raidCount=clamp(Math.floor(finite(saved.raidCount)),0,1e8);raidCheckAt=clock+clamp(finite(saved.raidCheckAt,clock)-clock,0,15);
  for(const key of Object.keys(inventory))inventory[key]=clamp(Math.floor(finite(saved.inventory?.[key])),0,99);
  for(const [key,value] of Object.entries(saved.records||{})){
   if(!registry.has(key)||!value||typeof value!=='object')continue;
   const q=record(key);q.status=['independent','contested','protected'].includes(value.status)?value.status:'independent';q.gang=q.status==='protected'?0:clamp(Math.floor(finite(value.gang,q.gang)),1,3);
   q.robUntil=clock+clamp(finite(value.robUntil)-clock,0,180);q.extortUntil=clock+clamp(finite(value.extortUntil)-clock,0,300);q.earned=Math.max(0,finite(value.earned));q.closed=value.closed===true;q.rivalGang=clamp(Math.floor(finite(value.rivalGang,hash(key)%3+1)),1,3);q.eligibleAt=saved.version===2?clock+clamp(finite(value.eligibleAt,clock+480)-clock,0,1080):clock+480+hash(key)%181;q.lastRaid=['defended','lost','deferred'].includes(value.lastRaid)?value.lastRaid:null;
  }
  for(const id of Array.isArray(saved.claimed)?saved.claimed:[])if(typeof id==='string'&&id.length<250&&id.includes(':floor:'))claimed.add(id);
  for(const e of Array.isArray(saved.residents)?saved.residents:[])if(Number.isInteger(e?.id)&&[e.x,e.z,e.hp].every(Number.isFinite)&&e.x>970&&e.x<1030&&e.z>970&&e.z<1030)residents.set(e.id,{...e,hp:clamp(e.hp,0,100)});
  const m=saved.mission,b=m?.boss,bounds=world.bounds;
  if(m&&registry.has(m.key)&&slots.includes(m.enemyId)&&['hunt','return'].includes(m.stage)&&b&&[b.x,b.z,b.hp].every(Number.isFinite)&&(!bounds||b.x>bounds.minX&&b.x<bounds.maxX&&b.z>bounds.minZ&&b.z<bounds.maxZ)&&record(m.key).status!=='protected'){
   mission={key:m.key,enemyId:m.enemyId,gang:clamp(Math.floor(finite(m.gang,1)),1,3),stage:b.hp<=0?'return':'hunt'};
   const e=sim.state.enemies[m.enemyId],base=initial.get(m.enemyId);
   Object.assign(e,structuredClone(base),{x:b.x,z:b.z,hp:clamp(b.hp,0,base.maxHp),deployed:true,combatEnabled:true,encounterReleased:true,gang:mission.gang,businessMission:true,businessKey:m.key,goalX:b.x,goalZ:b.z,injury:b.injury||null});
   if(e.hp<=0)mission.stage='return';mission.hint=locationHint(registry.get(mission.key),e);
  }
  if(saved.version===2){
   const q=saved.raid,entry=q&&registry.get(q.key);if(!mission&&entry&&record(q.key).status==='protected'&&!record(q.key).closed&&['warning','assault'].includes(q.stage)){
    const actors=Array.isArray(q.actors)?q.actors:[],ids=Array.isArray(q.ids)?[...new Set(q.ids)].filter(id=>slots.includes(id)).slice(0,2):[];
    if(q.stage==='warning'||ids.length===2&&ids.every(id=>actors.some(a=>a?.id===id&&[a.x,a.z,a.hp].every(Number.isFinite)&&inStreet(a.x,a.z,.1)))){
     raid={key:q.key,gang:record(q.key).rivalGang,stage:q.stage,remaining:clamp(finite(q.remaining,q.stage==='warning'?90:150),0,q.stage==='warning'?90:150),retry:clamp(finite(q.retry,60),0,60),hold:clamp(finite(q.hold),0,60),x:entry.building.x,z:entry.building.z,ids:q.stage==='assault'?ids:[]};
     for(const id of raid.ids)restoreActor(actors.find(a=>a.id===id),raid.key,raid.gang);
    }
   }
   for(const q of (Array.isArray(saved.retreats)?saved.retreats:[]).slice(0,8)){if(!q||q.actor?.id!==q.id||!registry.has(q.key)||raid?.ids.includes(q.id)||mission?.enemyId===q.id||retreats.some(r=>r.id===q.id)||!inStreet(q.x,q.z,.1))continue;const e=restoreActor(q.actor,q.key,clamp(Math.floor(finite(q.gang,1)),1,3),true);if(e&&e.id===q.id)retreats.push({id:q.id,key:q.key,gang:e.gang,x:q.x,z:q.z});}
  }
 }
 for(const id of slots){const e=sim.state.enemies[id];if(e.hp>0&&e.deployed&&mission?.enemyId!==id&&!raid?.ids.includes(id)&&!retreats.some(q=>q.id===id)){e.deployed=false;e.combatEnabled=false;e.encounterReleased=false;}}
 update(0,[]);
 function journal(){
  return [...records].map(([key,data])=>{const q=registry.get(key);return {key,name:q.place.name||'Commerce',address:q.place.address||q.building.address||'',status:data.closed?'closed':data.status,gang:data.gang,rate:data.status==='protected'&&!data.closed&&!(raid?.key===key&&occupying())?data.rate:0,earned:data.earned,raid:raid?.key===key?raidView():null,lastRaid:data.lastRaid};});
 }
 return {context,act,consume,update,save,geometry,journal,registry,records,inventory,slots,get mission(){return missionView();},get raid(){return raidView();},get income(){return income;},get earned(){return earned;},get time(){return clock;}};
}
R.business={prepare,create};
})(globalThis.RADE);
