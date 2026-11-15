#!/usr/bin/env python3
"""Deterministic visual fixtures in the actual renderer, without imported assets."""
from browser_support import Browser,ROOT
import time,json,hashlib
with Browser() as b:
 b.load();ev=b.ev;ev('RADE.game.start();true');time.sleep(.4)
 ev('''RADE.game.pause();document.getElementById('paused').hidden=true;document.getElementById('hud').hidden=true;globalThis.s=RADE.game.session;globalThis.q=s.world.freeNear(52,150,3.4);
 globalThis.actors=[10000,10002,10005].map((id,i)=>({id,x:q[0]+(i-1)*1.35,z:q[1],baseY:.08,hp:100,yaw:Math.PI,civil:true,moveSpeed:0,walkDistance:0}));s.world.boundaryOfficers=actors;
 s.sim.relocate(q[0],q[1]+4,0);RADE.game.camera={pos:[q[0],1.10,q[1]+4.4],yaw:0,pitch:0,fov:52,near:.035,far:6000,chunked:true,sun:{center:[q[0],0,q[1]],extent:110,depth:150}};true''');time.sleep(.3);b.capture('quality-people-front.png')
 ev('actors.forEach(e=>e.yaw=Math.PI/2);true');time.sleep(.2);b.capture('quality-people-profile.png')
 ev('actors.forEach((e,i)=>{e.yaw=Math.PI;e.moveSpeed=1.2;e.walkDistance=.2+i*.25;});true');time.sleep(.2);b.capture('quality-people-walk.png')
 ev('actors.forEach((e,i)=>{e.moveSpeed=0;e.seated=true;e.baseY=.08-.44*RADE.human.appearance(e.id).heightScale;});true');time.sleep(.2);b.capture('quality-people-seated.png')
 ev('''s.world.boundaryOfficers=[];RADE.game.camera={pos:[79,1.7,130],yaw:-.35,pitch:.12,fov:70,near:.035,far:6000,chunked:true,sun:{center:[65,0,98],extent:110,depth:150}};true''');time.sleep(.2);b.capture('quality-street.png')
 ev('RADE.game.camera=null;RADE.game.start();true');time.sleep(.2);b.capture('quality-fps.png')
 assert not ev('RADE.game.errors');report={'checks':['WebGL2 compile: shared CPU/GPU human gait','Three procedural identities: front/profile/walk/seated fixtures','Procedural trees and façades in actual city','Compact first-person weapon assembly'], 'fixture':'Actors and camera deliberately placed for visual inspection; not an end-to-end gameplay route.', 'errors':ev('RADE.game.errors'),'buildSha256':hashlib.sha256((ROOT/'dist/index.html').read_bytes()).hexdigest()};(ROOT/'docs/visual-quality.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)
