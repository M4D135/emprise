#!/usr/bin/env python3
"""Real WebGL2 frame pacing, autosave enabled, no sampling profiler or server."""
from browser_support import Browser, ROOT
import time,json,hashlib
with Browser() as b:
 b.cmd('Emulation.setDeviceMetricsOverride',{'width':1580,'height':920,'deviceScaleFactor':2,'mobile':False})
 b.load('');b.ev('RADE.game.start();true');time.sleep(3)
 b.ev('''globalThis.frameAudit={frames:[],longTasks:[]};RADE.game.samples.length=RADE.game.cpuSamples.length=0;
 globalThis.auditStart=performance.now();globalThis.auditPrevious=0;globalThis.auditOn=true;
 function audit(t){if(auditOn){if(auditPrevious)frameAudit.frames.push([t-auditStart,t-auditPrevious]);auditPrevious=t;requestAnimationFrame(audit)}}requestAnimationFrame(audit);
 globalThis.longObserver=new PerformanceObserver(l=>l.getEntries().forEach(e=>frameAudit.longTasks.push({time:e.startTime-auditStart,duration:e.duration})));longObserver.observe({type:'longtask'});true''')
 time.sleep(12)
 b.ev('RADE.game.controller=()=>({lookX:.0015});true');time.sleep(20)
 b.ev('RADE.game.controller=null;true');time.sleep(8)
 data=b.ev('({metrics:RADE.game.metrics(),audit:frameAudit,errors:RADE.game.errors,build:RADE.build,autosave:!!localStorage.getItem("rade-solo-v2")})')
 b.ev('auditOn=false;longObserver.disconnect();RADE.game.pause();true')
 frames=[x[1] for x in data['audit']['frames']];ordered=sorted(frames)
 data['pacing']={'frames':len(frames),'p50':ordered[len(ordered)//2],'p95':ordered[int(len(ordered)*.95)],'p99':ordered[int(len(ordered)*.99)],'max':max(frames),'over25':sum(v>25 for v in frames),'over50':sum(v>50 for v in frames),'over100':sum(v>100 for v in frames)}
 assert not data['errors'],data['errors'];assert data['autosave'];assert data['metrics']['renderer']['staticCulled']>0
 before=b.ev('RADE.game.renderer.stats.chunkBuildBytes');b.ev('RADE.game.start();true');time.sleep(.3)
 b.ev('RADE.game.pause();true');assert b.ev('RADE.game.renderer.stats.chunkBuildBytes')==before,'Static chunks must be retained between draws'
 b.ev('globalThis.loss=RADE.game.renderer.gl.getExtension("WEBGL_lose_context");loss.loseContext();true');time.sleep(.3);b.ev('loss.restoreContext();true');time.sleep(2)
 b.ev('RADE.game.start();true');b.wait('RADE.game.renderer.stats.visibleChunks>0');assert not b.ev('RADE.game.errors')
 data['checks']=['Culling caméra avec ombres séparées','Lots statiques conservés entre images','Autosauvegarde activée pendant 40 s','Restauration du contexte WebGL'];data['buildSha256']=hashlib.sha256((ROOT/'dist/index.html').read_bytes()).hexdigest()
 (ROOT/'docs/frame-pacing.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');b.capture('streaming-city.png');print(json.dumps({k:v for k,v in data.items() if k!='audit'},ensure_ascii=False,indent=2),flush=True)
