#!/usr/bin/env python3
"""Versioned common engine package; no network, image, mesh or audio inputs."""
import argparse,hashlib,json,pathlib,shutil,zipfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
def build(output):
    spec=json.loads((ROOT/'FERRO.json').read_text());output.mkdir(parents=True,exist_ok=True)
    modules=spec['modules']+spec['optionalModules']+[{'id':'host','path':spec['hostAPI']}]
    manifest={**spec,'files':[]}
    for module in modules:
        source=ROOT/module['path'];data=source.read_bytes();relative='modules/'+source.name;target=output/relative;target.parent.mkdir(exist_ok=True)
        target.write_bytes(data);manifest['files'].append({**module,'packagePath':relative,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
    core=spec['modules']+[{'id':'host','path':spec['hostAPI']}]
    # The optional music library is separate: a racing game need not carry a score it never uses.
    for name,selection in [('ferro-runtime.js',core),('ferro-music.js',[m for m in spec['optionalModules'] if m['id'] in ['music','imuse']]),('ferro-simulation.js',[m for m in spec['optionalModules'] if m['id'] in ['passages','brain','loop','schedule','jobs','demo']]),('ferro-render-extras.js',[m for m in spec['optionalModules'] if m['id'] in ['surface','gpu-profile','skies','reflections']])]:
        data=('/* FERRO '+spec['version']+' — procedural engine. */\n'+'\n'.join((ROOT/m['path']).read_text() for m in selection)).encode();(output/name).write_bytes(data)
        manifest['files'].append({'id':name,'packagePath':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
    for name in ['check-ferro-lock.py','install-ferro.py']:
        relative='tools/'+name;data=(ROOT/relative).read_bytes();(output/'tools').mkdir(exist_ok=True);(output/relative).write_bytes(data)
        manifest['files'].append({'id':name,'path':relative,'packagePath':relative,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
    (output/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
    shutil.copy2(ROOT/'docs/FERRO-UNIFIED.md',output/'README.md')
    archive=output.parent/('FERRO-'+spec['version']+'.zip')
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
        for name in sorted([item['packagePath'] for item in manifest['files']]+['manifest.json','README.md']):
            entry=zipfile.ZipInfo(name,date_time=(1980,1,1,0,0,0));entry.compress_type=zipfile.ZIP_DEFLATED;entry.external_attr=0o100644<<16
            z.writestr(entry,(output/name).read_bytes())
    print(json.dumps({'archive':str(archive),'files':len(manifest['files']),'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()}))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--output',type=pathlib.Path,default=ROOT/'dist/ferro-runtime');build(p.parse_args().output.resolve())
