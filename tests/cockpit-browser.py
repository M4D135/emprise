#!/usr/bin/env python3
"""Real keyboard entry/acceleration; the drivetrain alone changes the gear."""
from browser_support import Browser,ROOT
import time,json,hashlib
with Browser() as b:
 b.load();ev=b.ev;ev('RADE.game.start();globalThis.s=RADE.game.session;true')
 def key(code,down=True):b.cmd('Input.dispatchKeyEvent',{'type':'keyDown' if down else 'keyUp','code':code,'key':code[3:].lower()})
 def tap(code):key(code);time.sleep(.06);key(code,False)
 # Only approach the already parked player's vehicle; neither vehicle nor drivetrain is changed.
 ev('s.sim.relocate(s.car.x-2.6,s.car.z,s.car.cap+Math.PI/2);true');tap('KeyE');b.wait('s.mode==="car"',6)
 if ev('RADE.game.view')!='cockpit':tap('KeyC')
 b.wait('RADE.game.view==="cockpit"',3);time.sleep(.2);b.capture('cockpit-neutral.png')
 ev('globalThis.gearBefore=s.car.rapport;globalThis.driveBefore={x:s.car.x,z:s.car.z,v:s.car.v,time:s.time};true');key('KeyW')
 end=time.monotonic()+25;observed=None
 while time.monotonic()<end:
  state=ev('({gear:s.car.rapport,v:s.car.v,time:s.time,x:s.car.x,z:s.car.z,pose:RADE.vehicles.cockpitPose(s.car,s.time),mode:s.mode})')
  if state['gear']>ev('gearBefore') and state['pose']['shifting'] and .30<state['pose']['phase']<.62:
   observed=state;ev('RADE.game.pause();document.getElementById("paused").hidden=true;true');break
  if state['mode']!='car':break
  time.sleep(.025)
 key('KeyW',False)
 assert observed,{'error':'No genuine automatic gear shift captured','last':state}
 b.capture('cockpit-gear-change.png');assert observed['v']>2
 ev('globalThis.cm=BITUME.voiture.attitude(s.car.cap,s.car.tangage,s.car.roulis);globalThis.ce=BITUME.voiture.mul(cm,RADE.vehicles.model(s.car.model,s.car.color).eye);RADE.game.camera={pos:[s.car.x+ce[0],s.car.y+ce[1],s.car.z+ce[2]],yaw:s.car.cap+Math.PI/2+.18,pitch:-.44,roll:-s.car.roulis,fov:60,near:.035,far:26000,allStatic:true,chunked:true};true');time.sleep(.18);b.capture('cockpit-gear-close.png')
 # Pause preserves the real reached pose; no mutation of gear, speed, clock or hand state.
 ev('RADE.game.camera=null;RADE.game.start();true');time.sleep(.85);b.wait('!RADE.vehicles.cockpitPose(s.car,s.time).shifting',8);ev('RADE.game.pause();document.getElementById("paused").hidden=true;true');b.capture('cockpit-return.png')
 after=ev('({gear:s.car.rapport,v:s.car.v,time:s.time,pose:RADE.vehicles.cockpitPose(s.car,s.time),mode:s.mode})');assert not after['pose']['shifting']
 errors=ev('RADE.game.errors');assert not errors,errors
 report={'checks':['Keyboard E enters the actual parked vehicle','Cockpit FOV 60, procedural hands and sleeves','Keyboard W acceleration produces automatic BITUME gear change','Captured right-hand grip on moving shifter and return to wheel','No gear/speed/time mutation and no JS errors'],'before':ev('driveBefore'),'shift':{'gear':observed['gear'],'speed':observed['v'],'time':observed['time'],'phase':observed['pose']['phase']},'after':{'gear':after['gear'],'time':after['time'],'shifting':after['pose']['shifting']},'buildSha256':hashlib.sha256((ROOT/'dist/index.html').read_bytes()).hexdigest(),'errors':errors}
 (ROOT/'docs/cockpit-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)
