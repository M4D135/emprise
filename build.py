#!/usr/bin/env python3
"""Build the offline game with Python's standard library. No downloads."""
from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parent
modules=['ferro/renderer','ferro/destruction','metal/fmath','metal/physics','metal/input','metal/motion','metal/simulation','metal/actors','metal/effects','metal/audio','metal/audio-recipes','metal/weapon','bitume/carene','bitume/main','bitume/voiture','bitume/conduite','bitume/son','pdr/villes/marseille','pdr/ville-reelle','pdr/sim/nav','pdr/sim/regles','human-data','body-data','human','materials','pdr/foule','vehicles','mobility','marine','details','architecture','people','boundaries','clearance','coast-data','coast','city-data','city-stream','core-heights','landmarks','camera','world','crowd','traffic','campaign','replay','replays','weather','places-data','places','interiors','breach','urban','injuries','police','business','loot','phone','session','gamepad','game']
version=json.loads((root/'VERSION.json').read_text())
page=(root/'src/index.html').read_text().replace('/*STYLE*/',(root/'src/style.css').read_text())
code='\n'.join((root/'src'/f'{m}.js').read_text() for m in modules)
source_hash=hashlib.sha256((page+code+json.dumps(version,sort_keys=True)).encode()).hexdigest()[:10]
page=page.replace('__VERSION__',version['version']).replace('__BUILD__',source_hash)
code='globalThis.RADE={build:'+json.dumps({**version,'id':source_hash})+'};\n'+code
page=page.replace('<!--MODULES-->','<script>\n'+code.replace('</script','<\\/script')+'\n</script>')
data=page.encode();(root/'dist').mkdir(exist_ok=True);(root/'dist/index.html').write_bytes(data)
(root/'SIZE.json').write_text(json.dumps({'version':version['version'],'build':source_hash,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'modules':modules},indent=2)+'\n')
print(f'EMPRISE: {len(data):,} bytes — dist/index.html')
