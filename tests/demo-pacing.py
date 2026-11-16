#!/usr/bin/env python3
"""Measure the actual automatic demo, including its startup and streamed geometry. No port.

CPU sampling is optional and should not be compared with unprofiled runs.
"""
import sys,json,time,pathlib,argparse
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tests'))
from browser_support import Browser
p=argparse.ArgumentParser();p.add_argument('--label',required=True);p.add_argument('--html',type=pathlib.Path,default=ROOT/'dist/index.html');p.add_argument('--backend',default='auto');p.add_argument('--seconds',type=int,default=25);p.add_argument('--profile',action='store_true');a=p.parse_args()
folder=ROOT/'docs'
assert a.seconds>=8,'Measure at least three seconds after the ordinary five-second title timeout'
with Browser() as b:
 b.cmd('Emulation.setDeviceMetricsOverride',{'width':1710,'height':1000,'deviceScaleFactor':2,'mobile':False})
 b.cmd('Page.addScriptToEvaluateOnNewDocument',{'source':'''(()=>{const raf=requestAnimationFrame;window.probe={rows:[],enabled:false,last:0,lastStart:0};window.requestAnimationFrame=function(f){return raf.call(window,function(t){if(f.name!=='frame')return f(t);const p=probe,start=performance.now();try{return f(t);}finally{if(p.enabled)p.rows.push([t-p.last,performance.now()-start,RADE.game.demo&&RADE.game.running&&RADE.game.ready!==false,RADE.game.session?.time??null,RADE.game.drawCount,p.lastStart?start-p.lastStart:0]);p.last=t;p.lastStart=start;}})};})()'''})
 b.cmd('Page.navigate',{'url':a.html.resolve().as_uri()+'?renderer='+a.backend});b.cmd('Page.bringToFront')
 b.wait('globalThis.RADE?.game?.ready && !RADE.game.transition',90)
 print('READY',a.label,a.backend,json.dumps(b.ev('RADE.game.metrics()')),flush=True)
 b.ev('probe.enabled=true;RADE.game.renderer?.setProfiling?.(true);true')
 if a.profile:b.cmd('Profiler.enable');b.cmd('Profiler.setSamplingInterval',{'interval':1000});b.cmd('Profiler.start')
 time.sleep(a.seconds)
 b.ev('probe.enabled=false;true')
 b.wait('RADE.game.ready!==false && !!RADE.game.renderer && !!RADE.game.session',45)
 if a.profile:(folder/('demo-'+a.label+'-'+a.backend+'.cpuprofile')).write_text(json.dumps(b.cmd('Profiler.stop')['profile']))
 data=b.ev('({rows:probe.rows,metrics:RADE.game.metrics(),gpu:RADE.game.renderer?.getProfiling?.(),errors:RADE.game.errors,backendEvents:RADE.game.backendEvents,heap:performance.memory?.usedJSHeapSize,demolabel:document.getElementById("attract-label").textContent})')
 b.ev('probe.enabled=false;true')
 data['heapUsage']=b.cmd('Runtime.getHeapUsage')
 data['protocol']={'htmlSha256':__import__('hashlib').sha256(a.html.read_bytes()).hexdigest(),'viewport':[1710,1000],'dpr':2,'seconds':a.seconds,'profiled':a.profile,'notes':['Ordinary title and automatic demos; isolated fresh browser profile.','No simulation, population, geometry or quality overrides; loading transitions are excluded from active-demo summaries.','Rows contain RAF timestamp delta, CPU callback duration, active demo flag, simulation time, draw count, and actual callback start interval. Queued RAF timestamps can predate completion of loading; callback intervals are measured with performance.now. Physical presentation is not measured.']}
 assert data['rows'] and any(r[2] for r in data['rows']) and not data['errors'] and not data['backendEvents']
 (folder/('demo-'+a.label+'-'+a.backend+'.json')).write_text(json.dumps(data))
 def stats(v):
  v=sorted(v);n=len(v)
  return dict(n=n,mean=sum(v)/max(1,n),p50=v[int(n*.5)] if n else None,p95=v[int(n*.95)] if n else None,max=max(v,default=0))
 print('RESULT',json.dumps({'label':a.label,'backend':data['metrics']['renderer']['backend'],'cpu':stats([r[1] for r in data['rows'] if r[2]]),'raf':stats([r[0] for r in data['rows'] if r[2]]),'callback':stats([r[5] for i,r in enumerate(data['rows']) if i and r[2] and data['rows'][i-1][2]]),'gpu':stats((data.get('gpu') or {}).get('samples',[])),'metrics':data['metrics'],'heap':data['heap'],'errors':data['errors'],'backendEvents':data['backendEvents']}),flush=True)
