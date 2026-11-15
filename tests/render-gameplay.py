#!/usr/bin/env python3
"""Sequential native renderer acceptance; never overlaps Chrome processes."""
from pathlib import Path
import subprocess,os,time,json,hashlib,argparse
root=Path(__file__).resolve().parents[1];work=root/'../../work/webgpu';work.mkdir(parents=True,exist_ok=True)
parser=argparse.ArgumentParser();parser.add_argument('--tests',nargs='+');args=parser.parse_args()
report={'backendRequested':'webgpu','buildSha256':hashlib.sha256((root/'dist/index.html').read_bytes()).hexdigest(),'results':[]}
commands=[('inputs',['python3','tests/inputs.py']),('gamepad',['python3','tests/gamepad.py']),('cockpit',['python3','tests/cockpit-browser.py']),('collapse',['python3','tests/collapse-browser.py']),('attract',['python3','tests/attract.py']),('pacing',['python3','tests/streaming.py'])]
if args.tests:
 prior=root/'docs/render-gameplay.json'
 if prior.exists():
  previous=json.loads(prior.read_text())
  if previous['buildSha256']==report['buildSha256']:report=previous
 commands=[q for q in commands if q[0] in args.tests]
for name,command in commands:
 print('START native gameplay '+name,flush=True);started=time.monotonic()
 result=subprocess.run(command,cwd=root,env={**os.environ,'EMPRISE_RENDERER':'webgpu'},capture_output=True,text=True)
 (work/('gameplay-'+name+'.log')).write_text(result.stdout+result.stderr)
 record={'test':name,'passed':result.returncode==0,'seconds':round(time.monotonic()-started,2)}
 report.setdefault('attempts',[]).append(record)
 report['results']=[r for r in report['results'] if r['test']!=name]+[record]
 (root/'docs/render-gameplay.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report['results'][-1]),flush=True)
 if result.returncode:
  print((result.stdout+result.stderr)[-6000:],flush=True);raise SystemExit(result.returncode)
print('PASS native gameplay acceptance',flush=True)
