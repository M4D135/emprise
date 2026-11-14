/* RADE — the only owner of simulation time and mode transitions. No renderer or DOM here. */
(function(R){'use strict';
function create({pedestrians=480}={}){
 const world=R.world.create(),sim=FSimulation.create(world.combatWorld),crowd=R.crowd.create(world,pedestrians),player=sim.state.player;let car=world.car;
 let mode='foot',time=0,crowdClock=0,message='',messageTime=0,phase=0,started=false,returned=false,lastEvents=[],nearObjective=false;const history=[];let crowdEvents=[];
 function tell(s){message=s;messageTime=4;history.push({time,text:s});}
 function exitCandidates(){const c=Math.cos(car.cap),s=Math.sin(car.cap);return [-1,1].map(side=>({x:car.x-s*side*(R.vehicles.SPECS[car.model].width/2+.66),z:car.z+c*side*(R.vehicles.SPECS[car.model].width/2+.66),side}));}
 function interact(){
  if(mode==='car'){
   if(car.v>1.2){tell('Arrêtez le véhicule avant de sortir.');return false;}
   const points=exitCandidates(),free=points.find(q=>!world.blocked(q.x,q.z,.33,world.ground(),1.8)&&world.withoutCar(()=>{for(let t=.55;t<=1;t+=.08)if(world.blocked(car.x+(q.x-car.x)*t,car.z+(q.z-car.z)*t,.28))return false;return true;}));
   if(!free){tell('Sortie impossible : les deux côtés sont bloqués.');return false;}
   Object.assign(player,{x:free.x,z:free.z,y:world.ground(free.x,free.z),yaw:car.cap+Math.PI/2,pitch:0});mode='foot';car.u=car.w=car.omega=car.v=0;
   tell('À pied · véhicule conservé sur place.');if(nearObjective&&phase<2)phase=2;return true;
  }
  const nearest=world.fleet.slice().sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z))[0];car=nearest;world.select(car);
  if(Math.hypot(player.x-car.x,player.z-car.z)>4.4){tell('Approchez-vous du véhicule pour monter.');return false;}
  const target=exitCandidates().sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z)).find(q=>world.ray([player.x,1.0,player.z],[(q.x-player.x)/Math.max(.001,Math.hypot(q.x-player.x,q.z-player.z)),0,(q.z-player.z)/Math.max(.001,Math.hypot(q.x-player.x,q.z-player.z))],Math.hypot(q.x-player.x,q.z-player.z))>=Math.hypot(q.x-player.x,q.z-player.z)-.2);
  if(!target){tell('Accès bloqué : contournez le véhicule.');return false;}
  mode='car';Object.assign(player,{x:car.x,z:car.z,y:car.y,yaw:car.cap+Math.PI/2,pitch:0});car.moteur=true;if(phase===0)phase=1;if(phase===3)returned=true;tell('Moteur démarré · Z / W accélérer · S freiner / reculer.');return true;
 }
 function update(dt,input={}){
  time+=dt;messageTime=Math.max(0,messageTime-dt);lastEvents=[];
  if(input.interact)interact();if(input.engine&&mode==='car'){car.moteur=!car.moteur;tell(car.moteur?'Moteur démarré.':'Contact coupé.');}
  const distance=Math.hypot(car.x-world.mission.x,car.z-world.mission.z);nearObjective=distance<43;
  if(mode==='car'){
   const reverse=(input.back||0)>0&&(car.u<.35),forward=input.forward||0;
   const events=R.vehicles.step(car,{gaz:reverse?input.back:forward,frein:input.brake?1:!reverse?(input.back||0):forward>0?1:0,volant:input.steer||0,derive:!!input.drift,marcheArriere:reverse},world,dt);
   for(const e of events)lastEvents.push({name:e.type,...e,x:car.x,z:car.z});
   Object.assign(player,{x:car.x,z:car.z,y:car.y,yaw:car.cap+Math.PI/2,pitch:0});
   world.withoutCar(()=>sim.step(dt,{seated:true}));
   Object.assign(player,{x:car.x,z:car.z,y:car.y,yaw:car.cap+Math.PI/2,pitch:0});
  }else{
   R.vehicles.step(car,{gaz:0,frein:1,volant:0},world,dt);
   sim.step(dt,{moveX:input.moveX||0,moveY:input.moveY||0,lookX:input.lookX||0,lookY:input.lookY||0,sprint:input.sprint,fire:input.fire,weapon:input.weapon,dash:input.dash,melee:input.melee,pulse:input.pulse});
  }
  for(const e of sim.state.events.splice(0))lastEvents.push({...e,x:e.x??player.x,z:e.z??player.z});
  if(phase>=2&&sim.state.enemies.every(e=>e.hp<=0)&&phase<3){phase=3;tell('Zone sécurisée. Retrouvez votre véhicule.');}
  if(returned&&car.v>2&&phase===3){phase=4;tell('MISSION ACCOMPLIE · La ville reste ouverte.');}
  crowdEvents.push(...lastEvents);crowdClock+=dt;if(crowdClock>=.05){crowd.update(crowdClock,crowdEvents);crowdClock=0;crowdEvents=[];}
 }
 return {world,sim,crowd,get car(){return car;},player,interact,exitCandidates,update,history,tell,get mode(){return mode;},get phase(){return phase;},get time(){return time;},get message(){return messageTime?message:'';},get events(){return lastEvents;},get crowdAlpha(){return crowdClock/.05;}};
}
R.session={create};})(globalThis.RADE=globalThis.RADE||{});
