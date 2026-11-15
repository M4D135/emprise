/* RADE — street graph, civilian traffic and bounded police pursuit. */
(function(R){
'use strict';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const angle=a=>Math.atan2(Math.sin(a),Math.cos(a));

// Police behaviour bounds. These are deliberately plain constants so tests can
// assert the contract without inspecting implementation details.
const SIGHT_RANGE=72;          // metres, actual static line of sight required
const SENSOR_INTERVAL=.2;      // <= 5 Hz
const SEEN_GRACE=.65;          // aggregate law.seen survives between sensor ticks
const ROUTE_LIMIT=320;         // graph expansions per route request
const ROUTE_INTERVAL=1;        // <= 1 route request per car per second
const ARREST_RANGE=6;
const ARREST_OFFICER_SPEED=3;
const ARREST_STOP=5.2;         // stop before touching an arrestable player
const DIRECT_RANGE=22;         // short visible approach, otherwise road route
const PATROL_SPEED=7;
const PURSUIT_SPEED=[0,10,11.5,13];

function create(world,{count=12}={}){
 const random=PDR.villeReelle.hasard(881);
 const nodes=[],edges=[],ids=new Map(),cars=[];
 let clock=0,tick=0;
 let lawRef=null;
 let lastReportRevision=0;
 let freshReport=false;

 // Shared radio memory. It only ever receives an actually observed point or a
 // single explicit crime report; hidden player coordinates are never copied.
 let intel={seq:0,time:-Infinity,x:0,z:0,vx:0,vz:0,valid:false};
 let active=[];
 let nextDispatchAt=0;
 let lastWanted=0;
 let dispatchAt=0;

 const metrics={pathRequests:0,pathExpansions:0,maxPathExpansions:0,recoveries:0};

 const staticFree=(x,z,r=.92)=>world.withoutCar(()=>!world.blocked(x,z,r,.08,1.6));

 function node(x,z){
  const key=x.toFixed(1)+','+z.toFixed(1);
  if(ids.has(key))return ids.get(key);
  const id=nodes.length;
  nodes.push({x,z,links:[]});
  ids.set(key,id);
  return id;
 }

 // Build the original core first so extension never reshuffles initial vehicles.
 function buildRoads(bounds,extension=false){
 for(const edge of world.city.rues.aretes){
  if(!['rue','secondaire','tertiaire','desserte','voie-bus'].includes(edge.sorte)||edge.largeur<3.5)continue;
  const p=edge.points;
  let prev=-1;
  for(let k=2;k<p.length;k+=2){
   const dx=p[k]-p[k-2],dz=p[k+1]-p[k-1],length=Math.hypot(dx,dz),n=Math.max(1,Math.ceil(length/7));
   for(let j=k===2?0:1;j<=n;j++){
    const x=p[k-2]+dx*j/n,z=p[k-1]+dz*j/n;
    if(x<bounds.minX||x>bounds.maxX||z<bounds.minZ||z>bounds.maxZ||!staticFree(x,z,1)){prev=-1;continue;}
    const id=node(x,z);
    if(prev>=0&&id!==prev){
     const a=nodes[prev],len=Math.hypot(x-a.x,z-a.z);
     let clear=true;
     for(let d=0;d<len;d+=1)if(!staticFree(a.x+(x-a.x)*d/len,a.z+(z-a.z)*d/len)){clear=false;break;}
     if(clear&&(!extension||!nodes[prev].links.includes(id))){nodes[prev].links.push(id);nodes[id].links.push(prev);edges.push([prev,id]);}
    }
    prev=id;
   }
  }
 }

 }
 buildRoads({minX:-308,maxX:308,minZ:-308,maxZ:308});
 // Only pairs with a new endpoint need joining after extension.
 function joinJunctions(firstNew=0){
 for(let i=0;i<nodes.length;i++)for(let j=Math.max(i+1,firstNew);j<nodes.length;j++){
  const a=nodes[i],b=nodes[j],d=Math.hypot(a.x-b.x,a.z-b.z);
  if(d>.1&&d<4&&!a.links.includes(j)&&staticFree((a.x+b.x)/2,(a.z+b.z)/2)){a.links.push(j);b.links.push(i);}
 }

 }
 joinJunctions();
 const candidates=nodes.map((n,i)=>i).filter(i=>nodes[i].links.length);

 function nearest(x,z){
  let best=-1,dist=Infinity;
  for(const i of candidates){const n=nodes[i],d=(n.x-x)**2+(n.z-z)**2;if(d<dist){dist=d;best=i;}}
  return best;
 }

 function heuristic(id,end){
  const a=nodes[id],b=nodes[end];
  return Math.hypot(a.x-b.x,a.z-b.z);
 }

 // Bounded A*. Public route() keeps returning a node path, as before.
 function route(x,z,tx,tz){
  metrics.pathRequests++;
  const start=nearest(x,z),end=nearest(tx,tz);
  let expansions=0,path=[];
  if(start>=0&&end>=0){
   const open=[{id:start,g:0,f:heuristic(start,end)}];
   const cost=new Map([[start,0]]);
   const parent=new Map([[start,-1]]);
   const closed=new Set();
   while(open.length&&expansions<ROUTE_LIMIT){
    let pick=0;
    for(let i=1;i<open.length;i++){
     const a=open[i],b=open[pick];
     if(a.f<b.f||(a.f===b.f&&a.id<b.id))pick=i;
    }
    const current=open.splice(pick,1)[0];
    if(closed.has(current.id))continue;
    closed.add(current.id);
    expansions++;
    if(current.id===end){
     for(let i=end;i!==start&&i>=0;i=parent.get(i))path.push(i);
     path.reverse();
     break;
    }
    const from=nodes[current.id];
    for(const next of from.links){
     if(closed.has(next))continue;
     const step=Math.hypot(nodes[next].x-from.x,nodes[next].z-from.z);
     const value=current.g+step;
     if(value<(cost.get(next)??Infinity)){
      cost.set(next,value);
      parent.set(next,current.id);
      open.push({id:next,g:value,f:value+heuristic(next,end)});
     }
    }
   }
  }
  metrics.pathExpansions+=expansions;
  metrics.maxPathExpansions=Math.max(metrics.maxPathExpansions,expansions);
  return path;
 }

 function pickNext(c){
  const n=nodes[c.node],opts=n.links.filter(i=>i!==c.prev),choices=opts.length?opts:n.links;
  if(!choices.length)return;
  const ranked=choices.slice().sort((a,b)=>Math.abs(angle(Math.atan2(nodes[a].z-n.z,nodes[a].x-n.x)-c.cap))-Math.abs(angle(Math.atan2(nodes[b].z-n.z,nodes[b].x-n.x)-c.cap)));
  const viable=ranked.filter(i=>Math.abs(angle(Math.atan2(nodes[i].z-n.z,nodes[i].x-n.x)-c.cap))<1.8);
  const next=(viable.length?viable:ranked)[Math.floor(random()*(viable.length||1))];
  c.prev=c.node;
  c.node=next;
 }

 function lane(c,id=c.node){
  const n=nodes[id],from=nodes[c.prev]||c,dx=n.x-from.x,dz=n.z-from.z,d=Math.hypot(dx,dz)||1,off=1.15;
  let x=n.x-dz/d*off,z=n.z+dx/d*off;
  if(!staticFree(x,z,.85)){x=n.x;z=n.z;}
  return {x,z};
 }

 function spawn(i,police=false){
  const type=police?(i%3===0?'policebike':'gti'):i%3===0?'tmax':i%2?'r5':'gti';
  let car=null;
  const preferred=candidates.slice().sort((a,b)=>Math.abs(nodes[a].x-70)+Math.abs(nodes[a].z-90)-Math.abs(nodes[b].x-70)-Math.abs(nodes[b].z-90));
  for(let attempt=0;attempt<400;attempt++){
   const id=attempt<150&&i<5?preferred[Math.floor(random()*Math.min(100,preferred.length))]:candidates[Math.floor(random()*candidates.length)],n=nodes[id];
   if(!n)break;
   const next=police?n.links.slice().sort((a,b)=>Math.hypot(nodes[a].x-world.car.x,nodes[a].z-world.car.z)-Math.hypot(nodes[b].x-world.car.x,nodes[b].z-world.car.z))[0]:n.links[0],
    to=nodes[next],cap=Math.atan2(to.z-n.z,to.x-n.x),c=BITUME.conduite.creer(n.x,n.z,cap);
   Object.assign(c,{
    id:world.fleet.length,model:type,color:police?'#e6e9e8':R.vehicles.PALETTE[i%8],y:.08,ai:true,police,
    node:next,prev:id,moteur:true,stuck:0,reverse:0,think:0,path:[],lastKnown:null,travel:0,
    // Police state is inert until dispatch; civilians keep their original fields.
    state:'patrol',role:'patrol',confidence:0,sensorAt:0,sensorPrev:null,
    visibleAt:-Infinity,visibleNow:false,searchNode:-1,searchNodeUntil:0,searchStep:0,
    searchStartedAt:0,searchUntil:0,disengageSince:0,pathGoal:null,pathSetAt:-Infinity,
    routeAt:(world.fleet.length%7)*.13,goal:null,direct:false,
    progressClock:0,progressMoved:0,commandMoving:false,recoverCooldown:0
   });
   if(Math.hypot(c.x-world.car.x,c.z-world.car.z)<28||world.carContact(c)||world.fleet.some(o=>Math.hypot(o.x-c.x,o.z-c.z)<12))continue;
   car=c;
   break;
  }
  if(car){cars.push(car);world.fleet.push(car);}
  return car;
 }

 for(let i=0;i<count;i++)spawn(i);
 for(let i=0;i<3;i++)spawn(i,true);
 // Police can navigate the enlarged map; initial spawn draws already happened.
 const bounds=world.bounds;
 if(bounds&&(bounds.minX<-325||bounds.maxX>325||bounds.minZ<-325||bounds.maxZ>325)){
  const firstNew=nodes.length;
  buildRoads({minX:bounds.minX+20,maxX:bounds.maxX-20,minZ:bounds.minZ+20,maxZ:bounds.maxZ-20},true);
  joinJunctions(firstNew);
  candidates.length=0;
  for(let i=0;i<nodes.length;i++)if(nodes[i].links.length)candidates.push(i);
 }


 function clearLine(a,b,r=1){
  const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);
  if(d<1e-6)return staticFree(a.x,a.z,r);
  const steps=Math.ceil(d/.65);
  for(let i=0;i<=steps;i++){
   const t=i/steps;
   if(!staticFree(a.x+dx*t,a.z+dz*t,r))return false;
  }
  return true;
 }

 function distanceToIntel(c){
  if(intel.valid)return Math.hypot(c.x-intel.x,c.z-intel.z);
  const point=lawRef?.lastKnown;
  if(point&&Number.isFinite(point.x)&&Number.isFinite(point.z))return Math.hypot(c.x-point.x,c.z-point.z);
  return c.id;
 }

 function enterState(c,state){
  if(c.state===state)return;
  c.state=state;
  c.path=[];
  c.pathGoal=null;
  c.progressClock=0;
  c.progressMoved=0;
  c.commandMoving=false;
  if(state==='pursuit'){c.confidence=1;c.searchNode=-1;}
  else if(state==='search'){
   const wanted=clamp(Math.floor(lawRef?.wanted||1),1,3);
   c.searchStartedAt=clock;
   c.searchUntil=clock+22+(wanted-1)*5; // 22 s, 27 s, 32 s
   c.searchStep=0;
   c.confidence=Math.max(.2,c.confidence*.5);
  }else if(state==='disengage'){
   c.disengageSince=clock;
   c.confidence=0;
   c.searchNode=-1;
  }else if(state==='patrol'){
   c.confidence=0;
   c.searchNode=-1;
  }
 }

 function connectedNodes(seedX,seedZ,radius,maxExpansions=80){
  const start=nearest(seedX,seedZ);
  if(start<0)return [];
  const seen=new Set([start]),queue=[start],out=[];
  for(let h=0;h<queue.length&&h<maxExpansions;h++){
   const id=queue[h],n=nodes[id];
   if(n.links.length){
    const d=Math.hypot(n.x-seedX,n.z-seedZ);
    if(d>=4&&d<=radius)out.push(id);
   }
   for(const j of n.links)if(!seen.has(j)&&seen.size<maxExpansions){seen.add(j);queue.push(j);}
  }
  out.sort((a,b)=>{
   const da=Math.hypot(nodes[a].x-seedX,nodes[a].z-seedZ);
   const db=Math.hypot(nodes[b].x-seedX,nodes[b].z-seedZ);
   return da-db||a-b;
  });
  return out;
 }

 function chooseSearchNode(c,seedX,seedZ,radius,used){
  const list=connectedNodes(seedX,seedZ,radius,70);
  if(!list.length)return -1;
  const startIndex=Math.abs((c.roleSlot||0)+(c.searchStep||0)*3)%list.length;
  for(let k=0;k<list.length;k++){
   const id=list[(startIndex+k)%list.length];
   if(!used||!used.has(id)){if(used)used.add(id);return id;}
  }
  return list[startIndex];
 }

 function stableWanted(law){
  return clamp(Math.floor(Number(law?.wanted)||0),0,5);
 }

 function readReport(law){
  freshReport=false;
  if(!law)return;
  const revision=Number.isFinite(law.reportRevision)?Math.floor(law.reportRevision):0;
  if(revision>lastReportRevision){
   lastReportRevision=revision;
   const point=law.lastKnown;
   if(stableWanted(law)>0&&point&&Number.isFinite(point.x)&&Number.isFinite(point.z)){
    intel={seq:intel.seq+1,time:clock,x:point.x,z:point.z,vx:0,vz:0,valid:true};
    freshReport=true;
   }
  }else if(revision<lastReportRevision){
   lastReportRevision=revision;
  }
 }

 function sense(c,player,law){
  if(!law||stableWanted(law)<=0||!c.ai||c.exploded||c.driver?.hp<=0){c.visibleNow=false;return;}
  if(clock<c.sensorAt){
   c.visibleNow=c.visibleAt>clock-SEEN_GRACE;
   return;
  }
  c.sensorAt=clock+SENSOR_INTERVAL+(c.id%5)*.012;
  const dx=player.x-c.x,dz=player.z-c.z,dist=Math.hypot(dx,dz);
  const visible=dist<=SIGHT_RANGE&&clearLine(c,player,.3);
  if(visible){
   let vx=0,vz=0;
   if(c.sensorPrev){
    const elapsed=Math.max(.02,clock-c.sensorPrev.t);
    vx=(player.x-c.sensorPrev.x)/elapsed;
    vz=(player.z-c.sensorPrev.z)/elapsed;
    const speed=Math.hypot(vx,vz);
    if(speed>18){vx*=18/speed;vz*=18/speed;}
   }
   intel={seq:intel.seq+1,time:clock,x:player.x,z:player.z,vx,vz,valid:true};
   law.seen=true;
   law.lastKnown={x:player.x,z:player.z};
   c.visibleAt=clock;
   c.visibleNow=true;
   c.confidence=1;
   c.sensorPrev={t:clock,x:player.x,z:player.z};
  }else{
   c.visibleNow=false;
   c.sensorPrev=null;
  }
 }

 function updateDispatch(law){
  const wanted=stableWanted(law);
  const police=cars.filter(c=>c.police);
  if(wanted>0&&lastWanted<=0)dispatchAt=clock+Math.max(4,7-wanted); // 6 s / 5 s / 4 s radio dispatch latency
  lastWanted=wanted;
  if(!wanted){
   active=[];
   dispatchAt=0;
   for(const c of police){
    c.siren=false;c.role='patrol';c.searchNode=-1;
    if(c.state!=='patrol')enterState(c,'patrol');
   }
   if(intel.valid)intel={...intel,valid:false};
   return;
  }
  if(clock<dispatchAt){
   active=[];
   for(const c of police){
    c.siren=false;c.role='patrol';c.searchNode=-1;
    if(c.state!=='patrol')enterState(c,'patrol');
   }
   return;
  }
  const wantedResponders=Math.min(3,wanted);
  const healthy=police.filter(c=>c.ai&&!c.exploded&&!(c.driver&&c.driver.hp<=0));
  const activeHealthy=active.filter(c=>healthy.includes(c));
  const reassign=clock>=nextDispatchAt||activeHealthy.length!==active.length||active.length!==wantedResponders;
  if(reassign){
   const previous=active;
   const next=[];
   for(const c of activeHealthy)if(next.length<wantedResponders)next.push(c);
   const pool=healthy.filter(c=>!next.includes(c)).sort((a,b)=>distanceToIntel(a)-distanceToIntel(b)||a.id-b.id);
   while(next.length<wantedResponders&&pool.length)next.push(pool.shift());
   active=next.sort((a,b)=>distanceToIntel(a)-distanceToIntel(b)||a.id-b.id);
   active.forEach((c,i)=>{
    c.role=i===0?'chaser':'interceptor';
    c.roleSlot=i;
    c.siren=true;
    if(!previous.includes(c)&&c.state==='patrol')enterState(c,intel.valid?'pursuit':'search');
   });
   const used=new Set();
   for(const c of active){
    if(c.role!=='interceptor')continue;
    const speed=intel.valid?Math.hypot(intel.vx,intel.vz):0;
    const lead=intel.valid?clamp(distanceToIntel(c)/10+2,2,7):0;
    const px=intel.valid?intel.x+intel.vx*lead:c.x;
    const pz=intel.valid?intel.z+intel.vz*lead:c.z;
    c.searchNode=chooseSearchNode(c,px,pz,55,used);
    c.searchNodeUntil=clock+4.5;
   }
   nextDispatchAt=clock+1;
  }
  for(const c of police){
   if(!active.includes(c)){
    c.siren=false;c.role='patrol';c.searchNode=-1;
    if(c.state!=='patrol'&&c.state!=='disengage')enterState(c,'disengage');
   }
  }
  if(freshReport){
   for(const c of active){
    if(c.state==='search'||c.state==='disengage'||c.state==='patrol')enterState(c,'pursuit');
   }
  }
 }

 function considerObstacle(c,obj,kind,best,dirX,dirZ,rightX,rightZ,halfWidth,halfLength,otherWidth,otherLength){
  const dx=obj.x-c.x,dz=obj.z-c.z;
  const u=dx*dirX+dz*dirZ,v=dx*rightX+dz*rightZ;
  if(u<=.25||Math.abs(v)>=halfWidth+otherWidth+.08)return best;
  const distance=u-halfLength-otherLength;
  return distance<best.distance?{distance,kind}:best;
 }

 function obstacleScan(c,player,direction){
  const spec=R.vehicles.SPECS[c.model];
  const halfWidth=spec.width/2,halfLength=spec.length/2;
  const dirX=Math.cos(c.cap)*direction,dirZ=Math.sin(c.cap)*direction;
  const rightX=-Math.sin(c.cap)*direction,rightZ=Math.cos(c.cap)*direction;
  let best={distance:Infinity,kind:null};
  for(const other of world.fleet){
   if(other===c)continue;
   const os=R.vehicles.SPECS[other.model];
   best=considerObstacle(c,other,'vehicle',best,dirX,dirZ,rightX,rightZ,halfWidth,halfLength,os.width/2,os.length/2);
  }
  const considerPerson=(x,z,kind)=>{
   if(!Number.isFinite(x)||!Number.isFinite(z))return;
   const dx=x-c.x,dz=z-c.z;
   if(dx*dx+dz*dz>625)return;
   const along=dx*dirX+dz*dirZ,across=dx*rightX+dz*rightZ;
   if(along<=.25||Math.abs(across)>=halfWidth+.43)return;
   if(!clearLine(c,{x,z},.12))return;
   best=considerObstacle(c,{x,z},kind,best,dirX,dirZ,rightX,rightZ,halfWidth,halfLength,.35,.35);
  };
  if(player&&!world.playerSeated)considerPerson(player.x,player.z,'player');
  for(const person of world.pedestrians||[]){
   if(!person||person.hp<=0)continue;
   considerPerson(person.x,person.z,'pedestrian');
  }
  for(const person of world.policeOfficers||[])if(person&&!person.inside&&person.hp>0)considerPerson(person.x,person.z,'officer');
  if(direction>0){
   const look=clamp(3+c.v,4.5,16);
   for(let d=halfLength+.15;d<=halfLength+look;d+=.8){
    for(const offset of [-halfWidth*.8,0,halfWidth*.8]){
     const x=c.x+Math.cos(c.cap)*d-Math.sin(c.cap)*offset;
     const z=c.z+Math.sin(c.cap)*d+Math.cos(c.cap)*offset;
     if(!staticFree(x,z,.32)){
      const distance=d-halfLength;
      if(distance<best.distance)best={distance,kind:'static'};
      break;
     }
    }
   }
  }else{
   const look=3.4;
   for(let d=halfLength+.1;d<=halfLength+look;d+=.7){
    for(const offset of [-halfWidth*.7,0,halfWidth*.7]){
     const x=c.x-Math.cos(c.cap)*d-Math.sin(c.cap)*offset;
     const z=c.z-Math.sin(c.cap)*d+Math.cos(c.cap)*offset;
     if(!staticFree(x,z,.32)){
      const distance=d-halfLength;
      if(distance<best.distance)best={distance,kind:'static'};
      break;
     }
    }
   }
  }
  return best;
 }

 function startRecovery(c,steer,player){
  const rear=obstacleScan(c,player||null,-1);
  c.path=[];
  c.pathGoal=null;
  c.routeAt=clock+ROUTE_INTERVAL;
  c.progressClock=0;
  c.progressMoved=0;
  metrics.recoveries++;
  c.recoveryAttempts=(c.recoveryAttempts||0)+1;
  const backoff=Math.min(8,1.5+c.recoveryAttempts);
  if(rear.distance<2.6){
   c.recoverCooldown=clock+backoff;
   return false;
  }
  c.reverse=1;
  c.reverseSteer=steer;
  c.recoverCooldown=clock+backoff;
  return true;
 }

 function trackProgress(c,dt,dx,dz,player){
  if(!c.commandMoving||c.reverse>0){c.progressClock=0;c.progressMoved=0;return;}
  c.progressClock+=dt;
  c.progressMoved+=Math.hypot(dx,dz);
  if(c.progressClock<1.6)return;
  const stalled=c.progressMoved<.25&&clock>=c.recoverCooldown;
  if(stalled)startRecovery(c,0,player);
  else if(c.progressMoved>.8)c.recoveryAttempts=0;
  c.progressClock=0;
  c.progressMoved=0;
 }

 function driveToward(c,dt,player,target,desiredSpeed,{stop=false,steerScale=2.3}={}){
  const dx=target.x-c.x,dz=target.z-c.z,err=angle(Math.atan2(dz,dx)-c.cap);
  const steer=clamp(err*steerScale,-1,1);
  if(c.reverse>0){
   c.reverse=Math.max(0,c.reverse-dt);
   c.commandMoving=false;
   const rear=obstacleScan(c,player,-1),safe=rear.distance>1.3;
   if(!safe)c.reverse=0;
   const x=c.x,z=c.z;
   R.vehicles.step(c,{gaz:safe?.34:0,frein:safe?0:1,volant:-steer,marcheArriere:safe},world,dt);
   c.travel+=Math.hypot(c.x-x,c.z-z);
   if(c.reverse===0)c.routeAt=Math.max(c.routeAt,clock);
   return;
  }
  const ahead=obstacleScan(c,player,1);
  let targetSpeed=stop?0:desiredSpeed*clamp(1-Math.abs(err)*.55,.3,1);
  let intentional=stop;
  if(ahead.distance<Infinity){
   if(ahead.kind!=='static')intentional=true;
   targetSpeed=Math.min(targetSpeed,Math.max(0,(ahead.distance-1.1)*1.25));
  }
  if(targetSpeed<.25)targetSpeed=0;
  c.commandMoving=desiredSpeed>.8&&!intentional;
  const x=c.x,z=c.z;
  R.vehicles.step(c,{
   gaz:targetSpeed>c.v+.1?clamp((targetSpeed-c.v)*.3,0,.8):0,
   frein:stop&&c.v>.05?1:c.v>targetSpeed+.15?clamp((c.v-targetSpeed)/3,.2,1):0,
   volant:steer,
   marcheArriere:false
  },world,dt);
  c.travel+=Math.hypot(c.x-x,c.z-z);
  trackProgress(c,dt,c.x-x,c.z-z,player);
 }

 function pathTarget(c,goal){
  const moved=!c.pathGoal||Math.hypot(goal.x-c.pathGoal.x,goal.z-c.pathGoal.z)>10;
  const stale=clock-c.pathSetAt>5;
  if((!c.path.length||moved||stale)&&clock>=c.routeAt){
   c.routeAt=clock+ROUTE_INTERVAL;
   const path=route(c.x,c.z,goal.x,goal.z);
   c.path=path;
   c.pathGoal={x:goal.x,z:goal.z};
   c.pathSetAt=clock;
  }
  while(c.path.length&&Math.hypot(nodes[c.path[0]].x-c.x,nodes[c.path[0]].z-c.z)<4.2)c.path.shift();
  if(c.path.length){const n=nodes[c.path[0]];return {x:n.x,z:n.z,node:true};}
  const distance=Math.hypot(c.x-goal.x,c.z-goal.z);
  if(distance<5)return {x:goal.x,z:goal.z,node:false,arrived:true};
  if(distance<20&&clearLine(c,goal,.55))return {x:goal.x,z:goal.z,node:false};
  return null;
 }

 function searchGoal(c){
  let seedX=c.x,seedZ=c.z;
  if(intel.valid){seedX=intel.x;seedZ=intel.z;}
  const nearIntel=!intel.valid||Math.hypot(c.x-intel.x,c.z-intel.z)<12;
  if(!nearIntel&&c.role==='chaser')return {x:intel.x,z:intel.z,kind:'lastKnown'};
  if(c.searchNode<0||clock>=c.searchNodeUntil||Math.hypot(c.x-nodes[c.searchNode].x,c.z-nodes[c.searchNode].z)<5){
   c.searchStep=(c.searchStep||0)+1;
   c.searchNode=chooseSearchNode(c,seedX,seedZ,110,null);
   c.searchNodeUntil=clock+4.5;
  }
  if(c.searchNode>=0){const n=nodes[c.searchNode];return {x:n.x,z:n.z,kind:'search'};}
  if(intel.valid)return {x:intel.x,z:intel.z,kind:'lastKnown'};
  return null;
 }

 function patrolDrive(c,dt,player){
  // Outside pursuit the original patrol behaviour is kept verbatim so the
  // civilian baseline, replay recordings and initial random draws stay stable.
  civilianDrive(c,dt,player);
 }

 function policeDrive(c,dt,law,player){
  const wanted=stableWanted(law);
  if(!wanted){patrolDrive(c,dt,player);return;}
  const age=intel.valid?clock-intel.time:Infinity;
  if(c.state==='pursuit'&&(!intel.valid||age>.8))enterState(c,'search');
  else if(c.role!=='patrol'&&age<.6&&c.state!=='pursuit')enterState(c,'pursuit');
  else if(c.state==='search'&&clock>=c.searchUntil)enterState(c,'disengage');
  else if(c.state==='disengage'&&clock-c.disengageSince>3)enterState(c,'patrol');
  else if(c.state==='patrol'&&c.role!=='patrol'&&c.visibleNow)enterState(c,'pursuit');
  if(c.state==='patrol'||c.role==='patrol'){patrolDrive(c,dt,player);return;}
  let goal=null,direct=false,stop=false;
  if(c.state==='pursuit'){
   const actual=c.visibleNow||clock-c.visibleAt<=.35;
   if(c.role==='chaser'&&actual&&player){
    const distance=Math.hypot(player.x-c.x,player.z-c.z);
    if(distance<=DIRECT_RANGE&&clearLine(c,player,.3)){
     goal={x:player.x,z:player.z,kind:'player'};
     direct=true;
     stop=distance<=ARREST_STOP;
    }
   }
   if(!goal&&intel.valid)goal=searchGoal(c);
  }else if(c.state==='search'){
   goal=searchGoal(c);
  }else if(c.state==='disengage'){
   c.goal=null;patrolDrive(c,dt,player);return;
  }
  if(!goal){patrolDrive(c,dt,player);return;}
  let point=goal;
  if(!direct){
   point=pathTarget(c,goal);
   if(!point){
    if(goal.kind==='search'||goal.kind==='lastKnown'){
     c.searchNode=-1;
     c.searchStep=(c.searchStep||0)+1;
     point=searchGoal(c);
     if(point)point=pathTarget(c,point);
    }
    if(!point){patrolDrive(c,dt,player);return;}
   }
  }
  c.goal={x:point.x,z:point.z,direct,kind:goal.kind};
  const wantedSpeed=PURSUIT_SPEED[clamp(wanted,1,3)];
  let speed=c.state==='pursuit'?wantedSpeed:c.state==='search'?8.5:6.5;
  // Plan the stop early enough for BITUME braking, including the scooter.
  if(goal.kind==='player')speed=Math.min(speed,Math.sqrt(4.4*Math.max(0,Math.hypot(player.x-c.x,player.z-c.z)-ARREST_STOP)));
  if(goal.kind==='player'&&!stop&&Math.hypot(player.x-c.x,player.z-c.z)<=ARREST_STOP)stop=true;
  driveToward(c,dt,player,point,speed,{stop});
 }

 // Civilian behaviour is intentionally unchanged: same lane choice, same random
 // sequence and the same far hidden recycling as before.
 function civilianDrive(c,dt,player){
  c.siren=false;
  let target=lane(c),speed=c.model==='tmax'?7:6;
  if(Math.hypot(target.x-c.x,target.z-c.z)<3){pickNext(c);target=lane(c);}
  const dx=target.x-c.x,dz=target.z-c.z,dist=Math.hypot(dx,dz),err=angle(Math.atan2(dz,dx)-c.cap);
  speed*=clamp(1-Math.abs(err)*.6,.25,1);
  const co=Math.cos(c.cap),si=Math.sin(c.cap);
  let obstacle=Infinity;
  for(const other of world.fleet){
   if(other===c)continue;
   const x=other.x-c.x,z=other.z-c.z,u=x*co+z*si,v=-x*si+z*co;
   if(u>0&&Math.abs(v)<(R.vehicles.SPECS[c.model].width+R.vehicles.SPECS[other.model].width)/2+.04)obstacle=Math.min(obstacle,u-R.vehicles.SPECS[other.model].length/2-R.vehicles.SPECS[c.model].length/2);
  }
  const px=player.x-c.x,pz=player.z-c.z,pu=px*co+pz*si,pv=-px*si+pz*co;
  if(world.car!==c&&pu>0&&Math.abs(pv)<1.3)obstacle=Math.min(obstacle,pu-2);
  if(obstacle<4+c.v*.65)speed=Math.min(speed,Math.max(0,(obstacle-1)*1.3));
  const waiting=c.police&&obstacle<4+c.v*.65;
  if(c.v<.9&&!waiting)c.stuck+=dt;else c.stuck=0;
  if(c.stuck>4.5){c.reverse=c.police?1:1.8;c.stuck=0;c.jams=(c.jams||0)+1;}
  if(c.police&&c.reverse>0&&obstacleScan(c,player,-1).distance<1.3)c.reverse=0;
  const reverse=c.reverse>0;
  c.reverse=Math.max(0,c.reverse-dt);
  const steer=clamp(err*2.3,-1,1);
  const cmd={
   gaz:reverse?.35:clamp((speed-c.v)*.3,0,.8),
   frein:reverse?0:c.v>speed+.15?clamp((c.v-speed)/3,.25,1):0,
   volant:reverse?-steer:steer,
   marcheArriere:reverse
  };
  const x=c.x,z=c.z;
  R.vehicles.step(c,cmd,world,dt);
  c.travel+=Math.hypot(c.x-x,c.z-z);
  if(!c.police&&!reverse&&(c.jams||0)>4&&Math.hypot(c.x-player.x,c.z-player.z)>80&&!clearLine(c,player,.2)){
   for(let n=0;n<60;n++){
    const id=candidates[Math.floor(random()*candidates.length)],q=nodes[id],to=nodes[q.links[0]];
    if(Math.hypot(q.x-player.x,q.z-player.z)<90||clearLine(q,player,.2)||world.fleet.some(o=>o!==c&&Math.hypot(o.x-q.x,o.z-q.z)<10))continue;
    const old={x:c.x,z:c.z,cap:c.cap};
    Object.assign(c,{x:q.x,z:q.z,cap:Math.atan2(to.z-q.z,to.x-q.x)});
    if(world.carContact(c)){Object.assign(c,old);continue;}
    c.node=q.links[0];c.prev=id;c.u=c.w=c.v=c.omega=0;c.jams=0;
    break;
   }
  }
 }

 function arrestStatus(player,{seated=false,vehicle=null,speed=0}={}){
  const law=lawRef;
  if(law&&(law.cooldown||0)>0)return {eligible:false,reason:'cooldown',officerId:null,stationId:null};
  if(!law||stableWanted(law)<=0)return {eligible:false,reason:'wanted',officerId:null,stationId:null};
  if(seated&&Number(speed)>=1.8)return {eligible:false,reason:'speed',officerId:null,stationId:null};
  if(!player||!Number.isFinite(player.x)||!Number.isFinite(player.z))return {eligible:false,reason:'position',officerId:null,stationId:null};
  let best=null;
  for(const c of cars){
   if(!c.ai||!c.police||c.exploded||c.driver?.hp<=0)continue;
   if(c.state!=='pursuit')continue;
   const distance=Math.hypot(c.x-player.x,c.z-player.z);
   if(distance>=ARREST_RANGE||c.v>=ARREST_OFFICER_SPEED)continue;
   if(!clearLine(c,player,.3))continue;
   if(!best||distance<best.distance)best={c,distance};
  }
  if(!best)return {eligible:false,reason:'visibility',officerId:null,stationId:null};
  return {eligible:true,reason:'ok',officerId:best.c.id,stationId:null};
 }

 function update(dt,law,player){
  clock+=dt;
  tick++;
  if(law)lawRef=law;
  readReport(law);
  if(law&&stableWanted(law)>0){
   for(const c of cars)if(c.police)sense(c,player,law);
   law.seen=cars.some(c=>c.police&&c.ai&&!c.exploded&&!(c.driver?.hp<=0)&&c.visibleAt>clock-SEEN_GRACE);
  }else{
   for(const c of cars)if(c.police)c.visibleNow=false;
   if(law)law.seen=false;
  }
  updateDispatch(law);
  if(law&&stableWanted(law)>0&&active.length&&intel.valid&&clock-intel.time>22&&active.every(c=>c.state==='patrol'||c.state==='disengage'))intel={...intel,valid:false};
  for(const c of cars){
   if(!c.ai)continue;
   if(c.police){
    c.lastKnown=intel.valid?{x:intel.x,z:intel.z,time:intel.time}:null;
    c.confidence=intel.valid?clamp(1-(clock-intel.time)/32,0,1):0;
    if(c.exploded||c.driver?.hp<=0){c.siren=false;continue;}
    policeDrive(c,dt,law,player);
   }
   else civilianDrive(c,dt,player);
  }
 }

 // Mark police indexes after creation without touching spawn randomness.
 cars.filter(c=>c.police).forEach((c,i)=>{c.roleSlot=i;});

 return {
  cars,nodes,edges,nearest,route,update,clearLine,metrics,
  arrestStatus,
  get intel(){return {seq:intel.seq,time:intel.time,x:intel.x,z:intel.z,vx:intel.vx,vz:intel.vz,valid:intel.valid};},
  get time(){return clock;},
  get moving(){return cars.filter(c=>c.ai&&c.v>.5).length;}
 };
}
R.traffic={create};
})(globalThis.RADE);
