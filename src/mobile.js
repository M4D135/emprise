/* EMPRISE — METAL's floating-stick and drag-to-fire interaction, adapted to
   walking, swimming, driving and sailing. No aim assist or simulation changes. */
(function(R){'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:0));
function normalize(s={}){return {sensitivity:clamp(s.sensitivity??1,.25,3),acceleration:clamp(s.acceleration??.5,0,1),invertY:s.invertY===true};}
function create(settings={}){
 let tune=normalize(settings),mode='foot',station='',dx=0,dy=0,speed=0,lx=0,ly=0;
 const pointers=new Map(),roles=new Map(),pending=new Map();
 function clear(){pointers.clear();roles.clear();pending.clear();dx=dy=speed=lx=ly=0;}
 function setMode(next,control=''){if(next!==mode||control!==station){clear();mode=next;station=control;return true;}return false;}
 function begin(role,id,x,y,radius=54){
  if(!['move','look','fire','forward','back','brake'].includes(role)||!Number.isFinite(id)||!Number.isFinite(x)||!Number.isFinite(y)||roles.has(role)||pointers.has(id))return false;
  const p={role,id,x,y,sx:x,sy:y,cx:x,cy:y,radius:clamp(radius,38,70),mx:0,my:0,run:false,aiming:role==='look'};
  pointers.set(id,p);roles.set(role,p);if(role==='fire')pending.set('fire',id);return true;
 }
 function move(id,x,y){
  const p=pointers.get(id);if(!p||!Number.isFinite(x)||!Number.isFinite(y))return false;
  if(p.role==='move'){
   let ox=x-p.cx,oy=y-p.cy,d=Math.hypot(ox,oy),r=p.radius;p.run=p.run?d>r*1.05:d>r*1.25;
   if(d>r*1.6){const follow=1-r*1.6/d;p.cx+=ox*follow;p.cy+=oy*follow;ox=x-p.cx;oy=y-p.cy;d=r*1.6;}
   const amount=clamp((d/r-.12)/.88,0,1);p.mx=d?ox/d*amount:0;p.my=d?-oy/d*amount:0;
  }else if(p.role==='look'||p.role==='fire'){
   if(p.aiming){dx+=x-p.x;dy+=y-p.y;}else if(Math.hypot(x-p.sx,y-p.sy)>4){p.aiming=true;dx+=x-p.sx;dy+=y-p.sy;}
  }
  p.x=x;p.y=y;return true;
 }
 function end(id,cancel=false){const p=pointers.get(id);if(!p)return false;pointers.delete(id);roles.delete(p.role);if(cancel&&pending.get(p.role)===id)pending.delete(p.role);if(cancel&&(p.role==='look'||p.role==='fire'))dx=dy=lx=ly=0;return true;}
 function queue(action){if(['interact','cycle','dash','camera','engine','map','zoomIn','zoomOut'].includes(action))pending.set(action,true);}
 function frame(dt){
  const seconds=clamp(dt||1/60,.008,.05);speed+=(Math.hypot(dx,dy)/seconds-speed)*.5;
  const t=clamp((speed-400)/1800,0,1),gain=1+2.2*t*t*(3-2*t)*tune.acceleration,scale=.004*tune.sensitivity*gain;
  lx+=dx*scale;ly-=dy*scale*(tune.invertY?-1:1);dx=dy=0;
 }
 function step(weapon=0){
  const p=roles.get('move'),foot=mode==='foot'||mode==='swim',forward=roles.has('forward')?1:0,back=roles.has('back')?1:0;
  const out={moveX:foot?p?.mx||0:0,moveY:foot?p?.my||0:0,steer:foot?0:p?.mx||0,lookX:lx,lookY:ly,sprint:foot&&!!p?.run,fire:mode==='foot'&&(roles.has('fire')||pending.has('fire')),forward:foot?0:forward,back:foot?0:back,brake:!foot&&roles.has('brake')};
  if(mode==='boat'&&station==='trim'){out.sailAngle=forward-back||out.steer;out.forward=out.back=0;}
  if(mode==='boat'&&station==='hoist'){out.sailHoist=forward-back||p?.my||0;out.forward=out.back=0;}
  for(const action of pending.keys())if(action!=='fire'&&action!=='cycle')out[action]=true;
  if(pending.has('cycle')&&mode==='foot')out.weapon=(weapon+1)%3;
  pending.clear();lx=ly=0;return out;
 }
 return {begin,move,end,queue,frame,step,clear,setMode,configure(s){tune=normalize(s);},get settings(){return {...tune};},has:id=>pointers.has(id),role:id=>pointers.get(id)?.role,get count(){return pointers.size;},get stick(){const p=roles.get('move');return p?{x:p.cx,y:p.cy,dx:p.mx*p.radius,dy:-p.my*p.radius,radius:p.radius,run:p.run}:null;}};
}
// The canvas getter survives WebGPU -> WebGL canvas replacement. Every pointer
// has one owner; cancellation never releases a different finger's control.
function bind({controls,root,scene,document:doc=globalThis.document,host=globalThis,canPlay,activate,action,gesture=()=>false}){
 const captured=new Map(),actionPointers=new Map(),actionButtons=new Map(),listeners=[],stick=root.querySelector('[data-mobile-stick]'),knob=root.querySelector('[data-mobile-knob]');
 const listen=(target,type,fn,options)=>{target.addEventListener(type,fn,options);listeners.push(()=>target.removeEventListener(type,fn,options));};
 function paint(){const p=controls.stick;stick.classList.toggle('running',!!p?.run);if(p){stick.style.left=(p.x-p.radius)+'px';stick.style.top=(p.y-p.radius)+'px';stick.style.bottom='auto';stick.style.width=stick.style.height=p.radius*2+'px';knob.style.transform='translate('+p.dx*.62+'px,'+p.dy*.62+'px)';}else{for(const key of ['left','top','bottom','width','height'])stick.style[key]='';knob.style.transform='';}}
 function release(id){const target=captured.get(id);captured.delete(id);try{if(target?.hasPointerCapture?.(id))target.releasePointerCapture(id);}catch{}}
 function clear(){controls.clear();actionPointers.clear();actionButtons.clear();for(const id of [...captured.keys()])release(id);paint();}
 function down(e){
  const target=e.target,button=target.closest?.('[data-mobile-role],[data-mobile-action]'),onCanvas=target===scene();
  if(!onCanvas&&(!button||!root.contains(button)))return;if(e.pointerType==='mouse'&&onCanvas)return;
  if(gesture(e)||!canPlay()||button?.disabled||root.hidden&&!onCanvas)return;
  activate();
  // Open sheets on their native click, after the touch is released. Opening
  // on pointerdown lets the eventual click hit a newly revealed sheet button.
  if(button?.dataset.mobileAction){const press={button,id:e.pointerId,ended:false};actionPointers.set(e.pointerId,press);actionButtons.set(button,press);return;}
  e.preventDefault();
  const role=button?.dataset.mobileRole||(e.clientX<host.innerWidth*.42?'move':'look'),owner=button||target;
  if(controls.begin(role,e.pointerId,e.clientX,e.clientY,clamp(Math.min(host.innerWidth,host.innerHeight)*.14,42,60))){captured.set(e.pointerId,owner);try{owner.setPointerCapture(e.pointerId);}catch{}paint();}
 }
 function move(e){if(!controls.has(e.pointerId))return;if(!canPlay()){clear();return;}if(controls.move(e.pointerId,e.clientX,e.clientY)){e.preventDefault();paint();}}
 function end(e){
  const press=actionPointers.get(e.pointerId);if(press){actionPointers.delete(e.pointerId);if(e.type==='pointerup')press.ended=true;else if(actionButtons.get(press.button)===press)actionButtons.delete(press.button);}
  if(controls.end(e.pointerId,e.type!=='pointerup')){release(e.pointerId);paint();}
 }
 listen(doc,'pointerdown',down,{passive:false});listen(host,'pointermove',move,{passive:false});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(host,type,end);
 listen(host,'blur',clear);listen(host,'pagehide',clear);listen(host,'resize',clear);listen(host,'orientationchange',clear);
 listen(doc,'visibilitychange',()=>{if(doc.hidden)clear();});
 // One activation for both native touch clicks and keyboard/assistive clicks.
 listen(root,'click',e=>{if(!canPlay())return;const button=e.target.closest?.('[data-mobile-action]');if(!button||button.disabled)return;const press=actionButtons.get(button);actionButtons.delete(button);
  // A click from a pointer held before a pause/rotation must not survive clear.
  // detail=0 is an independent keyboard or assistive activation, without a hold.
  if(e.detail!==0&&!press?.ended)return;e.preventDefault();action(button.dataset.mobileAction);
 });
 return {clear,paint,syncMode(mode,station){if(controls.setMode(mode,station))clear();},destroy(){clear();for(const off of listeners)off();}};
}
function fovFor(aspect,vertical){return aspect>0?Math.max(vertical,Math.min(104,2*Math.atan(Math.tan(50*Math.PI/360)/aspect)*180/Math.PI)):vertical;}
R.mobile={create,bind,normalize,fovFor};
})(globalThis.RADE=globalThis.RADE||{});
