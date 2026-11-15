/* RADE — human hit regions shared by gang combat, civilians and vehicle drivers. */
(function(R){'use strict';
function create(world,sim,crowd,{interiors,urban,campaign,saved,notify=()=>{},onReclaim=()=>true}={}){const dead=[],p=sim.state.player,merchants=new Map(),records=new Map((Array.isArray(saved?.people)?saved.people:[]).filter(d=>Number.isInteger(d?.id)).map(d=>[d.id,d])),registered=new WeakSet();let hits=0,headshots=0,lastRoom=[];
 const civils=()=>[...crowd.people,...(world.boundaryOfficers||[]),...world.fleet.map(c=>c.driver).filter(e=>e&&!e.inside),...(world.room?.civil||[]),...(urban?.crew||[]),...merchants.values()];
 function initialize(e,id){
  if(e.hp===undefined)e.hp=100;e.radeCivil=true;if(e.id===undefined)e.id=id;if(e.baseY===undefined)e.baseY=world.ground?.(e.x,e.z)??.08;if(!e.temperament)e.temperament=R.crowd.temperament(e.id);
  if(!registered.has(e)){registered.add(e);const d=records.get(e.id);if(d&&[d.x,d.z,d.hp].every(Number.isFinite)&&d.x>=(world.bounds?.minX??-1100)&&d.x<=(world.bounds?.maxX??1100)&&d.z>=(world.bounds?.minZ??-1100)&&d.z<=(world.bounds?.maxZ??1100)){Object.assign(e,{x:d.x,z:d.z,baseY:world.ground?.(d.x,d.z)??.08,hp:Math.max(0,Math.min(100,d.hp)),...(Number.isFinite(d.yaw)?{yaw:d.yaw}:{}),injury:d.injury?{head:!!d.injury.head,leg:!!d.injury.leg,arm:!!d.injury.arm,dead:d.hp<=0}:null});if(Number.isFinite(e.cap)){if(Number.isFinite(d.cap))e.cap=d.cap;delete e.yaw;}if(typeof d.inside==='boolean')e.inside=d.inside;for(const k of ['fear','hostility'])if(Number.isFinite(d[k]))e[k]=Math.max(0,Math.min(1,d[k]));if(Number.isFinite(d.grievance))e.grievance=Math.max(0,Math.min(90,d.grievance));if(['confront','flee','recover','driving'].includes(d.reaction))e.reaction=d.reaction;if(Number.isInteger(d.ownerVehicle))e.ownerVehicle=d.ownerVehicle;for(const k of ['aggression','provocationCooldown','panic'])if(Number.isFinite(d[k]))e[k]=Math.max(0,Math.min(45,d[k]));}}
  return e;
 }
 function remember(e){if(e.injury||e.hp<100||e.inside===false||e.grievance||e.fear>.01||e.hostility>0||e.aggression>0)records.set(e.id,{id:e.id,x:e.x,z:e.z,hp:e.hp,injury:e.injury,yaw:e.yaw,cap:e.cap,inside:e.inside,fear:e.fear,hostility:e.hostility,grievance:e.grievance,reaction:e.reaction,ownerVehicle:e.ownerVehicle,aggression:e.aggression,provocationCooldown:e.provocationCooldown,panic:e.panic});}
 function drivers(){for(const c of world.fleet){if(!c.driver&&!c.parked&&(c.ai||c.emergency||records.has(14000+c.id)))c.driver=initialize({id:14000+c.id,inside:true,civil:true,hp:100,x:c.x,z:c.z},14000+c.id);if(c.driver){if(c.driver.inside){c.driver.x=c.x;c.driver.z=c.z;c.driver.yaw=c.cap+Math.PI/2;}else{c.ai=false;c.emergency=false;}if(c.driver.hp<=0&&c.driver.inside){c.ai=false;c.moteur=false;}}}}
 drivers();for(const e of world.boundaryOfficers||[])initialize(e,e.id);
 for(let i=0;i<crowd.people.length;i++)initialize(crowd.people[i],i+10000);
 for(const site of campaign?.sites||[])if(site.kind==='shop')merchants.set(site.id,initialize({x:site.x+.7,z:site.z-1.45,yaw:Math.PI,civil:true},12000+merchants.size));
 function hitShape(e,o,d,far){const prone=!!e.injury?.leg,base=e.baseY??.08,yaw=e.yaw??Math.PI-e.cap,c=Math.cos(yaw),s=Math.sin(yaw),v=[o[0]-e.x,o[1]-base,o[2]-e.z],origin=[v[0]*c+v[2]*s,v[1],-v[0]*s+v[2]*c],dir=[d[0]*c+d[2]*s,d[1],-d[0]*s+d[2]*c];let best=null;
  const volumes=e.seated?[['head',0,1.69,-.01,.135,.17,.14],['torso',0,1.19,0,.235,.35,.17],['arm',.22,1.25,-.30,.12,.14,.26],['arm',-.22,1.25,-.30,.12,.14,.26],['leg',.14,.96,-.30,.12,.15,.28],['leg',-.14,.96,-.30,.12,.15,.28]]:prone?[['head',0,.43,-.70,.15,.17,.15],['torso',0,.34,-.20,.25,.17,.45],['leg',0,.18,.50,.22,.16,.43],['arm',.31,.18,-.50,.12,.13,.4],['arm',-.31,.18,-.50,.12,.13,.4]]:[['head',0,1.69,-.01,.135,.17,.14],['torso',0,1.19,0,.235,.35,.17],['arm',.31,1.16,-.08,.115,.33,.15],['arm',-.31,1.16,-.08,.115,.33,.15],['leg',.115,.48,0,.105,.43,.14],['leg',-.115,.48,0,.105,.43,.14]];
  for(const [zone,x,y,z,rx,ry,rz] of volumes){const a=[(origin[0]-x)/rx,(origin[1]-y)/ry,(origin[2]-z)/rz],b=[dir[0]/rx,dir[1]/ry,dir[2]/rz],aa=b.reduce((s,v)=>s+v*v,0),bb=a.reduce((s,v,i)=>s+v*b[i],0),cc=a.reduce((s,v)=>s+v*v,0)-1,disc=bb*bb-aa*cc;if(disc<0)continue;const distance=(-bb-Math.sqrt(disc))/aa;if(distance>=0&&distance<far&&(!best||distance<best.distance))best={victim:e,zone,distance,weak:zone==='head'};}
  return best;
 }
 function meshRay(m,o,d,far,ellipsoid){
  const matrix=BITUME.voiture.euler(...(m.r||[0,0,0])),delta=o.map((v,k)=>v-m.p[k]),local=v=>[0,1,2].map(i=>matrix[i].reduce((n,x,k)=>n+x*v[k],0)),p=local(delta),v=local(d),r=m.s.map(x=>Math.max(.003,x/2));
  if(ellipsoid){const a=p.map((x,k)=>x/r[k]),b=v.map((x,k)=>x/r[k]),aa=b.reduce((n,x)=>n+x*x,0),bb=a.reduce((n,x,k)=>n+x*b[k],0),cc=a.reduce((n,x)=>n+x*x,0)-1,disc=bb*bb-aa*cc;if(disc<0||aa<1e-12)return far;const t=(-bb-Math.sqrt(disc))/aa;return t>=0&&t<far?t:far;}
  let lo=0,hi=far;for(let k=0;k<3;k++){if(Math.abs(v[k])<1e-9){if(Math.abs(p[k])>r[k])return far;}else{let a=(-r[k]-p[k])/v[k],b=(r[k]-p[k])/v[k];if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);if(lo>hi)return far;}}return lo;
 }
 function trace(origin,dir,far){let limit=world.ray(origin,dir,far),result={distance:limit,victim:null,weak:false};for(const e of [...sim.state.enemies,...civils()]){if(e.hp<=0||e.deployed===false||e.inside)continue;if(e.radeCivil||!sim.state.enemies.includes(e))initialize(e,e.id);const d=Math.hypot(e.x-origin[0],e.z-origin[2]);if(d>limit+2)continue;const hit=hitShape(e,origin,dir,limit);if(hit){result=hit;limit=hit.distance;}}for(const c of world.fleet){const e=c.driver;if(!e?.inside||e.hp<=0||c.exploded||Math.hypot(c.x-origin[0],c.z-origin[2])>far+3)continue;
   const actorLimit=result.victim?result.distance:far;if(world.rayBox({...world.carBox(c),maxY:(c.y??.08)+Math.max(2,R.vehicles.SPECS[c.model].height)},origin,dir,actorLimit)>=actorLimit)continue;
   const hardLimit=world.ray(origin,dir,actorLimit,c),meshes=[];R.vehicles.render(c,meshes,{rider:true,distance:0});let solid=hardLimit;
   for(const m of meshes)if(!m.riderPart&&!m.actorZone&&!m.policeUniform&&!m.window&&!m.fx&&m.mat!==19&&m.mat!==8){const d=meshRay(m,origin,dir,solid,false);if(d<solid)solid=d;}
   let hit=null;
   if(R.vehicles.SPECS[c.model].two){for(const m of meshes)if(m.actorZone){const d=meshRay(m,origin,dir,solid,true);if(d<solid&&(!hit||d<hit.distance))hit={victim:e,zone:m.actorZone,distance:d,weak:m.actorZone==='head'};}}
   else{const co=Math.cos(c.cap),si=Math.sin(c.cap),seat=c.model==='firetruck'?1.45:-.34;hit=hitShape({...e,x:c.x+seat*co+.34*si,z:c.z+seat*si-.34*co,baseY:(c.y??.08)+(c.model==='firetruck'?.45:-.51),seated:true,yaw:c.cap+Math.PI/2},origin,dir,solid);if(hit)hit.victim=e;}
   if(hit){result=hit;limit=hit.distance;}
  }return result;}
 function region(e,zone){hits++;e.injury=e.injury||{};e.injury.last=zone||'torso';if(zone==='head'){headshots++;e.injury.head=true;return 1e6;}if(zone==='leg'){e.injury.leg=true;return .55;}if(zone==='arm'){e.injury.arm=true;return .65;}return 1;}
 function hurtCivil(e,amount,zone){initialize(e,e.id);if(e.hp<=0)return;const multiplier=region(e,zone);e.hp=Math.max(0,e.hp-amount*25*multiplier);e.panic=8;e.civil=true;if(e.hp<=0&&!dead.includes(e)){dead.push(e);e.injury.dead=true;}campaign?.crime(zone==='head'||e.hp<=0?2:.7);
  const c=world.fleet.find(c=>c.driver===e);if(c&&e.inside){if(!R.vehicles.SPECS[c.model].two){c.glassBroken=true;c.condition=c.condition||{body:1,engine:1,tires:1,steering:1};}c.ai=false;c.moteur=false;c.uncontrolled=true;e.fear=e.temperament==='provocateur'?0:1;e.grievance=Math.max(e.grievance||0,45);
   if(e.hp<=0&&R.vehicles.SPECS[c.model].two){const co=Math.cos(c.cap),si=Math.sin(c.cap);e.inside=false;e.x=c.x-.45*co;e.z=c.z-.45*si;e.baseY=world.ground?.(e.x,e.z)??.08;e.thrown=1.4;}
  }
 }
 world.combatWorld.traceActors=trace;world.combatWorld.injure=(e,zone)=>region(e,zone);world.combatWorld.hurtCivil=hurtCivil;
 function stolen(c){const e=c.driver;if(!e||e.hp<=0)return;e.hostility=.9;e.fear=e.temperament==='provocateur'?0:.18;e.grievance=90;e.reaction='confront';e.panic=0;e.ownerVehicle=c.id;e.reclaimHold=0;notify('Le conducteur veut récupérer son véhicule.');}
 function ownerMove(e,target,speed,dt){const dx=target.x-e.x,dz=target.z-e.z,d=Math.hypot(dx,dz)||1;let best=null;
  for(const a of [0,.55,-.55,1.05,-1.05,1.57,-1.57]){const x=(dx*Math.cos(a)-dz*Math.sin(a))/d,z=(dx*Math.sin(a)+dz*Math.cos(a))/d,step=Math.min(speed*dt,d);if(world.blocked(e.x+x*.45,e.z+z*.45,.26,world.ground?.(e.x+x*.45,e.z+z*.45)??.08)||world.blocked(e.x+x*step,e.z+z*step,.26,world.ground?.(e.x+x*step,e.z+z*step)??.08))continue;best={x,z,step};break;}
  e.moveSpeed=best?speed:0;if(best){e.x+=best.x*best.step;e.z+=best.z*best.step;e.yaw=Math.atan2(best.x,-best.z);e.baseY=world.ground?.(e.x,e.z)??.08;}
 }
 function ownerUpdate(e,dt,events){
  const c=world.fleet.find(c=>c.driver===e);if(!c||c.police||!e.grievance)return false;
  e.grievance=Math.max(0,e.grievance-dt);e.hostility=Math.max(0,(e.hostility||0)-dt*.004);e.fear=Math.max(0,(e.fear||0)-dt*.045);e.strike=Math.max(0,(e.strike||0)-dt);e.attackWait=Math.max(0,(e.attackWait||0)-dt);
  for(const ev of events){if(!['shot','enemyShot','explosion','vehicleExplosion'].includes(ev.name))continue;const d=Math.hypot(e.x-ev.x,e.z-ev.z);if(d<32)e.fear=Math.min(1,e.fear+(ev.name.includes('xplosion')?.8:.42)*(1-d/40));}
  if(e.hp<50||e.injury?.leg)e.fear=Math.max(e.fear,.8);if(e.temperament==='provocateur')e.fear=0;
  if(e.thrown>0)return true;
  if(e.fear>.62||e.reaction==='flee'&&e.fear>.3){e.reaction='flee';e.reclaimHold=0;ownerMove(e,{x:e.x+(e.x-p.x)*4,z:e.z+(e.z-p.z)*4},e.injury?.leg?.3:3,dt);return true;}
  const distance=Math.hypot(e.x-p.x,e.z-p.z),occupied=world.playerSeated&&world.car===c;
  if(!occupied&&distance<2.8&&e.hostility>.35&&!sim.state.dead){e.reaction='confront';e.reclaimHold=0;ownerMove(e,p,e.injury?.leg?.3:2.1,dt);if(distance<1.45&&e.attackWait<=0&&!e.injury?.leg){const dir=[(p.x-e.x)/(distance||1),0,(p.z-e.z)/(distance||1)];if(world.ray([e.x,(e.baseY??.08)+1.05,e.z],dir,distance)>=distance-.3){sim.hurt(e.injury?.arm?2:5,false,{x:e.x,y:1,z:e.z});e.strike=.4;e.attackWait=1.1;notify('Le propriétaire vous frappe.');}}return true;}
  e.reaction='recover';
  if(c.exploded||Math.hypot(c.x-e.x,c.z-e.z)>70){e.reaction='flee';e.grievance=0;return false;}
  const spec=R.vehicles.SPECS[c.model],co=Math.cos(c.cap),si=Math.sin(c.cap),doors=[-1,1].map(side=>({x:c.x-si*side*(spec.width/2+.65),z:c.z+co*side*(spec.width/2+.65)})).filter(q=>!world.blocked(q.x,q.z,.28,world.ground?.(q.x,q.z)??.08)).sort((a,b)=>Math.hypot(a.x-e.x,a.z-e.z)-Math.hypot(b.x-e.x,b.z-e.z)),door=doors[0];
  if(!door)return true;ownerMove(e,door,e.injury?.leg?.3:2.3,dt);const near=Math.hypot(e.x-door.x,e.z-door.z)<.42;
  e.reclaimHold=near&&c.v<.7&&!e.injury?.leg?(e.reclaimHold||0)+dt:0;
  if(e.reclaimHold>1.8&&onReclaim(c,e,door)!==false){e.inside=true;e.reaction='driving';e.grievance=0;e.panic=0;e.moveSpeed=0;c.ai=true;c.moteur=true;c.uncontrolled=false;notify('Le propriétaire reprend son véhicule.');}
  return true;
 }
 function update(dt,events){
  for(const e of lastRoom)remember(e);lastRoom=world.room?.civil||[];
  for(const e of lastRoom)initialize(e,e.id);for(const e of urban?.crew||[])initialize(e,e.id);drivers();
  for(const c of world.fleet)if(c.uncontrolled){if(world.car===c&&world.playerSeated){c.uncontrolled=false;continue;}R.vehicles.step(c,{gaz:0,frein:.8,volant:(c.volant||0)*.8},world,dt);if(c.v<.1){c.u=c.w=c.v=c.omega=0;c.uncontrolled=false;}}
  for(const [id,e] of merchants)if(e.hp<=0){const site=campaign.sites.find(s=>s.id===id);if(site)site.closed=true;}
  for(const e of sim.state.enemies)if(e.injury){if(e.injury.leg)e.y=e.baseY+.4;if(e.hp<=0)e.injury.dead=true;}
  for(const ev of events)if(ev.name==='explosion')for(const e of civils()){if(e.inside||e.hp<=0)continue;const d=Math.hypot(e.x-ev.x,e.z-ev.z);if(d<ev.radius&&world.ray([ev.x,1,ev.z],[(e.x-ev.x)/(d||1),0,(e.z-ev.z)/(d||1)],Math.max(0,d-.3))>=d-.4)hurtCivil(e,(1-d/ev.radius)*2,'torso');}
  for(const e of [...world.fleet.map(c=>c.driver).filter(e=>e&&!e.inside),...merchants.values()]){if(e.hp<=0)continue;e.thrown=Math.max(0,(e.thrown||0)-dt);if(e.footPolice)continue;if(ownerUpdate(e,dt,events))continue;if(e.thrown)continue;if(e.panic>0){e.panic-=dt;const dx=e.x-p.x,dz=e.z-p.z,d=Math.hypot(dx,dz)||1,v=e.injury?.leg?.35:2.1;e.yaw=Math.atan2(dx,-dz);if(!world.blocked(e.x+dx/d*v*dt,e.z,.28,world.ground?.(e.x+dx/d*v*dt,e.z)??.08))e.x+=dx/d*v*dt;if(!world.blocked(e.x,e.z+dz/d*v*dt,.28,world.ground?.(e.x,e.z+dz/d*v*dt)??.08))e.z+=dz/d*v*dt;e.moveSpeed=v;e.baseY=world.ground?.(e.x,e.z)??.08;}}
 }
 function geometry(time){const out=[];for(const e of [...crowd.people.filter(e=>e.injury||e.aggression>0),...(world.boundaryOfficers||[]).filter(e=>e.hp<=0),...world.fleet.map(c=>c.driver).filter(e=>e&&!e.inside),...merchants.values(),...sim.state.enemies.filter(e=>e.hp<=0&&e.injury)])if(!e.footPolice&&Math.hypot(e.x-p.x,e.z-p.z)<100)out.push(...R.people.build({...e,civil:e.radeCivil,renderBody:true,yaw:e.yaw??Math.PI-e.cap},{time,distance:Math.hypot(e.x-p.x,e.z-p.z)}));return out;}
 function save(){for(const e of [...lastRoom,...civils(),...world.fleet.map(c=>c.driver).filter(Boolean)])remember(e);return {people:[...records.values()],enemies:sim.state.enemies.filter(e=>e.injury).map(e=>({id:e.id,injury:e.injury}))};}
 if(saved){for(const d of saved.enemies||[]){const e=sim.state.enemies[d?.id];if(e&&d.injury)e.injury={head:!!d.injury.head,leg:!!d.injury.leg,arm:!!d.injury.arm,dead:e.hp<=0};}}
 update(0,[]);
 return {trace,hitShape,hurtCivil,stolen,update,geometry,save,merchants,get stats(){return {hits,headshots};}};
}
R.injuries={create};})(globalThis.RADE);
