(function(R){'use strict';
const $=id=>document.getElementById(id),canvas=$('scene'),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const actions=[['left','KeyA'],['right','KeyD'],['back','KeyS'],['forward','KeyW'],['sprint','ShiftLeft'],['brake','Space'],['interact','KeyE'],['engine','KeyF'],['paint','KeyH'],['camera','KeyC'],['melee','KeyV'],['pulse','KeyR'],['weapon1','Digit1'],['weapon2','Digit2'],['fire','Enter']].map(([id,key])=>({id,keys:[key],type:['interact','engine','paint','camera','weapon1','weapon2','pulse','melee'].includes(id)?'press':'hold'}));
actions.push({id:'lookLeft',keys:['ArrowLeft'],type:'hold'},{id:'lookRight',keys:['ArrowRight'],type:'hold'});
const input=FInput.create({actions,sticks:{move:{type:'move',x:['left','right'],y:['back','forward'],pad:'LS'},look:{type:'look',x:['lookLeft','lookRight'],pad:'RS'}}});
let session,renderer,crowdView,model,motion=FMotion.create(),running=false,ready=false,last=0,acc=0,frameCount=0,view='poursuite',silent=false,audio=FAudio.create(),engineSound=BITUME.son.creer(),drag=false,previousMode='foot';
const samples=[],cpuSamples=[],errors=[];window.addEventListener('error',e=>errors.push(e.message));
let carLookX=0,carLookY=0,testInput=null,cameraOverride=null,drawCount=0,crowdVersion=-1;
function soundStart(){if(!silent){audio.start();audio.setMix({master:1,music:0,ambience:.3});audio.setPlaying(true);engineSound.demarrer();engineSound.reprendre();}}
function lock(){const p=canvas.requestPointerLock?.();if(p?.catch)p.catch(()=>session.tell('Capture refusée : maintenez le clic et glissez pour viser.'));}
function start(){if(!ready)return;running=true;last=performance.now();acc=0;$('title').hidden=true;$('hud').hidden=false;$('paused').hidden=true;$('touch').hidden=!matchMedia('(pointer:coarse)').matches;soundStart();lock();}
function pause(){running=false;input.clear();document.exitPointerLock?.();$('paused').hidden=false;engineSound.suspendre();audio.setPlaying(false);}
$('paint').oninput=e=>{if(session)session.car.color=e.target.value;};$('start').onclick=start;$('resume').onclick=start;$('pause').onclick=pause;$('restart').onclick=()=>location.reload();
$('sound').onclick=()=>{silent=!silent;$('sound').textContent=silent?'SON OFF':'SON ON';audio.setMix({master:silent?0:1});if(silent)engineSound.suspendre();else soundStart();};
window.addEventListener('keydown',e=>{if(e.code==='Escape'||e.code==='KeyP'){if(running)pause();else if(ready&&$('title').hidden)start();return;}if(input.keyDown(e.code,e.timeStamp,e.repeat,e.key))e.preventDefault();});
window.addEventListener('keyup',e=>input.keyUp(e.code));window.addEventListener('blur',()=>{input.clear();if(running&&!R.game?.testing)pause();});
canvas.addEventListener('mousedown',e=>{if(!running)return;soundStart();if(document.pointerLockElement!==canvas)lock();drag=true;if(e.button===0)input.button('fire',true,e.timeStamp,'mouse');});
window.addEventListener('mouseup',e=>{drag=false;input.button('fire',false,e.timeStamp,'mouse');});
window.addEventListener('mousemove',e=>{if(running&&(document.pointerLockElement===canvas||drag))input.mouseMove(e.movementX,e.movementY,e.timeStamp);});canvas.oncontextmenu=e=>e.preventDefault();
document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement===canvas&&session)session.tell(session.mode==='foot'?'Souris capturée · Échap pour libérer.':'Au volant · C change la vue.');});
let touchLast=null;canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')touchLast=[e.clientX,e.clientY];});canvas.addEventListener('pointermove',e=>{if(touchLast&&e.pointerType==='touch'){input.mouseMove(e.clientX-touchLast[0],e.clientY-touchLast[1],e.timeStamp);touchLast=[e.clientX,e.clientY];}});canvas.addEventListener('pointerup',()=>touchLast=null);
for(const b of document.querySelectorAll('#touch button')){b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);if(b.dataset.key)input.keyDown(b.dataset.key,e.timeStamp,false);else input.button('fire',true,e.timeStamp,'touch');};b.onpointerup=b.onpointercancel=e=>{if(b.dataset.key)input.keyUp(b.dataset.key);else input.button('fire',false,e.timeStamp,'touch');};}
function camera(){
 const p=session.player,c=session.car,t=session.time;
 if(cameraOverride)return cameraOverride;
 let cam;
 if(!running&&!$('title').hidden)cam={pos:[102,20,170],yaw:-.6,pitch:-.17,fov:65};
 else if(session.mode==='car'){
  if(view==='cockpit'){const eye=BITUME.voiture.mul(BITUME.voiture.attitude(c.cap,c.tangage,c.roulis),R.vehicles.model(c.model,c.color).eye);cam={pos:[c.x+eye[0],c.y+eye[1],c.z+eye[2]],yaw:c.cap+Math.PI/2+carLookX,pitch:(c.tangage||0)-.13+carLookY,roll:-c.roulis,fov:76};}
  else{const co=Math.cos(c.cap),si=Math.sin(c.cap),origin=[c.x,1.5,c.z],dir=[-co*.93,.36,-si*.93],length=session.world.withoutCar(()=>session.world.ray(origin,dir,7.8)),d=Math.max(1.2,length-.3);cam={pos:origin.map((v,k)=>v+dir[k]*d),yaw:c.cap+Math.PI/2,pitch:-.21,fov:69};}
 }else{const m=motion.view;cam={pos:[p.x,p.y+1.62+m.height,p.z],yaw:p.yaw,pitch:p.pitch,roll:m.roll,fov:74+m.fov};}
 return {...cam,near:.035,far:6000,allStatic:true,sun:{center:[p.x+Math.sin(p.yaw)*25,0,p.z-Math.cos(p.yaw)*25],extent:110,depth:150}};
}
function models(cam){
 const out=[],s=session.sim.state,c=session.car,t=session.time;
 for(const vehicle of session.world.fleet)R.vehicles.render(vehicle,out,{cockpit:vehicle===c&&session.mode==='car'&&view==='cockpit',rider:vehicle===c&&session.mode==='car'});
 for(const e of s.enemies)if(e.hp>0)out.push(...FActors.build(e,{time:t,distance:Math.hypot(e.x-cam.pos[0],e.z-cam.pos[2]),quality:'high',backend:'webgl2'}));
 out.push(...FEffects.build(s,session.world.combatWorld,cam,{quality:'high',backend:'webgl2'}));
 for(const q of s.bullets)out.push({shape:'sphere',p:[q.x,q.y,q.z],s:[.15,.15,.15],mat:6,emissive:2});
 for(const q of s.particles){const v=Math.min(.11,q.life*.17);out.push({shape:'box',p:[q.x,q.y,q.z],s:[v,v,v],mat:q.kind,emissive:1});}
 const goal=session.world.mission,color=session.phase>=3?[.25,.9,.68]:[1,.53,.15];out.push({shape:'octa',p:[goal.x,5+Math.sin(t*2)*.15,goal.z],s:[.8,1.2,.8],r:[0,t*.4,0],mat:5,color,emissive:.7});
 if(session.mode==='foot'&&running)out.push(...FWeapon.build(s,cam,motion));return out;
}
const map=$('map').getContext('2d'),mapCache=document.createElement('canvas');mapCache.width=660;mapCache.height=660;
function cacheMap(){const m=mapCache.getContext('2d');m.fillStyle='#b9b6a0';m.fillRect(0,0,660,660);m.fillStyle='#244e5e';for(const ring of session.world.city.eau){m.beginPath();for(let i=0;i<ring.length;i+=2){const x=ring[i]+330,z=ring[i+1]+330;i?m.lineTo(x,z):m.moveTo(x,z);}m.fill();}m.fillStyle='#687b7e';for(const q of session.world.city.emprises){m.save();m.translate(q.x+330,q.z+330);m.rotate(-q.lacet);m.fillRect(-q.lx/2,-q.lz/2,q.lx,q.lz);m.restore();}}
function hud(){const p=session.player,c=session.car,s=session.sim.state,g=session.world.mission,carMode=session.mode==='car',dist=Math.round(Math.hypot((session.phase===0||session.phase===3?c.x:g.x)-p.x,(session.phase===0||session.phase===3?c.z:g.z)-p.z));
 const tasks=['Rejoignez votre voiture','Cap sur le quai du Port','Sécurisez la zone de maintenance','Retrouvez votre voiture','Quai libre. La ville vous appartient.'];$('task').textContent=tasks[session.phase];$('progress').textContent=session.phase===2?`${s.enemies.filter(e=>e.hp<=0).length} / 3 sentinelles neutralisées`:session.phase===4?'Mission accomplie · exploration libre':`${dist} m · ${session.phase===1?'Quai des Belges → Quai du Port':'E pour interagir'}`;
 $('mode').textContent=carMode?R.vehicles.SPECS[c.model].name.toUpperCase():'À PIED';$('speed').innerHTML=carMode?`${Math.round(c.v*3.6)} <small>KM/H</small>`:`${Math.ceil(p.hp)} <small>PV</small>`;$('engine').textContent=carMode?`${c.model==='bike'?'PÉDALAGE':c.moteur?'MOTEUR ON':'F · DÉMARRER'} / ${c.arriere?'R':c.rapport}`:(s.weapon===1?'DOUBLE POMPE · 2':'MITRAILLETTE · 1');$('heat').firstElementChild.style.width=(p.heat*100)+'%';$('cross').hidden=carMode;$('hit').hidden=!(s.hitMarker>0);const near=session.world.fleet.find(v=>Math.hypot(v.x-p.x,v.z-p.z)<4.4);$('notice').textContent=session.message||(!carMode&&near?'E · '+R.vehicles.SPECS[near.model].name:'');
 $('keys').textContent=carMode?'Z / W accélérer · S freiner / reculer · Q / A / D tourner · E sortir · C vue · H couleur':'ZQSD / WASD marcher · Maj courir · E véhicule · Clic tirer · 1 / 2 armes';
 const visible=samples.slice(-90).sort((a,b)=>a-b);$('perf').textContent=`${visible.length?Math.round(1000/visible[Math.floor(visible.length/2)]):'—'} FPS · ${session.crowd.n} PIÉTONS`;
 map.clearRect(0,0,220,180);map.drawImage(mapCache,p.x+330-100,p.z+330-82,200,164,0,0,220,180);
 function dot(x,z,col,size){map.fillStyle=col;map.beginPath();map.arc(110+(x-p.x)*1.1,90+(z-p.z)*1.1,size,0,Math.PI*2);map.fill();}for(const v of session.world.fleet)dot(v.x,v.z,'#81e2dd',v===c?4:2);dot(g.x,g.z,'#ff975a',5);for(const e of s.enemies)if(e.hp>0)dot(e.x,e.z,'#e06043',2);map.save();map.translate(110,90);map.rotate(p.yaw);map.fillStyle='white';map.beginPath();map.moveTo(0,-7);map.lineTo(-4,5);map.lineTo(4,5);map.closePath();map.fill();map.restore();
 if(s.dead){$('pauseTitle').textContent='Vous êtes hors de combat.';$('resume').hidden=true;pause();}
}
function frame(now){requestAnimationFrame(frame);if(!ready)return;const cpu=performance.now(),ms=last?now-last:16.67;last=now;const dt=Math.min(.05,ms/1000);
 if(running){input.frame(dt);acc=Math.min(.12,acc+dt);while(acc>=1/120){const i=testInput?testInput(session,1/120):input.step();if(i.paint){const c=session.car,p=R.vehicles.PALETTE;c.color=p[(p.indexOf(c.color)+1)%p.length];}if(i.camera)view=view==='cockpit'?'poursuite':'cockpit';if(session.mode==='car'){carLookX=clamp(carLookX+(i.lookX||0),-1.7,1.7);carLookY=clamp(carLookY+(i.lookY||0),-.65,.35);}const cmd={...i,steer:i.steer??i.moveX,forward:Math.max(Number(i.forward||0),i.moveY||0,0),back:Math.max(Number(i.back||0),-(i.moveY||0),0),dash:session.mode==='foot'&&i.brake,drift:i.drift??(session.mode==='car'&&i.sprint),weapon:i.weapon??(i.weapon1?0:i.weapon2?1:undefined)};session.update(1/120,cmd);for(const e of session.events){motion.impulse(e.name);if(!silent){if(typeof audio[e.name]==='function')audio[e.name](e);if(e.type)engineSound.evenement(e.type,e);}}acc-=1/120;}
 motion.update(dt,session.sim.state.locomotion||{}, {time:session.time,firing:session.sim.state.flash>0},true);
 if(session.mode!==previousMode){motion.reset();input.clear();carLookX=carLookY=0;previousMode=session.mode;}
 samples.push(ms);if(samples.length>36000)samples.shift();
 }
 const cam=camera();if(crowdVersion!==session.crowd.version){crowdView.recevoir(session.crowd.packed,session.crowd.n);crowdVersion=session.crowd.version;}crowdView.cadre(cam,session.time,session.crowdAlpha);
 renderer.draw(cam,models(cam),{time:session.time,flash:session.mode==='foot'?session.sim.state.flash:0,damage:session.sim.state.damage,lights:FEffects.lights(session.sim.state),sunOnly:true,torch:false,shadows:true,bloom:true,msaa:true,foule:crowdView.fx,adaptive:false,frameMs:ms});drawCount++;
 engineSound.mettreAJour({pause:!running||silent,joueur:{...session.car,muet:session.mode!=='car'||!session.car.moteur||['bike','scooter'].includes(session.car.model),vue:view},rivaux:session.mode==='foot'&&session.car.moteur&&!['bike','scooter'].includes(session.car.model)?[{id:0,regime:session.car.regime,gaz:0,distance:Math.hypot(session.car.x-session.player.x,session.car.z-session.player.z),angle:0,vRel:0}]:[]});
 if(frameCount++%8===0)hud();if(running){cpuSamples.push(performance.now()-cpu);if(cpuSamples.length>36000)cpuSamples.shift();}
}
async function init(){try{
 await new Promise(r=>setTimeout(r,40));session=R.session.create();
 renderer=FRender.create(canvas,{msaa:4,shadowMapScale:1,vignette:.9,bloomThreshold:[.9,.99]});if(!renderer.gl)throw new Error('WebGL2 est nécessaire pour cette version.');
 const env={skyTop:[.25,.44,.63],skyBottom:[.72,.76,.74],fog:[.64,.70,.71],sunDirection:[-.45,.62,.35],sunColor:[1.62,1.44,1.16],ambient:[.2,.23,.27],wind:.5,fogDensity:.00035,biome:'ville',outdoorZones:[{x:0,z:0,w:6000,d:6000}]};
 renderer.setWorld(session.world.scenery,[],env);crowdView=PDR.foule.creerFoule(renderer,{ville:session.world.navCity,plafond:1000,seuil:3});crowdView.regler({joueur:-1,brouillard:false});cacheMap();
 R.game={session,renderer,crowdView,input,samples,cpuSamples,errors,start,pause,testing:false,get running(){return running;},get view(){return view;},set view(v){view=v;},set controller(fn){testInput=fn;},set camera(v){cameraOverride=v;},get drawCount(){return drawCount;},metrics(){const p=a=>{a=a.slice().sort((x,y)=>x-y);return {n:a.length,p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)]};};return {frame:p(samples),cpu:p(cpuSamples),resolution:[canvas.width,canvas.height],pedestrians:session.crowd.n,renderer:renderer.stats,webgl:renderer.gl.getParameter(renderer.gl.RENDERER),userAgent:navigator.userAgent};}};
 ready=true;$('loading').hidden=true;$('title').hidden=false;window.addEventListener('resize',()=>renderer.resize());requestAnimationFrame(frame);
 }catch(e){$('loading').innerHTML='RADE<span>'+e.message+'</span>';console.error(e);}}
init();
})(globalThis.RADE=globalThis.RADE||{});
