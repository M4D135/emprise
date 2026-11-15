"""Alternating native runs; old algorithms with matching procedural geometry."""
from pathlib import Path
import subprocess,json,tempfile,statistics,hashlib

ROOT=Path(__file__).resolve().parents[1]
REFERENCE='22a330f2dbbdc7ee359ce03da785e0cbeca495d4'
reports=[]
def run(label,html=None,realtime=False,backend='webgpu',dpr=1):
 cmd=['python3','tests/outdoor-stress.py','--label',label,'--backend',backend,'--frames','900' if realtime else '600','--fixture','tests/explosion-heavy-scenes.js','--expected-events','5','--dpr',str(dpr)]
 if html:cmd+=['--html',str(html)]
 if realtime:cmd+=['--realtime','--production-save']
 print('START '+label,flush=True)
 result=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True)
 if result.returncode:print(result.stdout[-2000:],result.stderr,flush=True);raise SystemExit(result.returncode)
 r=json.loads((ROOT/('docs/outdoor-'+label+'.json')).read_text());reports.append(r)
 print(json.dumps({'label':label,'cpu':r['measures']['callbackCpu'],'raf':r['measures']['observedRaf'],'submission':r['measures']['drawSubmission'],'simulation':r['measures']['simulation'],'ticks':r['simulationTicks']}),flush=True)
 return r
def same(a,b):
 for key in ['identity','events','simulationTicks']:assert a[key]==b[key],key
 assert a['finalStateHashes']==b['finalStateHashes'],'all six exact final state hashes'
 assert [{k:v for k,v in q.items() if k!='renderHash'} for q in a['hashes']]==[{k:v for k,v in q.items() if k!='renderHash'} for q in b['hashes']],'physical hashes'
 assert a['fixtureSha256']==b['fixtureSha256']
 for key in ['pedestrians','traffic','debris','staticMeshes','staticColliders','projections','projectedMeshes','projectedColliders','explosions','fires','msaa','shadows','reflections','bloom','resolution']:
  assert [q[key] for q in a['counts']]==[q[key] for q in b['counts']],key
 print('EXACT six final hashes, physical states, events, population, debris and quality settings',flush=True)

with tempfile.TemporaryDirectory(prefix='emprise-movement-control-') as temp:
 before=Path(temp)/'before-063.html';published=subprocess.check_output(['git','show',REFERENCE+':dist/index.html'],cwd=ROOT);control=published.decode();geometry=[]
 # Match only the intentional geometry/nautical fixes. All old performance
 # algorithms, renderer, loading path, UI and graphics settings remain old.
 # Coastal barriers follow heightAt, so comparing the old coast datum would
 # otherwise make 3188 distant collider heights intentionally differ.
 for name in ['pdr/ville-reelle','coast','marine']:
  path='src/'+name+'.js';old=subprocess.check_output(['git','show',REFERENCE+':'+path],cwd=ROOT).decode().replace('</script','<\\/script');new=(ROOT/path).read_text().replace('</script','<\\/script');assert control.count(old)==1,path;control=control.replace(old,new);geometry.append({'path':path,'sha256':hashlib.sha256((ROOT/path).read_bytes()).hexdigest()})
 before.write_text(control)
 pairs=[]
 for i in range(1,4):
  pair={}
  for old in ([True,False] if i%2 else [False,True]):pair[old]=run('motion-'+('before' if old else 'after')+'-'+str(i),before if old else None)
  same(pair[True],pair[False]);pairs.append(pair)
 webgl=run('motion-webgl2',backend='webgl2');same(pairs[0][False],webgl)
 retina=run('motion-retina',dpr=2)
 for key in ['identity','events','simulationTicks','finalStateHashes']:assert pairs[0][False][key]==retina[key],key
 run('motion-production-before',before,realtime=True)
 run('motion-production-after',realtime=True)
 medians={side:{metric:{q:statistics.median(p[old]['measures'][metric][q] for p in pairs) for q in ['p50','p95','p99','max','over25','over50']} for metric in ['callbackCpu','simulation','observedRaf','drawSubmission']} for side,old in [('before',True),('after',False)]}
 report={'referenceCommit':REFERENCE,'publishedReferenceSha256':hashlib.sha256(published).hexdigest(),'referenceGeometryOverrides':geometry,'referenceSha256':hashlib.sha256(before.read_bytes()).hexdigest(),'candidateSha256':hashlib.sha256((ROOT/'dist/index.html').read_bytes()).hexdigest(),'pairedRepetitions':3,'medianOfRuns':medians,'reports':['outdoor-'+r['label']+'.json' for r in reports],'equivalence':'Identical initial identity, scheduled impacts, 1200 ticks, periodic physical states and all six SHA final hashes (destruction, world meshes, world colliders, bodies, urban report, projections); population, debris and graphics settings unchanged.','visualChanges':['Traffic poses are interpolated between 30Hz simulation steps.','Both versions receive the same quay clipping, coastal datum and boat geometry/physics. Performance algorithms remain their respective versions.','The local wave grid is inactive in this terrestrial scenario.'],'limits':['The control is 0.6.3 with the three listed procedural geometry/nautical modules updated for scene equivalence; it is not the byte-identical published 0.6.3.','CPU callback, simulation, rAF and draw submission intervals are distinct metrics. None measures actual display presentation.','Realtime runs use the normal accumulator and ordinary autosave; their tick totals need not match and they are excluded from paired medians.','Three paired trials on one Mac/Chrome configuration do not guarantee frame times on every device.']}
 (ROOT/'docs/movement-comparison.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print('FINAL BENCH COMPLETE',flush=True)
