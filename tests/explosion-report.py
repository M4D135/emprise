#!/usr/bin/env python3
"""Strict paired performance report: equal workloads and byte-identical pictures."""
from pathlib import Path
import json,hashlib,statistics
from datetime import datetime,timezone
root=Path(__file__).resolve().parents[1]
docs=root/'docs'
read=lambda label:json.loads((docs/('outdoor-'+label+'.json')).read_text())
sha=lambda label:hashlib.sha256((docs/('outdoor-'+label+'.png')).read_bytes()).hexdigest()
size=json.loads((root/'SIZE.json').read_text())

def median(group):
 return {kind:{stat:statistics.median(r['measures'][kind][stat] for r in group) for stat in ('p50','p95','p99','max','over25','over50')} for kind in ('frame','simulation','render','game')}

def compare(prefix):
 before=[read(f'{prefix}-before-{i}') for i in (1,2,3)];after=[read(f'{prefix}-after-{i}') for i in (1,2,3)];reference=before[0]
 keys=['identity','hashes','counts','events','simulationTicks']+(['finalStateHashes'] if 'finalStateHashes' in reference else [])
 images=[sha(r['label']) for r in before+after]
 assert len(set(images))==1,(prefix,'native captures differ')
 for r in before+after:
  assert r['fixtureSha256']==reference['fixtureSha256']
  for key in keys:assert r[key]==reference[key],(r['label'],key)
  assert not r['profiled'] and not r['realtime'] and not r['errors'] and not r['backendEvents'] and not r['renderer'].get('errorEvents')
 for r in after:assert r['buildSha256']==size['sha256']
 assert len({r['buildSha256'] for r in before})==1
 def compact(r):return {key:r[key] for key in ['label','buildSha256','measures','gpu','worldUpdates']}
 return {'protocol':reference['protocol'],'fixtureSha256':reference['fixtureSha256'],'baselineSha256':reference['buildSha256'],'finalSha256':size['sha256'],'captureSha256':images[0],'equivalence':keys,'before':[compact(r) for r in before],'after':[compact(r) for r in after],'medianBefore':median(before),'medianAfter':median(after)}
report={'version':size['version'],'build':size['build'],'reportedAtUtc':datetime.now(timezone.utc).isoformat(),'hardware':'Apple M5, 24 GiB','os':'macOS 27.2.1 (26B131)','browser':'Chrome 157.0.8103.39','viewport':'1440x900 DPR1','isolation':'Point de rupture session was already closed when inspected; only one benchmark browser and no other agent test ran during each trial. Normal desktop background processes remained.','pairOrder':'before/after, after/before, before/after','scenes':{prefix:compare(prefix) for prefix in ('explosion','heavy')},'limits':'Controlled fixed-camera scenes, 600 rendered frames each. Fixed 1/120 simulation steps (2 per frame) for matched work. Separate realtime trial uses production accumulator. No guarantee for every city location, machine, browser or display resolution.'}
for label in ['heavy-webgl2','heavy-realtime']:
 r=read(label);assert r['buildSha256']==size['sha256'] and not r['errors'] and not r['backendEvents'] and not r['renderer'].get('errorEvents')
 if label=='heavy-webgl2':
  reference=read('heavy-after-1')
  for key in ['identity','events','simulationTicks','finalStateHashes']:assert r[key]==reference[key],(label,key)
  assert [q['hash'] for q in r['hashes']]==[q['hash'] for q in reference['hashes']]
  for a,b in zip(r['counts'],reference['counts']):
   for key in ['frame','models','pedestrians','alive','traffic','debris','staticMeshes','staticColliders','projections','msaa','shadows','reflections','bloom','resolution']:assert a[key]==b[key],(label,key)
 report[label]={key:r[key] for key in ['label','measures','gpu','worldUpdates','errors','backendEvents']}
realtimeBefore=read('heavy-realtime-before')
assert realtimeBefore['buildSha256']==report['scenes']['heavy']['baselineSha256']
assert realtimeBefore['identity']==read('heavy-realtime')['identity']
assert realtimeBefore['fixtureSha256']==read('heavy-realtime')['fixtureSha256']
assert not realtimeBefore['errors'] and not realtimeBefore['backendEvents'] and not realtimeBefore['renderer'].get('errorEvents')
report['heavy-realtime-before']={key:realtimeBefore[key] for key in ['label','buildSha256','measures','gpu','worldUpdates','simulationTicks','errors','backendEvents']}
report['heavy-realtime']['simulationTicks']=read('heavy-realtime')['simulationTicks']
report['realtimeCaveat']='One after trial then one baseline trial, 900 frames. Same prepared scene and simulation-tick triggers, normal wall-clock accumulator. Elapsed time, tick count and resulting state differ; not an exact-work performance comparison.'
(docs/'explosion-comparison.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({name:{'before':v['medianBefore']['frame'],'after':v['medianAfter']['frame']} for name,v in report['scenes'].items()},indent=2))
