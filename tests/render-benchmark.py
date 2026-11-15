#!/usr/bin/env python3
"""Same frozen scenes, resolution and effects. Real frame/CPU/GPU measurements."""
from browser_support import Browser,ROOT
from pathlib import Path
import argparse,json,hashlib,time

p=argparse.ArgumentParser();p.add_argument('--backend',choices=['webgl2','webgpu'],default='webgl2');p.add_argument('--label',required=True);p.add_argument('--html',type=Path,default=ROOT/'dist/index.html');p.add_argument('--frames',type=int,default=240);p.add_argument('--trials',type=int,default=3);p.add_argument('--scenes',nargs='+',default=['port-day','port-night','port-rain','bonne-mere','shop']);a=p.parse_args()
source=(ROOT/'tests/render-benchmark-scenes.js').read_text();html=a.html.resolve();report={'label':a.label,'backendRequested':a.backend,'buildSha256':hashlib.sha256(html.read_bytes()).hexdigest(),'fixtureSha256':hashlib.sha256(source.encode()).hexdigest(),'viewportCSS':[1440,900],'devicePixelRatio':1,'simulation':'frozen at identical tick; actual game model construction and render loop retained','scenes':[]}
path=ROOT/'docs'/('render-benchmark-'+a.label+'.json')
for scene in a.scenes:
 print('START '+a.label+' '+scene,flush=True)
 with Browser() as b:
  b.cmd('Page.navigate',{'url':html.as_uri()+'?test=1&renderer='+a.backend});b.cmd('Page.bringToFront');b.wait('globalThis.RADE?.game?.drawCount>2',90);b.ev('RADE.game.testing=true;true');b.ev(source)
  record=b.ev('prepareRenderBenchmark('+json.dumps(scene)+')');assert record['backend']==a.backend,record
  record['trials']=[]
  for trial in range(a.trials):
   result=b.ev('renderBenchmark.run('+str(a.frames)+')');assert not result['errors'],result['errors'];assert result['resolution']==[1440,900],result['resolution'];result['nativeProfiler']=b.ev('(()=>{const p=RADE.game.renderer.getProfiling?.();return p?{available:p.available,dropped:p.dropped,samples:p.samples.length}:null;})()');record['trials'].append(result)
   print(json.dumps({'scene':scene,'trial':trial,'frameP95':result['frames']['p95'],'cpuP95':result['renderCPU']['p95'],'gpuP95':result['gpu']['p95']}),flush=True)
  b.capture('render-'+a.label+'-'+scene+'.png');report['scenes'].append(record);path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('PASS '+str(path),flush=True)
