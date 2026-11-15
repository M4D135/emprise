#!/usr/bin/env python3
"""Validate scene equivalence and summarize measured renderer costs."""
from pathlib import Path
import json,statistics,argparse
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--final',action='store_true');args=parser.parse_args()
labels=[('webgl2','final-webgl2'),('webgpu','final-webgpu')] if args.final else [('before','before'),('webgl2','after-webgl2'),('webgpu','after-webgpu')]
reports={k:json.loads((root/'docs'/('render-benchmark-'+v+'.json')).read_text()) for k,v in labels}
reference='webgl2' if args.final else 'before'
assert len({r['fixtureSha256'] for r in reports.values()})==1,'Fixture differs'
assert reports['webgl2']['buildSha256']==reports['webgpu']['buildSha256'],'Final builds differ'
summary={'fixtureSha256':reports[reference]['fixtureSha256'],'builds':{k:r['buildSha256'] for k,r in reports.items()},'aggregation':'Median of three trial percentiles; 240 rendered frames per trial. Lower milliseconds is better.','scenes':[]}
keys=['msaa','shadows','reflections','bloom','pbrLayers','dynamicLights','staticVisible']
for i,base in enumerate(reports[reference]['scenes']):
 row={'name':base['name'],'identityHash':base['identity']['hash'],'measurements':{}}
 quality={k:base['trials'][0]['renderer'].get(k) for k in keys}
 for label,r in reports.items():
  scene=r['scenes'][i];assert scene['name']==base['name'] and scene['identity']==base['identity'],(label,base['name'],'Scene differs')
  trials=scene['trials'];assert len(trials)==3
  for trial in trials:
   assert trial['identityHash']==base['identity']['hash'] and not trial['streamPending'],(label,base['name'],'Streaming changed')
   assert trial['resolution']==[1440,900] and not trial['errors'] and not trial['renderer'].get('errorEvents'),(label,base['name'],'Rendering failed')
   assert {k:trial['renderer'].get(k) for k in keys}==quality,(label,base['name'],'Quality differs')
   assert trial['gpu']['n']>100 and trial['disjoint']==0,'Invalid GPU timing'
  row['measurements'][label]={metric:{q:round(statistics.median(t[metric][q] for t in trials),3) for q in ['p50','p95','p99']} for metric in ['frames','renderCPU','gameCPU','gpu']}
  row['measurements'][label]['over25']=sum(t['over25'] for t in trials)
  row['measurements'][label]['over50']=sum(t['over50'] for t in trials)
  row['measurements'][label]['maxFrameMs']=round(max(t['frames']['max'] for t in trials),3)
 row['quality']=quality;summary['scenes'].append(row)
path=root/'docs'/('render-final-comparison.json' if args.final else 'render-comparison.json');path.write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
if args.final:
 print('| Scène | GPU WebGL2 | GPU WebGPU | CPU rendu GL2 → WebGPU | Intervalle p95 GL2 → WebGPU |')
 print('|---|---:|---:|---:|---:|')
else:
 print('| Scène | GPU avant | GPU GL2 secours | GPU WebGPU | CPU rendu avant → WebGPU | Intervalle p95 avant → WebGPU |')
 print('|---|---:|---:|---:|---:|---:|')
for row in summary['scenes']:
 m=row['measurements'];old,gl,gpu=[m[k] for k in [reference,'webgl2','webgpu']]
 prefix='' if args.final else f" {old['gpu']['p95']:.2f} |"
 print(f"| {row['name']} |{prefix} {gl['gpu']['p95']:.2f} | {gpu['gpu']['p95']:.2f} | {old['renderCPU']['p95']:.2f} → {gpu['renderCPU']['p95']:.2f} | {old['frames']['p95']:.2f} → {gpu['frames']['p95']:.2f} |")
print('PASS: exact fixtures, same quality, complete streaming, actual GPU timers; '+str(path))
