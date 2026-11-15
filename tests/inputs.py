#!/usr/bin/env python3
"""Regression through Chromium keyboard/mouse events, never game.controller."""
import pathlib,sys,time,json,tempfile,base64
from chrome import Tube
root=pathlib.Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='rade-inputs-') as profile,tempfile.TemporaryFile(mode='w+') as journal:
 c=Tube('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--remote-debugging-pipe','--user-data-dir='+profile,'--no-first-run','--disable-background-networking','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--window-size=1440,1000','about:blank'],journal)
 try:
  target=c.envoyer('Target.createTarget',{'url':'about:blank'})['targetId'];sid=c.envoyer('Target.attachToTarget',{'targetId':target,'flatten':True})['sessionId']
  def cmd(m,p=None):return c.envoyer(m,p,sid)
  def ev(js):
   r=cmd('Runtime.evaluate',{'expression':js,'returnByValue':True,'awaitPromise':True,'userGesture':True});assert 'exceptionDetails' not in r,r;return r.get('result',{}).get('value')
  def key(code,down=True):cmd('Input.dispatchKeyEvent',{'type':'keyDown' if down else 'keyUp','key':code[3:].lower() if code.startswith('Key') else code,'code':code})
  def tap(code):key(code);time.sleep(.08);key(code,False)
  def mouse(down):cmd('Input.dispatchMouseEvent',{'type':'mousePressed' if down else 'mouseReleased','x':720,'y':450,'button':'left','clickCount':1})
  cmd('Page.enable');cmd('Runtime.enable');cmd('Emulation.setDeviceMetricsOverride',{'width':1440,'height':900,'deviceScaleFactor':1,'mobile':False});cmd('Page.navigate',{'url':(root/'dist/index.html').as_uri()+'?test=1'});cmd('Page.bringToFront')
  start=time.monotonic()
  while not ev('!!globalThis.RADE?.game'):
   assert time.monotonic()-start<30;time.sleep(.1)
  ev('RADE.game.testing=true;RADE.game.recorder?.start("Tir et conduite · clavier / souris réels");true')
  rect=ev('(()=>{const r=document.getElementById("start").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()')
  for event in ['mousePressed','mouseReleased']:cmd('Input.dispatchMouseEvent',{'type':event,**rect,'button':'left','clickCount':1})
  time.sleep(.4);assert ev('RADE.game.running')
  checks=[]
  for code in ['KeyZ','KeyW']:
   before=ev('({x:RADE.game.session.player.x,z:RADE.game.session.player.z})');key(code);time.sleep(.16);key(code,False);time.sleep(.2);after=ev('({x:RADE.game.session.player.x,z:RADE.game.session.player.z})');assert abs(after['x']-before['x'])+abs(after['z']-before['z'])>.2
  tap('KeyE');time.sleep(.25);assert ev('RADE.game.session.mode')=='car';assert ev('RADE.game.session.car.moteur')
  before=ev('({x:RADE.game.session.car.x,z:RADE.game.session.car.z})');key('KeyZ');time.sleep(1.4);key('KeyZ',False)
  drive=ev('({x:RADE.game.session.car.x,z:RADE.game.session.car.z,v:RADE.game.session.car.v})');assert drive['v']>2 and abs(drive['x']-before['x'])+abs(drive['z']-before['z'])>2,drive
  key('Space');time.sleep(1);key('Space',False);assert ev('RADE.game.session.car.v')<.2
  key('KeyS');time.sleep(.8);key('KeyS',False);reverse=ev('RADE.game.session.car.u');assert reverse<-.5
  key('Space');time.sleep(.8);key('Space',False);tap('KeyE');time.sleep(.2);assert ev('RADE.game.session.mode')=='foot';checks.append({'driving':drive,'reverse':reverse});print('AZERTY/WASD, enter, drive, brake, reverse, exit: passed',flush=True)
  mouse(True);time.sleep(.06);mouse(False);time.sleep(1.3)
  one=ev('({shots:RADE.game.session.sim.state.shots,queue:RADE.game.session.sim.state.events.length,events:RADE.game.session.events.filter(e=>e.name==="shot").length,voices:RADE.game.audio.stats.voices,gunVoices:RADE.game.audio.stats.activeCues.shot||0,kick:RADE.game.motion.view.weapon.slide})')
  assert one['shots']==1,one;assert one['queue']==0 and one['events']==0 and one['gunVoices']==0 and one['kick']<.001,one;checks.append({'singleShotAndRelease':one});print('single shot: quiet after release',flush=True)
  mouse(True);time.sleep(1.1);mouse(False);time.sleep(2)
  shots=ev('RADE.game.session.sim.state.shots');assert shots>=6;time.sleep(.4);assert ev('RADE.game.session.sim.state.shots')==shots;assert ev('RADE.game.audio.stats.activeCues.shot||0')==0;checks.append({'burstShots':shots});print('burst and release: passed',flush=True)
  yaw=ev('RADE.game.session.player.yaw');dragFallback=ev('document.pointerLockElement===null');cmd('Input.dispatchMouseEvent',{'type':'mouseMoved','x':720,'y':450});
  if dragFallback:mouse(True)
  cmd('Input.dispatchMouseEvent',{'type':'mouseMoved','x':780,'y':470});time.sleep(.2)
  if dragFallback:mouse(False)
  assert abs(ev('RADE.game.session.player.yaw')-yaw)>.01,{'dragFallback':dragFallback,'yaw':yaw,'after':ev('RADE.game.session.player.yaw')};checks.append({'mouseDragFallbackUsed':dragFallback})
  mouse(True);time.sleep(.2);mouse(False);time.sleep(1);assert ev('RADE.game.audio.stats.activeCues.shot||0')==0
  tap('KeyP');assert not ev('RADE.game.running');assert ev('RADE.game.audio.stats.voices')==0;checks.append({'mouseAfterExit':True,'pauseSilencesAudio':True})
  tape=ev('RADE.game.recorder?.stop()');
  if tape:
   tape['source']='tests/inputs.py / événements Chromium clavier et souris';tape['expected']=ev('({shots:RADE.game.session.sim.state.shots,mode:RADE.game.session.mode,player:[RADE.game.session.player.x,RADE.game.session.player.z],car:[RADE.game.session.car.x,RADE.game.session.car.z],cash:RADE.game.session.campaign.state.cash})')
   (root/'docs/input-recording.json').write_text(json.dumps(tape,separators=(',',':'))+'\n')
  errors=ev('RADE.game.errors');assert not errors,errors
  report={'date':'2026-11-15','checks':checks,'errors':errors};(root/'docs/input-regression.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2),flush=True)
 finally:c.fermer()
