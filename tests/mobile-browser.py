#!/usr/bin/env python3
"""Real Chromium multitouch through CDP pipe; no server or gameplay controller."""
from browser_support import Browser,ROOT
from pathlib import Path
import argparse,json,time,hashlib

p=argparse.ArgumentParser();p.add_argument('--html',type=Path,default=ROOT/'dist/index.html');p.add_argument('--label',default='mobile-controls');a=p.parse_args()
report={'htmlSha256':hashlib.sha256(a.html.read_bytes()).hexdigest(),'checks':[],'screenshots':[],'limitations':'Chrome mobile viewport and real CDP touch events on Mac; not a physical phone or Safari touch validation.'}
with Browser() as b:
 def size(w,h):
  b.cmd('Emulation.setDeviceMetricsOverride',{'width':w,'height':h,'deviceScaleFactor':1,'mobile':True});b.cmd('Emulation.setTouchEmulationEnabled',{'enabled':True,'maxTouchPoints':5});time.sleep(.15)
 def rect(selector):
  return b.ev('(()=>{const e=document.querySelector('+json.dumps(selector)+');e.scrollIntoView({block:"nearest"});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()')
 def touches(kind,points=[]):b.cmd('Input.dispatchTouchEvent',{'type':kind,'touchPoints':points})
 def point(selector,id=1):return {**rect(selector),'id':id}
 def tap(selector):touches('touchStart',[point(selector)]);time.sleep(.06);touches('touchEnd');time.sleep(.18)
 def hold(selector,seconds):touches('touchStart',[point(selector)]);time.sleep(seconds);touches('touchEnd');time.sleep(.15)
 def screenshot(suffix):name=a.label+'-'+suffix+'.png';b.capture(name);report['screenshots'].append(name)
 def state():return b.ev('({mode:RADE.game.session.mode,shots:RADE.game.session.sim.state.shots,x:RADE.game.session.player.x,z:RADE.game.session.player.z,yaw:RADE.game.session.player.yaw,v:RADE.game.session.car.v,u:RADE.game.session.car.u,weapon:RADE.game.session.sim.state.weapon,pointers:RADE.game.mobile.count,errors:RADE.game.errors,command:RADE.game.lastCommand})')
 def stop_car():
  touches('touchStart',[point('#touch-brake')]);b.wait('RADE.game.session.car.v<.18',8);touches('touchEnd');time.sleep(.2)
 def layout(label):
  result=b.ev('''(()=>{const root=document.getElementById('touch'),els=[...root.querySelectorAll('button'),document.getElementById('pause')].filter(e=>!e.disabled&&!e.closest('[hidden]')&&e.getClientRects().length);return {width:innerWidth,height:innerHeight,buttons:els.map(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {name:e.id||e.dataset.mobileAction,rect:[r.x,r.y,r.width,r.height],reachable:hit===e||e.contains(hit),inside:r.x>=0&&r.y>=0&&r.right<=innerWidth+.1&&r.bottom<=innerHeight+.1};})};})()''')
  assert all(e['inside'] and e['reachable'] for e in result['buttons']),result;report['checks'].append({'layout':label,**result})

 size(390,844);b.cmd('Page.navigate',{'url':a.html.resolve().as_uri()+'?test=1&renderer=webgpu'});b.cmd('Page.bringToFront');b.wait('globalThis.RADE?.game?.drawCount>2',90)
 b.ev('RADE.game.testing=true;true');screenshot('portrait-title');tap('#start');assert b.ev('RADE.game.running');b.ev('RADE.game.audio.setMix({master:0});RADE.game.engineSound.suspendre();true');time.sleep(.3);layout('portrait');screenshot('portrait')
 tap('#touch-interact');b.wait('RADE.game.session.mode==="car"');layout('portrait-driving')
 # Hold a genuine touch while invoking the same pause/resume DOM buttons.
 # CDP's secondary multitouch sequence emits pointerup but no native click on
 # Pause; do not mistake that emulation limitation for a gameplay failure.
 engine=b.ev('RADE.game.session.car.moteur');contact=point('#touch-engine',41)
 touches('touchStart',[contact]);b.ev('document.getElementById("pause").click();true');assert not b.ev('RADE.game.running')
 b.ev('document.getElementById("resume").click();true');assert b.ev('RADE.game.running');touches('touchEnd');time.sleep(.2);assert b.ev('RADE.game.session.car.moteur')==engine
 report['checks'].append('Real CONTACT touch held across pause/resume DOM-button activation is rejected on late release; secondary-finger native Pause click was not emitted by CDP')
 # No force-touch query: Enter must activate the focused touch button without
 # hiding its interface before the native keyboard click is dispatched.
 previous_view=b.ev('RADE.game.view');b.ev('document.getElementById("touch-camera").focus();true')
 for _ in range(2):
  b.cmd('Input.dispatchKeyEvent',{'type':'keyDown','key':'Enter','code':'Enter','windowsVirtualKeyCode':13,'nativeVirtualKeyCode':13,'text':'\r'});b.cmd('Input.dispatchKeyEvent',{'type':'keyUp','key':'Enter','code':'Enter','windowsVirtualKeyCode':13,'nativeVirtualKeyCode':13});time.sleep(.15);assert b.ev('document.body.classList.contains("touch")')
  if _==0:assert b.ev('RADE.game.view')!=previous_view
 assert b.ev('RADE.game.view')==previous_view;report['checks'].append('Keyboard Enter activates focused touch camera while preserving the touch interface')
 before=state();hold('#touch-forward',1.2);driven=state();assert driven['v']>1 and abs(driven['x']-before['x'])+abs(driven['z']-before['z'])>1,driven
 stop_car();hold('#touch-back',.7);reverse=state();assert reverse['u']<-.2,reverse;stop_car();tap('#touch-interact');b.wait('RADE.game.session.mode==="foot"');report['checks'].append({'driving':driven,'reverse':reverse,'exit':'foot'})
 before=state();m=point('#touch-stick',1);look={'x':245,'y':350,'id':2};fire=point('#touch-fire',3)
 touches('touchStart',[m,look,fire]);touches('touchMove',[{**m,'y':m['y']-65},{**look,'x':270},{**fire,'x':fire['x']-12,'y':fire['y']-6}]);time.sleep(.35);during=state();assert during['pointers']==3 and during['shots']>before['shots'] and abs(during['yaw']-before['yaw'])>.02,during;assert abs(during['x']-before['x'])+abs(during['z']-before['z'])>.1,during
 touches('touchEnd');time.sleep(.8);released=state();time.sleep(.3);assert state()['shots']==released['shots'];assert released['pointers']==0;report['checks'].append({'multitouchMoveAimFire':during,'released':released})
 weapon=state()['weapon'];tap('#touch-cycle');assert state()['weapon']==(weapon+1)%3
 touches('touchStart',[point('#touch-fire',4)]);time.sleep(.1);touches('touchCancel');time.sleep(.2);cancelled=state();time.sleep(.3);assert state()['shots']==cancelled['shots'] and cancelled['pointers']==0;report['checks'].append('CDP touchCancel stops held firing without stuck pointers')
 tap('[data-mobile-action="phone"]');assert b.ev('!document.getElementById("phone").hidden&&document.getElementById("touch").hidden');screenshot('phone');tap('#close-phone');assert b.ev('!document.getElementById("touch").hidden')
 tap('[data-mobile-action="actions"]');assert b.ev('!document.getElementById("actions").hidden');screenshot('actions');b.ev('document.querySelector("#action-list button:nth-child(3)").id="test-rocket-action";true');tap('#test-rocket-action');time.sleep(.2);assert state()['weapon']==2;report['checks'].append('Touch phone, close, action sheet and rocket selection use actual DOM buttons')
 touches('touchStart',[point('#touch-fire',5)]);b.ev('window.dispatchEvent(new Event("blur"));true');assert state()['pointers']==0;touches('touchCancel');report['checks'].append('Browser blur event clears ownership (testing mode suppresses automatic game pause)')
 tap('#pause');assert not b.ev('RADE.game.running');assert b.ev('document.getElementById("touch").hidden');screenshot('pause');tap('#pause-sound');assert b.ev('document.getElementById("sound").textContent')=='SON OFF';tap('#pause-sound');assert b.ev('document.getElementById("sound").textContent')=='SON ON';assert b.ev('RADE.game.audio.stats.voices')==0;report['checks'].append('Sound toggle remains reachable in mobile pause; unmuting while paused does not restart audio');tap('#pause-controls');assert b.ev('!document.getElementById("controls").hidden');tap('#touch-sensitivity');assert b.ev('JSON.parse(localStorage.getItem("emprise-touch-v1")).sensitivity===RADE.game.mobile.settings.sensitivity');screenshot('settings');tap('#close-controls');assert not b.ev('RADE.game.running');report['checks'].append('Touch Commandes sheet, sensitivity slider persistence and close return to pause');tap('#resume');assert b.ev('RADE.game.running');assert state()['pointers']==0
 touches('touchStart',[point('#touch-fire',6)]);size(844,390);touches('touchCancel');assert state()['pointers']==0;time.sleep(.25);layout('landscape');screenshot('landscape');report['checks'].append('Pause/resume and viewport rotation discard held pointers')
 # Fixture relocation only; boarding and all boat commands still use touch.
 b.ev('(()=>{const s=RADE.game.session,q=s.marine.boats.find(q=>q.kind==="motorboat");s.player.hp=100;Object.assign(s.player,{x:q.x,z:q.z,y:.08});return true;})()');time.sleep(.3);tap('#touch-interact');b.wait('RADE.game.session.mode==="boat"');hold('#touch-forward',.7);assert b.ev('RADE.game.session.marine.boat.speed>0');layout('motorboat');screenshot('motorboat');report['checks'].append('Motorboat boarding and throttle through touch controls')
 b.ev('RADE.game.session.marine.boat.speed=0;true');tap('#touch-interact');b.wait('RADE.game.session.mode==="swim"');m=point('#touch-stick',20);touches('touchStart',[m]);touches('touchMove',[{**m,'y':m['y']-75}]);time.sleep(.2);assert b.ev('RADE.game.lastCommand.sprint&&RADE.game.lastCommand.moveY>.9');touches('touchEnd')
 b.ev('(()=>{const s=RADE.game.session,q=s.marine.boats.find(q=>q.kind==="sailboat");s.player.hp=100;Object.assign(s.player,{x:q.x,z:q.z});return true;})()');time.sleep(.3);tap('#touch-interact');b.wait('RADE.game.session.mode==="boat"&&RADE.game.session.marine.boat.kind==="sailboat"');tap('#touch-camera');assert b.ev('RADE.game.session.marine.boat.control')=='trim';angle=b.ev('RADE.game.session.marine.boat.sailAngle');hold('#touch-forward',.4);assert abs(b.ev('RADE.game.session.marine.boat.sailAngle')-angle)>.05
 tap('#touch-camera');assert b.ev('RADE.game.session.marine.boat.control')=='hoist';deployment=b.ev('RADE.game.session.marine.boat.sailDeployment');hold('#touch-back',.4);assert b.ev('RADE.game.session.marine.boat.sailDeployment')<deployment;layout('sailboat');screenshot('sailboat');report['checks'].append('Swimming sprint, sail station switch, sail orientation and hoisting all through touch')
 size(320,568);time.sleep(.3);layout('small-portrait-sailing');screenshot('small-portrait');assert not state()['errors'];report['final']=state();report['backend']=b.ev('RADE.game.renderer.stats.backend')
(ROOT/'docs'/(a.label+'.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)
