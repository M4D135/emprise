/* Same commands as a player; no teleportation, HP edits or forced mission completion. */
(function(G){G.radeScenario=function(session){
 const s=session,initial={x:s.player.x,z:s.player.z},route=[[76,110],[73.5,90],[70,65],[66,44],[62,31],[54,23],[47,18],[31,12],[20,5],[-12,-7],[-36,-18],[-57,-23],[-83,-18],[-106,-14]],log=[];
 let stage='walk',way=0,clock=0,total=0,maxReverse=0,entered=0,exited=0,walkDistance=0,old={x:s.player.x,z:s.player.z},finished=false;
 const angle=x=>Math.atan2(Math.sin(x),Math.cos(x)),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 function next(v){log.push({stage,time:+total.toFixed(2),position:[s.player.x,s.player.z],hp:s.player.hp,phase:s.phase});stage=v;clock=0;}
 function walk(x,z,sprint=false){const p=s.player,dx=x-p.x,dz=z-p.z,yaw=Math.atan2(dx,-dz);return {lookX:angle(yaw-p.yaw),lookY:-p.pitch,moveY:1,sprint};}
 function step(dt=1/120){total+=dt;clock+=dt;const p=s.player,c=s.car;walkDistance+=s.mode==='foot'?Math.hypot(p.x-old.x,p.z-old.z):0;old={x:p.x,z:p.z};
 if(s.sim.state.dead||total>170){finished=true;return {};}
 if(stage==='walk'){if(clock>1.2){next('return-start');}return walk(initial.x,initial.z-6,true);}
 if(stage==='return-start'){if(Math.hypot(p.x-initial.x,p.z-initial.z)<.5){next('enter');return {};}return walk(initial.x,initial.z);}
 if(stage==='enter'){entered++;next('drive');return {interact:true,engine:true};}
 if(stage==='drive'){
  if(Math.hypot(route[way][0]-c.x,route[way][1]-c.z)<3){way++;if(way===route.length){next('brake');return {brake:true};}}
  const q=route[way],err=angle(Math.atan2(q[1]-c.z,q[0]-c.x)-c.cap),target=Math.abs(err)>.55?3:6;
  return {forward:clamp((target-c.v)*.4,0,.65),back:c.v>target+.3?.2:0,steer:clamp(err*2.5,-1,1)};
 }
 if(stage==='brake'){if(c.v<.06){next('reverse');}return {brake:true};}
 if(stage==='reverse'){maxReverse=Math.max(maxReverse,-c.u);if(clock>1.6){next('stop');return {brake:true};}return {back:.5};}
 if(stage==='stop'){if(c.v<.06){next('exit');}return {brake:true};}
 if(stage==='exit'){exited++;next('fight');return {interact:true};}
 if(stage==='fight'){
  const e=s.sim.state.enemies.filter(e=>e.hp>0).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];
  if(!e){next('walk-objective');return {};}
  const dx=e.x-p.x,dz=e.z-p.z,d=Math.hypot(dx,dz),dy=e.y-(p.y+1.62),yaw=Math.atan2(dx,-dz),pitch=Math.atan2(dy,d),len=Math.hypot(dx,dy,dz),visible=s.world.ray([p.x,p.y+1.62,p.z],[dx/len,dy/len,dz/len],len)>=len-.1;
  return {lookX:angle(yaw-p.yaw),lookY:pitch-p.pitch,fire:visible,moveY:visible?0:1,weapon:0};
 }
 if(stage==='walk-objective'){if(Math.hypot(p.x-s.world.mission.x,p.z-s.world.mission.z)<12){next('return-car');return {};}return walk(s.world.mission.x,s.world.mission.z);}
 if(stage==='return-car'){const q=s.exitCandidates().sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];if(Math.hypot(p.x-q.x,p.z-q.z)<.6){next('reenter');return {};}return walk(q.x,q.z);}
 if(stage==='reenter'){entered++;next('depart');return {interact:true};}
 if(stage==='depart'){if(c.v>2&&s.phase===4){next('done');finished=true;return {};}return {forward:.6};}
 return {};
 }
 return {step,log,get finished(){return finished;},get stage(){return stage;},report(){return {complete:s.phase===4&&!s.sim.state.dead,stage,total,waypoints:way,walkDistance,maxReverse,entered,exited,health:s.player.hp,enemies:s.sim.state.enemies.map(e=>e.hp),crowdAvoids:s.crowd.avoids,log};}};
};})(globalThis);
