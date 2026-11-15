#!/usr/bin/env python3
"""Real native view of the corrected procedural 205 trim, with shadows on/off."""
import hashlib,json,math
from browser_support import Browser,ROOT
report={'buildSha256':hashlib.sha256((ROOT/'dist/index.html').read_bytes()).hexdigest(),'checks':['Native WebGPU, frozen port-day at the reported 122-degree view','205 C-pillar trim with actual shadows enabled and disabled','One-degree view change with shadows disabled; no renderer depth bias changed','R5 geometric identity checked separately by node tests/vehicle-trim.mjs'],'captures':[]}
with Browser() as b:
 b.load('?test=1&renderer=webgpu');b.ev((ROOT/'tests/render-benchmark-scenes.js').read_text());b.ev('prepareRenderBenchmark("port-day")')
 b.ev('''globalThis.baseYaw=122*Math.PI/180;globalThis.trimCamera={pos:[74.5,1.7,130],yaw:baseYaw,pitch:.04,fov:74,near:.15,overlayNear:.035,far:26000,allStatic:true,chunked:true,sun:{center:[74.5+Math.sin(baseYaw)*25,.08,130-Math.cos(baseYaw)*25],extent:110,depth:150}};RADE.game.camera=trimCamera;true''')
 for label,on,turn in [('on',True,0),('off',False,0),('turn',False,math.pi/180)]:
  b.ev('RADE.game.graphics.shadows='+json.dumps(on)+';trimCamera.yaw=baseYaw+'+str(turn)+';true');b.ev('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');filename='vehicle-trim-after-'+label+'.png';b.capture(filename);report['captures'].append(filename)
 report.update(b.ev('({backend:RADE.game.renderer.stats.backend,stats:RADE.game.renderer.stats,errors:RADE.game.errors})'))
 assert report['backend']=='webgpu';assert not report['errors'];assert not report['stats'].get('errorEvents')
(ROOT/'docs/vehicle-trim-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False),flush=True)
