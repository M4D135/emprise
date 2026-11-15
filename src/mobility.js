/* RADE — TMAX-inspired maxi-scooter, electric kick scooter and city bicycle.
   Original procedural meshes; see docs/VEHICULES.md for visual references. */
(function(R){'use strict';const V=R.vehicles,PI=Math.PI,black=[.025,.032,.04],metal=[.48,.54,.57],tire=[.012,.016,.022];
Object.assign(V.SPECS,{tmax:{name:'Yamaha TMAX 560',length:2.195,width:.78,height:1.47,wheelbase:1.575,mass:219,two:true,top:43,acc:5.4,eye:[-.20,1.49,0]},scooter:{name:'Trottinette électrique',length:1.144,width:.48,height:1.178,wheelbase:.91,mass:17.2,two:true,top:6.94,acc:1.8,eye:[-.12,1.73,0]},bike:{name:'Vélo de ville',length:1.82,width:.62,height:1.10,wheelbase:1.10,mass:14,two:true,top:11,acc:1.25,eye:[-.20,1.62,0]}});
const originalModel=V.model,originalRender=V.render,cache=new Map();
// RT road-tourer proportions; patrol equipment adds an estimated 20 kg.
V.SPECS.policebike={name:'Moto de police · RT 1250',length:2.222,width:.990,height:1.65,wheelbase:1.485,mass:299,two:true,top:54,acc:6.8,eye:[-.22,1.55,0]};
const shapeCache=new Map(),triangleCounts=new Map();
const addTri=(out,a,b,c)=>{const u=b.map((v,i)=>v-a[i]),v=c.map((n,i)=>n-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n)||1;out.push([a,b,c,...Array(3).fill(n.map(v=>v/l))]);};
const addQuad=(out,a,b,c,d)=>{addTri(out,a,b,c);addTri(out,a,c,d);};
function shape(name,build,smooth=false){
 const key='emprise-mobility-'+name;if(shapeCache.has(key))return shapeCache.get(key);
 let triangles=build();if(smooth)triangles=BITUME.carene.lisser(triangles.map(t=>t.slice(0,3)),42);
 const n=BITUME.carene.normaliser(triangles),result={shape:key,p:n.centre,s:n.taille};
 if(typeof FRender!=='undefined')FRender.forme(key,n.triangles);shapeCache.set(key,result);triangleCounts.set(key,n.triangles.length);return result;
}
function tube(out,a,b,r0,r1=r0,sides=6){
 const d=b.map((v,i)=>v-a[i]),length=Math.hypot(...d),axis=d.map(v=>v/length),u=Math.abs(axis[1])<.95?[axis[2],0,-axis[0]]:[1,0,0],ul=Math.hypot(...u);for(let k=0;k<3;k++)u[k]/=ul;
 const v=[axis[1]*u[2]-axis[2]*u[1],axis[2]*u[0]-axis[0]*u[2],axis[0]*u[1]-axis[1]*u[0]],at=(p,r,j)=>p.map((n,k)=>n+r*(Math.cos(j*PI*2/sides)*u[k]+Math.sin(j*PI*2/sides)*v[k]));
 for(let j=0;j<sides;j++){const p=at(a,r0,j),q=at(a,r0,j+1),r=at(b,r1,j),s=at(b,r1,j+1);addQuad(out,p,q,s,r);addTri(out,a,q,p);addTri(out,b,r,s);}
}
function lathe(name,profile,sides){
 return shape(name,()=>{const out=[],at=(j,k)=>{const [r,z]=profile[(k+profile.length)%profile.length],a=j*PI*2/sides;return [r*Math.cos(a),r*Math.sin(a),z];};
  for(let j=0;j<sides;j++)for(let k=0;k<profile.length;k++)addQuad(out,at(j,k),at(j+1,k),at(j+1,k+1),at(j,k+1));return out;
 },true);
}
function spinMatrix(axis,angle){
 const l=Math.hypot(...axis),[x,y,z]=axis.map(v=>v/l),c=Math.cos(angle),s=Math.sin(angle),t=1-c;
 return [[t*x*x+c,t*x*y+s*z,t*x*z-s*y],[t*x*y-s*z,t*y*y+c,t*y*z+s*x],[t*x*z+s*y,t*y*z-s*x,t*z*z+c]];
}
function model(type,color='#18252f'){
 if(!V.SPECS[type]?.two)return originalModel(type,color);const key=type+color;if(cache.has(key))return cache.get(key);
 const spec=V.SPECS[type],paint=V.rgb(color),pieces=[],front=[],bike=type==='bike',kick=type==='scooter',rt=type==='policebike',wr=bike?.345:kick?.127:rt?.315:.285,wb=spec.wheelbase/2;
 const steering={pivot:[wb,rt?.300:wr,0],axis:kick?[-.115,.973,0]:bike?[-.20,.535,0]:[-.30,.65,0]},handle={x:kick?.34:bike?.30:rt?.17:.28,y:kick?1.10:bike?1.07:rt?1.135:1.08,half:rt?.365:spec.width/2-.025};
 let group='fixed';
 function p(name,pos,size,c=paint,r=[0,0,0],extra={}){const q={shape:name,p:pos,s:size,color:c,r:r||[0,0,0],mat:c===paint?17:c===metal?0:7,surface:'object',detail:0,group,...extra};pieces.push(q);if(group==='steering')front.push(q);return q;}
 function box(pos,size,c=paint,r,extra){return p('bevel',pos,size,c,r,extra);}
 function bar(a,b,w,c=paint,extra={}){const d=b.map((v,i)=>v-a[i]),len=Math.hypot(...d);return p('cylinder',a.map((v,i)=>(v+b[i])/2),[w,len,w],c,[Math.acos(d[1]/len),Math.atan2(d[0],d[2]),0],extra);}
 function custom(g,c=paint,extra={}){return p(g.shape,g.p.slice(),g.s.slice(),c,[0,0,0],extra);}
 function shell(name,sections,c=paint,extra={}){return custom(shape(type+'-'+name,()=>BITUME.carene.carene(sections.map(([x,y0,y1,l,n=3])=>({x,y0,y1,l,n})),{cotes:24,pas:4,vif:40})),c,extra);}
 function surface(name,polys,c=paint,extra={}){return custom(shape(type+'-'+name,()=>{const out=[];for(const poly of polys)for(let i=1;i<poly.length-1;i++)addTri(out,poly[0],poly[i],poly[i+1]);return out;},!!extra.smooth),c,extra);}
 function path(name,points,r,c=black,extra={}){return custom(shape(type+'-'+name,()=>{const out=[];for(let i=1;i<points.length;i++)tube(out,points[i-1],points[i],r,r,8);return out;},true),c,extra);}
 function fender(name,x,r,width,from,to,c=paint){return custom(shape(type+'-'+name,()=>{const out=[],segments=20,at=(j,side,outer)=>{const a=from+(to-from)*j/segments;return [x+Math.cos(a)*(r+(outer?(bike?.004:kick?.006:.010):0)),wr+Math.sin(a)*(r+(outer?(bike?.004:kick?.006:.010):0)),side*width/2];};for(let j=0;j<segments;j++){addQuad(out,at(j,-1,true),at(j+1,-1,true),at(j+1,1,true),at(j,1,true));addQuad(out,at(j,-1,false),at(j,1,false),at(j+1,1,false),at(j+1,-1,false));for(const side of [-1,1]){const q=[at(j,side,false),at(j,side,true),at(j+1,side,true),at(j+1,side,false)];addQuad(out,...(side<0?q.reverse():q));}}for(const j of [0,segments]){const q=[at(j,-1,false),at(j,-1,true),at(j,1,true),at(j,1,false)];addQuad(out,...(j?q.reverse():q));}return out;},true),c);}
 if(rt){
  shell('engine',[[-.38,.27,.61,.15],[-.05,.24,.67,.19],[.20,.31,.65,.17],[.32,.42,.56,.10]],[.18,.20,.22],{mat:0});
  for(const side of [-1,1]){
   // Opposed cylinders and their heads remain visible below the touring fairing.
   box([.095,.48,side*.255],[.26,.20,.24],[.22,.25,.27],null,{mat:0});
   box([.095,.485,side*.38],[.225,.175,.035],[.46,.49,.48],null,{mat:0});
   for(let j=0;j<4;j++)box([.095,.425+j*.033,side*.402],[.20,.012,.009],black,null,{detail:1});
   path('frame-'+side,[[-.67,.68,side*.09],[-.24,.65,side*.13],[.31,.92,side*.10],[.03,.38,side*.14],[-.45,.32,side*.12]],.025,black);
   path('engine-guard-'+side,[[.30,.54,side*.26],[.30,.36,side*.43],[-.10,.32,side*.43],[-.16,.50,side*.28]],.016,metal,{mat:0});
   const panel=[[.18,.52,side*.21],[.46,.62,side*.30],[.67,.94,side*.36],[.49,1.125,side*.32],[.19,1.05,side*.24],[-.09,.76,side*.19]];
   const back=panel.map(p=>[p[0],p[1],p[2]-side*.024]),polys=[side>0?panel:panel.slice().reverse(),side>0?back.slice().reverse():back];for(let j=0;j<panel.length;j++)polys.push([panel[j],back[j],back[(j+1)%panel.length],panel[(j+1)%panel.length]]);
   surface('touring-side-'+side,polys,paint,{smooth:true});
   box([.45,.81,side*.31],[.11,.16,.016],black,[0,side*.3,-.38]);
   for(let j=0;j<3;j++)box([.45,.767+j*.04,side*.322],[.095,.007,.01],[.26,.29,.29],[0,side*.3,-.38],{detail:1});
   box([.20,1.105,side*.408],[.22,.11,.16],paint,[0,side*.12,0]);
   box([.095,1.115,side*.408],[.009,.072,.118],[.24,.36,.40],null,{mat:19,detail:1});
   bar([-.22,.35,side*.16],[-.22,.35,side*.31],.029,metal,{mat:0});box([-.22,.353,side*.30],[.11,.025,.105],black);
  }
  shell('tank',[[-.25,.68,.88,.15],[-.10,.66,1.02,.205],[.14,.71,1.07,.215],[.35,.82,1.03,.16],[.42,.89,.97,.08]]);
  p('cylinder',[.09,1.074,0],[.085,.008,.085],metal,null,{mat:0,detail:1});
  shell('seat',[[-.60,.77,.83,.17],[-.46,.77,.825,.20],[-.28,.765,.815,.18],[-.13,.78,.83,.10]],black,{mat:18});
  shell('rear-frame',[[-1.07,.66,.73,.05],[-.86,.62,.84,.16],[-.59,.57,.80,.19],[-.40,.58,.75,.16]]);
  path('shaft-drive',[[-.20,.34,-.105],[-.48,.31,-.13],[-wb,.315,-.12]],.065,[.27,.30,.31],{mat:0});
  p('cylinder',[-wb,.315,-.115],[.17,.07,.17],[.27,.30,.31],[PI/2,0,0],{mat:0});
  shell('exhaust',[[-1.01,.30,.43,.045],[-.87,.27,.48,.075],[-.53,.30,.47,.075],[-.36,.33,.41,.045]],metal,{mat:0}).p[2]=.25;
  p('cylinder',[-1.017,.37,.25],[.067,.014,.067],black,[0,0,PI/2]);
  path('exhaust-header',[[.23,.44,.25],[.29,.23,.23],[.02,.21,.18],[-.44,.33,.25]],.024,metal,{mat:0,detail:1});
  // Upper nose above the wheel, separate from the tank and forks.
  shell('front-cowl',[[.43,.90,1.14,.26],[.64,.79,1.17,.33],[.88,.88,1.10,.28],[.97,.94,1.035,.16]]);
  box([.939,.98,0],[.025,.13,.38],black,[0,0,.16]);
  for(const side of [-1,1]){box([.962,.991,side*.11],[.012,.084,.145],[.65,.78,.80],[0,side*.13,.16],{mat:8});path('running-light-'+side,[[.970,1.028,side*.055],[.968,1.035,side*.16],[.963,1.005,side*.18]],.007,[.88,.94,.94],{mat:4,detail:1});}
  const wind=[];for(let j=0;j<9;j++)for(let i=0;i<12;i++){
   const at=(u,v)=>{const t=u/6-1;return [.56-v*.028-.045*t*t,1.145+v*.039-.025*t*t,t*(.255-.016*v/9)];};const q=[at(i,j),at(i+1,j),at(i+1,j+1),at(i,j+1)];wind.push(q,q.slice().reverse());
  }surface('touring-windscreen',wind,[.30,.43,.46],{mat:19,fx:true,alpha:.22,smooth:true});
  box([.35,1.107,0],[.12,.12,.34],black,[0,0,.35]);box([.288,1.127,0],[.012,.072,.26],[.03,.16,.19],[0,0,.35],{mat:4,detail:1});
  box([-1.061,.745,0],[.026,.072,.25],[.66,.02,.02],null,{mat:6});box([-1.08,.58,0],[.025,.12,.17],[.82,.83,.78],null,{detail:1});
  group='steering';
  for(const side of [-1,1]){bar([.43,.94,side*.105],[.65,.49,side*.105],.038,metal,{mat:0});bar([.65,.50,side*.105],[wb,.300,side*.105],.048,[.27,.30,.31],{mat:0});box([.69,.34,side*.105],[.085,.14,.04],black,null,{detail:1});}
  fender('front-fender',wb,.319,.15,.13,PI-.10,paint).p[1]-=.015;
 }else if(type==='tmax'){
  shell('lower-engine',[[-.81,.28,.45,.12],[-.53,.25,.52,.21],[-.13,.27,.55,.24],[.25,.31,.55,.17],[.48,.40,.52,.08]],black);
  shell('tail',[[-1.025,.63,.73,.075],[-.82,.57,.82,.19],[-.53,.48,.80,.24],[-.20,.45,.72,.24],[.025,.44,.67,.15]]);
  shell('rider-seat',[[-.51,.77,.84,.21],[-.33,.75,.82,.225],[-.12,.72,.80,.17],[.025,.70,.76,.07]],black,{mat:18});
  shell('passenger-seat',[[-.96,.76,.82,.10],[-.80,.80,.89,.17],[-.60,.81,.91,.20],[-.47,.80,.88,.20]],black,{mat:18});
  shell('legshield',[[.055,.36,.62,.10],[.25,.36,.73,.17],[.42,.44,.99,.215],[.58,.63,1.105,.19]],black);
  // A thin sculpted front apron replaces the old ellipsoidal nose volume.
  const yRows=[[.61,.79,.14],[.72,.91,.23],[.89,.99,.31],[1.015,.86,.295],[1.105,.65,.205]],face=(j,t,back=0)=>{const [y,x,w]=yRows[j],z=t*w;return [x-.14*t*t-back,y,z];},frontPolys=[];
  for(let j=0;j<yRows.length-1;j++)for(let i=0;i<12;i++){const t=i/6-1,u=(i+1)/6-1;frontPolys.push([face(j,t),face(j+1,t),face(j+1,u),face(j,u)]);frontPolys.push([face(j,t,.027),face(j,u,.027),face(j+1,u,.027),face(j+1,t,.027)]);}
  for(const t of [-1,1])for(let j=0;j<yRows.length-1;j++){const q=[face(j,t),face(j+1,t),face(j+1,t,.027),face(j,t,.027)];frontPolys.push(t<0?q.reverse():q);}
  for(const j of [0,yRows.length-1])for(let i=0;i<12;i++){const q=[face(j,i/6-1),face(j,i/6-1,.027),face(j,(i+1)/6-1,.027),face(j,(i+1)/6-1)];frontPolys.push(j===0?q.reverse():q);}
  surface('front-apron',frontPolys,paint,{smooth:true});
  const frontX=(y,z)=>{let j=0;while(j<yRows.length-2&&y>yRows[j+1][0])j++;const t=(y-yRows[j][0])/(yRows[j+1][0]-yRows[j][0]),x=yRows[j][1]*(1-t)+yRows[j+1][1]*t,w=yRows[j][2]*(1-t)+yRows[j+1][2]*t;return x-.14*(z/w)**2;};
  for(const side of [-1,1]){
   const z=side*.255;
   const edge=[[-.66,.54,z],[-.16,.44,side*.245],[.22,.46,side*.26],[.51,.69,side*.25],[.55,.91,side*.225],[.32,.70,side*.26],[-.04,.62,side*.27],[-.60,.66,side*.225]],panels=[],back=q=>[q[0],q[1],q[2]-side*.022];for(const ids of [[0,1,6,7],[1,2,5,6],[2,3,4,5]]){const q=ids.map(i=>edge[i]);panels.push(side>0?q:q.slice().reverse(),side>0?q.map(back).reverse():q.map(back));}for(let j=0;j<8;j++){const q=[edge[j],back(edge[j]),back(edge[(j+1)%8]),edge[(j+1)%8]];panels.push(side>0?q:q.reverse());}surface('boomerang-'+side,panels,paint,{smooth:true});
   shell('floorboard-'+side,[[-.05,.325,.375,.07],[.22,.325,.38,.075],[.48,.35,.405,.06]],black).p[2]+=side*.285;
   for(let j=0;j<5;j++)box([.06+j*.075,.384,side*.285],[.035,.008,.09],[.16,.18,.18],null,{detail:2});
   path('grab-'+side,[[-.92,.76,side*.19],[-.73,.84,side*.235],[-.52,.84,side*.24]],.017,black,{detail:1});
   const lens=[[.916,.960,side*.079],[.874,.981,side*.238],[.918,.916,side*.277],[.958,.920,side*.115]];
   for(const q of lens)q[0]=frontX(q[1],q[2])+.008;if(side<0)lens.reverse();surface('headlamp-recess-'+side,[lens],black,{mat:7});surface('headlamp-lens-'+side,[lens.map(([x,y,z])=>[x+.006,y+.003,z*.96])],[.63,.77,.82],{mat:8});
   path('headlamp-strip-'+side,Array.from({length:5},(_,j)=>{const y=.966+j*.004,z=side*(.10+j*.033);return [frontX(y,z)+.024,y,z];}),.006,[.88,.94,.94],{mat:4,detail:1});
   path('mirror-arm-'+side,[[.45,1.07,side*.225],[.45,1.24,side*.31],[.40,1.29,side*.335]],.012,black);
   box([.395,1.30,side*.335],[.155,.072,.105],black,[0,side*.12,-.10]);box([.323,1.303,side*.335],[.008,.048,.082],[.31,.43,.46],null,{mat:19,detail:1});
  }
  const wind=[];for(let j=0;j<8;j++)for(let i=0;i<12;i++){
   const at=(u,v)=>{const t=u/6-1,y=1.105+v*.044,width=.208-.025*v/8;return [.628-.020*v-.040*t*t,y-.022*t*t,t*width];};
   const q=[at(i,j),at(i+1,j),at(i+1,j+1),at(i,j+1)];wind.push(q,q.slice().reverse());
  }surface('windscreen',wind,[.24,.39,.43],{mat:19,fx:true,alpha:.24,smooth:true});
  box([.39,1.065,0],[.105,.13,.285],black,[0,0,.48]);box([.337,1.085,0],[.012,.075,.205],[.026,.15,.18],[0,0,.48],{mat:4,detail:1});
  for(const z of [-.069,0,.069])box([.329,1.098,z],[.006,.028,.030],[.32,.66,.67],[0,0,.48],{mat:4,detail:2});
  shell('exhaust',[[-1.025,.31,.405,.055],[-.87,.26,.42,.085],[-.51,.28,.40,.08],[-.40,.31,.37,.045]],metal,{mat:0}).p[2]=.285;
  p('cylinder',[-1.035,.355,.285],[.068,.018,.068],black,[0,0,PI/2]);
  shell('transmission',[[-.87,.22,.43,.06],[-.67,.22,.43,.08],[-.30,.30,.46,.08],[-.07,.34,.42,.045]],[.17,.20,.21],{mat:0}).p[2]=-.20;
  path('swingarm',[[-.12,.37,-.12],[-.44,.31,-.12],[-wb,wr,-.12]],.035,[.27,.30,.30],{mat:0});
  path('rear-spring',[[-.64,.36,.11],[-.48,.56,.13]],.027,metal,{detail:1});
  box([-.994,.74,0],[.042,.064,.28],[.72,.018,.018],null,{mat:6});box([-1.005,.47,0],[.035,.13,.17],[.84,.83,.73],[0,0,-.17],{detail:1});
  group='steering';
  for(const side of [-1,1]){bar([.485,.94,side*.095],[.68,.49,side*.095],.043,[.48,.43,.30],{mat:0});bar([.68,.50,side*.095],[wb,wr,side*.095],.034,metal,{mat:0});box([.70,.36,side*.10],[.09,.13,.045],[.19,.22,.23],null,{detail:1});}
  fender('front-fender',wb,wr+.019,.17,.15,PI-.18,paint);
 }else if(kick){
  shell('battery-deck',[[-.45,.135,.19,.07],[-.34,.125,.205,.092],[.18,.125,.205,.092],[.31,.15,.20,.055]],paint);
  box([-.075,.211,0],[.56,.012,.154],black);for(let j=0;j<14;j++)box([-.33+j*.039,.219,0],[.012,.004,.134],[.12,.14,.14],null,{detail:2});
  path('neck',[[.23,.18,0],[.29,.24,0],[.36,.36,0],[.412,.43,0]],.032,paint);
  box([.405,.43,0],[.080,.115,.073],black,[0,0,.11]);box([.373,.445,0],[.018,.09,.040],metal,null,{detail:1});
  fender('rear-fender',-wb,wr+.012,.075,.05,PI+.15,black);box([-.552,.229,0],[.024,.030,.052],[.85,.025,.018],null,{mat:6});
  bar([-.13,.17,.07],[-.20,.025,.14],.014,metal,{detail:1});
  group='steering';bar([.412,.43,0],[.34,1.10,0],.043,paint);p('cylinder',[.406,.48,0],[.053,.055,.053],black,[0,0,-.107],{detail:1});
  for(const side of [-1,1])path('fork-'+side,[[.423,.40,side*.035],[.452,.25,side*.041],[wb,wr,side*.041]],.014,paint);
  fender('front-fender',wb,wr+.016,.068,.38,PI-.35,black);
  box([.345,1.107,0],[.092,.049,.105],black);box([.329,1.134,0],[.044,.012,.067],[.05,.27,.28],[0,0,.10],{mat:4,detail:1});
  p('cylinder',[.374,1.066,0],[.035,.035,.035],black,[0,0,PI/2]);p('cylinder',[.393,1.066,0],[.027,.008,.027],[.89,.91,.82],[0,0,PI/2],{mat:8});
  path('brake-cable',[[.34,1.08,-.13],[.42,.99,-.09],[.45,.82,-.04],[.419,.50,-.035]],.0035,black,{detail:1});
 }else{
  const rear=[-wb,wr,0],crank=[-.05,.31,0],seat=[-.22,.91,0],head=[.35,.88,0];
  for(const [a,b,w]of [[crank,seat,.034],[seat,head,.030],[head,crank,.038]])bar(a,b,w,paint);
  for(const side of [-1,1]){bar([rear[0],rear[1],side*.045],[crank[0],crank[1],side*.035],.018,paint);bar([rear[0],rear[1],side*.045],[seat[0],seat[1]-.02,side*.018],.017,paint);}
  bar([.38,.78,0],[.335,.94,0],.046,paint);bar([-.22,.8,0],[-.25,.99,0],.027,metal,{mat:0});
  shell('saddle',[[-.43,.975,1.025,.045],[-.34,.978,1.037,.095],[-.23,.972,1.03,.09],[-.08,.98,1.012,.027]],black,{mat:18});
  for(const side of [-1,1]){bar([-.40,.966,side*.04],[-.16,.958,side*.04],.009,metal,{detail:1});path('rack-'+side,[[-.79,.735,side*.102],[-.34,.735,side*.102],[-.34,.75,side*.07]],.009,metal);bar([-wb,wr,side*.045],[-.70,.735,side*.10],.011,metal);}
  for(const x of [-.76,-.62,-.47,-.35])bar([x,.735,-.102],[x,.735,.102],.010,metal,{detail:1});
  fender('rear-fender',-wb,wr+.013,.053,-.08,PI+.30,[.34,.38,.36]);
  p('cylinder',[-.05,.31,0],[.074,.12,.074],[.28,.31,.31],[PI/2,0,0],{mat:0});
  path('chain',[[-.55,.390,.071],[-.05,.405,.071],[.047,.31,.071],[-.05,.215,.071],[-.55,.305,.071],[-.59,.346,.071],[-.55,.390,.071]],.0045,[.14,.17,.17],{detail:1});
  const ring=lathe('bike-chainring',[[.094,.004],[.072,.004],[.072,-.004],[.094,-.004]],32);custom({...ring,p:[ring.p[0]-.05,ring.p[1]+.31,ring.p[2]+.073]},metal,{mat:0,detail:1});
  bar([-.15,.3,-.07],[-.29,.025,-.15],.012,metal,{detail:1});box([-.79,.695,0],[.021,.045,.055],[.72,.02,.015],null,{mat:6,detail:1});
  group='steering';
  for(const side of [-1,1])path('fork-'+side,[[.376,.82,side*.025],[.44,.64,side*.041],[.49,.43,side*.047],[wb,wr,side*.047]],.014,paint);
  bar([.35,.88,0],[.30,1.055,0],.026,metal,{mat:0});bar([.30,1.03,0],[.36,1.06,0],.025,metal,{mat:0});
  fender('front-fender',wb,wr+.013,.053,.15,PI+.08,[.34,.38,.36]);
  for(const side of [-1,1]){bar([.43,.64,side*.04],[.49,.68,side*.032],.012,[.25,.29,.28],{mat:0,detail:1});box([.50,.66,side*.028],[.033,.022,.012],black,null,{detail:1});}
  path('cable-front',[[.30,1.07,-.20],[.43,.98,-.14],[.48,.82,-.06],[.46,.68,-.04]],.003,black,{detail:1});
  p('cylinder',[.405,1.01,0],[.058,.05,.058],[.22,.25,.25],[0,0,PI/2]);p('cylinder',[.432,1.01,0],[.049,.01,.049],[.92,.91,.79],[0,0,PI/2],{mat:8});
 }
 group='steering';
 const hx=handle.x,hy=handle.y,hw=handle.half;
 path('handlebar',[ [hx+.035,hy-.018,-hw],[hx,hy,-hw*.58],[hx,hy,hw*.58],[hx+.035,hy-.018,hw] ],.0135,metal);
 for(const side of [-1,1]){bar([hx+.025,hy-.012,side*(hw-.11)],[hx+.035,hy-.018,side*hw],.036,black);bar([hx+.083,hy-.032,side*(hw-.13)],[hx+.082,hy-.038,side*hw],.011,metal,{mat:0,detail:1});box([hx+.004,hy-.015,side*(hw-.13)],[.047,.044,.038],black,null,{detail:1});}
 if(bike||kick)p('sphere',[hx+.05,hy+.034,-hw*.45],[.045,.028,.045],metal,null,{mat:0,detail:1});
 const wheels=[];
 for(const end of [-1,1]){
  const wheelRadius=rt?(end>0?.300:.315):wr,width=bike?.034:kick?.050:rt?(end<0?.180:.120):end<0?.155:.120,levels=[];
  for(let level=0;level<3;level++){
   const segments=[32,20,12][level],profile=Array.from({length:[12,8,6][level]},(_,i)=>{const a=i*PI*2/[12,8,6][level];return [wheelRadius*(.89+.11*Math.cos(a)),width*.5*Math.sin(a)];});
   const tireShape=lathe(type+'-tyre-'+end+'-'+level,profile,segments),rim=lathe(type+'-rim-'+level,[[wr*.815,width*.33],[wr*.746,width*.33],[wr*.746,-width*.33],[wr*.815,-width*.33]],segments),parts=[{...tireShape,color:tire,mat:7,tag:'tyre'},{...rim,color:metal,mat:0,tag:'rim'}];
   if(!kick&&level<2||type==='tmax'||rt){
    const spokes=shape(type+'-spokes-'+level,()=>{const out=[],n=bike?(level?12:24):10;for(let j=0;j<n;j++){const a=j*PI*2/n,b=a+(bike?(j%2?-.18:.18):.12),r0=bike?.028:.040,r1=wr*.76;const from=[Math.cos(a)*r0,Math.sin(a)*r0,bike?(j%2?-.018:.018):0],to=[Math.cos(b)*r1,Math.sin(b)*r1,0];tube(out,from,to,bike?.0015:.011,bike?.0015:.006,bike?4:6);}return out;},true);parts.push({...spokes,color:metal,mat:0,spin:true,tag:'spokes'});
   }
   if(kick)parts.push({shape:'cylinder',p:[0,0,0],s:[wr*1.53,width*.85,wr*1.53],r:[PI/2,0,0],color:[.13,.16,.17],mat:7,tag:'motor-hub'});
   else parts.push({shape:'cylinder',p:[0,0,0],s:[bike?.062:.065,width*.95,bike?.062:.065],r:[PI/2,0,0],color:metal,mat:0,tag:'hub'});
   if(!bike&&level<2&&(type==='tmax'||rt||end<0)){const radius=kick?.061:rt?(end>0?.16:.138):.1335,disc=lathe(type+'-brake-disc-'+end+'-'+level,[[radius,.004],[radius*.57,.004],[radius*.57,-.004],[radius,-.004]],segments);for(const side of (type==='tmax'||rt)&&end>0?[-1,1]:[1])parts.push({...disc,p:[disc.p[0],disc.p[1],disc.p[2]+side*(width/2+.009)],color:[.40,.44,.45],mat:0,spin:true,tag:'brake-disc'});}
   levels.push(parts);
  }wheels.push({end,x:end*wb,y:wheelRadius,levels});
 }
 const result={spec,pieces,wr,wb,eye:spec.eye,front,steering,handle,wheels,triangleCounts,contacts:(distance=0,turn=0)=>riderContacts(type,handle,steering,distance,turn)};cache.set(key,result);return result;
}
function riderContacts(type,handle,steering,distance,turn){
 const kick=type==='scooter',bike=type==='bike',rt=type==='policebike',matrix=spinMatrix(steering.axis,-turn),move=q=>BITUME.voiture.mul(matrix,q.map((v,k)=>v-steering.pivot[k])).map((v,k)=>v+steering.pivot[k]);
 const hands=[-1,1].map(side=>move([handle.x+.03,handle.y-.015,side*(handle.half-.055)]));
 const pedals=[-1,1].map(side=>{const a=distance*2.7+(side<0?0:PI);return [-.05+Math.sin(a)*.155,.31+Math.cos(a)*.155,side*.145];});
 const feet=bike?pedals.map(p=>[p[0]+.025,p[1]+.060,p[2]]):kick?[[-.21,.268,-.042],[.02,.268,.042]]:rt?[[-.20,.413,-.30],[-.20,.413,.30]]:[[.35,.445,-.285],[.35,.445,.285]];
 return {hands,feet,pedals,hip:bike?[-.25,1.12,0]:kick?[-.10,1.08,0]:rt?[-.34,.91,0]:[-.32,.87,0],head:bike?[.015,1.62,0]:kick?[-.045,1.73,0]:rt?[-.20,1.55,0]:[-.18,1.49,0]};
}
let patrolParts;
function joint(a,b,l1,l2,pole){
 const d=b.map((v,k)=>v-a[k]),distance=Math.hypot(...d),axis=d.map(v=>v/distance),v=pole.map((v,k)=>v-a[k]),dot=v.reduce((n,v,k)=>n+v*axis[k],0),side=v.map((v,k)=>v-dot*axis[k]),length=Math.hypot(...side)||1;
 const x=(distance*distance+l1*l1-l2*l2)/(2*distance),h=Math.sqrt(Math.max(0,l1*l1-x*x));return a.map((v,k)=>v+axis[k]*x+side[k]*h/length);
}
function policeEquipment(){
 if(patrolParts)return patrolParts;const out=[],white=[.83,.86,.85],blue=[.035,.13,.33];
 const add=(shape,p,s,color,r=[0,0,0],extra={})=>out.push({shape,p,s,r,color,mat:7,surface:'object',policeEquipment:true,...extra});
 const box=(p,s,color=white,r,extra)=>add('bevel',p,s,color,r,extra);
 const lettering=shape('patrol-lettering',()=>{const glyphs={P:['110','101','110','100','100'],O:['111','101','101','101','111'],L:['100','100','100','100','111'],I:['111','010','010','010','111'],C:['111','100','100','100','111'],E:['111','100','110','100','111']},t=[];for(let k=0;k<6;k++)for(let y=0;y<5;y++)for(let x=0;x<3;x++)if(glyphs['POLICE'[k]][y][x]==='1'){const a=[(k*4+x)*.013,(4-y)*.013,0],b=[a[0]+.010,a[1]+.010,.001];for(const z of [0,.001])addQuad(t,[a[0],a[1],z],[b[0],a[1],z],[b[0],b[1],z],[a[0],b[1],z]);}return t;});
 for(const side of [-1,1]){
  // Cases clear the rear tyre, exhaust and the rider's legs; no car doors or roof bar.
  const g=shape('patrol-case-'+side,()=>BITUME.carene.carene([[-1.01,.65,.83,.055],[-.91,.59,.91,.085],[-.60,.59,.92,.085],[-.49,.65,.85,.045]].map(([x,y0,y1,l])=>({x,y0,y1,l,n:4})),{cotes:16,pas:3,vif:40}));
  add(g.shape,[g.p[0],g.p[1],g.p[2]+side*.37],g.s,white);
  box([-.75,.765,side*.457],[.37,.105,.008],blue);
  add(lettering.shape,[-.75,.765,side*.463],lettering.s,white,[0,side<0?PI:0,0],{detail:1});
  box([-.75,.892,side*.37],[.31,.025,.17],black,undefined,{detail:1});
  box([-.75,.804,side*.463],[.085,.021,.012],[.7,.74,.74],undefined,{detail:1});
  box([-.985,.732,side*.37],[.018,.045,.095],[.65,.025,.02],undefined,{mat:6,detail:1});
  box([.73,1.07,side*.34],[.10,.073,.08],black,[0,side*.23,-.18]);
  box([.782,1.075,side*.349],[.012,.044,.061],blue,[0,side*.23,-.18],{policeLight:side});
 }
 box([-.80,.907,0],[.43,.043,.32],black);
 box([-.79,1.025,0],[.43,.205,.32]);
 box([-.79,1.134,0],[.43,.025,.33],black,undefined,{detail:1});
 box([-.99,1.035,0],[.014,.073,.255],blue);
 add('cylinder',[-.91,1.37,.14],[.021,.40,.021],metal,undefined,{mat:0});
 add('cylinder',[-.91,1.559,.14],[.083,.035,.083],black);
 add('cylinder',[-.91,1.603,.14],[.075,.068,.075],blue,undefined,{policeLight:0});
 if(!patrolParts)patrolParts=out;return patrolParts;
}
function render(c,out,opt={}){
 if(!V.SPECS[c.model]?.two)return originalRender(c,out,opt);
 const mod=model(c.model,c.color),M=BITUME.voiture.attitude(c.cap,0,c.roulis||0),pos=[c.x,c.y||.08,c.z],distance=Number.isFinite(opt.distance)?Math.max(0,opt.distance):0,lod=distance>75?2:distance>28?1:0,turn=Number.isFinite(c.braquage)?c.braquage:0,steer=spinMatrix(mod.steering.axis,-turn),origin=mod.steering.pivot;
 function rotated(m,matrix,pivot){const p=BITUME.voiture.mul(matrix,m.p.map((v,k)=>v-pivot[k])).map((v,k)=>v+pivot[k]);return {...m,p,r:BITUME.voiture.angles(BITUME.voiture.mulM(matrix,BITUME.voiture.euler(...(m.r||[0,0,0]))))};}
 let drawingRider=false;
 function put(m){const p=BITUME.voiture.mul(M,m.p),r=BITUME.voiture.angles(BITUME.voiture.mulM(M,BITUME.voiture.euler(...(m.r||[0,0,0]))));out.push({...m,...(drawingRider?{riderPart:true}:{}),p:p.map((x,i)=>x+pos[i]),r});}
 for(const q of mod.pieces){if((q.detail||0)>2-lod)continue;if(lod>0&&q.fx)continue;put(q.group==='steering'?rotated(q,steer,origin):q);}
 if(c.police&&c.model==='policebike'&&!c.exploded)for(const part of policeEquipment()){
  if((part.detail||0)>2-lod)continue;let q=part;
  if(part.policeLight!==undefined){const phase=((opt.time||0)*4+part.policeLight*.5)%1,flash=!!c.siren&&(phase<.15||phase>.24&&phase<.39);q={...part,color:flash?[.16,.42,1]:[.035,.13,.33],mat:5,emissive:flash?2:0};}
  put(q);
 }
 for(const wheel of mod.wheels)for(const part of wheel.levels[lod]){
  let q={...part,p:part.p.slice(),r:part.r||[0,0,0],surface:'object',wheel:wheel.end>0?'front':'rear'};
  if(q.spin)q=rotated(q,BITUME.voiture.euler(0,0,-(c.distance||0)/mod.wr),[0,0,0]);q.p=q.p.map((v,k)=>v+[wheel.x,wheel.y,0][k]);if(wheel.end>0)q=rotated(q,steer,origin);put(q);
 }
 const contacts=mod.contacts(c.distance||0,turn),bar=(a,b,w,color,extra={})=>{const d=b.map((v,k)=>v-a[k]),l=Math.hypot(...d);put({shape:'cylinder',p:a.map((v,k)=>(v+b[k])/2),s:[w,l,w],r:[Math.acos(d[1]/l),Math.atan2(d[0],d[2]),0],color,mat:18,...extra});};
 if(c.model==='bike')for(let i=0;i<2;i++){const pedal=contacts.pedals[i],side=i?1:-1;bar([-.05,.31,side*.10],pedal,.017,metal,{mat:0});put({shape:'bevel',p:pedal,s:[.10,.025,.095],color:black,mat:7,contact:'pedal-'+i});}
 if(opt.rider&&!opt.cockpit){
  drawingRider=true;
  const bike=c.model==='bike',kick=c.model==='scooter',rt=c.model==='policebike',uniform=!!(c.police&&c.driver?.inside&&c.driver.hp>0),hip=contacts.hip,head=contacts.head,cloth=uniform?[.035,.075,.15]:[.075,.11,.15],pants=uniform?[.035,.055,.10]:[.13,.16,.20],shoulder=bike?[-.075,1.45,0]:kick?[-.065,1.46,0]:rt?[-.25,1.29,0]:[-.225,1.23,0],body=hip.map((v,k)=>(v+shoulder[k])/2);
  put({shape:'sphere',p:[hip[0],hip[1],0],s:[.25,.19,.34],color:pants,mat:18,actorZone:'torso'});put({shape:'sphere',p:body,s:[.29,shoulder[1]-hip[1]+.12,.41],r:[0,0,bike?-.40:kick?-.05:-.18],color:cloth,mat:18,actorZone:'torso'});
  bar([shoulder[0],shoulder[1]-.015,0],[head[0],head[1]-.12,0],.105,[.49,.33,.24]);
  put({shape:'sphere',p:head,s:[.255,.29,.25],color:uniform?[.85,.88,.88]:black,mat:7,policeUniform:uniform,actorZone:'head'});
  if(uniform){
   put({shape:'sphere',p:[head[0],head[1]-.107,0],s:[.22,.055,.23],color:black,mat:7});
   put({shape:'sphere',p:[shoulder[0],shoulder[1]-.035,0],s:[.285,.13,.425],color:[.72,.76,.78],r:[0,0,-.18],mat:18,policeUniform:true});
   if(lod<2){
    for(const side of [-1,1])put({shape:'bevel',p:[shoulder[0]+.07,shoulder[1]-.01,side*.157],s:[.08,.042,.08],r:[0,0,-.18],color:[.025,.09,.22],mat:18,policeUniform:true});
    put({shape:'bevel',p:[shoulder[0]+.15,shoulder[1]-.095,-.12],s:[.038,.09,.055],color:black,mat:7});
   }
  }
  for(let j=0;j<(lod===2?1:5);j++){const a=lod===2?0:(j-2)*.22;put({shape:'bevel',p:[head[0]+.121*Math.cos(a),head[1]+.005,.12*Math.sin(a)],s:[.016,.075,lod===2?.17:.054],r:[0,-a,0],color:[.14,.25,.28],mat:19});}
  for(let i=0;i<2;i++){const side=i?1:-1,hand=contacts.hands[i],foot=contacts.feet[i],sh=[shoulder[0],shoulder[1],side*.19],elbow=bike?[.12,1.24,side*.23]:kick?[.15,1.25,side*.20]:rt?[-.09,1.075,side*.26]:[.035,1.075,side*.24],pelvis=[hip[0],hip[1]-.02,side*.13],knee=bike?[.11,.70+Math.cos((c.distance||0)*2.7+(i?PI:0))*.08,side*.145]:kick?[-.095,.64,side*.075]:rt?[.04,.64,side*.245]:[.035,.61,side*.225];
   const arm=rt?joint(sh,hand,.29,.27,elbow):elbow,leg=rt?joint(pelvis,foot,.42,.40,knee):knee;
   bar(sh,arm,.105,cloth,{actorZone:'arm'});bar(arm,hand,.085,cloth,{actorZone:'arm'});bar(pelvis,leg,.14,pants,{actorZone:'leg'});bar(leg,foot,.105,pants,{actorZone:'leg'});
   if(rt&&lod<2)for(const [p,s,color] of [[sh,[.115,.13,.12],cloth],[arm,[.105,.11,.105],cloth],[leg,[.14,.15,.14],pants]])put({shape:'sphere',p,s,color,mat:18});
   if(lod<2)put({shape:'sphere',p:hand,s:[.077,.061,.075],color:black,mat:7,contact:'hand-'+i});
   put({shape:'bevel',p:foot,s:[.24,.095,.105],color:black,mat:7,contact:'foot-'+i});
  }
 }
 return mod;
}
function step(c,cmd,world,dt){
 const spec=V.SPECS[c.model];if(world.weather?.gust>.65&&c.v>3)c.w+=Math.sin(c.cap-.4)*world.weather.gust*.18*dt;if(!spec.two)return BITUME.conduite.pas(c,cmd,world,dt);
 const gaz=c.moteur?cmd.gaz||0:0,reverse=!!cmd.marcheArriere,old=c.u;
 c.gaz=gaz;c.arriere=reverse;c.volant+=((cmd.volant||0)-c.volant)*(1-Math.exp(-dt/.12));
 const thrust=spec.acc*gaz*(reverse?-.6:1)*Math.max(0,1-Math.abs(c.u)/(reverse?2:spec.top)),drag=.10+c.u*c.u*.0015,brake=Math.max(cmd.frein||0,cmd.handbrake||0)*6*(1-.22*(world.weather?.wet||0));
 c.u+= (thrust-Math.sign(c.u)*(drag+brake))*dt;if(old*c.u<0&&!gaz)c.u=0;
 c.braquage=c.volant*Math.min(.5,2.5/Math.max(1,Math.abs(c.u)));c.omega=c.u*Math.tan(c.braquage)/spec.wheelbase;
 const next=c.cap+c.omega*dt,hit=world.moveVehicle(c,Math.cos(next)*c.u*dt,Math.sin(next)*c.u*dt,next);if(hit)c.u=0;
 c.v=Math.abs(c.u);c.w=0;c.distance+=c.v*dt;c.y=world.ground(c.x,c.z);c.roulis+=(-Math.atan(c.omega*c.u/9.81)*.65-c.roulis)*(1-Math.exp(-dt/.18));c.regime=c.moteur?1800+gaz*4500:0;c.rapport=1;
 return hit?[{type:'choc',force:Math.abs(old)}]:[];
}
V.model=model;V.render=render;V.step=step;
for(const type of ['tmax','scooter','bike','policebike'])model(type);
policeEquipment(); // Register custom patrol shapes before FERRO compiles its geometry atlas.
})(globalThis.RADE);
