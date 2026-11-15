#!/usr/bin/env python3
"""Ten second scenic frame/CPU/GPU probe after city streaming settles."""
from browser_support import Browser,ROOT
import time,json,hashlib
with Browser() as b:
 b.load();ev=b.ev;ev('RADE.game.start();globalThis.s=RADE.game.session;globalThis.w=s.world;s.sim.state.enemies.forEach(e=>e.deployed=false);s.campaign.law.wanted=0;true')
 # Ten seconds after all streamed construction finishes, using the agreed scenic view.
 ev('globalThis.lm=w.landmarks;const free=w.freeNear(lm.center.x+130,lm.center.z-110,.34);s.sim.relocate(free[0],free[1],0);s.campaign.law.wanted=0;s.weather.setHour(23);globalThis.camPos=[lm.center.x+130,lm.groundLevel+49,lm.center.z-110];const target=[lm.center.x-6,lm.groundLevel+29,lm.center.z],d=target.map((v,i)=>v-camPos[i]);RADE.game.camera={pos:camPos,yaw:Math.atan2(d[0],-d[2]),pitch:Math.atan2(d[1],Math.hypot(d[0],d[2])),fov:62,near:.035,far:26000,allStatic:true,chunked:true};true');time.sleep(.25);b.wait('!w.cityStream.pending',90);time.sleep(.5)
 b.capture('road-debug-baseline.png')
 ev('RADE.game.graphics.shadows=false;true');time.sleep(.5);b.capture('road-debug-no-shadows.png')
 ev('RADE.game.camera={pos:camPos,yaw:Math.atan2((lm.center.x-6)-camPos[0],camPos[2]-lm.center.z),pitch:Math.atan2((lm.groundLevel+29)-camPos[1],Math.hypot((lm.center.x-6)-camPos[0],lm.center.z-camPos[2])),fov:62,near:1,far:26000,allStatic:true,chunked:true};true');time.sleep(.5);b.capture('road-debug-near1.png')
 print(ev('({errors:RADE.game.errors,near:RADE.game.camera?.near})'),flush=True)
