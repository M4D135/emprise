#!/usr/bin/env python3
"""Far sea background must never overwrite opaque land; local water keeps depth.
Uses normal FERRO GPU rendering, near=.035/far=26000, distances150/5000 m.
A WEBGL_lose_context cycle verifies the independent background cache is restored.
"""
from browser_support import Browser,ROOT
import base64,hashlib,json,time
with Browser() as b:
 b.load();ev=b.ev;ev('RADE.game.start();RADE.game.pause();document.getElementById("paused").hidden=true;true')
 ev('''globalThis.wc=document.createElement('canvas');wc.width=640;wc.height=480;wc.style.cssText='position:fixed;left:0;top:0;width:640px;height:480px;z-index:100';document.body.append(wc);globalThis.wr=FRender.create(wc,{vignette:1});globalThis.we={sunDirection:[.6,.5,.6],sunColor:[1.8,1.7,1.5],ambient:[.2,.2,.2],skyTop:[.2,.3,.4],skyBottom:[.4,.5,.6],fog:[.4,.5,.6],fogDensity:.0001,wind:0,outdoorZones:[{x:0,z:0,w:40000,d:40000}]};globalThis.land={shape:'box',p:[0,.02,0],s:[12000,.12,12000],mat:0,color:[.65,.6,.52],outdoor:true};globalThis.sea={shape:'box',p:[0,-.22,0],s:[30000,.12,30000],mat:12,color:[.15,.31,.36],outdoor:true,backgroundWater:true};globalThis.wcam=null;globalThis.wfx={time:0,shadows:false,torch:false,sunOnly:true,bloom:false,reflections:false,adaptive:false};globalThis.wp=()=>{wr.draw(wcam,[],wfx);const gl=wr.gl,p=new Uint8Array(wc.width*wc.height*4);gl.readPixels(0,0,wc.width,wc.height,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;};globalThis.diff=(a,c)=>{let changed=0,max=0;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-c[i]);if(d)changed++;max=Math.max(max,d);}return {changed,max};};globalThis.waterCase=d=>{wcam={pos:[0,d,0],yaw:0,pitch:-Math.PI/2+.0001,near:.035,far:26000,fov:60,allStatic:true};wr.setWorld([land],[],we);const reference=wp(),baseline={...wr.stats};wr.setWorld([land,sea],[],we);const water=wp(),withSea={...wr.stats};wp();const cached={...wr.stats};globalThis.waterReference=reference;return {distance:d,diff:diff(reference,water),baseline,withSea,cached,depthWriteRestored:wr.gl.getParameter(wr.gl.DEPTH_WRITEMASK)};};true''')
 results=[];captures=[]
 for distance in [150,5000]:
  q=ev('waterCase('+str(distance)+')');results.append(q)
  data=ev('wp();wc.toDataURL("image/png")');name='water-depth-'+str(distance)+'.png';(ROOT/'docs'/name).write_bytes(base64.b64decode(data.split(',')[1]));captures.append(name)
  assert q['diff']['changed']==0 and q['withSea']['backgroundWater']==1,q
  assert q['withSea']['backgroundDrawCalls']==1 and q['withSea']['drawCalls']<=q['baseline']['drawCalls']+1,q
  assert q['cached']['uploadBytes']==0 and q['depthWriteRestored'],q
 # Local plans are still normal opaque receivers, not the separate backdrop.
 local=ev('wr.setWorld([land,{...sea,backgroundWater:false,p:[0,.4,0],s:[50,.12,50]}],[],we);wcam.pos=[0,20,0];wp();({background:wr.stats.backgroundWater,drawCalls:wr.stats.drawCalls,depthMask:wr.gl.getParameter(wr.gl.DEPTH_WRITEMASK)})');assert local['background']==0 and local['depthMask'],local
 ev('waterCase(5000);globalThis.loss=wr.gl.getExtension("WEBGL_lose_context");loss.loseContext();true');b.wait('wr.stats.contextLost',10);time.sleep(.2);ev('loss.restoreContext();true');b.wait('!wr.stats.contextLost',15)
 restored=ev('(()=>{const p=wp();return {diff:diff(waterReference,p),background:wr.stats.backgroundWater,draws:wr.stats.backgroundDrawCalls,error:wr.gl.getError()};})()');assert restored['diff']['changed']==0 and restored['background']==1 and restored['draws']==1 and restored['error']==0,restored
 # Removing/replacing the backdrop through a normal world update clears its cache.
 removed=ev('wr.updateWorld([land],3,[]);wp();({background:wr.stats.backgroundWater,draws:wr.stats.backgroundDrawCalls})');assert removed=={'background':0,'draws':0},removed
 ev('wr.dispose();wc.remove();true')
 errors=ev('RADE.game.errors');assert not errors,errors
 report={'checks':['Opaque land exactly matches no-sea control at150m and5000m with near.035/far26000','One background draw, zero repeated instance uploads, depth write state restored','Unmarked local water remains in opaque path','WebGL context loss/restoration retains background and exact image','World revision can remove background cleanly'],'results':results,'local':local,'restored':restored,'removed':removed,'captures':captures,'errors':errors,'buildSha256':hashlib.sha256((ROOT/'dist/index.html').read_bytes()).hexdigest(),'limitation':'Background sea has procedural sky reflections but no depth-based SSR; local water keeps its normal depth/SSR path.'}
 (ROOT/'docs/water-depth-browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)
