/* RADE — one owner of simulation time, transitions, traffic and the solo campaign. */
(function(R){'use strict';
function create({pedestrians=480,expanded=!!R.campaign,saved=null,now=Date.now()}={}){
 const storedAmmo=saved?.ammunition,ammoValid=storedAmmo?.version===1&&Array.isArray(storedAmmo.ammo)&&storedAmmo.ammo.length===3&&storedAmmo.ammo.every((v,i)=>Number.isInteger(v)&&v>=0&&v<=[180,36,12][i]);
 const world=R.world.create({savedCity:saved?.city}),weather=R.weather?R.weather.create(saved?.weather):null,layout=expanded?R.campaign.layout(world):null,addresses=expanded&&R.interiors?(world.addresses=R.interiors.catalog(world)):null,sim=(expanded&&R.business?.prepare(world),FSimulation.create(world.combatWorld,{finiteAmmo:expanded,...(ammoValid?{inventory:{weapons:[true,true,true],ammo:storedAmmo.ammo.slice()}}:{})})),player=sim.state.player;
 if(ammoValid&&Number.isInteger(storedAmmo.weapon)&&storedAmmo.weapon>=0&&storedAmmo.weapon<3)sim.selectWeapon(storedAmmo.weapon);
 let loot;
 let car=world.car,mode='foot',time=0,crowdClock=0,trafficClock=0,message='',messageTime=0,phase=0,returned=false,lastEvents=[],nearObjective=false,crowdEvents=[];const history=(Array.isArray(saved?.journal)?saved.journal:[]).filter(e=>e&&Number.isFinite(e.time)&&typeof e.text==='string'&&e.text.length<=400).slice(-80).map(e=>({time:e.time,text:e.text}));
 const tell=(s,{remember=true}={})=>{message=s;messageTime=5;if(s.startsWith('SMS ·'))lastEvents.push({name:'phoneMessage'});if(remember&&history.at(-1)?.text!==s){history.push({time,text:s});if(history.length>80)history.shift();}};
 const traffic=expanded?R.traffic.create(world):null,campaign=expanded?R.campaign.create(world,sim,layout,{saved,now,notify:tell}):null,crowd=R.crowd.create(world,pedestrians,{allowAggression:expanded&&!!R.injuries,hurt:(amount,e)=>sim.hurt(amount,false,{x:e.x,y:1,z:e.z}),notify:tell});world.player=player;world.pedestrians=crowd.people;world.weather=weather?.state||null;const interiors=expanded&&R.interiors?R.interiors.create(world,sim,{saved:saved?.interiors,notify:tell}):null;const urban=expanded&&R.urban?R.urban.create(world,sim,{saved:saved?.urban,interiors,campaign,traffic,notify:tell}):null;const marine=R.marine?R.marine.create(world,{saved:saved?.marine,notify:tell}):null;const business=expanded&&R.business?R.business.create(world,sim,{interiors,campaign,saved:saved?.business,notify:tell}):null;const injuries=expanded&&R.injuries?R.injuries.create(world,sim,crowd,{interiors,urban,campaign,saved:saved?.injuries,notify:tell,onReclaim:ownerReclaim}):null;
 const police=expanded&&R.police?R.police.create(world,sim,{traffic,campaign,saved:saved?.police,notify:tell}):null;
 loot=expanded&&R.loot?R.loot.create(world,sim,{campaign,business,interiors,saved:saved?.loot,notify:tell}):null;
 const phone=expanded&&R.phone?R.phone.create(world,sim,{campaign,business,interiors,traffic,saved:saved?.phone,notify:tell}):null;
 marine?.restore(player);if(marine&&marine.mode!=='foot')mode=marine.mode;
 interiors?.setServiceHandler('repair',()=>urban?.repair(car));
 function ownerReclaim(c,e,door){if(mode==='car'&&car===c){if(c.v>=.7)return false;const co=Math.cos(c.cap),si=Math.sin(c.cap),q={x:door.x-co*.9,z:door.z-si*.9};if(world.blocked(q.x,q.z,.28))return false;mode='foot';world.playerSeated=false;Object.assign(player,{x:q.x,z:q.z,y:world.ground(q.x,q.z)});sim.hurt(5,false,{x:e.x,y:1,z:e.z});}return true;}
 function exitCandidates(){const c=Math.cos(car.cap),s=Math.sin(car.cap);return [-1,1].map(side=>({x:car.x-s*side*(R.vehicles.SPECS[car.model].width/2+.66),z:car.z+c*side*(R.vehicles.SPECS[car.model].width/2+.66),side}));}
 function interact(){
  if(interiors?.active)return interiors.interact(campaign);
  if(mode==='swim'||mode==='boat'||mode==='foot'&&marine?.context(player)){const result=marine.interact(player);mode=marine.mode;return result;}
  if(mode==='car'){
   if(car.v>1.2){tell('Arrêtez le véhicule avant de sortir.');return false;}
   const free=exitCandidates().find(q=>!world.blocked(q.x,q.z,.33,world.ground(q.x,q.z),1.8)&&world.withoutCar(()=>{for(let t=.55;t<=1;t+=.08)if(world.blocked(car.x+(q.x-car.x)*t,car.z+(q.z-car.z)*t,.28))return false;return true;}));
   if(!free){tell('Sortie impossible : les deux côtés sont bloqués.');return false;}
   Object.assign(player,{x:free.x,z:free.z,y:world.ground(free.x,free.z),yaw:car.cap+Math.PI/2,pitch:0});mode='foot';car.u=car.w=car.omega=car.v=0;tell('À pied.');if(nearObjective&&phase<2)phase=2;return true;
  }
  const nearest=world.fleet.filter(c=>!c.hidden).slice().sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z))[0];
  const door=interiors?.near();if(door&&(!nearest||door.distance<Math.hypot(player.x-nearest.x,player.z-nearest.z)))return interiors.interact(campaign);
  if(!nearest||Math.hypot(player.x-nearest.x,player.z-nearest.z)>4.4){tell('Aucun véhicule à portée.');return false;}
  if(nearest.exploded){tell('Épave irréparable.');return false;}
  if(nearest.v>1.4){tell('Le véhicule doit être arrêté.');return false;}
  const old=car;car=nearest;
  const target=exitCandidates().sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z)).find(q=>{const d=Math.hypot(q.x-player.x,q.z-player.z);return world.ray([player.x,player.y+1,player.z],[(q.x-player.x)/Math.max(.001,d),0,(q.z-player.z)/Math.max(.001,d)],d)>=d-.2;});
  if(!target){car=old;tell('Accès bloqué : contournez le véhicule.');return false;}
  if(car.driver?.inside){const driver=car.driver,q=world.freeNear(target.x,target.z,.35);Object.assign(driver,{inside:false,x:q[0],z:q[1],baseY:world.ground(q[0],q[1]),yaw:player.yaw+Math.PI,hp:driver.hp>0?Math.max(1,driver.hp-15):0,thrown:1.4,panic:12,moveSpeed:0});tell('Conducteur sorti du véhicule.');injuries?.stolen(car);}world.select(car);const policeTheft=car.police&&!car.policeStolen;if(car.police)car.policeStolen=true;if(car.ai||car.emergency||policeTheft){car.ai=false;car.emergency=false;campaign?.crime(car.police?2.5:1);tell('Véhicule pris.');}mode='car';car.moteur=true;
  Object.assign(player,{x:car.x,z:car.z,y:car.y,yaw:car.cap+Math.PI/2,pitch:0});if(phase===0)phase=1;if(phase===3)returned=true;tell('Moteur démarré · Z / W accélérer · S freiner / reculer.');return true;
 }
 function respawn(arrested=false){
  marine?.leave();interiors?.leave();
  if(campaign&&!arrested){const fee=Math.min(campaign.state.cash,Math.max(60,campaign.state.cash*.15));campaign.state.cash-=fee;tell('Vous reprenez connaissance · '+Math.round(fee)+' € perdus.');}
  car.u=car.w=car.v=car.omega=0;mode='foot';const p=world.freeNear(world.combatWorld.spawn.x,world.combatWorld.spawn.z,.4);
  sim.revive(p[0],p[1]);if(arrested&&interiors?.respawnPolice())tell('Libéré au commissariat · 42 La Canebière.');if(campaign){campaign.law.heat=campaign.law.wanted=campaign.law.arrest=0;campaign.law.mode='calme';}
 }
 function update(dt,input={}){
  const previous={x:player.x,y:player.y,z:player.z};time+=dt;const weatherEvents=weather?.tick(dt,player)||[];messageTime=Math.max(0,messageTime-dt);lastEvents=[];
  if(input.phoneAction&&typeof input.phoneAction.id==='string')phone?.respond(input.phoneAction.id,input.phoneAction.action);if(input.loot)loot?.take();if(typeof input.businessAction==='string')business?.act(input.businessAction);if(input.interact)interact();if(input.grab)urban?.grab();if(input.ignite)urban?.igniteAhead();if(input.repair)urban?.repair(car);if(input.throw)urban?.throwHeld();if(input.engine&&mode==='car'){car.moteur=!car.moteur;tell(car.moteur?'Moteur démarré.':'Contact coupé.');}
  if(mode==='foot'&&!interiors?.active&&marine){const mx=input.moveX||0,my=input.moveY||0,n=Math.hypot(mx,my),yaw=player.yaw+(input.lookX||0);if(n>.05){const dx=(Math.cos(yaw)*mx+Math.sin(yaw)*my)/n,dz=(Math.sin(yaw)*mx-Math.cos(yaw)*my)/n,x=player.x+dx*.65,z=player.z+dz*.65;if(world.water(x,z)&&world.ray([player.x,player.y+.8,player.z],[dx,0,dz],.7)>.64){const ox=player.x,oz=player.z;player.x=x;player.z=z;if(marine.enterWater(player))mode='swim';else{player.x=ox;player.z=oz;}}}}
  nearObjective=Math.hypot(car.x-world.mission.x,car.z-world.mission.z)<43;
  if(mode==='car'){
   const reverse=(input.back||0)>0&&car.u<.35,forward=input.forward||0;
   const events=R.vehicles.step(car,{gaz:reverse?input.back:forward,handbrake:input.brake?1:0,frein:!reverse?(input.back||0):forward>0?1:0,volant:input.steer||0,derive:!!input.drift,marcheArriere:reverse},world,dt);
   for(const e of events)lastEvents.push({name:e.type,...e,x:car.x,z:car.z});
   Object.assign(player,{x:car.x,z:car.z,y:car.y,yaw:car.cap+Math.PI/2,pitch:0});world.withoutCar(()=>sim.step(dt,{seated:true}));Object.assign(player,{x:car.x,z:car.z,y:car.y,yaw:car.cap+Math.PI/2,pitch:0});
  }else if(mode==='swim'||mode==='boat'){sim.step(dt,{seated:true});marine.update(dt,input,player,weather?.state);mode=marine.mode;
  }else{if(!car.ai&&!car.uncontrolled)R.vehicles.step(car,{gaz:0,frein:1,volant:0},world,dt);sim.step(dt,{moveX:input.moveX||0,moveY:input.moveY||0,lookX:input.lookX||0,lookY:input.lookY||0,sprint:input.sprint,fire:input.fire,weapon:input.weapon,dash:input.dash,melee:input.melee,pulse:input.pulse});}
  if(mode!=='swim'&&mode!=='boat'&&!interiors?.active)marine?.update(dt,{},player,weather?.state);
  // METAL's event list is a queue, not a history. Consume exactly once.
  for(const e of sim.state.events.splice(0)){lastEvents.push({...e,x:e.x??player.x,z:e.z??player.z});if(e.name==='empty')tell('Arme vide · trouvez des munitions ou changez d’arme.');}
  if(phase>=2&&sim.state.enemies.slice(0,3).every(e=>e.hp<=0)&&phase<3){phase=3;if(!expanded)tell('Zone sécurisée. Retrouvez votre véhicule.');}
  if(returned&&car.v>2&&phase===3){phase=4;if(!expanded)tell('MISSION ACCOMPLIE · La ville reste ouverte.');}
  world.playerSeated=mode!=='foot';
  if(campaign){campaign.tick(dt,lastEvents);trafficClock+=dt;if(trafficClock>=1/30){traffic.update(trafficClock,campaign.law,player);trafficClock=0;}
   const law=campaign.law,policeContext={seated:mode==='car',vehicle:car,speed:mode==='car'?car.v:sim.state.locomotion.speed,hidden:!!interiors?.active||mode==='swim'||mode==='boat'};
   police?.update(dt,policeContext);law.seen=!!law.seen||!!police?.seen;
   const status=police?police.arrestStatus(player,policeContext):traffic.arrestStatus(player,policeContext);
   if(law.wanted>0&&status.eligible){law.arrest+=dt;if(law.arrest>4){campaign.arrest();respawn(true);}}else law.arrest=Math.max(0,law.arrest-dt*1.5);
   if(law.wanted&&Math.floor(time/.85)!==Math.floor((time-dt)/.85)&&traffic.cars.some(c=>c.police&&c.ai&&Math.hypot(c.x-player.x,c.z-player.z)<85))lastEvents.push({name:'policeSiren',level:.25});
  }
  urban?.update(dt,lastEvents);if(mode==='foot'){world.resolveOverlap?.(player,dt);if(!interiors?.active)urban?.crossBreach(previous,player);}business?.update(dt,lastEvents);injuries?.update(dt,lastEvents);loot?.update();phone?.update(dt,lastEvents,{mode,car});lastEvents.push(...weatherEvents);crowdEvents.push(...lastEvents);crowdClock+=dt;if(crowdClock>=.05){crowd.update(crowdClock,crowdEvents);crowdClock=0;crowdEvents=[];}
 }
 return {world,sim,crowd,traffic,campaign,weather,interiors,urban,injuries,loot,police,phone,save(){const data=campaign.save();if(interiors?.active)data.player={...data.player,...interiors.outside};return {...data,city:world.cityStream?.save(),ammunition:{version:1,ammo:sim.state.inventory.ammo.slice(),weapon:sim.state.weapon},weather:weather?.save(),police:police?.save(),interiors:interiors?.save(),urban:urban?.save(),injuries:injuries?.save(),marine:marine?.save(),business:business?.save(),loot:loot?.save(),phone:phone?.save(),journal:history.slice(-80)};},expanded,marine,business,get car(){return car;},player,interact,exitCandidates,respawn,update,history,tell,get mode(){return mode;},get phase(){return phase;},get time(){return time;},get message(){return messageTime?message:'';},get events(){return lastEvents;},get crowdAlpha(){return crowdClock/.05;}};
}
R.session={create};})(globalThis.RADE=globalThis.RADE||{});
