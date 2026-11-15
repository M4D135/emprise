/* EMPRISE — physical, hand-searched gang bags; no rewards for harming civilians. */
(function(R){'use strict';
function create(world,sim,{campaign,business,interiors,saved=null,notify=()=>{}}={}){
 const enemies=sim.state.enemies,player=sim.state.player,bags=[],lives=new Map(),previous=new Map();let serial=0;
 const bounds=world.bounds,valid=(x,z)=>Number.isFinite(x)&&Number.isFinite(z)&&(!bounds||x>bounds.minX&&x<bounds.maxX&&z>bounds.minZ&&z<bounds.maxZ);
 const items=['bandage','provision','valuable'],names={bandage:'bandage',provision:'provision',valuable:'objet de valeur'};
 for(const e of enemies){previous.set(e.id,e.hp>0);lives.set(e.id,0);}
 if(saved?.version===1||saved?.version===2){
  serial=Number.isSafeInteger(saved.serial)?Math.max(0,Math.min(1e9,saved.serial)):0;
  for(const pair of Array.isArray(saved.lives)?saved.lives:[])if(Array.isArray(pair)&&previous.has(pair[0])&&Number.isSafeInteger(pair[1])&&pair[1]>=0&&pair[1]<1e9)lives.set(pair[0],pair[1]);
  const ids=new Set();
  for(const q of (Array.isArray(saved.bags)?saved.bags:[]).slice(-64)){
   if(!q||!Number.isSafeInteger(q.id)||q.id<1||q.id>serial||ids.has(q.id)||!valid(q.x,q.z)||!previous.has(q.enemyId)||!Number.isInteger(q.cash)||q.cash<0||q.cash>80||q.item!==null&&!items.includes(q.item))continue;
   const a=q.ammo,ammo=saved.version===2&&a&&Number.isInteger(a.weapon)&&a.weapon>=0&&a.weapon<3&&Number.isInteger(a.amount)&&a.amount>0&&a.amount<=[12,3,1][a.weapon]?{weapon:a.weapon,amount:a.amount}:null;
   ids.add(q.id);bags.push({id:q.id,enemyId:q.enemyId,x:q.x,z:q.z,cash:q.cash,item:q.item,ammo});
  }
 }
 function update(){
  for(const e of enemies){
   const alive=e.hp>0,was=previous.get(e.id);previous.set(e.id,alive);
   if(alive&&!was)lives.set(e.id,(lives.get(e.id)||0)+1);
   if(!was||alive||e.deployed===false||e.radeCivil||e.civil||!valid(e.x,e.z))continue;
   const life=lives.get(e.id)||0,seed=(Math.imul(e.id+1,2654435761)^Math.imul(life+1,1597334677))>>>0;
   const weapon=e.weapon==='rocket'?2:e.type===1?1:0,ammo=sim.state.inventory?.ammo?{weapon,amount:[12,3,1][weapon]}:null;
   bags.push({id:++serial,enemyId:e.id,x:e.x,z:e.z,cash:12+seed%29,item:items[(seed>>>8)%items.length],ammo});
   if(bags.length>64)bags.shift();
  }
 }
 function nearby(){
  if(interiors?.active||world.playerSeated||player.hp<=0)return null;
  let best=null,distance=1.65;
  for(const q of bags){const dx=q.x-player.x,dz=q.z-player.z,d=Math.hypot(dx,dz);if(d>=distance)continue;
   // Both the hand-level and eye-to-bag rays must be free; proximity alone cannot cross walls.
   const y=world.ground(),dy=y+.25-(player.y+1.4),length=Math.hypot(dx,dy,dz);
   if(d>.05&&world.ray([player.x,player.y+.7,player.z],[dx/d,0,dz/d],d)<d-.08)continue;
   if(length>.05&&world.ray([player.x,player.y+1.4,player.z],[dx/length,dy/length,dz/length],length)<length-.12)continue;
   best=q;distance=d;
  }
  return best?{kind:'loot',label:'E · Fouiller le sac',distance,target:best}:null;
 }
 function take(){
  const q=nearby()?.target;if(!q||!campaign||!business)return false;
  const gains=[];if(q.cash>0){campaign.state.cash+=q.cash;gains.push(q.cash+' €');q.cash=0;}
  if(q.item&&(business.inventory[q.item]||0)<99){business.inventory[q.item]=(business.inventory[q.item]||0)+1;gains.push(names[q.item]);q.item=null;}
  if(q.ammo&&sim.state.inventory?.ammo){const a=q.ammo,reserve=sim.state.inventory.ammo,caps=sim.ammoCaps,amount=Math.max(0,Math.min(a.amount,caps[a.weapon]-reserve[a.weapon]));if(amount){reserve[a.weapon]+=amount;a.amount-=amount;gains.push(amount+' '+['cartouches de mitraillette','cartouches de pompe','roquettes'][a.weapon]);if(!a.amount)q.ammo=null;}}
  if(!gains.length){notify('Réserves pleines. Le reste du sac reste ici.');return false;}
  if(!q.cash&&!q.item&&!q.ammo)bags.splice(bags.indexOf(q),1);
  notify('Sac fouillé · '+gains.join(' · '));return true;
 }
 function geometry(camera){
  if(interiors?.active)return [];const out=[];
  for(const q of bags){if(Math.hypot(q.x-camera.pos[0],q.z-camera.pos[2])>55)continue;const y=world.ground();
   out.push({shape:'bevel',p:[q.x,y+.13,q.z],s:[.34,.24,.26],color:[.115,.105,.08],mat:21,surface:'object',collision:false});
   out.push({shape:'box',p:[q.x,y+.255,q.z],s:[.25,.012,.017],color:[.45,.40,.29],mat:0,collision:false});
   out.push({shape:'bevel',p:[q.x,y+.29,q.z+.02],s:[.13,.025,.045],color:[.14,.12,.09],mat:21,collision:false});
  }return out;
 }
 return {update,context:nearby,take,geometry,bags,save:()=>({version:2,serial,lives:[...lives],bags:bags.map(q=>({...q,ammo:q.ammo?{...q.ammo}:null}))})};
}
R.loot={create};})(globalThis.RADE);
