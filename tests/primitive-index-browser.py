"""Compare native primitive indexing on identical, paused scene state."""
from browser_support import Browser,ROOT
from pathlib import Path
import argparse,json,hashlib

p=argparse.ArgumentParser();p.add_argument('--html',type=Path,default=ROOT/'dist/index.html');a=p.parse_args()
captures=[]
with Browser() as b:
 b.cmd('Page.navigate',{'url':a.html.resolve().as_uri()+'?test=1&renderer=webgpu'});b.cmd('Page.bringToFront');b.wait('globalThis.RADE?.game?.drawCount>2',90)
 b.ev((ROOT/'tests/explosion-heavy-scenes.js').read_text())
 b.ev('(async()=>{globalThis.indexScene=await prepareOutdoorStress();return true;})()')
 report=b.ev('indexScene.run(360,false)')
 assert len(report['events'])==5 and not report['errors'] and not report['backendEvents']
 b.ev('document.getElementById("paused").hidden=true;true')
 assert b.ev('typeof RADE.game.renderer.setPrimitiveIndexing')=='function'
 frozen=b.ev('({time:RADE.game.session.time,revision:RADE.game.session.urban.revision})')
 for dpr in [1,2]:
  b.cmd('Emulation.setDeviceMetricsOverride',{'width':1440,'height':900,'deviceScaleFactor':dpr,'mobile':False})
  # Resizing the browser and resizing the GPU canvas are separate operations.
  # Let the paused renderer/compositor finish the DPR transition before the
  # three identical-state captures; this delay is not a timing measurement.
  b.ev('(async()=>{for(let i=0;i<12;i++)await new Promise(requestAnimationFrame);return true;})()')
  images=[];stats=[]
  for enabled,name in [(False,'expanded'),(True,'indexed'),(False,'repeat')]:
   assert b.ev('RADE.game.renderer.setPrimitiveIndexing('+str(enabled).lower()+')')==enabled
   b.ev('(async()=>{for(let i=0;i<3;i++)await new Promise(requestAnimationFrame);return true;})()')
   path=ROOT/'docs'/f'primitive-index-dpr{dpr}-{name}.png';b.capture(path.name);images.append(path)
   stats.append(b.ev('({enabled:RADE.game.renderer.stats.primitiveIndexing,width:RADE.game.renderer.stats.width,height:RADE.game.renderer.stats.height,triangles:RADE.game.renderer.stats.triangles,instances:RADE.game.renderer.stats.instances,drawCalls:RADE.game.renderer.stats.drawCalls})'))
   assert b.ev('({time:RADE.game.session.time,revision:RADE.game.session.urban.revision})')==frozen,'The comparison must not advance gameplay'
  encoded=[path.read_bytes() for path in images]
  assert encoded[0]==encoded[1]==encoded[2],'Primitive indexing changed the captured PNG'
  assert all({k:v for k,v in s.items() if k!='enabled'}=={k:v for k,v in stats[0].items() if k!='enabled'} for s in stats[1:]),'Draw/instance/triangle counts changed'
  captures.append({'dpr':dpr,'images':[p.name for p in images],'pngSha256':hashlib.sha256(encoded[0]).hexdigest(),'byteIdentical':True,'stats':stats})
 errors=b.ev('RADE.game.errors');backend=b.ev('RADE.game.backendEvents');assert not errors and not backend
result={'test':'PASS native primitive indexing, identical paused frames','buildSha256':hashlib.sha256(a.html.read_bytes()).hexdigest(),'scene':report['identity'],'events':report['events'],'frozen':frozen,'captures':captures,'errors':errors,'backendEvents':backend,'notes':['Same renderer, same scene state and animation time; only IBO contents are toggled.','DPR 2 retains the existing production pixel cap.','Pixel equality is separate from timing measurements and does not establish a speedup.']}
(ROOT/'docs/primitive-index-validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'test':result['test'],'captures':captures},indent=2))
