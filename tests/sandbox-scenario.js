/* Verified command-driven gameplay. No position, health or ownership writes. */
(function(G){G.radeSandboxScenario=function(s){
 let stage='approach',time=0,clock=0,finished=false,path=[],pathClock=0,log=[],shotsAt=0;
 const site=s.campaign.sites[0],ang=x=>Math.atan2(Math.sin(x),Math.cos(x)),goal=[site.x,site.z+1.3];
 function next(v){log.push({stage,time:+time.toFixed(2),hp:s.player.hp,position:[s.player.x,s.player.z]});stage=v;clock=0;path=[];pathClock=0;}
 function clear(a,b){const d=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let t=0;t<d;t+=.25)if(s.world.blocked(a[0]+(b[0]-a[0])*t/d,a[1]+(b[1]-a[1])*t/d,.33))return false;return true;}
 function findPath(x,z){const p=s.player,step=1,minX=Math.floor(Math.min(p.x,x)-25),minZ=Math.floor(Math.min(p.z,z)-25),w=Math.ceil(Math.abs(p.x-x))+52,h=Math.ceil(Math.abs(p.z-z))+52;
  const index=(x,z)=>Math.round(z-minZ)*w+Math.round(x-minX),coord=i=>[minX+i%w,minZ+Math.floor(i/w)],start=index(p.x,p.z),end=index(x,z),cost=new Float32Array(w*h).fill(Infinity),parent=new Int32Array(w*h).fill(-1),open=[start],closed=new Uint8Array(w*h);cost[start]=0;
  while(open.length){open.sort((a,b)=>{const A=coord(a),B=coord(b);return cost[a]+Math.hypot(A[0]-x,A[1]-z)-cost[b]-Math.hypot(B[0]-x,B[1]-z);});const i=open.shift();if(i===end)break;if(closed[i])continue;closed[i]=1;const a=coord(i);
   for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const b=[a[0]+dx,a[1]+dz],j=index(...b);if(j<0||j>=cost.length||closed[j]||Math.abs((j%w)-(i%w))>1||!clear(a,b))continue;const c=cost[i]+Math.hypot(dx,dz);if(c<cost[j]){cost[j]=c;parent[j]=i;open.push(j);}}
  }if(parent[end]<0)return [[x,z]];let out=[[x,z]];for(let i=end;i!==start;i=parent[i])out.push(coord(i));return out.reverse();
 }
 function walk(x,z){const p=s.player;pathClock-=1/120;if(clear([p.x,p.z],[x,z]))path=[[x,z]];else if(!path.length||pathClock<=0){path=findPath(x,z);pathClock=2;}
  while(path.length>1&&Math.hypot(p.x-path[0][0],p.z-path[0][1])<.6)path.shift();const q=path[0]||[x,z],yaw=Math.atan2(q[0]-p.x,p.z-q[1]);return {lookX:ang(yaw-p.yaw),lookY:-p.pitch,moveY:1};
 }
 function step(dt=1/120){time+=dt;clock+=dt;const p=s.player;
  if(s.sim.state.dead||time>100){finished=true;next('failed');return {};}
  if(stage==='approach'){if(s.campaign.near()===site){next('buy');return {};}return walk(...goal);}
  if(stage==='buy'){next('contest');return {siteAction:100};}
  if(stage==='contest'){next('fight');shotsAt=s.sim.state.shots;return {siteAction:0};}
  if(stage==='fight'){const e=site.guards.map(id=>s.sim.state.enemies[id]).filter(e=>e.hp>0).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];if(!e){next('occupy');return {};}
   const dx=e.x-p.x,dz=e.z-p.z,d=Math.hypot(dx,dz),dy=e.y-(p.y+1.62),len=Math.hypot(dx,dy,dz),visible=s.world.ray([p.x,p.y+1.62,p.z],[dx/len,dy/len,dz/len],len)>=len-.1;
   if(!visible&&clock>1)return walk(e.x,e.z);
   return {lookX:ang(Math.atan2(dx,-dz)-p.yaw),lookY:Math.atan2(dy,d)-p.pitch,fire:visible,weapon:0};
  }
  if(stage==='occupy'){if(site.gang===0){next('income');return {};}return Math.hypot(p.x-site.x,p.z-site.z)>2.5?walk(...goal):{};}
  if(stage==='income'){if(clock>5){next('done');finished=true;}return {};}
  return {};
 }
 return {step,walk,get stage(){return stage;},get finished(){return finished;},report(){return {complete:stage==='done'&&site.gang===0&&s.campaign.state.mapOwned&&!s.sim.state.dead,time,stage,cash:s.campaign.state.cash,earned:s.campaign.state.earned,owner:site.gang,hp:s.player.hp,shots:s.sim.state.shots-shotsAt,wanted:s.campaign.law.wanted,log};}};
};})(globalThis);
