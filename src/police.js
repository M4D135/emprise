/* EMPRISE — existing patrol drivers dismount, investigate and arrest on foot. */
(function(R){'use strict';
const STATES=['ride','exiting','pursuit','search','return','stranded','dead'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),finite=Number.isFinite,MAX_ROUTE=384;
function create(world,sim,{traffic,campaign,saved=null,notify=()=>{}}={}){
 const player=sim.state.player,cars=(traffic?.cars||[]).filter(c=>c.police).slice(0,3),officers=[],units=[],metrics={exits:0,boarded:0,pathRequests:0,pathExpansions:0,maxPathExpansions:0,routeDeferred:0,stuckRecoveries:0,blockedExits:0};
 let clock=0,nextRoute=0,radioAt=0,seen=false,routeUsed=false,peopleAt=0;const peopleGrid=new Map();
 const ground=(x,z)=>world.ground(x,z),valid=(x,z)=>finite(x)&&finite(z)&&x>world.bounds.minX+.35&&x<world.bounds.maxX-.35&&z>world.bounds.minZ+.35&&z<world.bounds.maxZ-.35;
 const free=(x,z,r=.3)=>valid(x,z)&&!world.water?.(x,z)&&!world.blocked(x,z,r,ground(x,z),1.8);
 function line(a,b,ay=1.4,by=1.4){const dx=b.x-a.x,dz=b.z-a.z,dy=(b.baseY??b.y??ground(b.x,b.z))+by-(a.baseY??a.y??ground(a.x,a.z))-ay,d=Math.hypot(dx,dy,dz);return d<.001||world.ray([a.x,(a.baseY??a.y??ground(a.x,a.z))+ay,a.z],[dx/d,dy/d,dz/d],d)>=d-.025;}
 function segment(ax,az,bx,bz){const n=Math.ceil(Math.hypot(bx-ax,bz-az)/.25);if(n>144)return false;for(let i=1;i<=n;i++)if(!free(ax+(bx-ax)*i/n,az+(bz-az)*i/n))return false;return true;}
 function doorPoints(c){const width=R.vehicles.SPECS[c.model].width/2+.52,co=Math.cos(c.cap),si=Math.sin(c.cap),out=[];for(const side of [-1,1])for(const fore of [0,.7,-.7])out.push({x:c.x-si*width*side+co*fore,z:c.z+co*width*side+si*fore});return out;}
 function exitPoint(c){return doorPoints(c).find(q=>free(q.x,q.z)&&world.withoutCar(()=>segment(c.x,c.z,q.x,q.z)))||null;}
 function remember(u,x,z){if(!valid(x,z))return;u.last={x,z,time:clock};u.actor.alert=.7;if(u.state==='search'||u.state==='return'||u.state==='stranded')u.state='pursuit';}
 function clearPath(u){u.path=[];u.at=0;u.goal=null;}
 function park(c){c.ai=false;c.moteur=false;c.u=c.v=c.w=c.omega=0;c.siren=false;}
 for(const c of cars){
  const e=c.driver||(c.driver={id:14000+c.id,x:c.x,z:c.z,hp:100,inside:true,civil:true});
  if(!Number.isInteger(e.id))e.id=14000+c.id;if(!finite(e.hp))e.hp=100;if(typeof e.inside!=='boolean')e.inside=true;if(!e.inside&&!valid(e.x,e.z)){e.inside=true;e.x=c.x;e.z=c.z;}
  Object.assign(e,{police:true,footPolice:true,civil:true,radeCivil:true,baseY:e.baseY??ground(e.x,e.z)});officers.push(e);
  units.push({car:c,actor:e,state:e.hp<=0?'dead':e.inside?'ride':'return',last:null,path:[],at:0,goal:null,scanAt:0,routeAt:0,exitUntil:0,boardAfter:0,searchStep:0,searchAt:0,stuck:0,failures:0,visible:false,visibleAt:-100,radioSeq:-1});
 }
 world.policeOfficers=officers;
 function refreshPeople(){peopleGrid.clear();for(const e of [...(world.pedestrians||[]),...(world.boundaryOfficers||[]),...sim.state.enemies,...officers]){if(!e||e.hp<=0||e.inside||e.deployed===false)continue;const key=Math.floor(e.x/2)+','+Math.floor(e.z/2);if(!peopleGrid.has(key))peopleGrid.set(key,[]);peopleGrid.get(key).push(e);}}
 function personFree(e,x,z){const gx=Math.floor(x/2),gz=Math.floor(z/2);for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)for(const other of peopleGrid.get((gx+dx)+','+(gz+dz))||[])if(other!==e&&Math.hypot(other.x-x,other.z-z)<.60)return false;return true;}
 function findRoute(u,target){
  if(clock<u.routeAt)return false;u.routeAt=clock+1+u.car.id%3*.07;
  if(segment(u.actor.x,u.actor.z,target.x,target.z)){u.path=[{...target}];u.at=0;u.goal={...target};u.failures=0;return true;}
  if(routeUsed||clock<nextRoute){metrics.routeDeferred++;u.routeAt=clock+.19;return false;}
  routeUsed=true;nextRoute=clock+.18;metrics.pathRequests++;
  const start={x:u.actor.x,z:u.actor.z},cell=.9,range=24,dx=target.x-start.x,dz=target.z-start.z,d=Math.hypot(dx,dz),goal=d>21?{x:start.x+dx/d*21,z:start.z+dz/d*21}:target;
  const nodes=new Map(),heap=[];let order=0,expanded=0,found=null;
  const heuristic=(x,z)=>Math.hypot(x-goal.x,z-goal.z),key=(ix,iz)=>ix+','+iz;
  function push(n){let at=heap.length;heap.push(n);while(at){const p=(at-1)>>1;if(heap[p].f<n.f||heap[p].f===n.f&&heap[p].order<n.order)break;heap[at]=heap[p];at=p;}heap[at]=n;}
  function pop(){const first=heap[0],tail=heap.pop();if(heap.length){let at=0;while(at*2+1<heap.length){let q=at*2+1;if(q+1<heap.length&&(heap[q+1].f<heap[q].f||heap[q+1].f===heap[q].f&&heap[q+1].order<heap[q].order))q++;if(tail.f<heap[q].f||tail.f===heap[q].f&&tail.order<heap[q].order)break;heap[at]=heap[q];at=q;}heap[at]=tail;}return first;}
  const first={ix:0,iz:0,x:start.x,z:start.z,g:0,f:heuristic(start.x,start.z),parent:null,order:order++};nodes.set('0,0',first);push(first);
  while(heap.length&&expanded<MAX_ROUTE){const n=pop();if(n.closed)continue;n.closed=true;expanded++;if(heuristic(n.x,n.z)<.95&&segment(n.x,n.z,goal.x,goal.z)){found=n;break;}
   for(const [ox,oz]of [[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[-1,-1],[1,-1]]){const ix=n.ix+ox,iz=n.iz+oz;if(Math.abs(ix)>range||Math.abs(iz)>range)continue;const k=key(ix,iz),old=nodes.get(k);if(old?.closed)continue;const x=start.x+ix*cell,z=start.z+iz*cell,g=n.g+Math.hypot(ox,oz)*cell;if(old&&old.g<=g||!segment(n.x,n.z,x,z))continue;const q={ix,iz,x,z,g,f:g+heuristic(x,z)*1.08,parent:n,order:order++};nodes.set(k,q);push(q);}
  }
  metrics.pathExpansions+=expanded;metrics.maxPathExpansions=Math.max(metrics.maxPathExpansions,expanded);
  if(!found){u.failures++;u.routeAt=clock+Math.min(3,1+u.failures*.4);clearPath(u);return false;}
  const points=[{x:goal.x,z:goal.z}];for(let n=found;n.parent;n=n.parent)points.push({x:n.x,z:n.z});points.reverse();u.path=points;u.at=0;u.goal={...target};u.failures=0;return true;
 }
 function walk(u,target,dt,speed){
  const e=u.actor;if(Math.hypot(target.x-e.x,target.z-e.z)<.20){e.moveSpeed=0;return true;}
  if(!u.path.length||u.at>=u.path.length||!u.goal||Math.hypot(u.goal.x-target.x,u.goal.z-target.z)>2.2)findRoute(u,target);
  const q=u.path[u.at];if(!q){e.moveSpeed=0;return false;}const dx=q.x-e.x,dz=q.z-e.z,d=Math.hypot(dx,dz);
  if(d<.13){u.at++;return false;}const travel=Math.min(d,speed*dt),ox=e.x,oz=e.z,x=e.x+dx/d*travel,z=e.z+dz/d*travel;
  if(free(x,z)&&personFree(e,x,z)){e.x=x;e.z=z;}else if(free(x,e.z)&&personFree(e,x,e.z))e.x=x;else if(free(e.x,z)&&personFree(e,e.x,z))e.z=z;
  const moved=Math.hypot(e.x-ox,e.z-oz);e.moveSpeed=dt?moved/dt:0;e.walkDistance=(e.walkDistance||0)+moved;if(moved>.00001)e.yaw=Math.atan2(e.x-ox,oz-e.z);e.baseY=ground(e.x,e.z);
  if(moved<travel*.15)u.stuck+=dt;else u.stuck=Math.max(0,u.stuck-dt*2);
  if(u.stuck>1){u.stuck=0;clearPath(u);metrics.stuckRecoveries++;}
  return Math.hypot(target.x-e.x,target.z-e.z)<.20;
 }
 function dismount(u){const c=u.car,e=u.actor;if(c.policeStolen)return false;const q=exitPoint(c);if(!q){metrics.blockedExits++;u.boardAfter=clock+1;return false;}
  park(c);Object.assign(e,{x:q.x,z:q.z,inside:false,baseY:ground(q.x,q.z),yaw:c.cap+Math.PI/2,moveSpeed:0,panic:0});u.state='exiting';u.exitUntil=clock+.55;u.routeAt=clock;clearPath(u);metrics.exits++;notify('Police · Arrêtez-vous !');return true;
 }
 function board(u){const c=u.car,e=u.actor;if(c.policeStolen||c.exploded||world.car===c&&world.playerSeated||Math.abs(c.v||0)>.5||e.injury?.leg)return false;
  const q=doorPoints(c).find(q=>free(q.x,q.z)&&Math.hypot(e.x-q.x,e.z-q.z)<.55&&segment(e.x,e.z,q.x,q.z));if(!q)return false;
  Object.assign(e,{inside:true,x:c.x,z:c.z,yaw:c.cap+Math.PI/2,moveSpeed:0,alert:0,panic:0});c.ai=true;c.moteur=true;c.state='patrol';c.path=[];c.sensorAt=0;c.reverse=0;c.stuck=0;u.state='ride';u.last=null;u.boardAfter=clock+5;u.visible=false;clearPath(u);metrics.boarded++;return true;
 }
 function update(dt,{seated=false,vehicle=null,speed=0,hidden=false}={}){
  if(!finite(dt)||dt<0)return;clock+=dt;dt=Math.min(dt,.1);routeUsed=false;seen=false;const law=campaign.law,wanted=clamp(Number(law.wanted)||0,0,5),searchLife=12+Math.min(3,wanted)*2;
  if(clock>=peopleAt){peopleAt=clock+.2;refreshPeople();}
  for(const u of units){const e=u.actor,c=u.car;e.moveSpeed=0;e.panic=0;
   if(e.hp<=0){u.state='dead';u.visible=false;e.alert=0;if(!e.inside&&c.ai)park(c);continue;}
   if(e.inside){u.state='ride';u.visible=false;e.x=c.x;e.z=c.z;
    if(!wanted||law.cooldown>0||clock<u.boardAfter||!c.ai||c.policeStolen||c.exploded||Math.abs(c.v||0)>.8||hidden||seated&&speed>=1.8)continue;
    const d=Math.hypot(player.x-c.x,player.z-c.z),intel=c.lastKnown;
    const visual=d<=15&&line({x:c.x,z:c.z,baseY:ground(c.x,c.z)},player,1.65,seated&&vehicle?Math.max(1.4,(R.vehicles.SPECS[vehicle.model]?.height||1.4)+.15):1.4);
    const report=intel&&traffic.time-intel.time<7&&Math.hypot(intel.x-c.x,intel.z-c.z)<13;
    if(c.state!=='pursuit'&&c.state!=='search'||!visual&&!report||units.filter(q=>!q.actor.inside&&q.actor.hp>0&&['exiting','pursuit','search'].includes(q.state)).length>=Math.ceil(Math.min(3,wanted)))continue;
    if(dismount(u)){if(visual)remember(u,player.x,player.z);else remember(u,intel.x,intel.z);}continue;
   }
   if(u.state==='ride'){u.state='return';clearPath(u);}
   if(clock<u.exitUntil||(e.thrown||0)>0)continue;
   if(u.state==='exiting')u.state=u.last?'pursuit':'return';
   if(hidden||!wanted||law.cooldown>0){u.visible=false;if(!wanted||law.cooldown>0){u.state='return';u.last=null;e.alert=0;}}
   if(wanted&&law.cooldown<=0&&!hidden&&clock>=u.scanAt){u.scanAt=clock+.2+u.car.id%3*.015;const d=Math.hypot(player.x-e.x,player.z-e.z);u.visible=d<38&&line(e,player,e.injury?.leg?.45:1.5,seated&&vehicle?Math.max(1.4,(R.vehicles.SPECS[vehicle.model]?.height||1.4)+.15):1.4);if(u.visible){u.visibleAt=clock;remember(u,player.x,player.z);u.state='pursuit';}}
   if(u.visible&&wanted&&!hidden){seen=true;if(clock>=radioAt){radioAt=clock+1;law.lastKnown={x:u.last.x,z:u.last.z};law.reportRevision=(Number(law.reportRevision)||0)+1;}for(const ally of units)if(ally!==u&&!ally.actor.inside&&ally.actor.hp>0&&Math.hypot(ally.actor.x-e.x,ally.actor.z-e.z)<35&&(!ally.last||ally.last.time<u.last.time))remember(ally,u.last.x,u.last.z);}
   const intel=traffic.intel;if(wanted&&u.state!=='return'&&intel?.valid&&intel.seq!==u.radioSeq){u.radioSeq=intel.seq;const age=traffic.time-intel.time;if(age>=0&&age<1&&Math.hypot(intel.x-e.x,intel.z-e.z)<38&&(!u.last||clock-age>u.last.time)){u.last={x:intel.x,z:intel.z,time:clock-age};}}
   if(u.last&&(clock-u.last.time>searchLife||Math.hypot(e.x-c.x,e.z-c.z)>60)){u.state='return';u.last=null;u.visible=false;clearPath(u);}
   const pace=e.injury?.leg?.32:e.hp<45?1.65:2.65;
   if(u.state==='return'||u.state==='stranded'){
    e.alert=0;u.visible=false;if(board(u))continue;
    if(c.policeStolen||c.exploded||world.car===c&&world.playerSeated||Math.hypot(c.x-e.x,c.z-e.z)>75){u.state='stranded';clearPath(u);continue;}
    const target=doorPoints(c).filter(q=>free(q.x,q.z)).sort((a,b)=>Math.hypot(a.x-e.x,a.z-e.z)-Math.hypot(b.x-e.x,b.z-e.z))[0];if(target)walk(u,target,dt,Math.min(1.6,pace));continue;
   }
   if(!u.last){u.state='return';continue;}
   const distance=Math.hypot(u.last.x-e.x,u.last.z-e.z);
   if(u.visible){e.yaw=Math.atan2(u.last.x-e.x,e.z-u.last.z);const stop=seated?2.35:1.25;if(distance>stop||seated&&vehicle){const target=seated&&vehicle?doorPoints(vehicle).filter(q=>free(q.x,q.z)).sort((a,b)=>Math.hypot(a.x-e.x,a.z-e.z)-Math.hypot(b.x-e.x,b.z-e.z))[0]:{x:u.last.x+(e.x-u.last.x)/distance*stop,z:u.last.z+(e.z-u.last.z)/distance*stop};if(target)walk(u,target,dt,pace);}else clearPath(u);}
   else if(distance>1.1&&u.state!=='search'){walk(u,u.last,dt,pace);}
   else{u.state='search';if(clock>=u.searchAt){u.searchAt=clock+2.5;u.searchStep++;clearPath(u);}const angle=(u.searchStep+u.car.id)*2.399963,target={x:u.last.x+Math.cos(angle)*2.8,z:u.last.z+Math.sin(angle)*2.8};walk(u,target,dt,Math.min(1.5,pace));}
  }
 }
 function arrestStatus(target=player,{seated=false,vehicle=null,speed=0,hidden=false}={}){
  const law=campaign.law;if(hidden||world.room||target.hp<=0||!law.wanted||law.cooldown>0||seated&&speed>=1.8)return {eligible:false,reason:'unavailable',officerId:null,stationId:null};
  const u=units.find(u=>!u.actor.inside&&u.actor.hp>0&&!u.actor.injury?.leg&&u.state==='pursuit'&&clock>=u.exitUntil&&u.visible&&(seated&&vehicle?doorPoints(vehicle).some(q=>Math.hypot(u.actor.x-q.x,u.actor.z-q.z)<.85&&line(u.actor,q)&&segment(u.actor.x,u.actor.z,q.x,q.z)):Math.hypot(u.actor.x-target.x,u.actor.z-target.z)<(seated?2.8:1.9)&&line(u.actor,target,1.4,seated?1.55:1.1)));
  return {eligible:!!u,reason:u?'ok':'distance',officerId:u?.actor.id??null,stationId:null};
 }
 function geometry(time=clock,camera){const origin=camera?.pos||[player.x,player.y,player.z],out=[];for(const e of officers)if(!e.inside){const distance=Math.hypot(e.x-origin[0],e.z-origin[2]);if(distance<100)out.push(...R.people.build({...e,renderBody:true},{time,distance}));}return out;}
 function save(){return {version:1,clock,nextRoute,radioAt,units:units.map(u=>({carId:u.car.id,stolen:!!u.car.policeStolen,state:u.state,last:u.last?{...u.last}:null,path:u.path.map(q=>({...q})),at:u.at,goal:u.goal?{...u.goal}:null,scanAt:u.scanAt,routeAt:u.routeAt,exitUntil:u.exitUntil,boardAfter:u.boardAfter,searchStep:u.searchStep,searchAt:u.searchAt,stuck:u.stuck,failures:u.failures,visibleAt:u.visibleAt,radioSeq:u.radioSeq,actor:{x:u.actor.x,z:u.actor.z,yaw:u.actor.yaw||0,hp:u.actor.hp,inside:!!u.actor.inside,walkDistance:u.actor.walkDistance||0,injury:u.actor.injury?{head:!!u.actor.injury.head,leg:!!u.actor.injury.leg,arm:!!u.actor.injury.arm,dead:u.actor.hp<=0}:null}}))};}
 if(saved?.version===1&&finite(saved.clock)&&saved.clock>=0&&saved.clock<1e9&&Array.isArray(saved.units)){
  clock=saved.clock;nextRoute=finite(saved.nextRoute)?clamp(saved.nextRoute,clock,clock+3):clock;radioAt=finite(saved.radioAt)?clamp(saved.radioAt,clock,clock+1):clock;
  const restored=new Set();for(const data of saved.units.slice(0,3)){const u=units.find(u=>u.car.id===data?.carId),a=data?.actor;if(u&&data.stolen===true)u.car.policeStolen=true;if(!u||restored.has(u)||!a||a.injury!==null&&a.injury!==undefined&&(!a.injury||!['head','leg','arm','dead'].every(k=>typeof a.injury[k]==='boolean'))||!STATES.includes(data.state)||typeof a.inside!=='boolean'||!finite(a.hp)||a.hp<0||a.hp>100||!finite(a.yaw)||!valid(a.x,a.z)||!a.inside&&!free(a.x,a.z))continue;
   restored.add(u);const point=q=>q&&valid(q.x,q.z),last=point(data.last)&&finite(data.last.time)&&data.last.time>=0&&data.last.time<=clock?{x:data.last.x,z:data.last.z,time:data.last.time}:null;
   Object.assign(u.actor,{x:a.inside?u.car.x:a.x,z:a.inside?u.car.z:a.z,yaw:a.yaw,hp:Math.min(u.actor.hp,a.hp),inside:a.inside,walkDistance:finite(a.walkDistance)?clamp(a.walkDistance,0,1e9):0});
   if(a.injury&&typeof a.injury==='object')u.actor.injury={head:!!a.injury.head||!!u.actor.injury?.head,leg:!!a.injury.leg||!!u.actor.injury?.leg,arm:!!a.injury.arm||!!u.actor.injury?.arm,dead:u.actor.hp<=0};u.actor.baseY=ground(u.actor.x,u.actor.z);
   u.state=u.actor.hp<=0?'dead':a.inside?'ride':data.state==='ride'?'return':data.state;u.last=last;
   for(const name of ['scanAt','routeAt','exitUntil','boardAfter','searchAt'])u[name]=finite(data[name])?clamp(data[name],clock-3,clock+5):clock;
   for(const name of ['searchStep','failures','radioSeq'])u[name]=Number.isSafeInteger(data[name])?clamp(data[name],-1,1e9):0;
   u.stuck=finite(data.stuck)?clamp(data.stuck,0,1):0;u.visibleAt=-100;u.visible=false;u.goal=point(data.goal)?{x:data.goal.x,z:data.goal.z}:null;
   u.path=(Array.isArray(data.path)?data.path:[]).slice(0,64).filter(point).map(q=>({x:q.x,z:q.z}));u.at=Number.isInteger(data.at)?clamp(data.at,0,u.path.length):0;
   if(!a.inside)park(u.car);
  }
 }
 return {actors:officers,units,update,arrestStatus,geometry,save,metrics,get seen(){return seen;},get time(){return clock;}};
}
R.police={create};})(globalThis.RADE);
