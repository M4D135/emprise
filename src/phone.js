/* EMPRISE — local fictional SMS contracts backed by the real solo economy. */
(function(R){'use strict';
const TYPES=['delivery','vehicle','protection'];
const REWARDS={delivery:150,vehicle:260,protection:180};
const CONTACTS={delivery:['dispatch','Le répartiteur'],vehicle:['workshop','Le mécano'],protection:['network','Le réseau']};
const STATUS=new Set(['offered','accepted','declined','completed','failed','info']);
const finite=(v,f=0)=>Number.isFinite(v)?v:f,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const clean=(s,n=120)=>typeof s==='string'?s.slice(0,n):'';
const clone=value=>structuredClone(value);
const colorNames={'#bb2729':'rouge','#e7e7db':'blanche','#18252f':'noire','#1a4c92':'bleue','#8f999c':'grise','#19594d':'verte','#c5a256':'dorée','#4b365d':'violette'};
const vehicleName=car=>(R.vehicles?.SPECS?.[car?.model]?.name||car?.model||'Véhicule')+(colorNames[car?.color]?' '+colorNames[car.color]:'');

function create(world,sim,{campaign,business,interiors,traffic,saved=null,notify=()=>{}}={}){
 const player=sim.state.player,registry=business?.registry||new Map();
 const entries=[...registry.values()].sort((a,b)=>String(a.key).localeCompare(String(b.key)));
 const messages=[],paid=new Set(),usedVehicles=new Set();
 let clock=0,nextOfferAt=15,serial=0,cursor=0,activeId=null,revision=0,lastDanger=-100,notice=null,lastVehiclePoint=null;
 const usable=s=>typeof s==='string'&&s.trim().length>4&&!/non renseign|inconnue|sans adresse/i.test(s);
 const address=entry=>[entry?.place.address,entry?.building.address].find(usable)||entry?.place.name||'Entrée du bâtiment';
 const located=entry=>[entry?.place.address,entry?.building.address].some(usable);
 const entryAt=key=>registry.get(key);
 const living=entry=>!!entry&&!business?.records.get(entry.key)?.closed;
 const vehicleAt=id=>(world.fleet||traffic?.cars||[]).find(c=>c.id===id);
 const activeMessage=()=>messages.find(m=>m.id===activeId&&m.status==='accepted')||null;
 function change(){revision++;}
 function trim(){while(messages.length>80){const i=messages.findIndex(m=>m.id!==activeId&&m.status!=='offered');if(i<0)break;messages.splice(i,1);}}
 function post(type,subject,text,contract=null,status='info'){
  const [threadId,from]=CONTACTS[type]||['network','Le réseau'];
  const m={id:'sms-'+(++serial),threadId,from,subject,text,createdAt:clock,read:false,status,contract};messages.push(m);trim();change();notice='SMS · '+from;return m;
 }
 function contractView(c){
  if(!c)return null;
  const source=entryAt(c.sourceKey),target=entryAt(c.targetKey),car=vehicleAt(c.vehicleId);
  const sourceAddress=address(source),targetAddress=address(target);
  let readout='',hint='';
  if(c.type==='delivery'){
   readout=c.stage==='pickup'?'Retirer une provision au comptoir':'Remettre le colis au comptoir';
   hint=c.stage==='pickup'?sourceAddress+' · achetez une provision si nécessaire':targetAddress+' · remise au commerçant, rez-de-chaussée';
  }else if(c.type==='vehicle'){
   readout=c.stage==='drive'?'Essai routier · '+Math.floor(c.distance||0)+' / 350 m':'Retourner au garage et s’arrêter';
   hint=(car?vehicleName(car):c.vehicleName||'Véhicule')+' · '+targetAddress+' · arrêt de 2 s devant le garage';
  }else{
   const mission=business?.mission;
   readout=mission?.buildingId===target?.building.id?mission.label:'Obtenir et confirmer la protection';
   hint=targetAddress+' · proposer la protection au comptoir, régler le conflit puis revenir confirmer';
  }
  return {...clone(c),reward:REWARDS[c.type],sourceName:source?.place.name||'',targetName:target?.place.name||'',sourceAddress,targetAddress,readout,hint};
 }
 function view(m){return {...clone(m),contract:contractView(m.contract)};}
 function closedTarget(c){return !living(entryAt(c.targetKey))||(c.type==='delivery'&&!living(entryAt(c.sourceKey)));}
 function fail(m,text){
  if(!m||m.status!=='accepted')return false;
  m.status='failed';m.read=false;activeId=null;lastVehiclePoint=null;nextOfferAt=clock+150;change();post(m.contract.type,'Contrat interrompu',text);return true;
 }
 function complete(m){
  if(!m||m.status!=='accepted'||paid.has(m.id)||!campaign?.state||!Number.isFinite(campaign.state.cash))return false;
  // The ledger and terminal status are set before money, so a re-entrant UI
  // callback or replayed update cannot pay this contract twice.
  paid.add(m.id);m.status='completed';m.read=false;activeId=null;lastVehiclePoint=null;
  if(m.contract.type==='vehicle')usedVehicles.add(m.contract.vehicleId);
  campaign.state.cash+=REWARDS[m.contract.type];campaign.state.xp=finite(campaign.state.xp)+25;
  nextOfferAt=clock+150;change();post(m.contract.type,'Travail réglé','C’est réglé. '+REWARDS[m.contract.type]+' € versés pour ce contrat.');return true;
 }
 function prepare(type){
  const available=entries.filter(e=>living(e)&&located(e));
  if(type==='delivery'){
   const sources=available.filter(e=>['restaurant','kebab','supermarche','hotel'].includes(e.place.type));
   const source=sources[cursor%sources.length];if(!source)return null;
   const targets=available.filter(e=>e.building.id!==source.building.id);
   const target=targets[cursor%targets.length];if(!target)return null;
   return {type,stage:'pickup',sourceKey:source.key,targetKey:target.key,reward:REWARDS[type],cargo:false};
  }
  if(type==='vehicle'){
   const garages=available.filter(e=>e.place.type==='garage');
   const target=garages[cursor%garages.length];
   const cars=(world.fleet||traffic?.cars||[]).filter(c=>['gti','r5'].includes(c.model)&&!c.ai&&!c.police&&!c.emergency&&!c.exploded&&!c.hidden&&!usedVehicles.has(c.id));
   const car=cars[cursor%cars.length];if(!target||!car)return null;
   return {type,stage:'drive',sourceKey:target.key,targetKey:target.key,vehicleId:car.id,vehicleModel:car.model,vehicleName:vehicleName(car),vehicleStart:{x:car.x,z:car.z},reward:REWARDS[type],distance:0,hold:0};
  }
  const targets=available.filter(e=>business.records.get(e.key)?.status!=='protected');
  const target=targets[cursor%targets.length];if(!target)return null;
  return {type,stage:'claim',sourceKey:target.key,targetKey:target.key,reward:REWARDS[type],started:false};
 }
 function nearestHint(point){
  let nearest=null,distance=Infinity;
  for(const entry of entries.filter(located)){const d=Math.hypot(entry.building.x-point.x,entry.building.z-point.z);if(d<distance){distance=d;nearest=entry;}}
  if(!nearest)return 'près du Vieux-Port';
  const dx=point.x-nearest.building.x,dz=point.z-nearest.building.z;
  const direction=['est','sud-est','sud','sud-ouest','ouest','nord-ouest','nord','nord-est'][(Math.round(Math.atan2(dz,dx)/(Math.PI/4))+8)%8];
  return 'environ '+Math.round(distance/10)*10+' m au '+direction+' de '+address(nearest);
 }
 function offer(){
  for(let attempt=0;attempt<TYPES.length;attempt++){
   const type=TYPES[cursor++%TYPES.length],c=prepare(type);if(!c)continue;
   const source=entryAt(c.sourceKey),target=entryAt(c.targetKey);
   let subject,text;
   if(type==='delivery'){
    subject='Livraison de provisions';text='Une provision à retirer chez '+source.place.name+' ('+address(source)+'), puis à remettre au comptoir de '+target.place.name+' ('+address(target)+'). Prévois l’achat sur place si ton sac est vide. Forfait : 150 €.';
   }else if(type==='vehicle'){
    subject='Essai mécanique';text='Fais rouler la '+c.vehicleName+' repérée '+nearestHint(c.vehicleStart)+'. Il me faut 350 m d’essai avec ce véhicule, puis un arrêt devant '+target.place.name+' ('+address(target)+'). Je paie le contrôle 260 € ; le véhicule reste disponible après.';
   }else{
    subject='Étendre le réseau';text='Passe chez '+target.place.name+' ('+address(target)+'). Négocie la protection au comptoir, règle le conflit du clan en place et reviens confirmer l’accord. Prime du réseau : 180 €, en plus des revenus du commerce.';
   }
   post(type,subject,text,c,'offered');nextOfferAt=clock+150;return true;
  }
  nextOfferAt=clock+120;return false;
 }
 function read(id){const m=messages.find(m=>m.id===id);if(!m)return null;if(!m.read){m.read=true;change();}return view(m);}
 function open(id){
  if(!id)return messages.map(view);
  if(messages.some(m=>m.id===id))return read(id);
  const thread=messages.filter(m=>m.threadId===id);let changed=false;
  for(const m of thread)if(!m.read){m.read=true;changed=true;}if(changed)change();return thread.map(view);
 }
 function respond(id,answer){
  const m=messages.find(m=>m.id===id);
  if(!m||m.status!=='offered'||!m.contract||!['accept','decline'].includes(answer))return false;
  if(answer==='decline'){m.status='declined';m.read=true;nextOfferAt=clock+120;change();return true;}
  if(activeMessage()||player.hp<=0||closedTarget(m.contract))return false;
  const c=m.contract,target=entryAt(c.targetKey);
  if(c.type==='vehicle'){
   const car=vehicleAt(c.vehicleId);if(!car||car.exploded||usedVehicles.has(car.id))return false;
  }
  if(c.type==='protection'&&(business.records.get(target.key)?.status==='protected'||business.mission))return false;
  m.status='accepted';m.read=true;activeId=m.id;lastVehiclePoint=null;change();return true;
 }
 function atCounter(entry){
  const room=interiors?.active;if(!entry||!room||room.floor!==0||room.building?.id!==entry.building.id||room.place?.id!==entry.place.id||room.merchant?.hp<=0)return false;
  const anchors=(room.services||[]).filter(s=>s.kind!=='weapon');
  if(!anchors.length&&room.merchant)anchors.push({x:room.merchant.x,z:room.merchant.z+1.65});
  return anchors.some(a=>Math.hypot(player.x-a.x,player.z-a.z)<=1.8);
 }
 function update(dt,events=[],context={}){
  dt=clamp(finite(dt),0,60);clock+=dt;
  if(events.some(e=>['shot','hurt','kill','fracture','explosion'].includes(e?.name)))lastDanger=clock;
  const danger=player.hp<=0||finite(campaign?.law?.wanted)>0||clock-lastDanger<6;
  if(notice&&!danger){notify(notice);notice=null;}
  const m=activeMessage();
  if(m){
   const c=m.contract,source=entryAt(c.sourceKey),target=entryAt(c.targetKey);
   if(closedTarget(c)){fail(m,'Le commerce n’est plus disponible. Aucun paiement.');return;}
   if(player.hp<=0){fail(m,'Le travail est interrompu. Reprends contact quand tu seras sur pied.');return;}
   if(c.type==='delivery'){
    if(c.stage==='pickup'&&atCounter(source)&&finite(business.inventory.provision)>0){
     business.inventory.provision--;c.cargo=true;c.stage='deliver';change();post(c.type,'Colis retiré','Provision mise de côté. Remets-la au comptoir de '+target.place.name+' · '+address(target)+'.');
    }else if(c.stage==='deliver'&&c.cargo&&atCounter(target)){c.cargo=false;complete(m);}
   }else if(c.type==='vehicle'){
    const car=vehicleAt(c.vehicleId);
    if(!car||car.exploded){fail(m,'Le véhicule ne peut plus être essayé. Contrat annulé.');return;}
    const driving=context.mode==='car'&&context.car===car&&!car.ai&&!interiors?.active;
    if(driving){
     if(lastVehiclePoint){const d=Math.hypot(car.x-lastVehiclePoint.x,car.z-lastVehiclePoint.z),speed=Math.abs(finite(car.v)),previous=Math.floor(c.distance/10);if(d<=Math.max(3,speed*dt*2+2))c.distance+=d;if(previous!==Math.floor(c.distance/10))change();}
     lastVehiclePoint={x:car.x,z:car.z};
     if(c.distance>=350&&c.stage!=='return'){c.stage='return';change();post(c.type,'Essai suffisant','Reviens devant '+target.place.name+' · '+address(target)+'. Immobilise le véhicule deux secondes.');}
     const stopped=c.stage==='return'&&Math.hypot(car.x-target.building.x,car.z-target.building.z)<9&&Math.abs(finite(car.v))<.5&&Math.abs(finite(car.u))<.5;
     c.hold=stopped?c.hold+Math.min(dt,.25):0;
     if(c.hold>=2)complete(m);
    }else{lastVehiclePoint=null;c.hold=0;}
   }else{
    const mission=business.mission;
    if(mission?.buildingId===target.building.id&&mission?.placeId===target.place.id)c.started=true;
    if(c.started&&business.records.get(target.key)?.status==='protected')complete(m);
   }
  }
  if(!activeMessage()&&!messages.some(m=>m.status==='offered')&&clock>=nextOfferAt&&!danger)offer();
 }
 function validContract(raw){
  if(!raw||!TYPES.includes(raw.type)||!entryAt(raw.sourceKey)||!entryAt(raw.targetKey))return null;
  const type=raw.type,c={type,sourceKey:raw.sourceKey,targetKey:raw.targetKey,reward:REWARDS[type]};
  if(type==='delivery'){
   if(!['restaurant','kebab','supermarche','hotel'].includes(entryAt(c.sourceKey).place.type)||entryAt(c.sourceKey).building.id===entryAt(c.targetKey).building.id)return null;
   c.stage=raw.stage==='deliver'&&raw.cargo===true?'deliver':'pickup';c.cargo=c.stage==='deliver';
  }else if(type==='vehicle'){
   const car=vehicleAt(raw.vehicleId);if(!car||!['gti','r5'].includes(car.model)||car.police||car.model!==raw.vehicleModel||entryAt(c.targetKey).place.type!=='garage')return null;
   Object.assign(c,{vehicleId:car.id,vehicleModel:car.model,vehicleName:vehicleName(car),vehicleStart:{x:car.x,z:car.z},distance:clamp(finite(raw.distance),0,100000),hold:0});c.stage=c.distance>=350?'return':'drive';
  }else{c.stage='claim';c.started=raw.started===true;}
  return c;
 }
 function save(){return {version:1,clock,nextOfferAt,serial,cursor,activeId,messages:clone(messages),paid:[...paid].slice(-256),usedVehicles:[...usedVehicles].slice(-256)};}
 if(saved?.version===1){
  clock=clamp(finite(saved.clock),0,1e9);nextOfferAt=clock+clamp(finite(saved.nextOfferAt,clock+15)-clock,0,300);serial=clamp(Math.floor(finite(saved.serial)),0,1e9);cursor=clamp(Math.floor(finite(saved.cursor)),0,1e9);
  for(const id of (Array.isArray(saved.paid)?saved.paid:[]).slice(-256))if(/^sms-\d{1,10}$/.test(id))paid.add(id);
  for(const id of (Array.isArray(saved.usedVehicles)?saved.usedVehicles:[]).slice(-256))if(vehicleAt(id))usedVehicles.add(id);
  const seen=new Set();let pending=false;
  for(const raw of (Array.isArray(saved.messages)?saved.messages:[]).slice(-80)){
   if(!raw||typeof raw.id!=='string'||!/^sms-\d{1,10}$/.test(raw.id)||seen.has(raw.id)||!STATUS.has(raw.status))continue;
   const contract=validContract(raw.contract);if(raw.status!=='info'&&!contract)continue;
   seen.add(raw.id);serial=Math.max(serial,Number(raw.id.slice(4)));
   const type=contract?.type||TYPES.find(t=>CONTACTS[t][0]===raw.threadId)||'protection',[threadId,from]=CONTACTS[type];
   const m={id:raw.id,threadId,from,subject:clean(raw.subject,100),text:clean(raw.text,1600),createdAt:clamp(finite(raw.createdAt),0,clock),read:raw.read===true,status:raw.status,contract};
   if(paid.has(m.id))m.status='completed';
   if(m.status==='completed')paid.add(m.id);
   if(m.status==='accepted'){if(m.id===saved.activeId&&!activeId&&!paid.has(m.id)){activeId=m.id;}else m.status='failed';}
   if(m.status==='offered'){if(pending||activeId)m.status='declined';else pending=true;}
   messages.push(m);
  }
  if(activeId)for(const m of messages)if(m.status==='offered')m.status='declined';
  trim();change();
 }
 return {open,read,respond,update,save,get messages(){return messages.map(view);},get threads(){
  const out=[];for(const [id,name]of Object.values(CONTACTS)){const list=messages.filter(m=>m.threadId===id);if(list.length)out.push({id,name,unread:list.filter(m=>!m.read).length,lastMessage:clone(list.at(-1)),lastAt:list.at(-1).createdAt});}return out.sort((a,b)=>b.lastAt-a.lastAt);
 },get unread(){return messages.filter(m=>!m.read).length;},get revision(){return revision;},get active(){const m=activeMessage();return m?{messageId:m.id,...contractView(m.contract)}:null;},get time(){return clock;}};
}
R.phone={create,REWARDS};
})(globalThis.RADE=globalThis.RADE||{});
