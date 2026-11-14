#!/usr/bin/env python3
"""Build the offline game with Python's standard library. No downloads."""
from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parent
modules=['ferro/renderer','metal/fmath','metal/physics','metal/input','metal/motion','metal/simulation','metal/actors','metal/effects','metal/audio','metal/audio-recipes','metal/weapon','bitume/carene','bitume/main','bitume/voiture','bitume/conduite','bitume/son','pdr/villes/marseille','pdr/ville-reelle','pdr/sim/nav','pdr/sim/regles','pdr/foule','vehicles','mobility','details','world','crowd','session','game']
page=(root/'src/index.html').read_text().replace('/*STYLE*/',(root/'src/style.css').read_text())
code='\n'.join((root/'src'/f'{m}.js').read_text() for m in modules)
page=page.replace('<!--MODULES-->','<script>\n'+code.replace('</script','<\\/script')+'\n</script>')
data=page.encode();(root/'dist').mkdir(exist_ok=True);(root/'dist/index.html').write_bytes(data)
(root/'SIZE.json').write_text(json.dumps({'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'modules':modules},indent=2)+'\n')
print(f'RADE: {len(data):,} bytes — dist/index.html')
