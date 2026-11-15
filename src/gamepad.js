/* EMPRISE — standard Gamepad API. BITUME driving layout, neutral gates and finite haptics. */
(function(R){'use strict';
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:0)),defaults={sensitivity:1,deadzone:.14,invert:false,vibration:.5};
function normalize(s={}){return {sensitivity:clamp(+s.sensitivity||1,.25,2),deadzone:clamp(s.deadzone===undefined?.14:+s.deadzone,.05,.35),invert:!!s.invert,vibration:clamp(s.vibration===undefined?.5:+s.vibration)};}
function stick(x,y,dead,curve=1){const n=Math.hypot(x,y);if(n<=dead)return [0,0];const v=Math.pow(clamp((n-dead)/(1-dead)),curve)/n;return [x*v,y*v];}
function create({read=()=>navigator.getGamepads?.()||[],settings=defaults}={}){
 let config=normalize(settings),pad=null,identity='',previous=[],axes=[0,0,0,0],buttons=[],edges=[],blocked=false,lastTime=0,rumbleAt=-Infinity,pulse=0,weakPulse=0,wasRumbling=false;
 const pending={},look=[0,0];let menuDirection='',menuAt=0;
 function stop(){pulse=weakPulse=0;if(pad&&wasRumbling){try{const a=pad.vibrationActuator;const p=a?.reset?a.reset():a?.playEffect?.('dual-rumble',{duration:1,startDelay:0,weakMagnitude:0,strongMagnitude:0});p?.catch?.(()=>{});}catch{}}wasRumbling=false;}
 function neutral(){return buttons.every(v=>v<.08)&&axes.every(v=>Math.abs(v)<config.deadzone);}
 function suspend(){blocked=true;for(const k in pending)delete pending[k];look.fill(0);menuDirection='';stop();}
 function poll(dt,now){lastTime=now;let list=[];try{list=Array.from(read()||[]).filter(p=>p&&p.connected!==false);}catch{}
  const old=identity,oldPad=pad;const next=list.find(p=>p.index+':'+p.id===identity)||list[0]||null;if(next!==oldPad&&oldPad&&(next?.id!==oldPad.id||next?.index!==oldPad.index))stop();pad=next;identity=pad?pad.index+':'+pad.id:'';
  const changed=identity!==old,disconnected=!!old&&!list.some(p=>p.index+':'+p.id===old);
  if(changed){previous=[];stop();if(old)suspend();}
  axes=Array.from({length:4},(_,i)=>clamp(+pad?.axes?.[i]||0,-1,1));buttons=Array.from({length:17},(_,i)=>{const b=pad?.buttons?.[i];return clamp(typeof b==='number'?b:b?.value||(b?.pressed?1:0));});
  const active=buttons.some(b=>b>.18)||axes.some(a=>Math.abs(a)>Math.max(.22,config.deadzone));
  edges=buttons.map((v,i)=>v>.5&&!(previous[i]>.5));previous=buttons.slice();
  if(blocked){if(neutral())blocked=false;edges.fill(false);}
  const l=stick(axes[2],axes[3],config.deadzone,1.7),aim=buttons[6]>.2;
  if(!blocked){look[0]+=l[0]*3.8*config.sensitivity*dt*(aim?.45:1);look[1]+=-l[1]*2.6*config.sensitivity*dt*(config.invert?-1:1)*(aim?.45:1);}
  return {active,changed,disconnected,connected:!!pad,pressed:edges,blocked};
 }
 function queue(action,value=true){pending[action]=value;}
 function step(mode,weapon=0){if(!pad||blocked)return {};const foot=mode==='foot'||mode==='swim',m=stick(axes[0],axes[1],config.deadzone,foot?1:1.3),trigger=i=>buttons[i]<.05?0:(buttons[i]-.05)/.95;
  const out={...pending,moveX:m[0],moveY:foot?-m[1]:0,steer:m[0],lookX:look[0],lookY:look[1],fire:foot&&trigger(7)>.2,aim:foot?trigger(6):0,sprint:foot&&buttons[0]>.5,drift:!foot&&buttons[0]>.5,forward:foot?0:trigger(7),back:foot?0:trigger(6),brake:!foot&&buttons[1]>.5};
  if(out.cycle){out.weapon=(weapon+out.cycle+3)%3;delete out.cycle;}
  for(const k in pending)delete pending[k];look.fill(0);return out;
 }
 function gameplay(mode){const car=mode==='car'||mode==='boat';if(edges[2])queue('interact');if(edges[3])queue(car?'camera':'cycle',car?true:1);if(edges[5])queue('throw');if(edges[11])queue('melee');if(edges[10])queue('pulse');if(edges[1]&&!car)queue('dash');if(edges[14])queue('cycle',-1);if(edges[15])queue('cycle',1);if(edges[13])queue(car?'engine':'grab');}
 function navigation(now){if(blocked)return null;const y=axes[1],x=axes[0];const dir=buttons[12]>.5||y<-.55?'up':buttons[13]>.5||y>.55?'down':buttons[14]>.5||x<-.55?'left':buttons[15]>.5||x>.55?'right':'';
  if(!dir){menuDirection='';return null;}if(dir!==menuDirection){menuDirection=dir;menuAt=now+400;return dir;}if(now>=menuAt){menuAt=now+120;return dir;}return null;
 }
 function navigate(root,now){if(!root)return;const items=[...root.querySelectorAll('button,input,select')].filter(e=>!e.disabled&&e.type!=='color'&&!e.closest('[hidden]')&&e.getClientRects().length);if(!items.length)return;
  let i=items.indexOf(document.activeElement);if(i<0){i=0;items[i].focus();}const el=items[i],dir=navigation(now);
  if(dir){if(el.type==='range'&&(dir==='left'||dir==='right')){el.value=String(clamp(+el.value+(dir==='right'?1:-1)*(+el.step||.1),+el.min,+el.max));el.dispatchEvent(new Event('input',{bubbles:true}));}else {items[(i+(['up','left'].includes(dir)?-1:1)+items.length)%items.length].focus();}document.activeElement?.scrollIntoView({block:'nearest'});}
  if(edges[0]){el.click();suspend();}
 }
 function event(e,car){if(e.name==='shot'){weakPulse=Math.max(weakPulse,.24);pulse=Math.max(pulse,.10);}if(e.name==='hurt'||e.name==='damage')pulse=Math.max(pulse,.5);if((e.name==='explosion'||e.name==='vehicleExplosion')&&Math.hypot((e.x||0)-car.x,(e.z||0)-car.z)<20)pulse=Math.max(pulse,.75);if(['choc','contact','roue','casse'].includes(e.type||e.name))pulse=Math.max(pulse,clamp(.2+(e.force||0)/16,0,.85));}
 function feedback(dt,now,car,playing,driving){pulse=Math.max(0,pulse-dt*2.6);weakPulse=Math.max(0,weakPulse-dt*3.5);if(!playing||blocked||!config.vibration){stop();return;}if(!pad||now-rumbleAt<40)return;
  const rpm=clamp(((car.regime||850)-850)/6200),road=driving?clamp(car.v/70):0,engine=driving&&car.moteur?(.025+.24*rpm*rpm*(.25+.75*(car.gaz||0))):0;
  const weak=clamp(weakPulse+road*.15+(driving?Math.min(.3,Math.abs(car.glisseAr||0)*.4):0))*config.vibration,strong=clamp(pulse+engine+road*.12)*config.vibration;
  if(weak<.015&&strong<.015){if(wasRumbling)stop();return;}try{pad.vibrationActuator?.playEffect?.('dual-rumble',{duration:90,startDelay:0,weakMagnitude:weak,strongMagnitude:strong})?.catch?.(()=>{});wasRumbling=true;}catch{}rumbleAt=now;
 }
 return {poll,step,queue,gameplay,navigate,navigation,suspend,stop,event,feedback,get connected(){return !!pad;},get blocked(){return blocked;},get settings(){return {...config};},configure(s){config=normalize(s);if(!config.vibration)stop();},get label(){return /054c|playstation|dualshock|dualsense|sony/i.test(pad?.id||'')?'PlayStation':'Xbox / standard';},glyph(key){return FInput.glyph(key,/054c|playstation|dualshock|dualsense|sony/i.test(pad?.id||'')?'ps':'xbox');}};
}
R.gamepad={create,normalize,stick,defaults};
})(globalThis.RADE);
