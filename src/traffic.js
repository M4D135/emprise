/* RADE — street graph, civilian traffic and pursuit cars. AI commands share vehicle collisions. */
(function(R){'use strict';const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
function create(world,{count=12}={}){
 const random=PDR.villeReelle.hasard(881),nodes=[],edges=[],ids=new Map(),cars=[];let clock=0,tick=0;
 const staticFree=(x,z,r=.92)=>world.withoutCar(()=>!world.blocked(x,z,r,.08,1.6));
 function node(x,z){const key=x.toFixed(1)+','+z.toFixed(1);if(ids.has(key))return ids.get(key);const id=nodes.length;nodes.push({x,z,links:[]});ids.set(key,id);return id;}
 // Split only drivable OSM streets; validate road samples against the actual scenery.
 for(const edge of world.city.rues.aretes){if(!['rue','secondaire','tertiaire','desserte','voie-bus'].includes(edge.sorte)||edge.largeur<3.5)continue;
  const p=edge.points;let prev=-1;
  for(let k=2;k<p.length;k+=2){const dx=p[k]-p[k-2],dz=p[k+1]-p[k-1],length=Math.hypot(dx,dz),n=Math.max(1,Math.ceil(length/7));
   for(let j=k===2?0:1;j<=n;j++){const x=p[k-2]+dx*j/n,z=p[k-1]+dz*j/n;if(Math.abs(x)>308||Math.abs(z)>308||!staticFree(x,z,1)){prev=-1;continue;}
    const id=node(x,z);if(prev>=0&&id!==prev){const a=nodes[prev],len=Math.hypot(x-a.x,z-a.z);let clear=true;for(let d=0;d<len;d+=1)if(!staticFree(a.x+(x-a.x)*d/len,a.z+(z-a.z)*d/len)){clear=false;break;}if(clear){nodes[prev].links.push(id);nodes[id].links.push(prev);edges.push([prev,id]);}}prev=id;
   }
  }
 }
 // Join near-identical junction endpoints without crossing walls or water.
 for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const a=nodes[i],b=nodes[j],d=Math.hypot(a.x-b.x,a.z-b.z);if(d>.1&&d<4&&!a.links.includes(j)&&staticFree((a.x+b.x)/2,(a.z+b.z)/2)){a.links.push(j);b.links.push(i);}}
 const candidates=nodes.map((n,i)=>i).filter(i=>nodes[i].links.length);
 function nearest(x,z){let best=-1,dist=Infinity;for(const i of candidates){const n=nodes[i],d=(n.x-x)**2+(n.z-z)**2;if(d<dist){dist=d;best=i;}}return best;}
 function route(x,z,tx,tz){const start=nearest(x,z),end=nearest(tx,tz);if(start<0||end<0)return [];const parent=new Int32Array(nodes.length).fill(-1),queue=[start];parent[start]=start;for(let h=0;h<queue.length&&parent[end]<0;h++)for(const j of nodes[queue[h]].links)if(parent[j]<0){parent[j]=queue[h];queue.push(j);}if(parent[end]<0)return [];const path=[];for(let i=end;i!==start;i=parent[i])path.push(i);return path.reverse();}
 function pickNext(c){const n=nodes[c.node],opts=n.links.filter(i=>i!==c.prev),choices=opts.length?opts:n.links;if(!choices.length)return;const ranked=choices.slice().sort((a,b)=>Math.abs(angle(Math.atan2(nodes[a].z-n.z,nodes[a].x-n.x)-c.cap))-Math.abs(angle(Math.atan2(nodes[b].z-n.z,nodes[b].x-n.x)-c.cap)));const viable=ranked.filter(i=>Math.abs(angle(Math.atan2(nodes[i].z-n.z,nodes[i].x-n.x)-c.cap))<1.8);const next=(viable.length?viable:ranked)[Math.floor(random()*(viable.length||1))];c.prev=c.node;c.node=next;}
 function lane(c,id=c.node){const n=nodes[id],from=nodes[c.prev]||c,dx=n.x-from.x,dz=n.z-from.z,d=Math.hypot(dx,dz)||1,off=1.15;let x=n.x-dz/d*off,z=n.z+dx/d*off;if(!staticFree(x,z,.85)){x=n.x;z=n.z;}return {x,z};}
 function spawn(i,police=false){
  const type=police?(i%3===0?'tmax':'gti'):i%3===0?'tmax':i%2?'r5':'gti';let car=null;
  const preferred=candidates.slice().sort((a,b)=>Math.abs(nodes[a].x-70)+Math.abs(nodes[a].z-90)-Math.abs(nodes[b].x-70)-Math.abs(nodes[b].z-90));
  for(let attempt=0;attempt<400;attempt++){
   const id=attempt<150&&i<5?preferred[Math.floor(random()*Math.min(100,preferred.length))]:candidates[Math.floor(random()*candidates.length)],n=nodes[id];if(!n)break;const next=police?n.links.slice().sort((a,b)=>Math.hypot(nodes[a].x-world.car.x,nodes[a].z-world.car.z)-Math.hypot(nodes[b].x-world.car.x,nodes[b].z-world.car.z))[0]:n.links[0],to=nodes[next],cap=Math.atan2(to.z-n.z,to.x-n.x),c=BITUME.conduite.creer(n.x,n.z,cap);
   Object.assign(c,{id:world.fleet.length,model:type,color:police?'#e6e9e8':R.vehicles.PALETTE[i%8],y:.08,ai:true,police,node:next,prev:id,moteur:true,stuck:0,reverse:0,think:0,path:[],lastKnown:null,travel:0});
   if(Math.hypot(c.x-world.car.x,c.z-world.car.z)<28||world.carContact(c)||world.fleet.some(o=>Math.hypot(o.x-c.x,o.z-c.z)<12))continue;
   car=c;break;
  }if(car){cars.push(car);world.fleet.push(car);}return car;
 }
 for(let i=0;i<count;i++)spawn(i);for(let i=0;i<3;i++)spawn(i,true);
 function clearLine(a,b,r=1){const d=Math.hypot(a.x-b.x,a.z-b.z);for(let t=0;t<d;t+=1.3)if(!staticFree(a.x+(b.x-a.x)*t/d,a.z+(b.z-a.z)*t/d,r))return false;return true;}
 function ai(c,dt,law,player){
  const pursuing=c.police&&law?.wanted>0;c.siren=pursuing;let target=lane(c),speed=c.model==='tmax'?7:6;
  if(pursuing){const seen=Math.hypot(c.x-player.x,c.z-player.z)<90&&clearLine(c,player,.25);if(seen){c.lastKnown={x:player.x,z:player.z};law.seen=true;law.lastKnown={...c.lastKnown};}
   const goal=seen?player:c.lastKnown||law.lastKnown;
   if(goal){speed=law.wanted>=3?13:10;c.think-=dt;if(clearLine(c,goal,R.vehicles.SPECS[c.model].width/2+.1))target=goal;
    else{if(c.think<=0){c.path=route(c.x,c.z,goal.x,goal.z);c.think=1.2;}while(c.path.length&&Math.hypot(nodes[c.path[0]].x-c.x,nodes[c.path[0]].z-c.z)<4)c.path.shift();if(c.path.length)target=nodes[c.path[0]];}
   }
  }else if(Math.hypot(target.x-c.x,target.z-c.z)<3){pickNext(c);target=lane(c);}
  const dx=target.x-c.x,dz=target.z-c.z,dist=Math.hypot(dx,dz),err=angle(Math.atan2(dz,dx)-c.cap);speed*=clamp(1-Math.abs(err)*.6,.25,1);
  // Yield to traffic, the on-foot player, and nearby pedestrians. No contact teleporting.
  const co=Math.cos(c.cap),si=Math.sin(c.cap);let obstacle=Infinity;
  for(const other of world.fleet){if(other===c)continue;const x=other.x-c.x,z=other.z-c.z,u=x*co+z*si,v=-x*si+z*co;if(u>0&&Math.abs(v)<(R.vehicles.SPECS[c.model].width+R.vehicles.SPECS[other.model].width)/2+.04)obstacle=Math.min(obstacle,u-R.vehicles.SPECS[other.model].length/2-R.vehicles.SPECS[c.model].length/2);}
  const px=player.x-c.x,pz=player.z-c.z,pu=px*co+pz*si,pv=-px*si+pz*co;
  if(world.car!==c&&pu>0&&Math.abs(pv)<1.3)obstacle=Math.min(obstacle,pu-2);
  if(obstacle<4+c.v*.65)speed=Math.min(speed,Math.max(0,(obstacle-1)*1.3));
  if(pursuing&&dist<3.8)speed=0;
  if(c.v<.9)c.stuck+=dt;else c.stuck=0;
  if(c.stuck>4.5){c.reverse=1.8;c.stuck=0;c.jams=(c.jams||0)+1;}
  const reverse=c.reverse>0;c.reverse=Math.max(0,c.reverse-dt);
  const steer=clamp(err*2.3,-1,1),cmd={gaz:reverse?.35:clamp((speed-c.v)*.3,0,.8),frein:reverse?0:c.v>speed+.15?clamp((c.v-speed)/3,.25,1):0,volant:reverse?-steer:steer,marcheArriere:reverse};
  const x=c.x,z=c.z;R.vehicles.step(c,cmd,world,dt);c.travel+=Math.hypot(c.x-x,c.z-z);
  if(!pursuing&&(c.jams||0)>4&&Math.hypot(c.x-player.x,c.z-player.z)>80&&!clearLine(c,player,.2)){
   for(let n=0;n<60;n++){const id=candidates[Math.floor(random()*candidates.length)],q=nodes[id],to=nodes[q.links[0]];if(Math.hypot(q.x-player.x,q.z-player.z)<90||clearLine(q,player,.2)||world.fleet.some(o=>o!==c&&Math.hypot(o.x-q.x,o.z-q.z)<10))continue;const old={x:c.x,z:c.z,cap:c.cap};Object.assign(c,{x:q.x,z:q.z,cap:Math.atan2(to.z-q.z,to.x-q.x)});if(world.carContact(c)){Object.assign(c,old);continue;}c.node=q.links[0];c.prev=id;c.u=c.w=c.v=c.omega=0;c.jams=0;break;}
  }
  if(c.police&&!pursuing&&clock%15<dt)c.lastKnown=null;
 }
 function update(dt,law,player){clock+=dt;tick++;if(law)law.seen=false;for(const c of cars)if(c.ai)ai(c,dt,law,player);}
 return {cars,nodes,edges,nearest,route,update,clearLine,get time(){return clock;},get moving(){return cars.filter(c=>c.ai&&c.v>.5).length;}};
}
R.traffic={create};})(globalThis.RADE);
