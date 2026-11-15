/* EMPRISE — original procedural hulls and surface navigation; no imported assets. */
(function(R){'use strict';
const PI=Math.PI,SEA=-.04,SWIM=-1.2,clamp=(v,a,b)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:0)),wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const kinds={motorboat:{name:'Canot à moteur',length:6.4,width:2.3,top:12,accel:4.3,turn:.85,eye:1.35},sailboat:{name:'Voilier',length:7.6,width:2.5,top:6.5,accel:1.4,turn:.5,eye:1.3},jetski:{name:'Jet-ski',length:3.1,width:1.18,top:16,accel:6.8,turn:1.5,eye:1.1}};
const models={};
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
  bar([.5,.4,0],[.5,7.6,0],.10);bar([.5,1.6,0],[-2.6,1.6,0],.07);bar([.5,7.5,0],[L-.1,.65,0],.014);bar([.5,7.5,0],[-L+.1,.65,0],.014);for(const z of [-W,W])bar([.5,6,0],[.3,.5,z],.012);
  const faces=[[[.43,7.2,0],[.43,1.7,0],[-2.6,1.7,.25]],[[.6,6.7,0],[L-.25,.75,0],[.6,1.65,.12]]],tris=[];for(const f of faces){const a=f[0],u=f[1].map((x,i)=>x-a[i]),v=f[2].map((x,i)=>x-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],d=Math.hypot(...n),nn=n.map(x=>x/d);tris.push([...f,nn,nn,nn],[...f.slice().reverse(),...Array(3).fill(nn.map(x=>-x))]);}
  const s=BITUME.carene.normaliser(tris);FRender.forme('emprise-sails',s.triangles);put('emprise-sails',s.centre,s.taille,[.91,.87,.73],18,[0,0,0],{sail:true});put('box',[0,-.65,0],[1.4,1.1,.11],dark);
 }
 return parts;
}
for(const kind of Object.keys(kinds))models[kind]=model(kind);
function create(world,{saved=null,notify=()=>{}}={}){
 let mode='foot',boat=null,time=0,vx=0,vz=0,wakeClock=0,lastPlayer=null;const boats=[],ladders=[],wakes=[],B=world.bounds;
 const inBounds=(x,z,r=0)=>x-r>B.minX+5&&x+r<B.maxX-5&&z-r>B.minZ+5&&z+r<B.maxZ-5;
 function obstacle(x,z,r=.25){for(const q of world.candidates?.(x,z,r)||[]){if(q.maxY<.20||q.minY>1.4)continue;const dx=x-q.x,dz=z-q.z,u=dx*q.c+dz*q.s,v=-dx*q.s+dz*q.c;if((u-clamp(u,-q.a,q.a))**2+(v-clamp(v,-q.b,q.b))**2<r*r)return true;}return false;}
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
  for(const q of [...(world.candidates?.(x,z,radius)||[]),...(world.dynamicBodies||[])])if(q.maxY>=SEA-.4&&q.minY<=1.4&&overlap(box,q))return false;
  // Sample the filled footprint, not only six points on its boundary; no narrow strip of land can sit in the cabin.
  const nx=Math.ceil(k.length/.55),nz=Math.ceil(k.width/.55);
  for(let i=0;i<=nx;i++)for(let j=0;j<=nz;j++){const a=-k.length/2+k.length*i/nx,b=-k.width/2+k.width*j/nz,px=x+a*box.c-b*box.s,pz=z+a*box.s+b*box.c;if(!inBounds(px,pz,.2)||!world.water(px,pz))return false;}
  return true;
 }
 function hull(x,z,cap,k,ignore=null){if(!hullClear(x,z,cap,k))return false;const box=boatBox(x,z,cap,k);return boats.every(q=>q===ignore||!overlap(box,boatBox(q.x,q.z,q.cap,kinds[q.kind])));}
 function clearPassage(x,z,tx,tz){
  const dx=tx-x,dz=tz-z,d=Math.hypot(dx,dz);if(!Number.isFinite(d))return false;if(d<.02)return true;
  const ux=dx/d,uz=dz/d;
  for(const side of [-.22,0,.22]){const sx=x-uz*side,sz=z+ux*side;
   if(world.ray){if(world.ray([sx,.9,sz],[ux,0,uz],d)<d-.03)return false;}
   else for(let t=0;t<=d;t+=.2){for(const q of world.candidates?.(sx+ux*t,sz+uz*t,.2)||[])if(q.minY<1.3&&q.maxY>.55&&overlap({x:sx+ux*t,z:sz+uz*t,a:.12,b:.12,c:1,s:0},q))return false;}
  }return true;
 }
 const validLadder=l=>water(l.x,l.z,.35)&&!world.water(l.landX,l.landZ)&&!world.blocked(l.landX,l.landZ,.4)&&clearPassage(l.x,l.z,l.landX,l.landZ);
 const spawn=world.combatWorld?.spawn||{x:0,z:0};
 for(const [i,kind]of Object.keys(kinds).entries()){const k=kinds[kind],cap=kind==='sailboat'?PI/2:PI;let best=null,dist=Infinity;for(let z=spawn.z-90;z<=spawn.z+90;z+=4)for(let x=spawn.x-90;x<=spawn.x+90;x+=4){const d=Math.hypot(x-spawn.x,z-spawn.z);if(d<dist&&hull(x,z,cap,k)){best={x,z};dist=d;}}if(best)boats.push({id:'boat-'+i,kind,...best,cap,speed:0,y:SEA,roll:0,pitch:0,lookX:0,lookY:0,sailTrim:.7,engineOn:true});}
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
 function sync(p){if(mode==='boat'&&boat){p.x=boat.x-.7*Math.cos(boat.cap);p.z=boat.z-.7*Math.sin(boat.cap);p.y=boat.y;p.yaw=boat.cap+PI/2+boat.lookX;p.pitch=boat.lookY;}else if(mode==='swim')p.y=SWIM;}
 function enterWater(p){if(!water(p.x,p.z))return false;lastPlayer=p;mode='swim';boat=null;vx=vz=0;p.y=SWIM;notify('Nage · rejoignez une échelle pour remonter sur le quai.');return true;}
 function context(p){if(mode==='boat')return {kind:'marine',label:'E · Descendre dans l’eau',distance:0};const opts=[];for(const q of boats){const d=Math.hypot(p.x-q.x,p.z-q.z),reach=kinds[q.kind].length/2+.7;if(d<reach&&Math.abs(q.speed)<1.3&&clearPassage(p.x,p.z,q.x-.7*Math.cos(q.cap),q.z-.7*Math.sin(q.cap)))opts.push({kind:'marine',boat:q,label:'E · Monter · '+kinds[q.kind].name,distance:d});}
  for(const l of ladders){const d=Math.hypot(p.x-(mode==='swim'?l.x:l.landX),p.z-(mode==='swim'?l.z:l.landZ));if(d<2&&validLadder(l))opts.push({kind:'marine',ladder:l,label:mode==='swim'?'E · Monter à l’échelle':'E · Descendre dans l’eau',distance:d});}return opts.sort((a,b)=>a.distance-b.distance)[0]||null;
 }
 function interact(p){lastPlayer=p;if(mode==='boat'){if(Math.abs(boat.speed)>1.3){notify('Ralentissez avant de descendre.');return false;}const k=kinds[boat.kind];for(const side of [-1,1]){const x=boat.x-Math.sin(boat.cap)*side*(k.width/2+.65),z=boat.z+Math.cos(boat.cap)*side*(k.width/2+.65);if(water(x,z)){boat.speed=0;Object.assign(p,{x,z});return enterWater(p);}}notify('Aucune sortie sûre sur le côté.');return false;}
  const c=context(p);if(!c)return false;if(c.boat){boat=c.boat;mode='boat';boat.speed=0;boat.lookX=boat.lookY=0;sync(p);notify(kinds[boat.kind].name+' · avancer / braquer');return true;}const l=c.ladder;if(!validLadder(l))return false;if(mode==='swim'){mode='foot';Object.assign(p,{x:l.landX,z:l.landZ,y:world.ground(),pitch:0});notify('Sur le quai.');return true;}Object.assign(p,{x:l.x,z:l.z});return enterWater(p);
 }
 function update(dt,input={},p,weather={}){lastPlayer=p;dt=clamp(dt,0,.05);time+=dt;
  if(mode==='swim'){p.yaw+=clamp(input.lookX,-.5,.5);p.pitch=clamp(p.pitch+clamp(input.lookY,-.5,.5),-1.2,1.2);const mx=clamp(input.moveX,-1,1),my=clamp(input.moveY,-1,1),n=Math.max(1,Math.hypot(mx,my)),v=input.sprint?2.6:1.7,e=1-Math.exp(-dt*5);vx+=((Math.cos(p.yaw)*mx+Math.sin(p.yaw)*my)/n*v-vx)*e;vz+=((Math.sin(p.yaw)*mx-Math.cos(p.yaw)*my)/n*v-vz)*e;if(water(p.x+vx*dt,p.z))p.x+=vx*dt;else vx=0;if(water(p.x,p.z+vz*dt))p.z+=vz*dt;else vz=0;}
  for(const q of boats){const k=kinds[q.kind],active=q===boat&&mode==='boat',wind=clamp(weather.wind??.28,0,2),gust=clamp(weather.gust??wind,0,2);if(active){q.lookX=clamp(q.lookX+clamp(input.lookX,-.5,.5),-2.5,2.5);q.lookY=clamp(q.lookY+clamp(input.lookY,-.5,.5),-.8,.8);if(input.engine&&q.kind!=='sailboat')q.engineOn=!q.engineOn;const gas=clamp(input.forward,0,1),back=clamp(input.back,0,1);let target;
    if(q.kind==='sailboat'){q.sailTrim=clamp(q.sailTrim+(gas-back)*dt*.5,0,1);const from=Math.atan2(.0018,.006)+PI,relative=Math.abs(wrap(q.cap-from)),drive=clamp((relative-.58)/.9,0,1);target=k.top*Math.min(1,wind/.7)*drive*q.sailTrim;}
    else target=q.engineOn?(gas*k.top-back*2.8):0;
    const accel=input.brake?8:k.accel;q.speed+=clamp((input.brake?0:target)-q.speed,-accel*dt,accel*dt);const turn=clamp(input.steer,-1,1)*k.turn*clamp(q.speed/3,-1,1)*dt,newCap=q.cap+turn,dx=Math.cos(newCap)*q.speed*dt,dz=Math.sin(newCap)*q.speed*dt;
    if(hull(q.x+dx,q.z+dz,newCap,k,q)){q.x+=dx;q.z+=dz;q.cap=newCap;}else q.speed*=Math.exp(-dt*15);
   }else q.speed*=Math.exp(-dt*2);
   q.y=SEA+Math.sin(time*1.6+q.id.length)*(.025+gust*.035);q.roll=Math.sin(time*1.25+q.x*.2)*(.012+gust*.025);q.pitch=Math.sin(time*1.8+q.z*.3)*(.009+gust*.018)+Math.abs(q.speed)*.002;
  }
  wakeClock+=dt;if(wakeClock>.15){wakeClock=0;for(const q of boats)if(Math.abs(q.speed)>1)wakes.push({x:q.x-Math.cos(q.cap)*kinds[q.kind].length/2,z:q.z-Math.sin(q.cap)*kinds[q.kind].length/2,cap:q.cap,age:0});while(wakes.length>30)wakes.shift();}for(let i=wakes.length-1;i>=0;i--){wakes[i].age+=dt;if(wakes[i].age>3)wakes.splice(i,1);}sync(p);
 }
 function geometry(){const out=[];for(const q of boats){const M=BITUME.voiture.attitude(q.cap,q.pitch,q.roll),rot=BITUME.voiture.angles(M);for(const m of models[q.kind]){const local=m.sail?{...m,s:[m.s[0],m.s[1]*(.1+.9*q.sailTrim),m.s[2]],p:[m.p[0],1.7+(m.p[1]-1.7)*(.1+.9*q.sailTrim),m.p[2]]}:m,v=BITUME.voiture.mul(M,local.p),r=local.r?.some(Boolean)?BITUME.voiture.angles(BITUME.voiture.mulM(M,BITUME.voiture.euler(...local.r))):rot;out.push({...local,p:[q.x+v[0],q.y+v[1],q.z+v[2]],r});}}
  for(const l of ladders){const c=Math.cos(l.cap),s=Math.sin(l.cap),at=(u,y)=>[l.x-u*s,y,l.z+u*c];for(const a of [-.32,.32])out.push({shape:'cylinder',p:at(a,.1),s:[.055,2.5,.055],mat:0,color:[.56,.62,.63]});for(let y=-.9;y<1.2;y+=.3)out.push({shape:'box',p:at(0,y),s:[.72,.06,.06],r:[0,-l.cap-PI/2,0],mat:0,color:[.56,.62,.63]});out.push({shape:'sphere',p:[l.landX,.10,l.landZ],s:[.7,.05,.7],color:[.85,.5,.12],mat:7});}
  for(const w of wakes)out.push({shape:'box',p:[w.x,.01,w.z],s:[.6+w.age,.012,1+w.age*1.5],r:[0,-w.cap,0],fx:true,alpha:.23*(1-w.age/3),mat:7,color:[.72,.85,.88]});return out;
 }
 function camera(p=lastPlayer){if(mode==='swim')return {pos:[p.x,.35+Math.sin(time*2.2)*.025,p.z],yaw:p.yaw,pitch:p.pitch,roll:0,fov:74};if(mode==='boat'&&boat)return {pos:[p.x,boat.y+kinds[boat.kind].eye,p.z],yaw:p.yaw,pitch:p.pitch-.08,roll:-boat.roll,fov:74};return null;}
 function save(){return {version:1,mode,boatId:boat?.id,player:lastPlayer?{x:lastPlayer.x,z:lastPlayer.z,yaw:lastPlayer.yaw,pitch:lastPlayer.pitch}:null,boats:boats.map(({id,kind,x,z,cap,sailTrim,engineOn})=>({id,kind,x,z,cap,sailTrim,engineOn}))};}
 function restore(p){
  if(!saved||saved.version!==1)return;
  const proposed=boats.map(q=>({...q})),records=Array.isArray(saved.boats)?saved.boats.slice(0,64):[];
  for(const data of records){
   if(!data||typeof data!=='object')continue;const q=proposed.find(q=>q.id===data.id&&q.kind===data.kind);
   if(q&&[data.x,data.z,data.cap].every(Number.isFinite)&&hullClear(data.x,data.z,data.cap,kinds[q.kind]))Object.assign(q,{x:data.x,z:data.z,cap:wrap(data.cap),sailTrim:Number.isFinite(data.sailTrim)?clamp(data.sailTrim,0,1):q.sailTrim,engineOn:typeof data.engineOn==='boolean'?data.engineOn:q.engineOn});
  }
  // Validate the proposed fleet together, allowing valid saved positions to exchange places.
  if(proposed.every((a,i)=>proposed.every((b,j)=>j<=i||!overlap(boatBox(a.x,a.z,a.cap,kinds[a.kind]),boatBox(b.x,b.z,b.cap,kinds[b.kind])))))for(let i=0;i<boats.length;i++)Object.assign(boats[i],proposed[i],{speed:0});
  if(saved.mode==='boat'){boat=boats.find(q=>q.id===saved.boatId)||null;if(boat)mode='boat';}
  if(saved.mode==='swim'&&saved.player&&[saved.player.x,saved.player.z].every(Number.isFinite)&&water(saved.player.x,saved.player.z)){Object.assign(p,{x:saved.player.x,z:saved.player.z,yaw:clamp(saved.player.yaw,-1e6,1e6),pitch:clamp(saved.player.pitch,-1.2,1.2)});mode='swim';}sync(p);lastPlayer=p;
 }
 return {boats,ladders,update,geometry,context,interact,enterWater,camera,save,restore,hull,get mode(){return mode;},get boat(){return boat;},leave(){mode='foot';boat=null;vx=vz=0;}};
}
R.marine={create,kinds,models};
})(globalThis.RADE);
