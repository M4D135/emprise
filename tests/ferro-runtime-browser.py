#!/usr/bin/env python3
"""Exercise the distributed engine without a game namespace, on native GPUs."""
import base64, hashlib, json
from browser_support import Browser, ROOT

out = ROOT / 'work/unified-validation'
out.mkdir(parents=True, exist_ok=True)
page = out / 'neutral.html'
page.write_text('''<!doctype html><meta charset="utf-8"><title>FERRO — moteur autonome</title>
<style>body{margin:0;background:#203438}canvas{width:100vw;height:100vh;display:block}</style>
<canvas id="scene"></canvas><script src="../../dist/ferro-runtime/ferro-runtime.js"></script>
<script>
globalThis.errors=[];addEventListener('error',e=>errors.push(e.message));
addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
(async()=>{
 const backend=new URLSearchParams(location.search).get('backend');
 const result=await FERRO.createRenderer(document.getElementById('scene'),{backend,
  onError:e=>errors.push(String(e)),onDeviceLost:e=>errors.push(String(e.reason))});
 const scene=FERRO.compileRecipe(FERRO.recipes.demo());
 const environment={skyTop:[.24,.38,.43],skyBottom:[.69,.75,.70],fog:[.46,.55,.54],fogDensity:.001,
  sunDirection:[-.45,.78,.35],sunColor:[1,.91,.75],ambient:[.29,.34,.33],wind:0,
  outdoorZones:[{x:0,z:0,w:20000,d:20000}]};
 const r=result.renderer;r.setWorld(scene.meshes,[],environment);r.resize('high');result.activate();
 const camera={pos:[-13,10,19],yaw:.60,pitch:-.35,fov:55,far:1000,allStatic:true};
 globalThis.frames=0;
 function draw(){r.draw(camera,[],{time:0,torch:false,sunOnly:true,shadows:true,reflections:true,bloom:true,msaa:true,adaptive:false,weather:[0,.25,0,0]});frames++;if(frames<8)requestAnimationFrame(draw);}
 draw();globalThis.neutral={backend:result.backend,renderer:r,meshCount:scene.meshes.length};
})().catch(e=>errors.push(e.stack||String(e)));
</script>''')
report = {'version': json.loads((ROOT/'FERRO.json').read_text())['version'],
          'runtimeSha256': hashlib.sha256((ROOT/'dist/ferro-runtime/ferro-runtime.js').read_bytes()).hexdigest(),
          'cases': []}
for backend in ['webgl2', 'webgpu']:
    with Browser() as b:
        b.cmd('Page.navigate', {'url': page.as_uri()+'?backend='+backend})
        b.cmd('Page.bringToFront')
        b.wait('globalThis.errors?.length || globalThis.frames>=8')
        state = b.ev('({errors,frames:globalThis.frames,hasRADE:typeof RADE!=="undefined",backend:globalThis.neutral?.backend,meshes:globalThis.neutral?.meshCount,stats:globalThis.neutral?.renderer.stats,capabilities:FERRO.capabilities()})')
        assert not state['errors'], state
        assert not state['hasRADE'], 'Engine unexpectedly depends on the pilot namespace'
        assert state['backend'] == backend, state
        assert state['meshes'] > 0 and state['stats']['instances'] > 0, state
        assert state['stats']['pbrLayers'] == 2, state
        (out/('neutral-'+backend+'.png')).write_bytes(base64.b64decode(b.cmd('Page.captureScreenshot', {'format':'png'})['data']))
        report['cases'].append(state)
(out/'neutral-browser.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps(report, indent=2))
