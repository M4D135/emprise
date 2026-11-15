#!/usr/bin/env python3
"""GPU shadow regression: real Marseille ON/OFF and isolated procedural receivers.
Run sequentially after Chrome is released; --label before records the old build,
--label after also asserts clean receivers while a genuine occluder still casts.
No shadow map is fabricated. All pixels come from FERRO's normal GPU passes.
"""
from browser_support import Browser,ROOT
import argparse,base64,hashlib,json,time
args=argparse.ArgumentParser();args.add_argument('--label',default='after',choices=['before','after']);label=args.parse_args().label
with Browser() as b:
 b.load();ev=b.ev;ev('RADE.game.start();RADE.game.pause();document.getElementById("paused").hidden=true;globalThis.s=RADE.game.session;s.weather.setHour(14);s.weather.force("soleil");true')
 captures=[]
 def capture(name):
  name='shadow-'+label+'-'+name+'.png';b.capture(name);captures.append(name)
 # Same static in-game view, with live geometry and procedural materials.
 for on in [True,False]:
  ev('RADE.game.graphics.shadows='+json.dumps(on)+';true');time.sleep(.3);capture('marseille-'+('on' if on else 'off'))
 ev('RADE.game.graphics.shadows=true;true')
 # A separate canvas isolates self-shadowing on one continuous receiver. It uses
 # the same FRender factory and shaders as the game, not an edited test shader.
 ev('''globalThis.shadowCanvas=document.createElement('canvas');shadowCanvas.width=640;shadowCanvas.height=480;shadowCanvas.style.cssText='position:fixed;left:0;top:0;width:640px;height:480px;z-index:100';document.body.append(shadowCanvas);globalThis.sr=FRender.create(shadowCanvas,{vignette:1});globalThis.shadowEnv={sunDirection:[.6,.5,.6],sunColor:[1.8,1.7,1.5],ambient:[.2,.2,.2],skyTop:[.2,.3,.4],skyBottom:[.4,.5,.6],fog:[.4,.5,.6],fogDensity:.0001,wind:0,outdoorZones:[{x:0,z:0,w:1000,d:1000}]};globalThis.shadowFixtures={wall:{meshes:[{shape:'box',p:[0,10,0],s:[40,30,.2],color:[.65,.6,.52],mat:0,outdoor:true}],camera:{pos:[0,10,18],yaw:0,pitch:0}},floor:{meshes:[{shape:'box',p:[0,-.1,0],s:[100,.2,100],color:[.55,.55,.55],mat:0,outdoor:true}],camera:{pos:[0,6,12],yaw:0,pitch:-Math.atan2(6,12)}},occluder:{meshes:[{shape:'box',p:[0,-.1,0],s:[100,.2,100],color:[.55,.55,.55],mat:0,outdoor:true},{shape:'box',p:[0,2,0],s:[3,4,3],color:[.6,.5,.4],mat:0,outdoor:true}],camera:{pos:[10,10,15],yaw:Math.atan2(-10,15),pitch:-Math.atan2(10,Math.hypot(10,15))}}};
 globalThis.shadowFrame=(name,on,full,shift=0,time=0)=>{const f=shadowFixtures[name],cam={...f.camera,pos:f.camera.pos.map((v,i)=>v+(i===0?shift:0)),near:.035,far:500,fov:60,allStatic:true,sun:{center:[shift,5,0],extent:110,depth:150}};sr.setWorld(f.meshes,[],shadowEnv);sr.draw(cam,[],{time,shadows:on,sunOnly:full,torch:false,bloom:false,reflections:false,adaptive:false});const gl=sr.gl,px=new Uint8Array(shadowCanvas.width*shadowCanvas.height*4);gl.readPixels(0,0,shadowCanvas.width,shadowCanvas.height,gl.RGBA,gl.UNSIGNED_BYTE,px);return px;};
 globalThis.shadowPair=(name,full,shift=0)=>{const off=shadowFrame(name,false,full,shift),on=shadowFrame(name,true,full,shift),later=shadowFrame(name,true,full,shift,0);let samples=0,dark=0,delta=0,max=0,changed=0;const w=shadowCanvas.width,h=shadowCanvas.height;for(let y=Math.floor(h*.35);y<h*.65;y++)for(let x=Math.floor(w*.3);x<w*.7;x++){const k=(y*w+x)*4;for(let i=0;i<3;i++){const d=off[k+i]-on[k+i];max=Math.max(max,Math.abs(d));delta+=Math.abs(d);if(d>2)dark++;if(later[k+i]!==on[k+i])changed++;samples++;}}return {name,full,shift,samples,dark,meanDifference:delta/samples,maxDifference:max,stationaryChanged:changed,stats:{...sr.stats},error:sr.gl.getError()};};true''')
 results=[]
 for name in ['wall','floor']:
  for full in [True,False]:
   for shift in [0,.003,.25]:
    result=ev('shadowPair('+json.dumps(name)+','+json.dumps(full)+','+str(shift)+')');results.append(result)
    if shift==0:
     data=ev('shadowFrame('+json.dumps(name)+',true,'+json.dumps(full)+');shadowCanvas.toDataURL("image/png")');namepng='shadow-'+label+'-'+name+'-'+('full' if full else 'tile')+'.png';(ROOT/'docs'/namepng).write_bytes(base64.b64decode(data.split(',')[1]));captures.append(namepng)
 occluder=ev('shadowPair("occluder",true)')
 # Capture movement in the actual game after removing the isolated fixture.
 ev('sr.dispose();shadowCanvas.remove();const p=s.player;RADE.game.camera={pos:[p.x+.25,p.y+1.62,p.z],yaw:p.yaw,pitch:p.pitch,roll:0,fov:75};true');time.sleep(.3);capture('marseille-moved')
 errors=ev('RADE.game.errors');assert not errors,errors
 report={'label':label,'fixtures':'Fixed sun/time, isolated procedural wall/floor and original Marseille view. Camera translations 0, 0.003 and 0.25 m. Receiver images compare actual GPU shadows ON/OFF.','results':results,'occluder':occluder,'captures':captures,'errors':errors,'buildSha256':hashlib.sha256((ROOT/'dist/index.html').read_bytes()).hexdigest()}
 (ROOT/'docs'/('shadow-'+label+'.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)
 if label=='after':
  assert all(q['error']==0 and q['dark']==0 and q['maxDifference']<=1 for q in results),results
  assert all(q['stationaryChanged']==0 for q in results),results
  assert occluder['dark']>100,'A real occluder must still cast its shadow'
