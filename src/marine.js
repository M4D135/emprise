/* EMPRISE — original procedural hulls and surface navigation; no imported assets. */
(function(R){'use strict';
const PI=Math.PI,SEA=-1.25,SWIM=SEA-1.16,clamp=(v,a,b)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:0)),wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const kinds={motorboat:{name:'Canot à moteur',length:6.4,width:2.3,top:12,accel:4.3,turn:.85,eye:1.35},sailboat:{name:'Voilier',length:7.6,width:2.5,top:6.5,accel:1.4,turn:.5,eye:1.3},jetski:{name:'Jet-ski',length:3.1,width:1.18,top:16,accel:6.8,turn:1.5,eye:1.1}};
const models={},SAIL_LIMIT=1.35,LAUNCH_RUN=24,stations=[{id:'helm',label:'Gouvernail',position:[-.7,0,0]},{id:'trim',label:'Manivelle · orientation de voile',position:[-1.55,0,-.30]},{id:'hoist',label:'Manivelle · déploiement de voile',position:[-1.55,0,.30]}];
// Pre-register every cloth variant before the FERRO geometry atlas is built.
// No bitmap, animation clip or external mesh is used.
function sailShapes(){const result={main:[],jib:[]};for(const type of ['main','jib'])for(let level=0;level<5;level++){result[type][level]=[];for(const side of [-1,1]){
 const tris=[],N=12,full=.015+level*.12,main=type==='main';
 const point=(u,v)=>main?[.5-3.1*u*(1-v),1.7+5.5*v,side*full*Math.sin(Math.PI*u)*Math.sin(Math.PI*v)]:[.58+3.0*u*(1-v),1.65+5.05*v-.9*u*(1-v),side*full*.7*Math.sin(Math.PI*u)*Math.sin(Math.PI*v)];
 const tri=(a,b,c)=>{const u=b.map((n,i)=>n-a[i]),v=c.map((n,i)=>n-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n);if(l<1e-8)return;const normal=n.map(x=>x/l),back=normal.map(x=>-x);tris.push([a,b,c,normal,normal,normal],[c,b,a,back,back,back]);};
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){const a=point(i/N,j/N),b=point((i+1)/N,j/N),c=point((i+1)/N,(j+1)/N),d=point(i/N,(j+1)/N);tri(a,b,c);tri(a,c,d);}
 const q=BITUME.carene.normaliser(tris),shape='emprise-cloth-'+type+'-'+level+'-'+(side<0?'port':'starboard');FRender.forme(shape,q.triangles);result[type][level].push({shape,p:q.centre,s:q.taille,color:[.91,.87,.73],mat:18,r:[0,0,0],sail:true,sailType:type});
 }}return result;}
const sails=sailShapes();
function windDirection(weather={}){return Number.isFinite(weather.windDirection)?weather.windDirection:Math.atan2(.0018,.006);}
// Shared with the procedural sea patch: world coordinates, seconds, wind TO.
// The old constant -.04 placed the hull 1.21 m above Marseille's actual water.
function seaHeight(x,z,t,wind=.28,direction=Math.atan2(.0018,.006)){
 const c=Math.cos(direction),s=Math.sin(direction),u=x*c+z*s,v=-x*s+z*c,A=.035+.10*clamp(wind,0,2);
 return SEA+A*(.60*Math.sin(.24*u-1.10*t)+.27*Math.sin(.41*u+.17*v-1.55*t+1.7)+.13*Math.sin(.63*v-.83*t+.4));
}
function damp(q,key,rate,target,omega,dt){const error=q[key]-target,j=q[rate]+omega*error,e=Math.exp(-omega*dt);q[key]=target+(error+j*dt)*e;q[rate]=(q[rate]-omega*j*dt)*e;}
function sailDrive(q,weather={}){
 const strength=clamp(weather.wind??.28,0,2),direction=windDirection(weather),speed=strength*9,wx=Math.cos(direction)*speed,wz=Math.sin(direction)*speed,ax=wx-Math.cos(q.cap)*q.speed,az=wz-Math.sin(q.cap)*q.speed;
 const apparent=Math.hypot(ax,az),windFrom=wrap(direction+PI),from=wrap(Math.atan2(az,ax)+PI),relative=wrap(from-q.cap),a=Math.abs(relative),polar=clamp((a-.58)/.65,0,1)*(1-.18*clamp((a-2.3)/.84,0,1));
 const ideal=Math.sign(relative||1)*clamp((a-.35)*.6,.08,SAIL_LIMIT),trim=Math.max(0,Math.cos(wrap(q.sailAngle-ideal)*1.25));
 // Either tack works on a dead run. Blend the opposite trim only near the
 // stern, so crossing +/-pi cannot suddenly empty a correctly set sail.
 const stern=clamp((a-2.65)/(PI-2.65),0,1),other=Math.max(0,Math.cos(wrap(q.sailAngle+ideal)*1.25)),opposite=other*other*stern*stern*(3-2*stern),catching=polar*Math.max(trim*trim,opposite),idealAngle=opposite>trim*trim?-ideal:ideal,trimError=wrap(q.sailAngle-idealAngle);
 const deployment=clamp(q.sailDeployment,0,1),force=strength>.005?clamp(apparent*apparent*.038*catching*deployment,0,3.0):0,load=deployment>.01&&strength>.005?catching*clamp(apparent/2.3,0,1)*clamp(speed/.45,0,1):0;
 return {windFrom,windSpeed:speed,apparentFrom:from,relativeWind:relative,apparentSpeed:apparent,idealAngle,trimError,catch:catching,force,load,luffing:load<.12};
}
function model(kind){const k=kinds[kind],parts=[],white=[.81,.84,.82],dark=[.035,.07,.11],wood=[.44,.29,.14],metal=[.48,.55,.58],color=kind==='jetski'?[.78,.18,.07]:white;
 const put=(shape,p,s,c=white,mat=7,r=[0,0,0],extra={})=>parts.push({shape,p,s,color:c,mat,r,...extra});
 const bar=(a,b,width=.035,c=metal)=>{const d=b.map((v,i)=>v-a[i]),len=Math.hypot(...d);put('cylinder',a.map((v,i)=>(v+b[i])/2),[width,len,width],c,0,[Math.acos(d[1]/len),Math.atan2(d[0],d[2]),0]);};
 const L=k.length/2,W=k.width/2,sections=[[-L,.55,.12],[-L*.75,1,.12],[0,1,0],[L*.65,.7,.12],[L,.025,.38]].map(([x,f,h])=>({x,y0:-.38+h,y1:.48+h,l:W*f,n:3}));
 const norm=BITUME.carene.normaliser(BITUME.carene.carene(sections,{cotes:24,pas:4})),shape='emprise-hull-'+kind;FRender.forme(shape,norm.triangles);put(shape,norm.centre,norm.taille,color,17);
 put('bevel',[-.4,.47,0],[k.length*.55,.12,k.width*.78],kind==='jetski'?dark:wood,18);
 if(kind==='jetski'){put('bevel',[-.4,.63,0],[1.5,.26,.46],dark,18);put('bevel',[.5,.64,0],[.7,.25,.6],dark);bar([.3,.7,0],[.5,1.01,0],.08);bar([.5,1.01,-.35],[.5,1.01,.35],.055,dark);}
 else{
  for(const z of [-.67,.67]){put('bevel',[-1.6,.64,z],[1.4,.28,.39],white,18);put('bevel',[-1.6,.84,z*1.22],[1.4,.36,.12],white,18);}
  put('bevel',[.45,.75,0],[.65,.60,.90],white,17);put('box',[.45,1.08,0],[.55,.05,.82],dark);put('ring',[.09,1.02,-.17],[.30,.025,.30],dark,7,[0,0,PI/2]);put('cylinder',[.09,1.02,-.17],[.07,.045,.07],metal,0,[0,0,PI/2]);for(let a=0;a<PI*2;a+=PI*2/3)bar([.09,1.02,-.17],[.09,1.02+Math.cos(a)*.13,-.17+Math.sin(a)*.13],.017,metal);put('box',[.20,1.13,.19],[.18,.05,.22],[.05,.20,.24],8);
  for(const z of [-W*.9,W*.9])for(let i=0;i<6;i++){const a=-L*.85+i*L*.31,b=a+L*.31;bar([a,.55,z],[a,1.02,z],.023);bar([a,1.02,z],[b,1.02,z],.025);}
  if(kind==='motorboat'){put('box',[.82,1.18,0],[.05,.50,1.12],[.26,.46,.5],8,[0,0,-.28],{fx:true,alpha:.36});put('bevel',[-L-.1,.28,0],[.44,.8,.46],dark);bar([-L-.1,.1,0],[-L-.1,-.6,0],.12,dark);}
 }
 if(kind==='sailboat'){
  bar([.5,.4,0],[.5,7.6,0],.10);bar([.5,7.5,0],[L-.1,.65,0],.014);bar([.5,7.5,0],[-L+.1,.65,0],.014);for(const z of [-W,W])bar([.5,6,0],[.3,.5,z],.012);
  put('box',[0,-.65,0],[1.4,1.1,.11],dark);
  for(const [id,z]of [['trim',-.78],['hoist',.78]]){put('bevel',[-1.15,.65,z],[.42,.24,.35],white,17);put('cylinder',[-1.15,.86,z],[.20,.22,.20],metal,0);put('cylinder',[-1.15,.98,z],[.24,.035,.24],dark,0);}
  put('bevel',[-L-.08,.30,.58],[.34,.52,.35],dark);bar([-L-.08,.12,.58],[-L-.08,-.52,.58],.085,dark);
  // Mast-head vane shaft; the arrow is oriented in geometry() from the current wind.
  bar([.5,7.6,0],[.5,7.93,0],.025);

 }
 return parts;
}
for(const kind of Object.keys(kinds))models[kind]=model(kind);
function create(world,{saved=null,notify=()=>{}}={}){
 let mode='foot',boat=null,time=0,vx=0,vz=0,wakeClock=0,lastPlayer=null,boundaryWarning=0;const lastWeather={wind:.28,direction:windDirection()};const boats=[],ladders=[],wakes=[],B=world.navigationBounds||world.bounds;
 const inBounds=(x,z,r=0)=>x-r>B.minX+5&&x+r<B.maxX-5&&z-r>B.minZ+5&&z+r<B.maxZ-5;
 function obstacle(x,z,r=.25){for(const q of world.candidates?.(x,z,r)||[]){if(q.maxY<SEA+.20||q.minY>SEA+1.4)continue;const dx=x-q.x,dz=z-q.z,u=dx*q.c+dz*q.s,v=-dx*q.s+dz*q.c;if((u-clamp(u,-q.a,q.a))**2+(v-clamp(v,-q.b,q.b))**2<r*r)return true;}return false;}
 function water(x,z,r=.25){return inBounds(x,z,r)&&world.water(x,z)&&!obstacle(x,z,r);}
 function boatBox(x,z,cap,k){return {x,z,a:k.length/2+.06,b:k.width/2+.06,c:Math.cos(cap),s:Math.sin(cap)};}
 function overlap(a,b){
  const bc=Number.isFinite(b.c)?b.c:Math.cos(b.cap||0),bs=Number.isFinite(b.s)?b.s:Math.sin(b.cap||0);
  for(const [x,z]of [[a.c,a.s],[-a.s,a.c],[bc,bs],[-bs,bc]]){
   const ra=a.a*Math.abs(x*a.c+z*a.s)+a.b*Math.abs(-x*a.s+z*a.c),rb=b.a*Math.abs(x*bc+z*bs)+b.b*Math.abs(-x*bs+z*bc);
   if(Math.abs((a.x-b.x)*x+(a.z-b.z)*z)>=ra+rb)return false;
  }return true;
 }
 function hullClear(x,z,cap,k){
  if(!k||![x,z,cap,k.length,k.width].every(Number.isFinite)||k.length<=0||k.width<=0)return false;
  const box=boatBox(x,z,cap,k),radius=Math.hypot(box.a,box.b);
  // Full oriented footprints catch piles, narrow piers and obstacles between sample points.
  for(const q of [...(world.candidates?.(x,z,radius)||[]),...(world.dynamicBodies||[])])if(q.maxY>=SEA-.4&&q.minY<=SEA+1.4&&overlap(box,q))return false;
  // Sample the filled footprint, not only six points on its boundary; no narrow strip of land can sit in the cabin.
  const nx=Math.ceil(k.length/.55),nz=Math.ceil(k.width/.55);
  for(let i=0;i<=nx;i++)for(let j=0;j<=nz;j++){const a=-k.length/2+k.length*i/nx,b=-k.width/2+k.width*j/nz,px=x+a*box.c-b*box.s,pz=z+a*box.s+b*box.c;if(!inBounds(px,pz,.2)||!world.water(px,pz))return false;}
  return true;
 }
 function hull(x,z,cap,k,ignore=null){if(!hullClear(x,z,cap,k))return false;const box=boatBox(x,z,cap,k);return boats.every(q=>q===ignore||!overlap(box,boatBox(q.x,q.z,q.cap,kinds[q.kind])));}
 const launchBox=(x,z,cap,k)=>boatBox(x+Math.cos(cap)*LAUNCH_RUN/2,z+Math.sin(cap)*LAUNCH_RUN/2,cap,{...k,length:k.length+LAUNCH_RUN});
 function launchClear(x,z,cap,k){
  const sweep=launchBox(x,z,cap,k),box=boatBox(x,z,cap,k);
  if(!hullClear(sweep.x,sweep.z,cap,{...k,length:k.length+LAUNCH_RUN}))return false;
  // A hull fitting at rest is insufficient: the old sailboat spawned directly
  // behind the canot and struck it after 2.93 m. Reserve every departure lane.
  return boats.every(q=>!overlap(sweep,boatBox(q.x,q.z,q.cap,kinds[q.kind]))&&!overlap(box,launchBox(q.x,q.z,q.cap,kinds[q.kind])));
 }
 function clearPassage(x,z,tx,tz){
  const dx=tx-x,dz=tz-z,d=Math.hypot(dx,dz);if(!Number.isFinite(d))return false;if(d<.02)return true;
  const ux=dx/d,uz=dz/d;
  const level=world.water(x,z)&&world.water(tx,tz)?SEA:Math.max(SEA,world.ground?.(world.water(x,z)?tx:x,world.water(x,z)?tz:z)||0);
  for(const side of [-.22,0,.22]){const sx=x-uz*side,sz=z+ux*side;
   if(world.ray){if(world.ray([sx,level+.9,sz],[ux,0,uz],d)<d-.03)return false;}
   else for(let t=0;t<=d;t+=.2){for(const q of world.candidates?.(sx+ux*t,sz+uz*t,.2)||[])if(q.minY<level+1.3&&q.maxY>level+.55&&overlap({x:sx+ux*t,z:sz+uz*t,a:.12,b:.12,c:1,s:0},q))return false;}
  }return true;
 }
 const validLadder=l=>water(l.x,l.z,.35)&&!world.water(l.landX,l.landZ)&&!world.blocked(l.landX,l.landZ,.4)&&clearPassage(l.x,l.z,l.landX,l.landZ);
 const spawn=world.combatWorld?.spawn||{x:0,z:0};
 for(const [i,kind]of Object.keys(kinds).entries()){const k=kinds[kind],cap=kind==='sailboat'?PI/2:PI;let best=null,dist=Infinity;for(let z=spawn.z-90;z<=spawn.z+90;z+=4)for(let x=spawn.x-90;x<=spawn.x+90;x+=4){const d=Math.hypot(x-spawn.x,z-spawn.z);if(d<dist&&launchClear(x,z,cap,k)){best={x,z};dist=d;}}if(best)boats.push({id:'boat-'+i,kind,...best,cap,speed:0,y:SEA,roll:0,pitch:0,yRate:0,rollRate:0,pitchRate:0,lookX:0,lookY:0,sailTrim:.7,sailDeployment:.7,sailAngle:.7,control:'helm',rudder:0,trimTurns:0,hoistTurns:0,catch:0,load:0,force:0,windSpeed:0,apparentSpeed:0,trimError:0,idealAngle:0,luffing:true,blocked:false,windFrom:Math.atan2(.0018,.006)+PI,relativeWind:0,engineOn:kind!=='sailboat',throttle:0,engineRpm:0});}
 // A ladder exists only when both endpoints and the intervening clearance were checked.
 for(let z=Math.max(B.minZ+10,spawn.z-220);z<Math.min(B.maxZ-10,spawn.z+220);z+=6)for(let x=Math.max(B.minX+10,spawn.x-220);x<Math.min(B.maxX-10,spawn.x+220);x+=6){
  if(!water(x,z)||ladders.some(l=>Math.hypot(l.x-x,l.z-z)<38))continue;let found=false;
  for(let a=0;a<16&&!found;a++){const co=Math.cos(a*PI/8),si=Math.sin(a*PI/8);
   for(let d=1;d<=6&&!found;d+=.4){const lx=x+co*d,lz=z+si*d;if(world.water(lx,lz)||world.blocked(lx,lz,.4))continue;
    for(let wd=Math.max(0,d-.6);wd>=0;wd-=.25){const l={id:'ladder-'+ladders.length,x:x+co*wd,z:z+si*wd,landX:lx,landZ:lz,cap:Math.atan2(si,co)};
     if(validLadder(l)){ladders.push(l);found=true;break;}
    }
   }
  }
 }
 function sync(p){if(mode==='boat'&&boat){const seat=boat.kind==='sailboat'?(stations.find(s=>s.id===boat.control)||stations[0]).position:stations[0].position,v=BITUME.voiture.mul(BITUME.voiture.attitude(boat.cap,boat.pitch,boat.roll),seat);p.x=boat.x+v[0];p.z=boat.z+v[2];p.y=boat.y+v[1];p.yaw=boat.cap+PI/2+boat.lookX;p.pitch=boat.lookY;}else if(mode==='swim')p.y=SWIM+seaHeight(p.x,p.z,time,lastWeather.wind,lastWeather.direction)-SEA;}
 function enterWater(p){if(!water(p.x,p.z))return false;lastPlayer=p;mode='swim';boat=null;vx=vz=0;p.y=SWIM;notify('Nage · rejoignez une échelle pour remonter sur le quai.');return true;}
 function shore(p){
  // Low natural banks can be climbed anywhere, including remote islands. High
  // quay walls still require an actual ladder; solid walls are never bypassed.
  if(mode!=='swim')return null;let best=null;
  for(let i=0;i<16;i++){const angle=i*PI/8,co=Math.cos(angle),si=Math.sin(angle);if(world.water(p.x+co*2.2,p.z+si*2.2))continue;
   for(let d=.45;d<=2.2;d+=.2){const x=p.x+co*d,z=p.z+si*d,y=world.ground(x,z);if(!inBounds(x,z,.35)||world.water(x,z)||!Number.isFinite(y)||y>SEA+.72||y<SEA-.1||world.blocked(x,z,.35,y,1.8)||!clearPassage(p.x,p.z,x,z))continue;
    if(!best||d<best.distance)best={kind:'marine',shore:{x,z,y},label:'E · Rejoindre la rive',distance:d};break;
   }
  }return best;
 }
 function context(p){if(mode==='boat')return {kind:'marine',label:'E · Descendre dans l’eau',distance:0,control:boat.control,controls:boat.kind==='sailboat'?stations:[]};const opts=[];for(const q of boats){const d=Math.hypot(p.x-q.x,p.z-q.z),reach=kinds[q.kind].length/2+.7;if(d<reach&&Math.abs(q.speed)<1.3&&clearPassage(p.x,p.z,q.x-.7*Math.cos(q.cap),q.z-.7*Math.sin(q.cap)))opts.push({kind:'marine',boat:q,label:'E · Monter · '+kinds[q.kind].name,distance:d});}
  for(const l of ladders){const d=Math.hypot(p.x-(mode==='swim'?l.x:l.landX),p.z-(mode==='swim'?l.z:l.landZ));if(d<2&&validLadder(l))opts.push({kind:'marine',ladder:l,label:mode==='swim'?'E · Monter à l’échelle':'E · Descendre dans l’eau',distance:d});}const bank=shore(p);if(bank)opts.push(bank);return opts.sort((a,b)=>a.distance-b.distance)[0]||null;
 }
 function interact(p){lastPlayer=p;if(mode==='boat'){if(Math.abs(boat.speed)>1.3){notify('Ralentissez avant de descendre.');return false;}const k=kinds[boat.kind];for(const side of [-1,1]){const x=boat.x-Math.sin(boat.cap)*side*(k.width/2+.65),z=boat.z+Math.cos(boat.cap)*side*(k.width/2+.65);if(water(x,z)){boat.speed=0;Object.assign(p,{x,z});return enterWater(p);}}notify('Aucune sortie sûre sur le côté.');return false;}
  const c=context(p);if(!c)return false;if(c.shore){mode='foot';vx=vz=0;Object.assign(p,c.shore,{pitch:0});notify('Sur la rive.');return true;}if(c.boat){boat=c.boat;mode='boat';boat.speed=0;boat.lookX=boat.lookY=0;boat.control='helm';sync(p);notify(kinds[boat.kind].name+(boat.kind==='sailboat'?' · gouvernail, orientation et déploiement de voile':' · avancer / braquer'));return true;}const l=c.ladder;if(!validLadder(l))return false;if(mode==='swim'){mode='foot';Object.assign(p,{x:l.landX,z:l.landZ,y:world.ground(l.landX,l.landZ),pitch:0});notify('Sur le quai.');return true;}Object.assign(p,{x:l.x,z:l.z});return enterWater(p);
 }
 function update(dt,input={},p,weather={}){lastPlayer=p;dt=clamp(dt,0,.05);time+=dt;lastWeather.wind=clamp(weather.wind??.28,0,2);lastWeather.direction=windDirection(weather);boundaryWarning=Math.max(0,boundaryWarning-dt);
  if(mode==='swim'){p.yaw+=clamp(input.lookX,-.5,.5);p.pitch=clamp(p.pitch+clamp(input.lookY,-.5,.5),-1.2,1.2);const mx=clamp(input.moveX,-1,1),my=clamp(input.moveY,-1,1),n=Math.max(1,Math.hypot(mx,my)),v=input.sprint?2.6:1.7,e=1-Math.exp(-dt*5);vx+=((Math.cos(p.yaw)*mx+Math.sin(p.yaw)*my)/n*v-vx)*e;vz+=((Math.sin(p.yaw)*mx-Math.cos(p.yaw)*my)/n*v-vz)*e;if(water(p.x+vx*dt,p.z))p.x+=vx*dt;else vx=0;if(water(p.x,p.z+vz*dt))p.z+=vz*dt;else vz=0;}
  for(const q of boats){const k=kinds[q.kind],active=q===boat&&mode==='boat',wind=clamp(weather.wind??.28,0,2);
   if(active){q.lookX=clamp(q.lookX+clamp(input.lookX,-.5,.5),-2.5,2.5);q.lookY=clamp(q.lookY+clamp(input.lookY,-.5,.5),-.8,.8);if(input.engine)q.engineOn=!q.engineOn;if(typeof input.sailControl==='string')setControl(input.sailControl);
    const gas=clamp(input.forward,0,1),back=clamp(input.back,0,1);q.throttle=!input.brake&&q.engineOn&&(q.kind!=='sailboat'||q.control==='helm')?gas-back:0;
    if(q.kind==='sailboat'){
     const trim=clamp(input.sailAngle??(q.control==='trim'?input.steer:0),-1,1),hoist=clamp(input.sailHoist??(q.control==='hoist'?gas-back:0),-1,1);
     const oldAngle=q.sailAngle,oldDeployment=q.sailDeployment;q.sailAngle=clamp(q.sailAngle+trim*dt*.42,-SAIL_LIMIT,SAIL_LIMIT);q.sailDeployment=clamp(q.sailDeployment+hoist*dt*.22,0,1);q.sailTrim=q.sailDeployment;q.trimTurns+=(q.sailAngle-oldAngle)*5;q.hoistTurns+=(q.sailDeployment-oldDeployment)*24;
     if(q.control==='helm')q.rudder=clamp(input.steer,-1,1); // At a crank the wheel holds its position.
     const windState=sailDrive(q,weather);Object.assign(q,windState);const motor=q.engineOn?q.throttle*.85:0,drag=.10*q.speed+.052*q.speed*Math.abs(q.speed),force=windState.force+motor-drag;
     q.speed=clamp(q.speed+force*dt,-1.6,k.top);if(Math.abs(q.speed)<.002&&windState.force===0&&!motor)q.speed=0;
     // Brake requests furl the sail and take the auxiliary throttle to neutral;
     // water resistance, not an invisible road brake, removes the remaining way.
     if(input.brake){q.sailDeployment=Math.max(0,q.sailDeployment-dt*.65);q.sailTrim=q.sailDeployment;q.throttle=0;q.speed*=Math.exp(-dt*.22);}
    }else{const target=q.engineOn?(gas*k.top-back*2.8):0,accel=input.brake?8:k.accel;q.speed+=clamp((input.brake?0:target)-q.speed,-accel*dt,accel*dt);q.rudder=clamp(input.steer,-1,1);}
    const turn=q.rudder*k.turn*clamp(q.speed/3,-1,1)*dt,newCap=q.cap+turn,dx=Math.cos(newCap)*q.speed*dt,dz=Math.sin(newCap)*q.speed*dt;
    if(hull(q.x+dx,q.z+dz,newCap,k,q)){q.x+=dx;q.z+=dz;q.cap=wrap(newCap);q.blocked=false;}else{q.blocked=true;q.speed*=Math.exp(-dt*15);if(!inBounds(q.x+dx,q.z+dz,Math.hypot(k.length,k.width)/2)&&boundaryWarning<=0){notify('Limite de navigation · restez à l’intérieur du balisage.');boundaryWarning=8;}}
   }else{q.speed*=Math.exp(-dt*2);q.throttle=0;q.blocked=false;if(q.kind==='sailboat')Object.assign(q,sailDrive(q,weather));}
   q.engineRpm=q.engineOn?750+Math.abs(q.throttle)*(q.kind==='jetski'?6700:q.kind==='sailboat'?2400:4300):0;
   const co=Math.cos(q.cap),si=Math.sin(q.cap),halfL=k.length*.38,halfW=k.width*.40,direction=windDirection(weather),height=(a,b)=>seaHeight(q.x+a*co-b*si,q.z+a*si+b*co,time,wind,direction),bow=height(halfL,0),stern=height(-halfL,0),port=height(0,-halfW),starboard=height(0,halfW),center=height(0,0),ratio=clamp(Math.abs(q.speed)/k.top,0,1);
   const wavePitch=Math.atan2(bow-stern,halfL*2),waveRoll=Math.atan2(port-starboard,halfW*2),heel=q.kind==='sailboat'?-Math.sin(q.relativeWind)*q.load*q.sailDeployment*.18:0,turnHeel=-q.rudder*ratio*(q.kind==='jetski'?.10:.035),lift=ratio*ratio*(q.kind==='jetski'?.09:q.kind==='motorboat'?.05:.008),response=q.kind==='sailboat'?3.5:q.kind==='motorboat'?4.6:6.2;
   // Five samples over each hull give shared wave phase, unlike independent
   // decorative sines. Critically damped heave/pitch/roll keep weight and inertia.
   damp(q,'y','yRate',(bow+stern+port+starboard+center*2)/6+(q.kind==='jetski'?.09:0),response*1.5,dt);
   damp(q,'pitch','pitchRate',clamp(wavePitch+lift,-.22,.22),response,dt);
   damp(q,'roll','rollRate',clamp(waveRoll+heel+turnHeel,-.32,.32),response*.85,dt);
  }
  wakeClock+=dt;if(wakeClock>.15){wakeClock=0;for(const q of boats)if(Math.abs(q.speed)>1)wakes.push({x:q.x-Math.cos(q.cap)*kinds[q.kind].length/2,z:q.z-Math.sin(q.cap)*kinds[q.kind].length/2,cap:q.cap,age:0});while(wakes.length>30)wakes.shift();}for(let i=wakes.length-1;i>=0;i--){wakes[i].age+=dt;if(wakes[i].age>3)wakes.splice(i,1);}sync(p);
 }
 function geometry(){const out=[];for(const q of boats){const M=BITUME.voiture.attitude(q.cap,q.pitch,q.roll),rot=BITUME.voiture.angles(M),parts=models[q.kind].slice();
   if(q.kind==='sailboat'){
    const angle=q.sailAngle||0,around=(p,a=angle)=>{const c=Math.cos(a),s=Math.sin(a),dx=p[0]-.5;return [.5+dx*c-p[2]*s,p[1],dx*s+p[2]*c];};
    const boomA=[.5,1.6,0],boomB=around([-2.6,1.6,0]);parts.push({shape:'cylinder',p:boomA.map((v,i)=>(v+boomB[i])/2),s:[.07,3.1,.07],r:[PI/2,-PI/2-angle,0],mat:0,color:[.48,.55,.58]});
    if(q.sailDeployment>.01){for(const type of ['main','jib']){const level=Math.min(4,Math.round((q.load||0)*4)),a=type==='main'?angle:angle*.6,side=Math.sin(a-q.relativeWind)<0?0:1,m=sails[type][level][side],p=[m.p[0],1.7+(m.p[1]-1.7)*q.sailDeployment,m.p[2]];parts.push({...m,p:around(p,a),s:[m.s[0],m.s[1]*q.sailDeployment,m.s[2]],r:[0,-a,0],sailCatch:q.load});}}
    else parts.push({shape:'bevel',p:around([-1.05,1.72,0]),s:[3.0,.14,.19],r:[0,-angle,0],mat:18,color:[.87,.83,.70],sailFurled:true});
    for(const [name,z,turns]of [['trim',-.78,q.trimTurns||0],['hoist',.78,q.hoistTurns||0]]){const cx=-1.15,cy=1.02;parts.push({shape:'box',p:[cx+Math.cos(turns)*.10,cy,z+Math.sin(turns)*.10],s:[.23,.035,.04],r:[0,-turns,0],mat:0,color:[.48,.55,.58],control:name},{shape:'cylinder',p:[cx+Math.cos(turns)*.21,cy+.055,z+Math.sin(turns)*.21],s:[.055,.13,.055],r:[0,0,0],mat:7,color:[.04,.06,.08],control:name});}
    const vane=wrap((q.windFrom||0)-q.cap);parts.push({shape:'box',p:[.5,7.94,0],s:[.58,.025,.025],r:[0,-vane,0],mat:0,color:[.8,.24,.07],windVane:true},{shape:'bevel',p:[.5+Math.cos(vane)*.23,7.94,Math.sin(vane)*.23],s:[.15,.045,.11],r:[0,-vane,0],mat:7,color:[.9,.26,.06],windVane:true});
   }
   for(const local of parts){const v=BITUME.voiture.mul(M,local.p),r=local.r?.some(Boolean)?BITUME.voiture.angles(BITUME.voiture.mulM(M,BITUME.voiture.euler(...local.r))):rot;out.push({...local,p:[q.x+v[0],q.y+v[1],q.z+v[2]],r});}
  }
  for(const buoy of world.marineBuoys||[]){if(!Number.isFinite(buoy.x)||!Number.isFinite(buoy.z)||lastPlayer&&Math.hypot(buoy.x-lastPlayer.x,buoy.z-lastPlayer.z)>2200)continue;const y=seaHeight(buoy.x,buoy.z,time,lastWeather.wind,lastWeather.direction);out.push({shape:'sphere',p:[buoy.x,y+.28,buoy.z],s:[1.05,.70,1.05],mat:7,color:[.90,.54,.04],boundaryBuoy:true},{shape:'cylinder',p:[buoy.x,y+1.05,buoy.z],s:[.14,1.15,.14],mat:7,color:[.84,.49,.04],boundaryBuoy:true},{shape:'sphere',p:[buoy.x,y+1.65,buoy.z],s:[.19,.19,.19],mat:5,color:[1,.64,.12],emissive:Math.sin(time*1.5)>0?1.5:0,boundaryBuoy:true});}
  for(const l of ladders){const c=Math.cos(l.cap),s=Math.sin(l.cap),at=(u,y)=>[l.x-u*s,y,l.z+u*c],ground=world.ground(l.landX,l.landZ),bottom=SEA-.9,top=ground+.95;for(const a of [-.32,.32])out.push({shape:'cylinder',p:at(a,(bottom+top)/2),s:[.055,top-bottom,.055],mat:0,color:[.56,.62,.63]});for(let y=bottom;y<top-.12;y+=.3)out.push({shape:'box',p:at(0,y),s:[.72,.06,.06],r:[0,-l.cap-PI/2,0],mat:0,color:[.56,.62,.63]});out.push({shape:'sphere',p:[l.landX,ground+.02,l.landZ],s:[.7,.05,.7],color:[.85,.5,.12],mat:7});}
  for(const w of wakes)out.push({shape:'box',p:[w.x,seaHeight(w.x,w.z,time,lastWeather.wind,lastWeather.direction)+.025,w.z],s:[.6+w.age,.012,1+w.age*1.5],r:[0,-w.cap,0],fx:true,alpha:.23*(1-w.age/3),mat:7,color:[.72,.85,.88]});return out;
 }
 function camera(p=lastPlayer){if(mode==='swim')return {pos:[p.x,seaHeight(p.x,p.z,time,lastWeather.wind,lastWeather.direction)+.39,p.z],yaw:p.yaw,pitch:p.pitch,roll:0,fov:74};if(mode==='boat'&&boat){const eye=BITUME.voiture.mul(BITUME.voiture.attitude(boat.cap,boat.pitch,boat.roll),[0,kinds[boat.kind].eye,0]),c=Math.cos(boat.lookX),s=Math.sin(boat.lookX);return {pos:[p.x+eye[0],p.y+eye[1],p.z+eye[2]],yaw:p.yaw,pitch:p.pitch-.08+boat.pitch*c+boat.roll*s,roll:-boat.roll*c+boat.pitch*s,fov:74};}return null;}
 function setControl(name){if(!boat||boat.kind!=='sailboat'||!stations.some(s=>s.id===name))return false;boat.control=name;boat.lookX=boat.lookY=0;if(lastPlayer)sync(lastPlayer);notify((stations.find(s=>s.id===name)||stations[0]).label);return true;}
 function cycleControl(direction=1){if(!boat||boat.kind!=='sailboat')return false;const i=stations.findIndex(s=>s.id===boat.control);return setControl(stations[(i+(direction<0?2:1))%3].id);}
 function save(){return {version:2,mode,boatId:boat?.id,player:lastPlayer?{x:lastPlayer.x,z:lastPlayer.z,yaw:lastPlayer.yaw,pitch:lastPlayer.pitch}:null,boats:boats.map(({id,kind,x,z,cap,sailTrim,sailDeployment,sailAngle,control,rudder,engineOn})=>({id,kind,x,z,cap,sailTrim,sailDeployment,sailAngle,control,rudder,engineOn}))};}
 function restore(p){
  if(!saved||![1,2].includes(saved.version))return;
  const proposed=boats.map(q=>({...q})),records=Array.isArray(saved.boats)?saved.boats.slice(0,64):[];
  for(const data of records){
   if(!data||typeof data!=='object')continue;const q=proposed.find(q=>q.id===data.id&&q.kind===data.kind);
   if(q&&[data.x,data.z,data.cap].every(Number.isFinite)&&hullClear(data.x,data.z,data.cap,kinds[q.kind]))Object.assign(q,{x:data.x,z:data.z,cap:wrap(data.cap),sailTrim:Number.isFinite(data.sailDeployment??data.sailTrim)?clamp(data.sailDeployment??data.sailTrim,0,1):q.sailTrim,sailDeployment:Number.isFinite(data.sailDeployment??data.sailTrim)?clamp(data.sailDeployment??data.sailTrim,0,1):q.sailDeployment,sailAngle:Number.isFinite(data.sailAngle)?clamp(data.sailAngle,-SAIL_LIMIT,SAIL_LIMIT):q.sailAngle,control:stations.some(s=>s.id===data.control)?data.control:'helm',rudder:Number.isFinite(data.rudder)?clamp(data.rudder,-1,1):0,engineOn:q.kind==='sailboat'&&saved.version===1?false:typeof data.engineOn==='boolean'?data.engineOn:q.engineOn});
  }
  // Validate the proposed fleet together, allowing valid saved positions to exchange places.
  if(proposed.every((a,i)=>proposed.every((b,j)=>j<=i||!overlap(boatBox(a.x,a.z,a.cap,kinds[a.kind]),boatBox(b.x,b.z,b.cap,kinds[b.kind])))))for(let i=0;i<boats.length;i++)Object.assign(boats[i],proposed[i],{speed:0});
  if(saved.mode==='boat'){boat=boats.find(q=>q.id===saved.boatId)||null;if(boat)mode='boat';}
  if(saved.mode==='swim'&&saved.player&&[saved.player.x,saved.player.z].every(Number.isFinite)&&water(saved.player.x,saved.player.z)){Object.assign(p,{x:saved.player.x,z:saved.player.z,yaw:clamp(saved.player.yaw,-1e6,1e6),pitch:clamp(saved.player.pitch,-1.2,1.2)});mode='swim';}sync(p);lastPlayer=p;
 }
 return {boats,ladders,update,geometry,context,interact,enterWater,camera,save,restore,hull,setControl,cycleControl,controls:()=>boat?.kind==='sailboat'?stations:[],get sailing(){return boat?.kind==='sailboat'?{control:boat.control,sailAngle:boat.sailAngle,sailDeployment:boat.sailDeployment,windFrom:boat.windFrom,relativeWind:boat.relativeWind,windSpeed:boat.windSpeed,apparentSpeed:boat.apparentSpeed,idealAngle:boat.idealAngle,trimError:boat.trimError,catch:boat.catch,force:boat.force,load:boat.load,luffing:boat.luffing,blocked:boat.blocked,engineOn:boat.engineOn,throttle:boat.throttle}:null;},get time(){return time;},get mode(){return mode;},get boat(){return boat;},leave(){mode='foot';boat=null;vx=vz=0;}};
}
R.marine={create,kinds,models,sailDrive,windDirection,seaHeight,SEA_LEVEL:SEA,stations};
})(globalThis.RADE);
