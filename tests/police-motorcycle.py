#!/usr/bin/env python3
from browser_support import Browser,ROOT
import time,json,hashlib
with Browser() as b:
 b.load();ev=b.ev;ev('RADE.game.start();true');time.sleep(.2)
 ev('''RADE.game.pause();document.getElementById('paused').hidden=true;document.getElementById('hud').hidden=true;globalThis.s=RADE.game.session;globalThis.v=s.world.fleet.find(v=>v.police&&v.model==='policebike');s.crowd.people.forEach(p=>p.hp=0);s.crowd.update(0);s.sim.state.enemies.forEach(e=>e.deployed=false);globalThis.base=s.world.freeNear(61.5,189,3);s.world.fleet.forEach(c=>{if(c!==v){c.x=450;c.z=-450;}});v.x=base[0];v.z=base[1];v.cap=Math.PI/2;v.y=.08;v.braquage=0;v.roulis=0;v.ai=true;v.driver.inside=true;v.driver.hp=100;v.siren=true;v.condition=null;s.sim.relocate(base[0],base[1]+5,0);true''')
 for name,pos,yaw,pitch in [('front',[0,1.35,3.3],0,-.05),('rear',[0,1.35,-3.3],3.141592653589793,-.05),('three-quarter',[2.5,1.45,2.5],-.7853981633974483,-.10)]:
  ev('RADE.game.camera={pos:[base[0]+'+str(pos[0])+','+str(pos[1])+',base[1]+'+str(pos[2])+'],yaw:'+str(yaw)+',pitch:'+str(pitch)+',fov:52,near:.035,far:6000,chunked:true,sun:{center:[base[0],0,base[1]],extent:110,depth:150}};true');time.sleep(.25);b.capture('police-motorcycle-'+name+'.png')
 ev('v.driver.inside=false;v.ai=true;true');time.sleep(.2);b.capture('police-motorcycle-empty.png')
 assert not ev('RADE.game.errors')
 data={'checks':['Prepared RT police motorcycle: front, rear and three-quarter with actual officer seated','Driver outside while AI flag remains true: empty seat','WebGL2 rendering without JavaScript errors'],'fixture':'Static visual placements; police pursuit and arrests tested separately','buildSha256':hashlib.sha256((ROOT/'dist/index.html').read_bytes()).hexdigest(),'errors':ev('RADE.game.errors')};(ROOT/'docs/police-motorcycle-browser.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');print(json.dumps(data,ensure_ascii=False,indent=2),flush=True)
