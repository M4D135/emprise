/* RADE — TMAX-inspired maxi-scooter, electric kick scooter and city bicycle.
   Original procedural meshes; see docs/VEHICULES.md for visual references. */
(function(R){'use strict';const V=R.vehicles,PI=Math.PI,black=[.025,.032,.04],metal=[.48,.54,.57],tire=[.012,.016,.022];
Object.assign(V.SPECS,{tmax:{name:'Yamaha TMAX 560',length:2.195,width:.78,height:1.47,wheelbase:1.575,mass:219,two:true,top:43,acc:5.4,eye:[-.20,1.49,0]},scooter:{name:'Trottinette électrique',length:1.144,width:.48,height:1.178,wheelbase:.91,mass:17.2,two:true,top:6.94,acc:1.8,eye:[-.12,1.73,0]},bike:{name:'Vélo de ville',length:1.82,width:.62,height:1.10,wheelbase:1.10,mass:14,two:true,top:11,acc:1.25,eye:[-.20,1.62,0]}});
const originalModel=V.model,originalRender=V.render,cache=new Map();
function model(type,color='#18252f'){
 if(!V.SPECS[type]?.two)return originalModel(type,color);const key=type+color;if(cache.has(key))return cache.get(key);
 const spec=V.SPECS[type],paint=V.rgb(color),pieces=[],front=[],bike=type==='bike',kick=type==='scooter',wr=bike?.345:kick?.127:.285,wb=spec.wheelbase/2;
 function p(shape,pos,s,c=paint,r=[0,0,0],extra={}){const q={shape,p:pos,s,color:c,r,mat:c===paint?17:7,surface:'object',...extra};pieces.push(q);return q;}
 function box(pos,s,c=paint,r,extra){return p('bevel',pos,s,c,r,extra);}
 function bar(a,b,w,c=paint){const d=b.map((v,i)=>v-a[i]),len=Math.hypot(...d);return p('cylinder',a.map((v,i)=>(v+b[i])/2),[w,len,w],c,[Math.acos(d[1]/len),Math.atan2(d[0],d[2]),0]);}
 function shell(name,sections,c=paint){const triangles=BITUME.carene.carene(sections.map(([x,y0,y1,l,n=2.5])=>({x,y0,y1,l,n})),{cotes:16,pas:3,vif:38});const norm=BITUME.carene.normaliser(triangles),shape='rade-mobility-'+name;if(typeof FRender!=='undefined')FRender.forme(shape,norm.triangles);return p(shape,norm.centre,norm.taille,c);}
 if(type==='tmax'){
  shell('underbody',[[-.86,.31,.46,.13],[-.34,.26,.57,.25],[.26,.30,.68,.24],[.53,.4,.55,.12]],black);
  shell('tail',[[-1.03,.62,.76,.13],[-.72,.51,.84,.25],[-.35,.44,.77,.27],[.04,.44,.69,.20]]);
  shell('seat',[[-.91,.79,.85,.17],[-.63,.82,.91,.24],[-.43,.76,.87,.24],[-.1,.73,.82,.18],[.02,.72,.78,.11]],black);
  shell('tunnel',[[.06,.35,.69,.12],[.24,.35,.84,.20],[.44,.44,1.12,.25],[.59,.53,1.14,.28]]);
  shell('nose',[[.41,.56,1.12,.29],[.63,.54,1.14,.34],[.86,.67,1.03,.31],[1.01,.78,.90,.17]]);
  shell('mudguard',[[.55,.52,.60,.10],[.78,.55,.64,.12],[1.0,.47,.54,.085]],black);
  for(const side of [-1,1]){box([.38,.38,side*.27],[.74,.10,.17],black);box([.46,.70,side*.29],[.38,.27,.075],paint,[0,0,.3]);box([.927,.955,side*.19],[.025,.056,.21],[.76,.88,.94],[0,0,.12],{mat:8});bar([.42,1.12,side*.26],[.48,1.30,side*.42],.024,black);box([.5,1.32,side*.44],[.16,.075,.12],black);box([.42,1.32,side*.44],[.008,.052,.08],metal);}
  box([.56,1.30,0],[.024,.39,.39],[.20,.36,.41],[0,0,.22],{fx:true,alpha:.23});
  box([.39,1.08,0],[.08,.18,.28],black,[0,0,.5]);box([.337,1.10,0],[.012,.10,.21],[.025,.17,.21],[0,0,.5],{mat:4,emissive:.2});
  box([-.99,.75,0],[.04,.06,.34],[.9,.035,.035],null,{mat:6});box([-.94,.38,0],[.04,.12,.18],[.9,.89,.79]);
  p('cylinder',[-.64,.30,.32],[.18,.59,.18],metal,[0,0,PI/2]);p('cylinder',[-.96,.30,.32],[.11,.02,.11],black,[0,0,PI/2]);
  bar([-.04,.31,-.13],[-wb,wr,-.13],.08,metal);
 }else if(kick){
  box([-.08,.17,0],[.69,.07,.17],paint);box([-.08,.21,0],[.59,.012,.15],black);
  bar([.29,.18,0],[.34,.47,0],.07,paint);bar([wb,wr,0],[.34,1.10,0],.045,paint);
  box([.35,1.105,0],[.08,.05,.10],black);box([.32,1.13,0],[.04,.01,.06],[.10,.65,.6],null,{mat:4});
  box([-.49,.23,0],[.16,.035,.12],black,[0,0,-.3]);box([-.55,.22,0],[.02,.03,.08],[.85,.03,.03],null,{mat:6});
  p('sphere',[.37,1.05,0],[.04,.045,.045],[.9,.9,.8],null,{mat:8});
  bar([-.13,.17,.07],[-.19,.04,.13],.014,metal);
 }else{
  const rear=[-wb,wr,0],crank=[-.05,.31,0],seat=[-.22,.91,0],head=[.35,.88,0];
  for(const[a,b]of [[rear,crank],[crank,seat],[seat,rear],[seat,head],[head,crank]])bar(a,b,.032,paint);
  bar([.38,.77,0],[wb,wr,0],.029,metal);bar([.35,.87,0],[.30,1.06,0],.028,metal);bar([-.22,.8,0],[-.25,1.0,0],.027,metal);
  box([-.28,1.01,0],[.25,.045,.16],black);bar([-.62,.73,-.1],[-.32,.73,-.1],.018,metal);bar([-.62,.73,.1],[-.32,.73,.1],.018,metal);
  for(const side of [-1,1])bar([-wb,wr,side*.04],[-.54,.73,side*.1],.013,metal);
  bar([-.15,.3,.07],[-.3,.04,.13],.014,metal);bar([-.53,.30,.055],[-.05,.23,.055],.011,black);bar([-.53,.40,.055],[-.05,.40,.055],.011,black);
  p('cylinder',[-.05,.31,.07],[.18,.012,.18],metal,[PI/2,0,0]);
  p('sphere',[.4,1.0,0],[.045,.065,.065],[.94,.91,.75],null,{mat:8});
 }
 const handleX=kick?.34:.29,handleY=kick?1.10:bike?1.07:1.08,handleW=spec.width/2;
 const begin=pieces.length;
 bar([handleX,handleY,-handleW],[handleX,handleY,handleW],.028,metal);
 for(const side of [-1,1]){bar([handleX,handleY,side*(handleW-.12)],[handleX,handleY,side*handleW],.041,black);bar([handleX+.06,handleY-.015,side*(handleW-.10)],[handleX+.07,handleY-.015,side*handleW],.012,metal);}
 front.push(...pieces.slice(begin));
 const result={spec,pieces,wr,wb,eye:spec.eye,front};cache.set(key,result);return result;
}
function render(c,out,opt={}){
 if(!V.SPECS[c.model]?.two)return originalRender(c,out,opt);
 const mod=model(c.model,c.color),M=BITUME.voiture.attitude(c.cap,0,c.roulis||0),pos=[c.x,c.y||.08,c.z];
 function put(m){const p=BITUME.voiture.mul(M,m.p),r=BITUME.voiture.angles(BITUME.voiture.mulM(M,BITUME.voiture.euler(...(m.r||[0,0,0]))));out.push({...m,p:p.map((x,i)=>x+pos[i]),r});}
 for(const q of mod.pieces)put(q);
 for(const a of [-1,1]){
  const x=a*mod.wb,y=mod.wr,r=mod.wr,steer=a>0?-(c.braquage||0):0;
  put({shape:'ring',p:[x,y,0],s:[2*r,c.model==='tmax'?.14:.045,2*r],r:[PI/2,steer,0],color:tire,mat:7});
  put({shape:'ring',p:[x,y,0],s:[r*1.69,.025,r*1.69],r:[PI/2,steer,0],color:metal,mat:0});
  const n=c.model==='bike'?16:6;
  for(let j=0;j<n;j++){const angle=j*PI*2/n+(c.distance||0)/r;put({shape:'box',p:[x+Math.sin(angle)*r*.39,y+Math.cos(angle)*r*.39,0],s:[c.model==='bike'?.006:.025,r*.80,.012],r:[0,steer,-angle],color:metal,mat:0});}
  put({shape:'cylinder',p:[x,y,0],s:[.07,.14,.07],r:[PI/2,steer,0],color:metal,mat:0});
 }
 if(c.model==='bike')for(const side of [-1,1]){const a=(c.distance||0)*2+side*PI/2;put({shape:'box',p:[-.05+Math.sin(a)*.12,.31+Math.cos(a)*.12,side*.15],s:[.08,.025,.10],color:black,mat:7});}
 // Seated/standing rider visible in chase view; joint segments follow pedals and controls.
 if(opt.rider&&!opt.cockpit){const kick=c.model==='scooter',cy=kick?1.03:1.10,cx=kick?-.08:-.27,torso=[.07,.12,.16],skin=[.57,.36,.25];
 const limb=(a,b,w,col)=>{const d=b.map((v,i)=>v-a[i]),l=Math.hypot(...d);put({shape:'cylinder',p:a.map((v,i)=>(v+b[i])/2),s:[w,l,w],r:[Math.acos(d[1]/l),Math.atan2(d[0],d[2]),0],color:col,mat:18});};
 put({shape:'bevel',p:[cx,cy+.20,0],s:[.27,.43,.39],color:torso,mat:18});put({shape:'sphere',p:[cx+.07,cy+.57,0],s:[.26,.29,.25],color:black,mat:7});put({shape:'box',p:[cx+.19,cy+.57,0],s:[.04,.08,.19],color:[.20,.34,.37],mat:8});
 for(const side of [-1,1]){const shoulder=[cx,cy+.34,side*.21],elbow=[cx+.16,cy+.08,side*.26],hand=[.28,1.07,side*(mod.spec.width/2-.06)],hip=[cx,cy-.07,side*.12],knee=kick?[-.07,.54,side*.08]:[.15,.58,side*.19],foot=kick?[-.12,.25,side*.06]:[.11,.29,side*.19];limb(shoulder,elbow,.10,torso);limb(elbow,hand,.08,torso);limb(hip,knee,.13,[.14,.17,.23]);limb(knee,foot,.11,[.14,.17,.23]);put({shape:'bevel',p:foot,s:[.23,.10,.11],color:black,mat:7});}
 }
 return mod;
}
function step(c,cmd,world,dt){
 const spec=V.SPECS[c.model];if(world.weather?.gust>.65&&c.v>3)c.w+=Math.sin(c.cap-.4)*world.weather.gust*.18*dt;if(!spec.two)return BITUME.conduite.pas(c,cmd,world,dt);
 const gaz=c.moteur?cmd.gaz||0:0,reverse=!!cmd.marcheArriere,old=c.u;
 c.gaz=gaz;c.arriere=reverse;c.volant+=((cmd.volant||0)-c.volant)*(1-Math.exp(-dt/.12));
 const thrust=spec.acc*gaz*(reverse?-.6:1)*Math.max(0,1-Math.abs(c.u)/(reverse?2:spec.top)),drag=.10+c.u*c.u*.0015,brake=(cmd.frein||0)*6*(1-.22*(world.weather?.wet||0));
 c.u+= (thrust-Math.sign(c.u)*(drag+brake))*dt;if(old*c.u<0&&!gaz)c.u=0;
 c.braquage=c.volant*Math.min(.5,2.5/Math.max(1,Math.abs(c.u)));c.omega=c.u*Math.tan(c.braquage)/spec.wheelbase;
 const next=c.cap+c.omega*dt,hit=world.moveVehicle(c,Math.cos(next)*c.u*dt,Math.sin(next)*c.u*dt,next);if(hit)c.u=0;
 c.v=Math.abs(c.u);c.w=0;c.distance+=c.v*dt;c.y=world.ground(c.x,c.z);c.roulis+=(-Math.atan(c.omega*c.u/9.81)*.65-c.roulis)*(1-Math.exp(-dt/.18));c.regime=c.moteur?1800+gaz*4500:0;c.rapport=1;
 return hit?[{type:'choc',force:Math.abs(old)}]:[];
}
V.model=model;V.render=render;V.step=step;
for(const type of ['tmax','scooter','bike'])model(type);
})(globalThis.RADE);
