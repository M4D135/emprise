#!/usr/bin/env python3
"""Build the offline game with Python's standard library. No downloads."""
from pathlib import Path
import hashlib,json,base64
root=Path(__file__).resolve().parent
modules=['ferro/renderer','ferro/destruction','metal/fmath','metal/physics','metal/input','metal/motion','metal/simulation','metal/actors','metal/effects','metal/audio','metal/audio-recipes','metal/weapon','bitume/carene','bitume/main','bitume/voiture','bitume/conduite','bitume/son','pdr/villes/marseille','pdr/ville-reelle','pdr/sim/nav','pdr/sim/regles','human-data','body-data','human','materials','pdr/foule','vehicles','mobility','details','architecture','people','world','crowd','traffic','campaign','replay','replays','weather','interiors','urban','injuries','session','game']
version=json.loads((root/'VERSION.json').read_text())
page=(root/'src/index.html').read_text().replace('/*STYLE*/',(root/'src/style.css').read_text())
code='\n'.join((root/'src'/f'{m}.js').read_text() for m in modules)
source_hash=hashlib.sha256((page+code+json.dumps(version,sort_keys=True)+''.join(hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((root/'assets/materials').glob('*.jpg')))).encode()).hexdigest()[:10]
page=page.replace('__VERSION__',version['version']).replace('__BUILD__',source_hash)
code='globalThis.RADE={build:'+json.dumps({**version,'id':source_hash})+'};\n'+code
images=[{kind:'data:image/jpeg;base64,'+base64.b64encode((root/'assets/materials'/f'{name}_{kind}.jpg').read_bytes()).decode() for kind in ['diff','nor_gl','rough']} for name in ['asphalt','plaster']]
code=code.replace('globalThis.RADE={build:', 'globalThis.RADE={materialImages:'+json.dumps(images)+',build:',1)
page=page.replace('<!--MODULES-->','<script>\n'+code.replace('</script','<\\/script')+'\n</script>')
data=page.encode();(root/'dist').mkdir(exist_ok=True);(root/'dist/index.html').write_bytes(data)
(root/'SIZE.json').write_text(json.dumps({'version':version['version'],'build':source_hash,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'modules':modules},indent=2)+'\n')
print(f'RADE: {len(data):,} bytes — dist/index.html')
