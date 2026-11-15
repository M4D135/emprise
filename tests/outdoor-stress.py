#!/usr/bin/env python3
"""Active deterministic crowd/traffic/blast load, with optional separate CPU sampling profile."""
from browser_support import Browser,ROOT
from pathlib import Path
import argparse,json,hashlib,tempfile,math
def describe(values):
 values=sorted(values);n=len(values)
 return {'n':n,**{name:values[min(n-1,math.floor(n*q))] if n else None for name,q in [('p50',.5),('p95',.95),('p99',.99)]},'max':values[-1] if n else None,'over25':sum(v>25 for v in values),'over50':sum(v>50 for v in values)}
p=argparse.ArgumentParser();p.add_argument('--html',type=Path,default=ROOT/'dist/index.html');p.add_argument('--label',required=True);p.add_argument('--backend',default='webgpu',choices=['webgpu','webgl2']);p.add_argument('--frames',type=int,default=600);p.add_argument('--fixture',type=Path,default=ROOT/'tests/outdoor-stress-scenes.js');p.add_argument('--expected-events',type=int,default=3);p.add_argument('--profile',action='store_true');p.add_argument('--realtime',action='store_true');p.add_argument('--production-save',action='store_true',help='Enable the ordinary production autosave path in an isolated browser profile; requires realtime and enough frames for two saves.');a=p.parse_args()
if a.production_save and not a.realtime:p.error('--production-save requires --realtime')
save_probe=r'''(()=>{
 const g=RADE.game,s=g.session,sessionSave=s.save,storageSave=RADE.storage.save,records=[];
 let phase='prewarm',serial=0,lastSnapshotId=0,windowStart=null;
 s.save=function(...args){const id=++serial,start=performance.now();let ok=false;try{const result=sessionSave.apply(this,args);ok=true;lastSnapshotId=id;return result;}finally{const ms=performance.now()-start;records.push({kind:'snapshot',id,phase,drawCount:g.drawCount,sessionTime:s.time,running:g.running,ms,ok});}};
 RADE.storage.save=function(value){const id=lastSnapshotId,start=performance.now();let ok=false;try{const result=storageSave.call(this,value);ok=result===true;return result;}finally{const ms=performance.now()-start;records.push({kind:'persist',id,phase,drawCount:g.drawCount,sessionTime:s.time,running:g.running,ms,ok});}};
 globalThis.outdoorSaveProbe={begin(){windowStart={drawCount:g.drawCount,sessionTime:s.time};phase='measured';return true;},finish(){phase='finished';s.save=sessionSave;RADE.storage.save=storageSave;
  const key='rade-solo-v2',stored=localStorage.getItem(key),loaded=RADE.storage.load();
  return {enabled:true,window:{start:windowStart,end:{drawCount:g.drawCount,sessionTime:s.time}},prewarm:records.filter(q=>q.phase==='prewarm'),measured:records.filter(q=>q.phase==='measured'&&q.running),afterMeasurement:records.filter(q=>q.phase==='measured'&&!q.running),persistence:{key,exists:stored!==null,bytes:stored===null?0:new TextEncoder().encode(stored).byteLength,loadOk:!!loaded&&loaded.version===2&&Number.isFinite(loaded.cash),version:loaded?.version??null,readBackMatchesString:!!loaded&&JSON.stringify(loaded)===stored},notes:['No test query parameter: the unmodified production game loop saves on its ordinary five-second clock. No save is manually triggered by the probe.','snapshot times session.save; persist times the original storage.save including JSON.stringify and synchronous localStorage.setItem. Probe bookkeeping and final byte counting are outside those timers.','Prewarm saves are separate. The fixture pause save has running=false and is excluded from measured autosave counts.','Persistence is read back through the existing storage.load; this checks serialized storage integrity, not a full new-session restore.','The existing fixture still controls HUD/audio and scene placement; production-save changes only the save path and timing instrumentation.']};
 }};return true;
})()'''
html=a.html.read_text();fixture=a.fixture.read_text()
hook="\n{const sc=RADE.session.create,tc=RADE.traffic.create;RADE.session.create=(o={})=>sc({...o,pedestrians:960,now:1794747600000});RADE.traffic.create=(w,o={})=>tc(w,{...o,count:36});}\n"
marker="(function(R){'use strict';\nlet canvas=document.getElementById('scene');"
assert html.count(marker)==1,'Game init marker changed'
with tempfile.TemporaryDirectory(prefix='emprise-outdoor-') as temp:
 target=Path(temp)/'index.html';target.write_text(html.replace(marker,hook+marker))
 with Browser() as b:
  b.cmd('Page.navigate',{'url':target.as_uri()+('?' if a.production_save else '?test=1&')+'renderer='+a.backend});b.cmd('Page.bringToFront');b.wait('globalThis.RADE?.game?.drawCount>2',90);b.ev('RADE.game.testing=true;true')
  if a.production_save:b.ev(save_probe)
  b.ev(fixture)
  identity=b.ev('(async()=>{globalThis.outdoorStress=await prepareOutdoorStress();return outdoorStress.identity;})()');print('READY',json.dumps(identity),flush=True)
  assert b.ev('RADE.game.renderer.stats.backend')==a.backend
  if a.profile:b.cmd('Profiler.enable');b.cmd('Profiler.setSamplingInterval',{'interval':1000});b.cmd('Profiler.start')
  if a.production_save:b.ev('outdoorSaveProbe.begin()')
  report=b.ev('outdoorStress.run('+str(a.frames)+','+str(a.realtime).lower()+')')
  if a.profile:
   profile=b.cmd('Profiler.stop')['profile'];(ROOT/'docs'/('outdoor-'+a.label+'.cpuprofile')).write_text(json.dumps(profile)+'\n');b.cmd('Profiler.disable')
  if a.production_save:
   saves=b.ev('outdoorSaveProbe.finish()');saves['measures']={phase:{kind:describe([q['ms'] for q in saves[phase] if q['kind']==kind]) for kind in ['snapshot','persist']} for phase in ['prewarm','measured','afterMeasurement']};report['productionSave']=saves
  # game.samples uses the browser's rAF timestamps, whereas the historic
  # fixture frame samples use performance.now() at renderer.draw entry.
  # Keep both: moving simulation before draw changes submission intervals
  # even when callback timestamps remain regular. Neither is presentation.
  raf_samples=b.ev('RADE.game.samples.slice()')
  report['measures'].setdefault('raf',describe(raf_samples))
  report['measures'].setdefault('drawSubmission',report['measures']['frame'].copy())
  report['timingDefinitions']={'frame':'Legacy alias of drawSubmission, retained for baseline compatibility.','drawSubmission':'Interval between CPU entries to renderer.draw, after simulation and model generation in realtime mode.','raf':'Delta between browser-supplied rAF timestamps from game.samples; may include boundary callbacks while GPU profiling starts/drains.','gpu':'GPU elapsed passes only; excludes queue wait, CPU uploads before submit, compositor and presentation.','presentation':'Not measured. Regular rAF timestamps do not prove regular GPU presentation.'}
  if 'pacing' in report:
   pacing=report['pacing'];fields=pacing['fields'];rows=pacing['rows']
   assert len(rows)==a.frames,(len(rows),a.frames)
   assert sum(row[fields.index('simulationTicks')] for row in rows)==report['simulationTicks']
   for field in ['rafInterval','preRenderCpu','renderCpu','postRenderCpu','callbackCpu']:
    assert all(isinstance(row[fields.index(field)],(int,float)) and math.isfinite(row[fields.index(field)]) and row[fields.index(field)]>=0 for row in rows),field
   # This is a difference of two independently exposed clocks, unlike the
   # same-clock CPU intervals above. Preserve signed sub-millisecond offsets
   # instead of clamping them or rejecting an otherwise valid measurement.
   # A larger negative offset remains an explicit instrumentation failure,
   # with its raw rows in the diagnostic; positive scheduling delays have no
   # upper bound and must not be discarded as inconvenient outliers.
   delay_index=fields.index('callbackDelay');delays=[row[delay_index] for row in rows]
   assert all(isinstance(value,(int,float)) and math.isfinite(value) for value in delays),'Non-finite callbackDelay'
   negative=[i for i,value in enumerate(delays) if value<0];anomalies=[i for i,value in enumerate(delays) if value < -1]
   pacing['clockAlignment']={'minimumDelayMs':min(delays),'maximumDelayMs':max(delays),'negativeCount':len(negative),'negativeFrameIndices':negative,'largeNegativeFrameIndices':anomalies,'negativeToleranceMs':1,'signedValuesPreserved':True,'note':'callbackDelay = performance.now() at callback entry minus browser rAF timestamp. Signed offsets down to -1 ms are retained as clock alignment/precision effects; larger negative offsets fail validation. No positive delay is clipped.'}
   assert not anomalies,{'timingError':'callbackDelay below -1 ms; investigate clock alignment','fields':fields,'rows':[rows[i] for i in anomalies[:12]],'anomalyCount':len(anomalies)}
  b.ev('document.getElementById("paused").hidden=true;true');b.capture('outdoor-'+a.label+'.png')
report.update(label=a.label,fixture=a.fixture.name,buildSha256=hashlib.sha256(html.encode()).hexdigest(),fixtureSha256=hashlib.sha256((hook+fixture).encode()).hexdigest(),profiled=a.profile,productionSaveEnabled=a.production_save,protocol=report.get('protocol') or '960 pedestrians (360 positioned in legal quay cells), 36 civilian traffic requests plus 3 police, 3 real vehicle detonations. '+('Normal wall-clock accumulator, unmodified 1/120 simulation ticks.' if a.realtime else 'Two normal 1/120 simulation ticks per rendered frame, active AI and physics; same simulation work regardless of backend speed.')+' Graphics unchanged: 1440x900 DPR1 MSAA4 shadows SSR bloom. Signature sampled every60frames, outside separate render/simulation timers.')
(ROOT/'docs'/('outdoor-'+a.label+'.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
assert not report['errors'] and not report['renderer'].get('errorEvents') and not report['backendEvents'],report['errors']
assert (a.realtime or report['simulationTicks']==a.frames*2) and len(report['events'])==a.expected_events
if a.production_save:
 saves=report['productionSave'];writes=[q for q in saves['measured'] if q['kind']=='persist'];snapshots={q['id']:q for q in saves['measured'] if q['kind']=='snapshot'}
 assert len(writes)>=2,{'error':'Fewer than two ordinary autosaves during the measured window; increase --frames','measuredWrites':writes,'window':saves['window']}
 assert all(q['ok'] and snapshots.get(q['id'],{}).get('ok') for q in writes),saves
 assert saves['persistence']['exists'] and saves['persistence']['loadOk'] and saves['persistence']['readBackMatchesString'],saves['persistence']
print(json.dumps({k:report[k] for k in ['label','measures','gpu','events']},indent=2),flush=True)
