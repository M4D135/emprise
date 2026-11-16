#!/usr/bin/env python3
"""Publish the qualified reference and four games to existing VPS roots.

Requires committed sources/builds. Stages and hashes every release before any
switch; retains all previous releases and restores links on verification failure.
Does not change Caddy, services, ports or DNS.
"""
import argparse,datetime,hashlib,json,pathlib,shlex,subprocess,time,urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1]
def run(*args,**kw):return subprocess.check_output(list(args),text=True,**kw).strip()
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def main():
 p=argparse.ArgumentParser();p.add_argument('--metal',required=True,type=pathlib.Path);p.add_argument('--bitume',required=True,type=pathlib.Path);p.add_argument('--pdr',required=True,type=pathlib.Path);p.add_argument('--host',default='amiga');p.add_argument('--receipt',required=True,type=pathlib.Path);a=p.parse_args()
 version=json.loads((ROOT/'FERRO.json').read_text())['version'];archive='FERRO-'+version+'.zip'
 hosts=[('emprise','rade','gta.estrasse.fr',ROOT,{'index.html':ROOT/'dist/index.html'}),('metal','fps','fps.estrasse.fr',a.metal,{'index.html':a.metal/'dist/index.html'}),('bitume','bitume','bitume.estrasse.fr',a.bitume,{'index.html':a.bitume/'dist/bitume.html'}),('point-de-rupture','pdr','pdr.estrasse.fr',a.pdr,{'index.html':a.pdr/'dist/point-de-rupture.html'}),('ferro','ferro','ferro.estrasse.fr',ROOT,{'index.html':ROOT/'dist/ferro-editor.html',archive:ROOT/'dist'/archive,'manifest.json':ROOT/'dist/ferro-runtime/manifest.json','README.md':ROOT/'docs/FERRO-UNIFIED.md','recipes.js':ROOT/'src/ferro/recipes.js'})]
 ssh=['ssh','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes',a.host];rows=[];reference=json.loads((ROOT/'FERRO.lock.json').read_text())
 hashes={m['id']:m['sha256'] for m in reference['modules']}
 for game,app,domain,checkout,files in hosts:
  checkout=checkout.resolve();repo=pathlib.Path(run('git','-C',str(checkout),'rev-parse','--show-toplevel'))
  if run('git','-C',str(repo),'status','--porcelain'):raise SystemExit('Uncommitted checkout: '+str(repo))
  if game!='ferro':
   lock=json.loads((checkout/'FERRO.lock.json').read_text());assert lock['version']==version and {m['id']:m['sha256'] for m in lock['modules']}==hashes,'Different FERRO module set'
   for m in lock['modules']:assert digest(checkout/m['path'])==m['sha256'],m['path']
  commit=run('git','-C',str(repo),'rev-parse','HEAD');remote='/home/ddd/apps/'+app;release=remote+'/releases/'+commit
  previous=run(*ssh,'readlink '+shlex.quote(remote+'/current'))
  payload={name:{'bytes':path.stat().st_size,'sha256':digest(path)} for name,path in files.items()}
  rows.append({'game':game,'url':'https://'+domain+'/','commit':commit,'release':release,'previous':previous,'root':remote,'files':payload})
  run(*ssh,'install -d -m 755 '+shlex.quote(release))
  for name,path in files.items():
   subprocess.run(['scp','-q','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes',str(path),a.host+':'+release+'/'+name+'.new'],check=True)
   staged=release+'/'+name+'.new';assert run(*ssh,'sha256sum '+shlex.quote(staged)).split()[0]==payload[name]['sha256']
   run(*ssh,'chmod 644 '+shlex.quote(staged)+' && mv '+shlex.quote(staged)+' '+shlex.quote(release+'/'+name))
  print('STAGED '+game+' '+commit,flush=True)
 switched=[]
 try:
  for row in rows:
   root=row['root'];run(*ssh,'ln -sfn '+shlex.quote(row['release'])+' '+shlex.quote(root+'/current.new')+' && mv -T '+shlex.quote(root+'/current.new')+' '+shlex.quote(root+'/current'));switched.append(row)
  for row in rows:
   for name,expected in row['files'].items():
    url=row['url']+('' if name=='index.html' else name)
    for attempt in range(8):
     try:
      with urllib.request.urlopen(url,timeout=30) as response:data=response.read();status=response.status
      assert status==200 and hashlib.sha256(data).hexdigest()==expected['sha256'];break
     except Exception:
      if attempt==7:raise
      time.sleep(1)
   row['httpsVerified']=True;print('VERIFIED '+row['url'],flush=True)
 except Exception:
  for row in reversed(switched):
   root=row['root'];run(*ssh,'ln -sfn '+shlex.quote(row['previous'])+' '+shlex.quote(root+'/current.rollback')+' && mv -T '+shlex.quote(root+'/current.rollback')+' '+shlex.quote(root+'/current'))
  raise
 receipt={'version':version,'date':datetime.datetime.now(datetime.timezone.utc).isoformat(),'moduleCount':len(hashes),'releases':rows,'previousReleasesRetained':True}
 a.receipt.parent.mkdir(parents=True,exist_ok=True);a.receipt.write_text(json.dumps(receipt,indent=2,ensure_ascii=False)+'\n');print(str(a.receipt))
if __name__=='__main__':main()
