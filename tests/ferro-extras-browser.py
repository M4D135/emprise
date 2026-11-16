"""Native GL qualification of optional shared rendering features."""
import json, base64
from browser_support import Browser, ROOT

out=ROOT/'work/reference-audit';out.mkdir(parents=True,exist_ok=True)
page=out/'extras.html'
page.write_text('''<!doctype html><style>body{margin:0}canvas{width:100vw;height:100vh}</style><canvas id="c"></canvas>
<script src="../../dist/ferro-runtime/ferro-runtime.js"></script><script src="../../dist/ferro-runtime/ferro-render-extras.js"></script>
<script>
globalThis.errors=[];onerror=(m)=>errors.push(m);onunhandledrejection=e=>errors.push(String(e.reason));
(async()=>{
 const materials=FMaterials.create();await materials.load();
 const r=globalThis.r=FRender.create(document.getElementById('c'),{materials,sceneReflections:true,advancedSky:true,composition:true,resolution:'native'});
 const scene=FRecipes.compile(FRecipes.demo()),sky=FSky.resolve(FSky.presets[0],{seed:42});
 r.setWorld(scene.meshes,[],{sky,skyTop:[.24,.38,.43],skyBottom:[.69,.75,.70],fog:[.46,.55,.54],fogDensity:.001,sunDirection:[-.45,.78,.35],sunColor:[1,.91,.75],ambient:[.29,.34,.33],outdoorZones:[{x:0,z:0,w:20000,d:20000}]});
 r.resize('high');r.profile({});
 const gl=r.gl,getError=gl.getError.bind(gl);for(const name of Object.getOwnPropertyNames(WebGL2RenderingContext.prototype).concat(Object.getOwnPropertyNames(WebGLRenderingContext.prototype))){if(name==='getError'||name==='constructor'||typeof gl[name]!=='function')continue;const original=gl[name].bind(gl);gl[name]=(...args)=>{const result=original(...args),err=getError();if(err&&!errors.length)errors.push(name+': '+err+' '+new Error().stack);return result;};}
globalThis.renderedFrames=0;globalThis.snapshots=[];
 function draw(){const mode=renderedFrames<12?'probe':renderedFrames<24?'screen':'off';r.draw({pos:[-13,10,19],yaw:.60,pitch:-.35,fov:55,far:180,allStatic:true},[],{time:0,torch:false,sunOnly:true,shadows:true,reflections:mode,bloom:true,adaptive:false,weather:[0,.25,0,0]});const error=r.gl.getError();if(error)errors.push('GL '+error+' frame '+renderedFrames);renderedFrames++;if(renderedFrames===12||renderedFrames===24||renderedFrames===30)snapshots.push(JSON.parse(JSON.stringify(r.stats)));if(renderedFrames<30&&!errors.length)requestAnimationFrame(draw);}
 draw();
})().catch(e=>errors.push(e.stack));
</script>''')
with Browser() as b:
 b.cmd('Log.enable');b.cmd('Page.navigate',{'url':page.as_uri()});b.cmd('Page.bringToFront')
 b.wait('globalThis.errors?.length || globalThis.renderedFrames>=30')
 state=b.ev('({errors,renderedFrames:globalThis.renderedFrames,snapshots:globalThis.snapshots,profile:globalThis.r?.profile()})')
 (out/'extras.json').write_text(json.dumps(state,indent=2)+'\n')
 (out/'extras-events.json').write_text(json.dumps(b.c.evenements,indent=2));assert not state['errors'],state
 assert state['snapshots'][0]['sceneReflections']['ready'],state
 assert state['snapshots'][1]['sceneReflections']['screenPasses']==1,state
 assert not state['snapshots'][2]['sceneReflections']['ready'],state
 assert all(s.get('sky') is not None for s in state['snapshots']),state
 (out/'extras.png').write_bytes(base64.b64decode(b.cmd('Page.captureScreenshot',{'format':'png'})['data']))
 print('FERRO optional sky/probe/screen/native/profile: PASS')
