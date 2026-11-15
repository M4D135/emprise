/* RADE — human gang members and merchants over the unchanged METAL combat state. */
(function(R){'use strict';
const skins=[[.70,.48,.33],[.40,.26,.18],[.82,.63,.48],[.55,.37,.25]],hair=[[.08,.07,.06],[.21,.13,.08],[.36,.27,.16],[.14,.14,.14]];
function build(e,{time=0,distance=0}={}){
 if(distance>130||e.hp<=0&&!e.renderBody)return [];const detail=distance<20,mid=distance<55,id=e.id||0,base=e.baseY??.08,walk=Math.min(1,(e.moveSpeed||0)/1.6),phase=time*(e.moveSpeed||0)*4.2+id,look=R.human?.appearance(id),skin=look?.skin||skins[id%4],dark=[.055,.07,.08],cloth=e.police?[.055,.10,.18]:e.civil?[.46,.49,.42]:id%3===0?[.17,.22,.25]:id%3===1?[.24,.23,.21]:[.12,.15,.20],denim=[.12,.17,.22],accent=R.campaign.GANGS[e.gang||1]?.color||[.3,.3,.3],out=[],yaw=e.yaw||0,c=Math.cos(yaw),s=Math.sin(yaw),height=e.type===1?.95:1;
 const prone=!!e.injury?.leg||e.hp<=0||e.thrown>0,lean=prone?Math.PI/2:0;const point=p=>{const y=prone?.25-p[2]*height:p[1]*height,z=prone?.98-p[1]*height:p[2];return [e.x+p[0]*c-z*s,base+y,e.z+p[0]*s+z*c];};
 const add=(shape,p,size,color,rot=[0,0,0],mat=7)=>{const M=BITUME.voiture.mulM(BITUME.voiture.euler(0,-yaw,0),BITUME.voiture.mulM(BITUME.voiture.euler(lean,0,0),BITUME.voiture.euler(...rot)));out.push({shape,p:point(p),s:[size[0],size[1]*height,size[2]],r:BITUME.voiture.angles(M),mat,color,surface:'object',actorPart:'human'});};
 const sphere=(p,size,color)=>add('sphere',p,size,color,[0,0,0],color===skin?20:21),box=(p,size,color,rot)=>add(detail?'bevel':'box',p,size,color,rot);
 const limb=(a,b,width,depth,color)=>{const d=b.map((v,i)=>v-a[i]),len=Math.hypot(...d);add('sphere',a.map((v,i)=>(v+b[i])/2),[width,len+width*.2,depth],color,[Math.atan2(d[2],Math.hypot(d[0],d[1])),0,-Math.atan2(d[0],d[1])]);};
 const realBody=!!R.human?.parts?.length;
 if(!realBody){
 for(const side of [-1,1]){const swing=Math.sin(phase+(side<0?0:Math.PI))*.27*walk,lift=Math.max(0,Math.cos(phase+(side<0?0:Math.PI)))*.10*walk,hip=[side*.105,.94,0],knee=e.seated?[side*.14,1.05,-.43]:[side*.12,.52+lift*.4,swing*.45-.04],ankle=e.seated?[side*.14,.88,-.54]:[side*.12,.12+lift,swing];
  limb(hip,knee,.19,.22,denim);limb(knee,ankle,.15,.18,denim);sphere([ankle[0],ankle[1]-.045,ankle[2]-.055],[.12,.11,.25],dark);if(detail)box([ankle[0],ankle[1]-.10,ankle[2]-.055],[.12,.018,.25],[.6,.59,.53]);
 }
 sphere([0,.98,0],[.37,.28,.27],denim);sphere([0,1.27,0],[.46,.57,.30],cloth);box([0,1.015,-.13],[.34,.035,.03],dark);
 }
 const anatomical=detail&&R.human,scarfColor=look?.scarfColor||[.09,.12,.17];
 if(anatomical){const h=R.human.headShape,ha=look.veil?R.human.scarfShape:R.human.hairShape;add(h.shape,h.p,h.s,skin,[0,0,0],20);add(ha.shape,ha.p,ha.s,look.veil?scarfColor:hair[id%4],[0,0,0],21);}
 else if(mid){sphere([0,1.53,0],[.12,.15,.12],skin);sphere([0,1.69,-.008],[.225,.31,.23],skin);sphere([0,1.61,-.033],[.17,.13,.17],skin);if(look?.veil&&R.human?.scarfShape){const h=R.human.scarfShape;add(h.shape,h.p,h.s,scarfColor,[0,0,0],21);}else sphere([0,1.785,.008],[.23,.14,.23],hair[id%4]);}
 else sphere([0,1.68,0],[.24,.32,.25],skin);
 const aim=!e.civil&&!e.injury?.arm&&(e.attackState==='aim'||e.attackState==='burst'||e.alert>0.5),hands=e.seated?[[.19,1.31,-.48],[-.19,1.31,-.48]]:aim?[[.12,1.24,-.48],[-.07,1.25,-.64]]:[[.27,.91,.05],[-.27,.91,.03]];
 if(!realBody){ for(let k=0;k<2;k++){const side=k===0?1:-1,shoulder=[side*.245,1.43,0],elbow=e.seated?[side*.31,1.12,-.22]:aim?[side*.32,1.15,-.20]:[side*.27,1.17,Math.sin(phase+(k?Math.PI:0))*.14*walk],hand=hands[k];limb(shoulder,elbow,.155,.18,cloth);limb(elbow,hand,.12,.15,cloth);sphere(hand,[.10,.12,.08],skin);if(detail)box([elbow[0],elbow[1],elbow[2]-.073],[.075,.10,.018],accent);}
 }
 const smoothBody=realBody&&detail&&R.human.skin?.({phase,walk,seated:!!e.seated,aim,feminine:look?.feminine});
 if(smoothBody){for(const part of smoothBody)add(part.shape,part.p,part.s,part.material===0?skin:part.material===1?cloth:part.material===2?denim:dark,[0,0,0],part.material===0?20:21);}
 if(realBody&&!smoothBody){
  const seated=!!e.seated,hipL=seated?2.24:Math.sin(phase)*.30*walk,hipR=seated?2.24:-Math.sin(phase)*.30*walk;
  function pose(part){let p=part.p.slice(),angle=0;const code=part.code,side=[3,19,5,17].includes(code)?1:-1;
   const rotate=(pivot,a)=>{const y=p[1]-pivot[1],z=p[2]-pivot[2];p[1]=pivot[1]+Math.cos(a)*y-Math.sin(a)*z;p[2]=pivot[2]+Math.sin(a)*y+Math.cos(a)*z;angle+=a;};
   if([4,5,16,17].includes(code)){const h=side<0?hipL:hipR;if(code>=16)rotate([side*.105,.52,0],seated?-2.24:-Math.max(0,-h)*1.1);rotate([side*.105,.97,0],h);}
   if([2,3,18,19].includes(code)){const a=seated?.62:aim?1.1:-(side<0?hipL:hipR)*.7;if(code>=18)rotate([side*.255,1.19,0],seated?.38:aim?.26:.10);rotate([side*.235,1.43,0],a);}
   return {p,angle};
  }
  for(const part of R.human.parts){if(part.code===1)continue;const posePart=pose(part),col=part.material===0?skin:part.material===1?cloth:part.material===2?denim:dark;add(part.shape,posePart.p,part.s,col,[posePart.angle,0,0],part.material===0?20:21);}
  for(const side of [-1,1]){const q=pose({code:side<0?16:17,p:[side*.105,.073,-.035]});add('bevel',q.p,[.12,.14,.25],dark,[q.angle,0,0],21);}

 }
 if(smoothBody){for(const side of [-1,1]){const a=e.seated?1.65:Math.sin(phase+(side>0?Math.PI:0))*.30*walk,knee=e.seated?-1.65:-Math.max(0,a)*1.25;let y=.073-.52,z=-.035;[y,z]=[Math.cos(knee)*y-Math.sin(knee)*z,Math.sin(knee)*y+Math.cos(knee)*z];y+=.52-.97;const py=.97+Math.cos(a)*y-Math.sin(a)*z,pz=Math.sin(a)*y+Math.cos(a)*z;add('bevel',[side*.105,py,pz],[.112,.14,.235],dark,[a+knee,0,0],21);}}
 if(look?.veil&&mid&&R.human?.scarfDrapeShape){const h=R.human.scarfDrapeShape;add(h.shape,h.p,h.s,scarfColor,[0,0,0],21);}

 if(e.police){sphere([0,1.80,0],[.24,.14,.25],[.04,.07,.12]);box([0,1.70,-.13],[.23,.16,.018],[.24,.39,.42]);box([.36,1.06,-.25],[.05,.78,.45],[.12,.21,.27]);}
 if(look?.streetwear&&!e.police){sphere([0,1.81,0],[.22,.10,.22],cloth);box([0,1.79,-.13],[.17,.015,.13],cloth);box([.015,1.25,-.165],[.024,.52,.02],dark,[0,0,.55]);box([.14,1.055,-.185],[.155,.18,.075],dark);if(detail)box([.14,1.11,-.226],[.12,.007,.006],[.4,.42,.42]);}
 if(!e.civil){const gp=aim?[.09,1.26,-.50]:[.27,.92,-.08];box(gp,[.10,.13,.38],dark,aim?[0,0,0]:[.75,0,0]);add('cylinder',[gp[0],gp[1]+.035,gp[2]-.27],[.032,.22,.032],[.14,.16,.17],[Math.PI/2,0,0],0);box([gp[0],gp[1]-.12,gp[2]+.04],[.065,.20,.09],dark);}
 if(detail){
  if(anatomical){for(const eye of R.human.head.eyes){sphere([eye[0],eye[1],-eye[2]],[.018,.009,.008],[.7,.68,.63]);sphere([eye[0],eye[1],-eye[2]-.005],[.005,.005,.003],dark);}}
  box([0,1.27,-.15],[.015,.39,.01],[.51,.53,.49]);for(const side of [-1,1])box([side*.115,1.16,-.145],[.11,.025,.020],dark);
  if(e.civil&&!e.seated&&!realBody){box([0,1.12,-.16],[.25,.40,.025],[.71,.66,.52]);for(const side of [-1,1])box([side*.09,1.39,-.14],[.018,.19,.018],[.71,.66,.52]);}
  else if(!e.civil){box([0,1.49,-.135],[.26,.07,.06],accent);if(id%2===0&&!look?.veil){box([0,1.66,-.13],[.20,.095,.04],dark);box([0,1.81,-.04],[.26,.06,.26],cloth);}}
 }
 return out;
}
R.people={build};})(globalThis.RADE);
