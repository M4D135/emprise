/* EMPRISE — capsule contact against the actual orientation of fallen rubble. */
(function(R){'use strict';
const cache=new WeakMap(),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function basis(q){let b=cache.get(q);if(b)return b;const m=q.mesh;
 if(!m?.p||!m?.s)return null;
 b={p:m.p,h:m.s.map(v=>Math.abs(v)/2),axes:BITUME.voiture.euler(...(m.r||[0,0,0]))};cache.set(q,b);return b;
}
function contact(q,x,z,r,y,height){
 if(q.maxY<=y+.22||q.minY>=y+height||Math.abs(x-q.x)>q.a+r||Math.abs(z-q.z)>q.b+r)return 0;
 const box=basis(q);if(!box)return 0;const bottom=y+Math.min(r,height/2),length=Math.max(0,height-2*r),v=[x-box.p[0],bottom-box.p[1],z-box.p[2]],a=box.axes.map(n=>n[0]*v[0]+n[1]*v[1]+n[2]*v[2]),d=box.axes.map(n=>n[1]*length),h=box.h,knots=[0,1];
 // Squared distance to an OBB is piecewise quadratic along the capsule axis.
 for(let i=0;i<3;i++)if(Math.abs(d[i])>1e-10)for(const sign of [-1,1]){const t=(sign*h[i]-a[i])/d[i];if(t>0&&t<1)knots.push(t);}
 knots.sort((a,b)=>a-b);let best=Infinity;
 const squared=t=>{let n=0;for(let i=0;i<3;i++){const e=Math.max(0,Math.abs(a[i]+d[i]*t)-h[i]);n+=e*e;}return n;};
 for(let j=1;j<knots.length;j++){const lo=knots[j-1],hi=knots[j],mid=(lo+hi)/2;let aa=0,bb=0;
  for(let i=0;i<3;i++){const p=a[i]+d[i]*mid;if(Math.abs(p)>h[i]){const e=a[i]-Math.sign(p)*h[i];aa+=d[i]*d[i];bb+=d[i]*e;}}
  best=Math.min(best,squared(lo),squared(hi),squared(aa?clamp(-bb/aa,lo,hi):mid));
 }
 const penetration=r-Math.sqrt(best);if(penetration<=1e-5)return 0;
 // Inside a thick body, capsule distance alone is flat. This tiny tie-break
 // chooses a horizontal exit and allows gradual recovery instead of trapping.
 const margin=Math.max(0,Math.min(q.a+r-Math.abs(x-q.x),q.b+r-Math.abs(z-q.z)));
 return penetration+margin*.01;
}
function create({bodies,staticBlocked}){
 const recovery=new WeakMap(),metrics={fallbackSearches:0,fallbackSamples:0,maxFallbackSamples:0,fallbackMoves:0,fallbackCancelled:0,failedSearches:0};
 const identity=q=>q.body||q;
 // 0 = forbidden wall/new fragment; 1 = original pile; 2 = completely free.
 function allowedAt(list,allowed,x,z,r,y,height){
  if(staticBlocked(x,z,r,y,height))return 0;let clear=true;
  for(const q of list)if(contact(q,x,z,r,y,height)>0){if(!allowed.has(identity(q)))return 0;clear=false;}
  return clear?2:1;
 }
 function exitPlan(actor,list,r,y,height){
  metrics.fallbackSearches++;const allowed=new Set(list.filter(q=>contact(q,actor.x,actor.z,r,y,height)>0).map(identity));let best=null,samples=0;
  // Destinations every .2 m, with an extra midpoint check on each segment.
  // All 16 rays stop at the first static wall or previously untouched body.
  for(let i=0;i<16;i++){const angle=i*Math.PI/8,dx=Math.cos(angle),dz=Math.sin(angle);
   for(let j=1;j<=40&&(!best||j*.1<best.distance-1e-8);j++){
    const distance=j*.1,x=actor.x+dx*distance,z=actor.z+dz*distance;const status=allowedAt(list,allowed,x,z,r,y,height);samples++;
    if(!status)break;if(status===2&&j%2===0){best={x,z,distance,allowed,y,r,height};break;}
   }
  }
  metrics.fallbackSamples+=samples;metrics.maxFallbackSamples=Math.max(metrics.maxFallbackSamples,samples);if(!best)metrics.failedSearches++;return best;
 }
 function advanceRecovery(actor,state,list,step,r,y,height){
  const goal=state.goal,dx=goal.x-actor.x,dz=goal.z-actor.z,d=Math.hypot(dx,dz);
  // Moving rubble has fresh proxy objects each frame; its body identity is stable.
  // Validate the next physical step again, even after the search was cached.
  if(Math.abs(y-goal.y)>.1||r!==goal.r||height!==goal.height||d>4.01||d<1e-6||allowedAt(list,goal.allowed,goal.x,goal.z,r,y,height)!==2||!allowedAt(list,goal.allowed,actor.x,actor.z,r,y,height)){
   state.goal=null;state.cooldown=.3;metrics.fallbackCancelled++;return false;
  }
  const travel=Math.min(step,d),x=actor.x+dx/d*travel,z=actor.z+dz/d*travel;
  if(!allowedAt(list,goal.allowed,x,z,r,y,height)){state.goal=null;state.cooldown=.3;metrics.fallbackCancelled++;return false;}
  actor.x=x;actor.z=z;metrics.fallbackMoves++;if(travel>=d-1e-8)state.goal=null;return true;
 }
 function blocked(x,z,r=.28,y=0,height=1.8){if(staticBlocked(x,z,r,y,height))return true;for(const q of bodies())if(contact(q,x,z,r,y,height)>0)return true;return false;}
 function moveBlocked(ax,az,x,z,r=.28,y=0,height=1.8){
  if(staticBlocked(x,z,r,y,height))return true;let oldSum=0,newSum=0;
  for(const q of bodies()){const old=contact(q,ax,az,r,y,height);oldSum+=old;const next=contact(q,x,z,r,y,height);if(!next)continue;if(!old||next>old+1e-7)return true;newSum+=next;}
  return newSum>0&&newSum>=oldSum-1e-8;
 }
 function resolve(actor,dt,r=.28,height=1.8){
  if(!(dt>0)||actor.hp<=0)return false;const y=actor.y||0,list=bodies();let score=0;for(const q of list)score+=contact(q,actor.x,actor.z,r,y,height);if(!score){recovery.delete(actor);return false;}
  let state=recovery.get(actor);if(!state){state={goal:null,cooldown:0};recovery.set(actor,state);}state.cooldown=Math.max(0,state.cooldown-dt);
  const step=Math.min(.06,dt*2),ox=actor.x,oz=actor.z;let best=null;
  if(state.goal)return advanceRecovery(actor,state,list,step,r,y,height);
  for(let i=0;i<16;i++){const a=i*Math.PI/8,x=ox+Math.cos(a)*step,z=oz+Math.sin(a)*step;if(moveBlocked(ox,oz,x,z,r,y,height))continue;let next=0;for(const q of list)next+=contact(q,x,z,r,y,height);if(next<score-1e-8&&(!best||next<best.score))best={x,z,score:next};}
  if(best){actor.x=best.x;actor.z=best.z;return true;}
  if(state.cooldown>0)return false;
  state.goal=exitPlan(actor,list,r,y,height);if(!state.goal){state.cooldown=.3;return false;}
  return advanceRecovery(actor,state,list,step,r,y,height);
 }
 return {blocked,moveBlocked,resolve,metrics};
}
R.clearance={contact,create};})(globalThis.RADE);
