/* RADE — human hit regions shared by gang combat, civilians and vehicle drivers. */
(function(R){'use strict';
function create(world,sim,crowd,{interiors,urban,campaign,saved}={}){const dead=[],p=sim.state.player,merchants=new Map(),records=new Map((Array.isArray(saved?.people)?saved.people:[]).filter(d=>Number.isInteger(d?.id)).map(d=>[d.id,d])),registered=new WeakSet();let hits=0,headshots=0,lastRoom=[];
 const civils=()=>[...crowd.people,...world.fleet.map(c=>c.driver).filter(e=>e&&!e.inside),...(world.room?.civil||[]),...(urban?.crew||[]),...merchants.values()];
 function initialize(e,id){
  if(e.hp===undefined)e.hp=100;e.radeCivil=true;if(e.id===undefined)e.id=id;if(e.baseY===undefined)e.baseY=.08;
  if(!registered.has(e)){registered.add(e);const d=records.get(e.id);if(d&&[d.x,d.z,d.hp].every(Number.isFinite)&&Math.abs(d.x)<1100&&Math.abs(d.z)<1100){Object.assign(e,{x:d.x,z:d.z,hp:Math.max(0,Math.min(100,d.hp)),yaw:Number.isFinite(d.yaw)?d.yaw:0,injury:d.injury?{head:!!d.injury.head,leg:!!d.injury.leg,arm:!!d.injury.arm,dead:d.hp<=0}:null});if(typeof d.inside==='boolean')e.inside=d.inside;}}
  return e;
 }
 function remember(e){if(e.injury||e.hp<100||e.inside===false)records.set(e.id,{id:e.id,x:e.x,z:e.z,hp:e.hp,injury:e.injury,yaw:e.yaw,inside:e.inside});}
 function drivers(){for(const c of world.fleet){if(!c.driver&&!c.parked&&(c.ai||c.emergency||records.has(14000+c.id)))c.driver=initialize({id:14000+c.id,inside:true,civil:true,hp:100,x:c.x,z:c.z},14000+c.id);if(c.driver){if(c.driver.inside){c.driver.x=c.x;c.driver.z=c.z;c.driver.yaw=c.cap+Math.PI/2;}else{c.ai=false;c.emergency=false;}if(c.driver.hp<=0&&c.driver.inside){c.ai=false;c.moteur=false;}}}}
 drivers();
 for(let i=0;i<crowd.people.length;i++)initialize(crowd.people[i],i+10000);
 for(const site of campaign?.sites||[])if(site.kind==='shop')merchants.set(site.id,initialize({x:site.x+.7,z:site.z-1.45,yaw:Math.PI,civil:true},12000+merchants.size));
 function hitShape(e,o,d,far){const prone=!!e.injury?.leg,base=e.baseY??.08,yaw=e.yaw??Math.PI-e.cap,c=Math.cos(yaw),s=Math.sin(yaw),v=[o[0]-e.x,o[1]-base,o[2]-e.z],origin=[v[0]*c+v[2]*s,v[1],-v[0]*s+v[2]*c],dir=[d[0]*c+d[2]*s,d[1],-d[0]*s+d[2]*c];let best=null;
  const volumes=prone?[['head',0,.43,-.70,.15,.17,.15],['torso',0,.34,-.20,.25,.17,.45],['leg',0,.18,.50,.22,.16,.43],['arm',.31,.18,-.50,.12,.13,.4],['arm',-.31,.18,-.50,.12,.13,.4]]:[['head',0,1.69,-.01,.135,.17,.14],['torso',0,1.19,0,.235,.35,.17],['arm',.31,1.16,-.08,.115,.33,.15],['arm',-.31,1.16,-.08,.115,.33,.15],['leg',.115,.48,0,.105,.43,.14],['leg',-.115,.48,0,.105,.43,.14]];
  for(const [zone,x,y,z,rx,ry,rz] of volumes){const a=[(origin[0]-x)/rx,(origin[1]-y)/ry,(origin[2]-z)/rz],b=[dir[0]/rx,dir[1]/ry,dir[2]/rz],aa=b.reduce((s,v)=>s+v*v,0),bb=a.reduce((s,v,i)=>s+v*b[i],0),cc=a.reduce((s,v)=>s+v*v,0)-1,disc=bb*bb-aa*cc;if(disc<0)continue;const distance=(-bb-Math.sqrt(disc))/aa;if(distance>=0&&distance<far&&(!best||distance<best.distance))best={victim:e,zone,distance,weak:zone==='head'};}
  return best;
 }
 function trace(origin,dir,far){let limit=world.ray(origin,dir,far),result={distance:limit,victim:null,weak:false};for(const e of [...sim.state.enemies,...civils()]){if(e.hp<=0||e.deployed===false||e.inside)continue;if(e.radeCivil||!sim.state.enemies.includes(e))initialize(e,e.id);const d=Math.hypot(e.x-origin[0],e.z-origin[2]);if(d>limit+2)continue;const hit=hitShape(e,origin,dir,limit);if(hit){result=hit;limit=hit.distance;}}return result;}
 function region(e,zone){hits++;e.injury=e.injury||{};e.injury.last=zone||'torso';if(zone==='head'){headshots++;e.injury.head=true;return 1e6;}if(zone==='leg'){e.injury.leg=true;return .55;}if(zone==='arm'){e.injury.arm=true;return .65;}return 1;}
 function hurtCivil(e,amount,zone){initialize(e,e.id);if(e.hp<=0)return;const multiplier=region(e,zone);e.hp=Math.max(0,e.hp-amount*25*multiplier);e.panic=8;e.civil=true;if(e.hp<=0&&!dead.includes(e)){dead.push(e);e.injury.dead=true;}campaign?.crime(zone==='head'||e.hp<=0?2:.7);}
 world.combatWorld.traceActors=trace;world.combatWorld.injure=(e,zone)=>region(e,zone);world.combatWorld.hurtCivil=hurtCivil;
 function update(dt,events){
  for(const e of lastRoom)remember(e);lastRoom=world.room?.civil||[];
  for(const e of lastRoom)initialize(e,e.id);for(const e of urban?.crew||[])initialize(e,e.id);drivers();
  for(const [id,e] of merchants)if(e.hp<=0){const site=campaign.sites.find(s=>s.id===id);if(site)site.closed=true;}
  for(const e of sim.state.enemies)if(e.injury){if(e.injury.leg)e.y=e.baseY+.4;if(e.hp<=0)e.injury.dead=true;}
  for(const ev of events)if(ev.name==='explosion')for(const e of civils()){if(e.inside||e.hp<=0)continue;const d=Math.hypot(e.x-ev.x,e.z-ev.z);if(d<ev.radius&&world.ray([ev.x,1,ev.z],[(e.x-ev.x)/(d||1),0,(e.z-ev.z)/(d||1)],Math.max(0,d-.3))>=d-.4)hurtCivil(e,(1-d/ev.radius)*2,'torso');}
  for(const e of [...world.fleet.map(c=>c.driver).filter(e=>e&&!e.inside),...merchants.values()]){if(e.hp<=0)continue;e.thrown=Math.max(0,(e.thrown||0)-dt);if(e.thrown)continue;if(e.panic>0){e.panic-=dt;const dx=e.x-p.x,dz=e.z-p.z,d=Math.hypot(dx,dz)||1,v=e.injury?.leg?.35:2.1;e.yaw=Math.atan2(dx,-dz);if(!world.blocked(e.x+dx/d*v*dt,e.z,.28))e.x+=dx/d*v*dt;if(!world.blocked(e.x,e.z+dz/d*v*dt,.28))e.z+=dz/d*v*dt;e.moveSpeed=v;}}
 }
 function geometry(time){const out=[];for(const e of [...crowd.people.filter(e=>e.injury),...world.fleet.map(c=>c.driver).filter(e=>e&&!e.inside),...merchants.values(),...sim.state.enemies.filter(e=>e.hp<=0&&e.injury)])if(Math.hypot(e.x-p.x,e.z-p.z)<100)out.push(...R.people.build({...e,civil:e.radeCivil,renderBody:true,yaw:e.yaw??Math.PI-e.cap},{time,distance:Math.hypot(e.x-p.x,e.z-p.z)}));return out;}
 function save(){for(const e of [...lastRoom,...civils(),...world.fleet.map(c=>c.driver).filter(Boolean)])remember(e);return {people:[...records.values()],enemies:sim.state.enemies.filter(e=>e.injury).map(e=>({id:e.id,injury:e.injury}))};}
 if(saved){for(const d of saved.enemies||[]){const e=sim.state.enemies[d?.id];if(e&&d.injury)e.injury={head:!!d.injury.head,leg:!!d.injury.leg,arm:!!d.injury.arm,dead:e.hp<=0};}}
 update(0,[]);
 return {trace,hitShape,hurtCivil,update,geometry,save,merchants,get stats(){return {hits,headshots};}};
}
R.injuries={create};})(globalThis.RADE);
