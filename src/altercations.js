/* EMPRISE — local ambient disputes. Decisions are slow; movement remains continuous.
 * Spark supplied the first state-machine drafts; integration keeps violence between
 * NPCs separate from the player's crime and existing stolen-vehicle ownership. */
(function(R){'use strict';
function hash(id){let h=Math.imul(id^0x6d2b79f5,0x45d9f3b);h=Math.imul(h^(h>>>16),0x45d9f3b);return(h^(h>>>16))>>>0;}
function create(world,sim,crowd,injuries,{saved,notify=()=>{}}={}){
 const player=sim.state.player,scenes=[],horns=new Map(),cooldowns=new Map();
 let clock=0,decisionAt=0,pedAt=25,rng=0x1a2b3c4d,nextId=1;
 const counters={created:0,strikes:0,dispersed:0};
 const random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};
 const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),occupied=c=>c===world.car&&world.playerSeated;
 const healthy=e=>e&&e.hp>25&&!e.injury?.leg&&!e.injury?.dead&&!e.grievance&&!e.thrown&&(e.fear||0)<=.65;
 const available=e=>healthy(e)&&!e.altercation&&!(e.aggression>0)&&!(e.panic>1)&&(cooldowns.get(e.id)||0)<=clock;
 const ground=(x,z)=>world.ground?.(x,z)??.08;
 function bounded(map,key,value,limit){if(!map.has(key)&&map.size>=limit)map.delete(map.keys().next().value);map.set(key,value);}
 function los(a,b,ignore){const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);return d<.01||!world.ray||world.ray([a.x,(a.baseY??ground(a.x,a.z))+1.05,a.z],[dx/d,0,dz/d],d,ignore)>=d-.3;}
 function door(c,e){const w=R.vehicles.SPECS[c.model].width/2+.65,co=Math.cos(c.cap),si=Math.sin(c.cap);let best=null;
  for(const side of [-1,1]){const q={x:c.x-si*side*w,z:c.z+co*side*w};if(!world.blocked(q.x,q.z,.28,ground(q.x,q.z))&&(!best||dist(q,e)<dist(best,e)))best=q;}return best;
 }
 function usable(c){return c&&!c.police&&!c.policeStolen&&!c.hidden&&!c.parked&&!c.exploded&&!c.burning&&!c.burned&&!occupied(c)&&c.driver&&c.driver.hp>0&&(c.condition?.engine??1)>.3&&(c.condition?.body??1)>.3;}
 function canExit(c){return usable(c)&&c.ai&&c.moteur&&!c.uncontrolled&&Math.abs(c.v)<.5&&c.driver.inside&&available(c.driver)&&!!door(c,c.driver);}
 function control(q,id){q.e.altercation={id,danger:false};q.e.moveSpeed=0;}
 function release(q,panic=false){const e=q.e;if(!e)return;e.altercation=null;e.strike=0;e.moveSpeed=0;
  if(Number.isFinite(e.cap)&&Number.isFinite(e.yaw)){e.cap=Math.PI-e.yaw;delete e.yaw;}
  if(panic&&e.hp>0&&!e.inside&&!e.grievance){e.fear=Math.max(e.fear||0,.4);e.panic=Math.max(e.panic||0,2);}
  e.provocationCooldown=Math.max(e.provocationCooldown||0,15);q.done=true;
 }
 function returning(s){if(s.phase==='return')return;s.phase='return';s.timer=0;s.wait=0;counters.dispersed++;for(const q of [s.a,s.b]){q.e.strike=0;q.e.moveSpeed=0;}}
 function start(a,b,reason){if(scenes.length>=2||a.e===b.e||!available(a.e)||!available(b.e)||dist(a.e,player)>55||dist(b.e,player)>55)return false;
  for(const q of [a,b])if(q.c&&!canExit(q.c))return false;
  const s={id:nextId++,a,b,phase:'tension',timer:0,wait:0,turn:0,dispute:2+random()*2,witnessed:false,reason};
  for(const q of [a,b]){if(q.c){const d=door(q.c,q.e);q.e.inside=false;q.e.x=d.x;q.e.z=d.z;q.e.baseY=ground(d.x,d.z);q.c.ai=q.c.moteur=false;q.c.u=q.c.w=q.c.v=q.c.omega=0;}control(q,s.id);bounded(cooldowns,q.e.id,clock+65,64);}
  scenes.push(s);counters.created++;notify('Une altercation éclate dans la rue.');return true;
 }
 function noticeTraffic(events){if(world.room||!Array.isArray(events))return;
  for(const ev of events){if(ev?.name!=='carHorn'||!['vehicle','pedestrian'].includes(ev.reason)||!Number.isInteger(ev.vehicleId))continue;
   let q=horns.get(ev.vehicleId);if(!q||clock-q.first>20)q={count:0,first:clock,last:clock,reason:ev.reason};q.count=Math.min(3,q.count+1);q.last=clock;q.reason=ev.reason;bounded(horns,ev.vehicleId,q,32);
  }
 }
 function target(c,reason){const co=Math.cos(c.cap),si=Math.sin(c.cap);let found=null,best=6.5;
  const consider=(e,car)=>{const dx=e.x-c.x,dz=e.z-c.z,along=dx*co+dz*si,across=-dx*si+dz*co,d=Math.hypot(dx,dz);
   if(along<=.3||along>6.5||Math.abs(across)>1.6||d>=best)return;
   // Test only the gap between bumpers: neither car's own body is an occluder.
   const start=R.vehicles.SPECS[c.model].length/2+.15,end=car?R.vehicles.SPECS[car.model].length/2+.15:.3;
   const a={x:c.x+dx/d*start,z:c.z+dz/d*start,baseY:ground(c.x,c.z)},b={x:e.x-dx/d*end,z:e.z-dz/d*end};
   if(d>start+end&&!los(a,b,c))return;best=d;found={e,c:car};
  };
  if(reason==='vehicle')for(const other of world.fleet){if(other!==c&&canExit(other))consider(other.driver,other);}
  if(reason==='pedestrian')for(const e of crowd.people){if(available(e)&&!e.inside)consider(e,null);}
  return found;
 }
 function decisions(){
  for(const [id,q] of horns){if(clock-q.last>20){horns.delete(id);continue;}if(q.count<2||scenes.length>=2)continue;
   const c=world.fleet.find(c=>c.id===id);if(!c||hash(id*7+3)%100>=20||!canExit(c)||dist(c,player)>55)continue;
   const other=target(c,q.reason);if(other&&start({e:c.driver,c},other,q.reason))horns.delete(id);
  }
  for(const [id,t] of cooldowns)if(t<clock)cooldowns.delete(id);
  if(clock<pedAt||scenes.length>=2)return;pedAt=clock+20+random()*25;
  const candidates=[];for(const e of crowd.people){if(candidates.length>=8)break;if(available(e)&&!e.inside&&dist(e,player)<45&&hash(e.id*11+5)%100<33)candidates.push(e);}
  for(let i=0;i<candidates.length;i++)for(let j=i+1;j<candidates.length;j++)if(dist(candidates[i],candidates[j])<4&&los(candidates[i],candidates[j])){start({e:candidates[i],c:null},{e:candidates[j],c:null},'pedestrianDispute');return;}
 }
 function policeNear(e){for(const c of world.fleet)if(c.police&&!c.policeStolen&&!c.exploded&&c.ai&&dist(c,e)<20){const d=dist(c,e),end={x:c.x+(e.x-c.x)/(d||1)*2.5,z:c.z+(e.z-c.z)/(d||1)*2.5};if(los(e,end,c))return true;}
  for(const p of world.boundaryOfficers||[])if(p.hp>0&&dist(p,e)<20&&los(e,p))return true;return false;
 }
 function witness(s){if(s.witnessed)return;s.witnessed=true;const x=(s.a.e.x+s.b.e.x)/2,z=(s.a.e.z+s.b.e.z)/2;
  for(const e of crowd.people)if(e.hp>0&&!e.inside&&!e.altercation&&Math.hypot(e.x-x,e.z-z)<12){e.fear=Math.min(1,(e.fear||0)+.45);e.panic=Math.max(e.panic||0,3);e.threat={x,z};}
 }
 function approach(q,other,dt){const d=dist(q.e,other);if(d>1.22)injuries.ownerMove(q.e,other,Math.min(1.8,(d-1.2)/dt),dt);else q.e.moveSpeed=0;
  q.e.yaw=Math.atan2(other.x-q.e.x,-(other.z-q.e.z));
 }
 function returnActor(q,dt,timer){if(q.done)return;
  if(!healthy(q.e)||q.e.altercation?.danger||q.c&&(!usable(q.c)||q.c.driver!==q.e)){release(q,true);return;}
  if(!q.c){release(q);return;}
  const d=door(q.c,q.e);if(!d||timer>12){release(q,true);return;}
  injuries.ownerMove(q.e,d,1.7,dt);
  if(dist(q.e,d)<.4&&Math.abs(q.c.v)<.5){q.e.inside=true;q.e.x=q.c.x;q.e.z=q.c.z;q.e.reaction='driving';q.e.panic=0;q.c.ai=q.c.moteur=true;q.c.uncontrolled=false;release(q);}
 }
 function update(dt,events=[]){if(!Number.isFinite(dt)||dt<=0||world.room)return;dt=Math.min(dt,.2);clock+=dt;
  const decide=clock>=decisionAt;if(decide){decisionAt=clock+1;decisions();}
  for(let i=scenes.length-1;i>=0;i--){const s=scenes[i],a=s.a.e,b=s.b.e;s.timer+=dt;
   for(const q of [s.a,s.b])q.e.strike=Math.max(0,(q.e.strike||0)-dt);
   const danger=[s.a,s.b].some(q=>!healthy(q.e)||q.e.altercation?.danger||q.c&&(!usable(q.c)||q.c.driver!==q.e));
   const shot=events.some(ev=>['shot','enemyShot','explosion','vehicleExplosion'].includes(ev.name)&&Number.isFinite(ev.x)&&Number.isFinite(ev.z)&&(Math.hypot(a.x-ev.x,a.z-ev.z)<30||Math.hypot(b.x-ev.x,b.z-ev.z)<30));
   const far=dist(a,player)>65||dist(b,player)>65;
   if(danger||shot||far||dist(a,b)>15||decide&&(policeNear(a)||policeNear(b)))returning(s);
   if(far){release(s.a,true);release(s.b,true);}
   if(s.phase==='return'){returnActor(s.a,dt,s.timer);returnActor(s.b,dt,s.timer);if(s.a.done&&s.b.done)scenes.splice(i,1);continue;}
   if(s.phase==='tension'){if(s.timer>=1){s.phase='approach';s.timer=0;}continue;}
   if(s.phase==='approach'){
    approach(s.a,b,dt);approach(s.b,a,dt);if(dist(a,b)<1.45&&los(a,b)){s.phase='dispute';s.timer=0;}else if(s.timer>8)returning(s);continue;
   }
   a.moveSpeed=b.moveSpeed=0;a.yaw=Math.atan2(b.x-a.x,-(b.z-a.z));b.yaw=Math.atan2(a.x-b.x,-(a.z-b.z));
   if(s.phase==='dispute'){if(s.timer>=s.dispute){s.phase='strikes';s.timer=0;s.wait=0;}continue;}
   if(s.phase==='strikes'){
    if(dist(a,b)>1.5||!los(a,b)){returning(s);continue;}
    s.wait-=dt;if(s.wait<=0){witness(s);const attacker=s.turn%2?a:b,victim=s.turn%2?b:a;s.turn++;s.wait=1.1;attacker.strike=.4;if(injuries.hurtAmbient(victim,3+Math.floor(random()*3),attacker)!==false)counters.strikes++;}
    if(s.timer>=20||a.hp<=25||b.hp<=25)returning(s);
   }
  }
 }
 function save(){return {version:1,clock,decisionAt,pedAt,rng,nextId,stats:{...counters},horns:[...horns],cooldowns:[...cooldowns],scenes:scenes.map(s=>({id:s.id,phase:s.phase,timer:s.timer,wait:s.wait,turn:s.turn,dispute:s.dispute,witnessed:s.witnessed,reason:s.reason,a:{id:s.a.e.id,car:s.a.c?.id??null,done:!!s.a.done},b:{id:s.b.e.id,car:s.b.c?.id??null,done:!!s.b.done}}))};}
 if(saved?.version===1&&Number.isFinite(saved.clock)&&saved.clock>=0){
  clock=saved.clock;decisionAt=Number.isFinite(saved.decisionAt)?Math.min(clock+1,saved.decisionAt):clock;pedAt=Number.isFinite(saved.pedAt)?Math.max(clock,Math.min(clock+45,saved.pedAt)):clock+25;
  rng=Number.isInteger(saved.rng)?saved.rng>>>0:rng;nextId=Number.isInteger(saved.nextId)?saved.nextId:1;
  for(const k of Object.keys(counters))if(Number.isFinite(saved.stats?.[k]))counters[k]=Math.max(0,saved.stats[k]);
  for(const pair of (Array.isArray(saved.horns)?saved.horns:[]).slice(-32)){if(!Array.isArray(pair))continue;const [id,q]=pair;if(Number.isInteger(id)&&q&&Number.isFinite(q.first)&&Number.isFinite(q.last)&&q.count>0&&q.last<=clock&&q.last>clock-20&&['vehicle','pedestrian'].includes(q.reason))horns.set(id,{count:Math.min(3,q.count),first:q.first,last:q.last,reason:q.reason});}
  for(const pair of (Array.isArray(saved.cooldowns)?saved.cooldowns:[]).slice(-64))if(Array.isArray(pair)&&Number.isInteger(pair[0])&&Number.isFinite(pair[1])&&pair[1]>clock)cooldowns.set(pair[0],Math.min(clock+65,pair[1]));
  for(const d of (Array.isArray(saved.scenes)?saved.scenes:[]).slice(0,2)){
   const restore=q=>{if(!q)return null;const c=q.car===null?null:world.fleet.find(c=>c.id===q.car),e=c?c.driver:crowd.people.find(e=>e.id===q.id);return e&&e.id===q.id&&!e.altercation&&Number.isFinite(e.x)&&Number.isFinite(e.z)?{e,c,done:!!q.done}:null;};
   const a=restore(d?.a),b=restore(d?.b);if(!a||!b||a.e===b.e)continue;
   const s={id:Number.isInteger(d.id)&&d.id>0?d.id:nextId++,a,b,phase:['tension','approach','dispute','strikes','return'].includes(d.phase)?d.phase:'return',timer:Number.isFinite(d.timer)?Math.max(0,Math.min(25,d.timer)):0,wait:Number.isFinite(d.wait)?Math.max(0,Math.min(1.1,d.wait)):0,turn:Number.isInteger(d.turn)?Math.max(0,d.turn):0,dispute:Number.isFinite(d.dispute)?Math.max(2,Math.min(4,d.dispute)):3,witnessed:!!d.witnessed,reason:d.reason};
   for(const q of [a,b])if(!q.done){control(q,s.id);if(q.c&&!q.e.inside){q.c.ai=q.c.moteur=false;q.c.u=q.c.w=q.c.v=q.c.omega=0;}else if(q.c){q.done=true;q.e.altercation=null;}}
   scenes.push(s);
  }
 }
 return {noticeTraffic,update,save,get scenes(){return scenes;},get stats(){return {...counters,activeScenes:scenes.length};}};
}
R.altercations={create};})(globalThis.RADE=globalThis.RADE||{});
