#!/usr/bin/env python3
"""Active deterministic crowd/traffic/blast load, with optional separate CPU sampling profile."""
from browser_support import Browser,ROOT
from pathlib import Path
import argparse,json,hashlib,tempfile
p=argparse.ArgumentParser();p.add_argument('--html',type=Path,default=ROOT/'dist/index.html');p.add_argument('--label',required=True);p.add_argument('--backend',default='webgpu',choices=['webgpu','webgl2']);p.add_argument('--frames',type=int,default=600);p.add_argument('--profile',action='store_true');p.add_argument('--realtime',action='store_true');a=p.parse_args()
html=a.html.read_text();fixture=(ROOT/'tests/outdoor-stress-scenes.js').read_text()
hook="\n{const sc=RADE.session.create,tc=RADE.traffic.create;RADE.session.create=(o={})=>sc({...o,pedestrians:960,now:1794747600000});RADE.traffic.create=(w,o={})=>tc(w,{...o,count:36});}\n"
marker="(function(R){'use strict';\nlet canvas=document.getElementById('scene');"
assert html.count(marker)==1,'Game init marker changed'
with tempfile.TemporaryDirectory(prefix='emprise-outdoor-') as temp:
 target=Path(temp)/'index.html';target.write_text(html.replace(marker,hook+marker))
 with Browser() as b:
  b.cmd('Page.navigate',{'url':target.as_uri()+'?test=1&renderer='+a.backend});b.cmd('Page.bringToFront');b.wait('globalThis.RADE?.game?.drawCount>2',90);b.ev('RADE.game.testing=true;true');b.ev(fixture)
  identity=b.ev('(async()=>{globalThis.outdoorStress=await prepareOutdoorStress();return outdoorStress.identity;})()');print('READY',json.dumps(identity),flush=True)
  assert b.ev('RADE.game.renderer.stats.backend')==a.backend
  if a.profile:b.cmd('Profiler.enable');b.cmd('Profiler.setSamplingInterval',{'interval':1000});b.cmd('Profiler.start')
  report=b.ev('outdoorStress.run('+str(a.frames)+','+str(a.realtime).lower()+')')
  if a.profile:
   profile=b.cmd('Profiler.stop')['profile'];(ROOT/'docs'/('outdoor-'+a.label+'.cpuprofile')).write_text(json.dumps(profile)+'\n');b.cmd('Profiler.disable')
  b.ev('document.getElementById("paused").hidden=true;true');b.capture('outdoor-'+a.label+'.png')
report.update(label=a.label,buildSha256=hashlib.sha256(html.encode()).hexdigest(),fixtureSha256=hashlib.sha256((hook+fixture).encode()).hexdigest(),profiled=a.profile,protocol='960 pedestrians (360 positioned in legal quay cells), 36 civilian traffic requests plus 3 police, 3 real vehicle detonations. '+('Normal wall-clock accumulator, unmodified 1/120 simulation ticks.' if a.realtime else 'Two normal 1/120 simulation ticks per rendered frame, active AI and physics; same simulation work regardless of backend speed.')+' Graphics unchanged: 1440x900 DPR1 MSAA4 shadows SSR bloom. Signature sampled every60frames, outside separate render/simulation timers.')
(ROOT/'docs'/('outdoor-'+a.label+'.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
assert not report['errors'] and not report['renderer'].get('errorEvents') and not report['backendEvents'],report['errors']
assert (a.realtime or report['simulationTicks']==a.frames*2) and len(report['events'])==3
print(json.dumps({k:report[k] for k in ['label','measures','gpu','events']},indent=2),flush=True)
