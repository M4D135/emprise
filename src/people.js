/* RADE — human gang members and merchants over the unchanged METAL combat state. */
(function(R){'use strict';
const skins=[[.70,.48,.33],[.40,.26,.18],[.82,.63,.48],[.55,.37,.25]],hair=[[.08,.07,.06],[.21,.13,.08],[.36,.27,.16],[.14,.14,.14]];
const animation=new Map();
// Advance from distance actually travelled. Stops and speed changes keep the
// same foot cycle; blocked actors never march just because an AI wants to move.
function advanceGait(state,travel,speed,dt){
 const target=Math.min(1.2,Math.max(0,speed)/(speed>2?2.53846:1.26923));
 const previous=state.amount||0;state.amount=previous+(target-previous)*(1-Math.exp(-Math.max(0,dt)/.12));
 if(state.amount<.001)state.amount=0;
 state.phase=(state.phase||0)+Math.min(.5,Math.max(0,travel))/(1.2/1.04*Math.max(.15,target,(previous+state.amount)/2))*Math.PI*2;
 return state;
}
function phaseFor(e,time,amount){const key=e.id??0,old=animation.get(key),distance=Number.isFinite(e.walkDistance)?e.walkDistance:null;let phase=old?.phase??key*.618;
 const gait={phase,amount:old?.amount||0};
 if(old&&time>=old.time&&time-old.time<1){const dt=Math.min(.1,time-old.time),travel=distance!==null&&old.distance!==null?Math.max(0,distance-old.distance):Math.hypot(e.x-old.x,e.z-old.z);advanceGait(gait,travel,dt>0?travel/dt:0,dt);}
 else gait.phase=key*.618;
 animation.set(key,{time,x:e.x,z:e.z,distance,phase:gait.phase%(Math.PI*2),amount:gait.amount});if(animation.size>1024)animation.delete(animation.keys().next().value);return gait;
}
function build(e,{time=0,distance=0}={}){
 if(distance>130||e.hp<=0&&!e.renderBody)return [];const detail=distance<20,mid=distance<55,id=e.id||0,base=e.baseY??.08,gait=phaseFor(e,time),walk=gait.amount,phase=gait.phase,look=R.human?.appearance(id),skin=look?.skin||skins[id%4],dark=[.055,.07,.08],cloth=e.police?[.055,.10,.18]:e.civil?(look?.shirt||[.46,.49,.42]):id%3===0?[.17,.22,.25]:id%3===1?[.24,.23,.21]:[.12,.15,.20],denim=e.police?[.07,.10,.16]:(look?.trousers||[.12,.17,.22]),accent=R.campaign.GANGS[e.gang||1]?.color||[.3,.3,.3],out=[],yaw=e.yaw||0,c=Math.cos(yaw),s=Math.sin(yaw),height=look?.heightScale||1,width=look?.widthScale||1;
 const prone=!!e.injury?.leg||e.hp<=0||e.thrown>0,lean=prone?Math.PI/2:0,aim=!e.civil&&!e.injury?.arm&&(e.attackState==='aim'||e.attackState==='burst'||e.alert>0.5),motion=R.human?.motion({phase,walk:prone?0:walk,seated:!!e.seated,aim}),bodyY=prone?0:(motion?.bodyY||0);const point=p=>{const y=prone?.25-p[2]*height:(p[1]+bodyY)*height,z=prone?.98-p[1]*height:p[2];return [e.x+p[0]*width*c-z*s,base+y,e.z+p[0]*width*s+z*c];};
 if(motion&&e.strike>0){motion.armRight=.45+1.0*Math.sin((1-e.strike/.4)*Math.PI);motion.elbow=.75;motion.matrices=[];}
 const add=(shape,p,size,color,rot=[0,0,0],mat=7)=>{const M=BITUME.voiture.mulM(BITUME.voiture.euler(0,-yaw,0),BITUME.voiture.mulM(BITUME.voiture.euler(lean,0,0),BITUME.voiture.euler(...rot)));out.push({shape,p:point(p),s:[size[0]*width,size[1]*height,size[2]],r:BITUME.voiture.angles(M),mat,color,surface:'object',actorPart:'human'});};
 const sphere=(p,size,color)=>add('sphere',p,size,color,[0,0,0],color===skin?20:21),box=(p,size,color,rot)=>add(detail?'bevel':'box',p,size,color,rot);
 const limb=(a,b,width,depth,color)=>{const d=b.map((v,i)=>v-a[i]),len=Math.hypot(...d);add('sphere',a.map((v,i)=>(v+b[i])/2),[width,len+width*.2,depth],color,[Math.atan2(d[2],Math.hypot(d[0],d[1])),0,-Math.atan2(d[0],d[1])]);};
 const realBody=!!R.human?.parts?.length;
 if(!realBody){
 for(const side of [-1,1]){const swing=Math.sin(phase+(side<0?0:Math.PI))*.27*walk,lift=Math.max(0,Math.cos(phase+(side<0?0:Math.PI)))*.10*walk,hip=[side*.105,.94,0],knee=e.seated?[side*.14,1.05,-.43]:[side*.12,.52+lift*.4,swing*.45-.04],ankle=e.seated?[side*.14,.88,-.54]:[side*.12,.12+lift,swing];
  limb(hip,knee,.19,.22,denim);limb(knee,ankle,.15,.18,denim);sphere([ankle[0],ankle[1]-.045,ankle[2]-.055],[.12,.11,.25],dark);if(detail)box([ankle[0],ankle[1]-.10,ankle[2]-.055],[.12,.018,.25],[.6,.59,.53]);
 }
 sphere([0,.98,0],[.37,.28,.27],denim);sphere([0,1.27,0],[.46,.57,.30],cloth);box([0,1.015,-.13],[.34,.035,.03],dark);
 }
 const anatomical=detail&&R.human,face=R.human?.headFor(look?.face||0),scarfColor=look?.scarfColor||[.09,.12,.17];
 if(anatomical){const h=face.headShape,ha=look.veil?R.human.scarfShape:face.hairShape;add(h.shape,h.p,h.s,skin,[0,0,0],20);add(ha.shape,ha.p,ha.s,look.veil?scarfColor:hair[id%4],[0,0,0],21);}
 else if(mid){sphere([0,1.53,0],[.12,.15,.12],skin);sphere([0,1.69,-.008],[.225,.31,.23],skin);sphere([0,1.61,-.033],[.17,.13,.17],skin);if(look?.veil&&R.human?.scarfShape){const h=R.human.scarfShape;add(h.shape,h.p,h.s,scarfColor,[0,0,0],21);}else sphere([0,1.785,.008],[.23,.14,.23],hair[id%4]);}
 else sphere([0,1.68,0],[.24,.32,.25],skin);
 const hands=e.seated?[[.19,1.31,-.48],[-.19,1.31,-.48]]:aim?[[.12,1.24,-.48],[-.07,1.25,-.64]]:[[.27,.91,.05],[-.27,.91,.03]];
 if(!realBody){ for(let k=0;k<2;k++){const side=k===0?1:-1,shoulder=[side*.245,1.43,0],elbow=e.seated?[side*.31,1.12,-.22]:aim?[side*.32,1.15,-.20]:[side*.27,1.17,Math.sin(phase+(k?Math.PI:0))*.14*walk],hand=hands[k];limb(shoulder,elbow,.155,.18,cloth);limb(elbow,hand,.12,.15,cloth);sphere(hand,[.10,.12,.08],skin);if(detail)box([elbow[0],elbow[1],elbow[2]-.073],[.075,.10,.018],accent);}
 }
 const smoothBody=realBody&&detail&&R.human.skin?.({phase,walk,seated:!!e.seated,aim,feminine:look?.feminine,strike:e.strike||0,motion});
 if(smoothBody){for(const part of smoothBody)add(part.shape,part.p,part.s,part.material===0?skin:part.material===1?cloth:part.material===2?denim:dark,[0,0,0],part.material===0?20:21);}
 if(realBody&&!smoothBody){
  function pose(part){const q=R.human.transformPoint([part.p[0],part.p[1],-part.p[2]],part.code,motion),matrix=R.human.boneMatrix(part.code,motion);return {p:[q[0],q[1],-q[2]],angle:matrix[4]};}
  for(const part of R.human.parts){if(part.code===1)continue;const posePart=pose(part),col=part.material===0?skin:part.material===1?cloth:part.material===2?denim:dark;add(part.shape,posePart.p,part.s,col,[posePart.angle,0,0],part.material===0?20:21);}
  if(!R.human.body.feet)for(const side of [-1,1]){const q=pose({code:side<0?16:17,p:[side*.105,.073,-.035]});add('bevel',q.p,[.12,.14,.25],dark,[q.angle,0,0],21);}

 }
 if(smoothBody&&!R.human.body.feet){for(const side of [-1,1]){const a=e.seated?1.65:Math.sin(phase+(side>0?Math.PI:0))*.30*walk,knee=e.seated?-1.65:-Math.max(0,a)*1.25;let y=.073-.52,z=-.035;[y,z]=[Math.cos(knee)*y-Math.sin(knee)*z,Math.sin(knee)*y+Math.cos(knee)*z];y+=.52-.97;const py=.97+Math.cos(a)*y-Math.sin(a)*z,pz=Math.sin(a)*y+Math.cos(a)*z;add('bevel',[side*.105,py,pz],[.112,.14,.235],dark,[a+knee,0,0],21);}}
 if(look?.veil&&mid&&R.human?.scarfDrapeShape){const h=R.human.scarfDrapeShape;add(h.shape,h.p,h.s,scarfColor,[0,0,0],21);}

 if(e.police){
  sphere([0,1.80,0],[.24,.14,.25],[.04,.07,.12]);
  if(e.footPolice){
   box([0,1.79,-.145],[.19,.022,.15],[.035,.05,.07]);
   box([0,1.005,0],[.36,.045,.285],dark);
   box([.10,1.37,-.158],[.065,.055,.012],[.65,.69,.72]);
   box([-.135,1.34,-.16],[.06,.10,.04],dark);
   box([.225,.94,.02],[.07,.19,.09],dark);
   if(detail){box([0,1.31,.155],[.26,.055,.012],[.73,.76,.79]);box([-.135,1.42,-.16],[.009,.075,.009],dark);}
  }else{box([0,1.70,-.13],[.23,.16,.018],[.24,.39,.42]);box([.36,1.06,-.25],[.05,.78,.45],[.12,.21,.27]);}
 }
 if(look?.streetwear&&!e.police){sphere([0,1.81,0],[.22,.10,.22],cloth);box([0,1.79,-.13],[.17,.015,.13],cloth);box([.015,1.25,-.165],[.024,.52,.02],dark,[0,0,.55]);box([.14,1.055,-.185],[.155,.18,.075],dark);if(detail)box([.14,1.11,-.226],[.12,.007,.006],[.4,.42,.42]);}
 if(!e.civil){const gp=aim?[.09,1.26,-.50]:[.27,.92,-.08];box(gp,[.10,.13,.38],dark,aim?[0,0,0]:[.75,0,0]);add('cylinder',[gp[0],gp[1]+.035,gp[2]-.27],[.032,.22,.032],[.14,.16,.17],[Math.PI/2,0,0],0);box([gp[0],gp[1]-.12,gp[2]+.04],[.065,.20,.09],dark);}
 if(detail){
  if(anatomical){for(const eye of face.head.eyes){sphere([eye[0],eye[1],-eye[2]],[.018,.009,.008],[.7,.68,.63]);sphere([eye[0],eye[1],-eye[2]-.005],[.005,.005,.003],dark);}for(const brow of face.head.brows)sphere([brow[0],brow[1],-brow[2]],[.030,.004,.006],hair[id%4]);}
  box([0,1.27,-.15],[.015,.39,.01],[.51,.53,.49]);for(const side of [-1,1])box([side*.115,1.16,-.145],[.11,.025,.020],dark);
  if(e.civil&&!e.seated&&!realBody){box([0,1.12,-.16],[.25,.40,.025],[.71,.66,.52]);for(const side of [-1,1])box([side*.09,1.39,-.14],[.018,.19,.018],[.71,.66,.52]);}
  else if(!e.civil){box([0,1.49,-.135],[.26,.07,.06],accent);if(id%2===0&&!look?.veil){box([0,1.66,-.13],[.20,.095,.04],dark);box([0,1.81,-.04],[.26,.06,.26],cloth);}}
 }
 return out;
}
R.people={build,advanceGait};})(globalThis.RADE);
