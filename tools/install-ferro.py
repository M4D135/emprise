#!/usr/bin/env python3
"""Install identical reference modules; host build lists select only what they use.

Run from the reference checkout: python3 tools/install-ferro.py GAME CHECKOUT
For point-de-rupture, CHECKOUT is the Jeu directory. Never rewrites game logic.
"""
import argparse,hashlib,json,pathlib,shutil
ROOT=pathlib.Path(__file__).resolve().parents[1]
MAPPING={
 'emprise':{},
 'metal':{name:'src/'+name+'.js' for name in ['passages','brain','loop','schedule','jobs','demo','fmath','renderer','physics-geometry','physics','destruction','input','motion','effects','audio','music','imuse','surface','gpu-profile','skies','reflections']},
 'bitume':{'renderer':'src/moteur/renderer.js','geometry':'src/carene.js'},
 'point-de-rupture':{'renderer':'src/moteur/renderer.js','navigation':'src/sim/nav.js'}
}
def install(game,dest):
 spec=json.loads((ROOT/('FERRO.json' if (ROOT/'FERRO.json').exists() else 'manifest.json')).read_text());entries=[];packaged={m['id']:m['packagePath'] for m in spec.get('files',[]) if m.get('path')}
 for module in spec['modules']+spec['optionalModules']+[{'id':'host','path':spec['hostAPI']}]:
  source=ROOT/packaged.get(module['id'],module['path']);name=source.stem
  relative=MAPPING[game].get(name,'src/ferro/'+source.name);target=dest/relative
  target.parent.mkdir(parents=True,exist_ok=True)
  if target.resolve()!=source.resolve():shutil.copy2(source,target)
  entries.append({'id':module['id'],'path':relative,'sha256':hashlib.sha256(source.read_bytes()).hexdigest()})
 lock={'format':'ferro-lock','version':spec['version'],'reference':spec.get('reference',{}).get('source','EMPRISE/src/ferro'),'game':game,'modules':entries}
 (dest/'FERRO.lock.json').write_text(json.dumps(lock,indent=2)+'\n')
 (dest/'tools').mkdir(exist_ok=True)
 check=dest/'tools/check-ferro-lock.py'
 if check.resolve()!=(ROOT/'tools/check-ferro-lock.py').resolve():shutil.copy2(ROOT/'tools/check-ferro-lock.py',check)
 print(game+': '+spec['version']+' installed, '+str(len(entries))+' identical modules')
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('game',choices=MAPPING);p.add_argument('checkout',type=pathlib.Path);a=p.parse_args();install(a.game,a.checkout.resolve())
