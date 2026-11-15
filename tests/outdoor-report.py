#!/usr/bin/env python3
"""Compare active outdoor trials only when workload and visual counters match."""
from pathlib import Path
import json,statistics,hashlib
root=Path(__file__).resolve().parents[1]
read=lambda name:json.loads((root/'docs'/name).read_text())
before=[read(f'outdoor-baseline-{i}.json') for i in (1,2,3)]
after=[read(f'outdoor-final-{i}.json') for i in (1,2,3)]
reference=before[0]
images=[hashlib.sha256((root/'docs'/f'outdoor-{kind}-{i}.png').read_bytes()).hexdigest() for kind in ('baseline','final') for i in (1,2,3)]
assert len(set(images))==1,'Native end-of-trial screenshots changed'
for r in before+after:
 assert r['fixtureSha256']==reference['fixtureSha256']
 for key in ('identity','hashes','counts','events','simulationTicks'):assert r[key]==reference[key],(r['label'],key)
 assert not r['profiled'] and not r['realtime']
 assert not r['errors'] and not r['backendEvents'] and not r['renderer'].get('errorEvents')
size=json.loads((root/'SIZE.json').read_text())
for r in after:assert r['buildSha256']==size['sha256']

def table(r):
 return {'label':r['label'],'frame':r['measures']['frame'],'simulation':r['measures']['simulation'],'render':r['measures']['render'],'gpu':r['gpu'],'worldUpdates':r['worldUpdates']}
def med(group):
 return {kind:{stat:statistics.median(r['measures'][kind][stat] for r in group) for stat in ('p50','p95','p99','max','over25','over50')} for kind in ('frame','simulation','render','game')}
report={'hardware':'Apple M5','os':'macOS 27.2.1','browser':'Chrome 157.0.8103.39','viewport':'1440×900, DPR1','protocol':reference['protocol'],'baselineSha256':reference['buildSha256'],'finalSha256':after[0]['buildSha256'],'fixtureSha256':reference['fixtureSha256'],'nativeScreenshotSha256':images[0],'concurrentLoad':after[0].get('concurrentLoad'),'timingConclusion':'Diagnostic only: another game was active during the final trials; timing differences cannot be attributed solely to this patch.','equivalence':['Exact initial state','Exact simulation hashes every 60 frames','Exact model/triangle/instance/draw counts every 60 frames','Same rendering settings and resolution','Same detonation schedule and simulation ticks'],'before':[table(r) for r in before],'after':[table(r) for r in after],'medianBefore':med(before),'medianAfter':med(after),'limits':'Fixed camera, controlled dense quay fixture, 600 rendered frames per trial. Two normal 1/120 simulation ticks per frame for equal workload; separate realtime test uses the production accumulator. Not a guarantee for every scene, machine, display size or browser.'}
(root/'docs/outdoor-comparison.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:report[k] for k in ('medianBefore','medianAfter')},indent=2))
