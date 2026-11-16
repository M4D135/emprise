#!/usr/bin/env python3
"""Explicit static publication of the workshop on the existing VPS Caddy."""
import argparse,datetime,hashlib,json,pathlib,subprocess,time,urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1]
def run(args,**kw):return subprocess.check_output(args,text=True,**kw).strip()
def main():
    p=argparse.ArgumentParser();p.add_argument('--host',default='amiga');args=p.parse_args()
    paths=['editor','src/ferro/recipes.js','tools/build-ferro-editor.py','tools/deploy-ferro-editor.py','dist/ferro-editor.html','deployment/ferro.estrasse.fr.Caddyfile']
    if run(['git','status','--porcelain','--',*paths],cwd=ROOT):raise SystemExit('Commit the workshop source and build before deployment.')
    subprocess.run(['python3','tools/build-ferro-editor.py'],cwd=ROOT,check=True)
    if run(['git','status','--porcelain','--','dist/ferro-editor.html'],cwd=ROOT):raise SystemExit('Rebuild differs from committed HTML.')
    commit=run(['git','rev-parse','HEAD'],cwd=ROOT);html=ROOT/'dist/ferro-editor.html';digest=hashlib.sha256(html.read_bytes()).hexdigest()
    runtime=ROOT/'src/ferro/recipes.js';runtime_hash=hashlib.sha256(runtime.read_bytes()).hexdigest()
    ssh=['ssh','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes',args.host]
    remote='/home/ddd/apps/ferro';release=remote+'/releases/'+commit
    subprocess.run(ssh+['install','-d','-m','755',release],check=True)
    for source,name in [(html,'index.html.new'),(runtime,'recipes.js.new'),(ROOT/'deployment/ferro.estrasse.fr.Caddyfile','vhost.new')]:
        subprocess.run(['scp','-q','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes',str(source),args.host+':'+release+'/'+name],check=True)
    script='''set -euo pipefail
release=$1
html_hash=$2
runtime_hash=$3
root=/home/ddd/apps/ferro
vhost=/home/ddd/apps/caddy-shared/vhosts.d/ferro.estrasse.fr.Caddyfile
printf '%s  %s\\n' "$html_hash" "$release/index.html.new" "$runtime_hash" "$release/recipes.js.new" | sha256sum -c --quiet -
chmod 644 "$release/index.html.new" "$release/recipes.js.new" "$release/vhost.new"
mv "$release/index.html.new" "$release/index.html"
mv "$release/recipes.js.new" "$release/recipes.js"
previous=$(readlink "$root/current" || true)
ln -sfn "$release" "$root/current.new"
mv -T "$root/current.new" "$root/current"
if ! cmp -s "$release/vhost.new" "$vhost"; then
    install -d -m 755 "$root/config-backups"
    backup="$root/config-backups/$(basename "$release")"
    if [ -e "$vhost" ]; then cp -p "$vhost" "$backup.previous"; fi
    install -m 644 "$release/vhost.new" "$vhost"
    if ! systemctl --user start caddy-shared-apply; then
        if [ -e "$backup.previous" ]; then
            cp -p "$backup.previous" "$vhost"
        else
            mv "$vhost" "$backup.rejected"
        fi
        if [ -n "$previous" ]; then ln -sfn "$previous" "$root/current.new"; mv -T "$root/current.new" "$root/current"; fi
        exit 1
    fi
fi
mv "$release/vhost.new" "$root/ferro.estrasse.fr.Caddyfile"
printf '%s\\n' "$previous"
'''
    previous=run(ssh+['bash','-s','--',release,digest,runtime_hash],input=script)
    last_error=None
    for attempt in range(15):
        try:
            with urllib.request.urlopen('https://ferro.estrasse.fr/',timeout=10) as r:
                data=r.read();headers=dict(r.headers);status=r.status
            if hashlib.sha256(data).hexdigest()!=digest:raise ValueError('Served HTML does not match release')
            break
        except Exception as error:
            last_error=str(error)
            if attempt==14:raise SystemExit('Uploaded, HTTPS verification failed: '+last_error)
            time.sleep(2)
    receipt={'date':datetime.datetime.now(datetime.timezone.utc).isoformat(),'url':'https://ferro.estrasse.fr/','commit':commit,'sha256':digest,'runtimeSha256':runtime_hash,'bytes':len(data),'status':status,'release':release,'previous':previous or None,'httpsVerified':True,'headers':headers}
    out=ROOT/'work/editor-validation/deployment.json';out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
if __name__=='__main__':main()
