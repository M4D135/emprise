#!/usr/bin/env python3
from browser_support import Browser,ROOT
import time,json,hashlib
with Browser() as b:
 b.load();ev=b.ev;ev('RADE.game.start();true');time.sleep(.2)
 ev('''RADE.game.pause();document.getElementById('paused').hidden=true;document.getElementById('hud').hidden=true;globalThis.s=RADE.game.session;globalThis.base=s.world.freeNear(61.5,189,3);globalThis.vehicles=['tmax','bike','scooter'].map(model=>s.world.fleet.find(v=>v.model===model));s.world.fleet.forEach(v=>{if(!vehicles.includes(v)){v.x=450;v.z=-450;}});vehicles.forEach((v,i)=>{v.x=base[0]+(i-1)*2;v.z=base[1];v.cap=Math.PI/2;v.ai=true;v.driver=v.driver||{id:14000+v.id,hp:100};v.driver.inside=true;v.moteur=true;v.volant=0;v.y=.08;v.condition=null;});s.sim.relocate(base[0],base[1]+6,0);true''')
 for name,pos,yaw,pitch in [('front',[0,1.25,5.5],0,0),('rear',[0,1.25,-5.5],3.141592653589793,0),('three-quarter',[4.2,1.7,4.2],-.7853981633974483,-.05)]:
  ev('RADE.game.camera={pos:[base[0]+'+str(pos[0])+','+str(pos[1])+',base[1]+'+str(pos[2])+'],yaw:'+str(yaw)+',pitch:'+str(pitch)+',fov:60,near:.035,far:6000,chunked:true,sun:{center:[base[0],0,base[1]],extent:110,depth:150}};true');time.sleep(.25);b.capture('quality-two-wheelers-'+name+'.png')
 for kind in ['tmax','bike','scooter']:
  ev('globalThis.v=vehicles.find(v=>v.model==='+json.dumps(kind)+');vehicles.forEach(v=>{v.ai=false;if(v.driver)v.driver.inside=false;});RADE.game.camera={pos:[v.x+2.5,1.2,v.z+1.5],yaw:-1.0303768265243125,pitch:-.06,fov:52,near:.035,far:6000,chunked:true,sun:{center:[v.x,0,v.z],extent:110,depth:150}};true');time.sleep(.25);b.capture('quality-'+kind+'-close.png')
 assert not ev('RADE.game.errors');data={'checks':['TMAX/vélo/trottinette: front, rear, three-quarter with rider','Three close-up parked model fixtures','WebGL2 shape compilation and no JavaScript errors'],'fixture':'Vehicles deliberately placed for visual review; dynamics tested separately','buildSha256':hashlib.sha256((ROOT/'dist/index.html').read_bytes()).hexdigest(),'errors':ev('RADE.game.errors')};(ROOT/'docs/vehicles-visual.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');print(json.dumps(data,ensure_ascii=False,indent=2),flush=True)
