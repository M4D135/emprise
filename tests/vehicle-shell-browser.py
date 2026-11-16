#!/usr/bin/env python3
"""Isolated real FERRO views, without loading Marseille or running simulation.

Use --source path/to/vehicles-before.js for an identical before gallery.
Only run while the shared browser/GPU slot is available.
"""
from browser_support import Browser, ROOT
from pathlib import Path
import argparse, hashlib, json, tempfile

p = argparse.ArgumentParser()
p.add_argument('--backend', choices=['webgl2', 'webgpu'], default='webgl2')
p.add_argument('--label', default='after')
p.add_argument('--source', type=Path)
args = p.parse_args()
modules = ['ferro/renderer', 'ferro/webgpu-shaders', 'ferro/webgpu-renderer', 'ferro/geometry', 'bitume/main', 'bitume/voiture']
code = '\n'.join((ROOT/'src'/(m+'.js')).read_text() for m in modules)
vehicles = (args.source or ROOT/'src/vehicles.js').read_text()
fixture = r'''
globalThis.vehicleErrors=[];globalThis.vehicleReady=false;
(async()=>{
 const canvas=document.querySelector('canvas'),options={msaa:4,vignette:1,reflections:true,onError:e=>vehicleErrors.push(e.message)};
 const renderer=BACKEND==='webgpu'?await FRenderWebGPU.create(canvas,options):FRender.create(canvas,options);
 const env={sunDirection:[.45,.75,.5],sunColor:[1.5,1.43,1.32],ambient:[.32,.34,.37],skyTop:[.26,.39,.52],skyBottom:[.68,.73,.77],fog:[.68,.73,.77],fogDensity:0,wind:0};
 const ground={shape:'box',p:[0,-.065,0],s:[30,.13,30],color:[.39,.40,.41],mat:0};
 renderer.setWorld([ground],[],env,{revisionedMeshes:true});
 const positions={profile:[0,1.02,6.5],front:[4.9,1.8,4.6],rear:[-4.9,1.8,4.6],opposite:[0,1.02,-6.5],roof:[3.7,3.2,4.1],belt:[-.2,.85,4.7]};
 globalThis.vehicleFixture={renderer,async frame(type,angle,shadows=true){
  const meshes=[],car={model:type,color:type==='gti'?'#bb2729':'#8f999c',x:0,y:0,z:0,cap:0,volant:0,moteur:false,distance:0};
  RADE.vehicles.render(car,meshes,{});const pos=positions[angle],target=[0,.70,0],d=target.map((n,i)=>n-pos[i]);
  const camera={pos,yaw:Math.atan2(d[0],-d[2]),pitch:Math.atan2(d[1],Math.hypot(d[0],d[2])),fov:42,near:.035,far:100,allStatic:true,chunked:true,sun:{center:[0,.6,0],extent:7,depth:20}};
  renderer.draw(camera,meshes,{time:0,quality:'high',shadows,sunOnly:true,torch:false,bloom:false,reflections:false,msaa:true,adaptive:false});
  if(renderer.gpu)await renderer.gpu.device.queue.onSubmittedWorkDone();
  await new Promise(resolve=>requestAnimationFrame(resolve));
  return {type,angle,shadows,instances:meshes.length,stats:{...renderer.stats}};
 }};vehicleReady=true;
})().catch(e=>{vehicleErrors.push(e.stack||String(e));vehicleReady=true;});
'''.replace('BACKEND', json.dumps(args.backend))
report={'backend':args.backend,'label':args.label,'sourceSha256':hashlib.sha256(vehicles.encode()).hexdigest(),'fixtureSha256':hashlib.sha256(fixture.encode()).hexdigest(),'views':[],'captures':[]}
with tempfile.TemporaryDirectory(prefix='emprise-vehicle-shell-') as temp:
    html=Path(temp)/'index.html'
    html.write_text('<!doctype html><style>body{margin:0;background:#a6b2bf}canvas{display:block;width:1440px;height:900px}</style><canvas width="1440" height="900"></canvas><script>globalThis.fixtureBootErrors=[];addEventListener("error",e=>fixtureBootErrors.push(e.message));</script><script>'+('\n'.join([code,vehicles,fixture])).replace('</script','<\\/script')+'</script>')
    with Browser() as b:
        b.cmd('Page.navigate',{'url':html.as_uri()});b.wait('globalThis.vehicleReady||globalThis.fixtureBootErrors?.length',45)
        assert not b.ev('fixtureBootErrors'),b.ev('fixtureBootErrors')
        assert not b.ev('vehicleErrors'),b.ev('vehicleErrors')
        assert b.ev('vehicleFixture.renderer.stats.backend')==args.backend
        for kind in ['gti','r5']:
            for angle in ['profile','front','rear','opposite','roof','belt']:
                result=b.ev('vehicleFixture.frame('+','.join(json.dumps(x) for x in [kind,angle,True])+')')
                filename='vehicle-shell-'+args.label+'-'+args.backend+'-'+kind+'-'+angle+'.png';b.capture(filename)
                report['views'].append(result);report['captures'].append(filename)
            for angle in ['profile','front']:
                result=b.ev('vehicleFixture.frame('+','.join(json.dumps(x) for x in [kind,angle,False])+')')
                suffix='unshadowed' if angle=='profile' else 'front-unshadowed'
                filename='vehicle-shell-'+args.label+'-'+args.backend+'-'+kind+'-'+suffix+'.png';b.capture(filename)
                report['views'].append(result);report['captures'].append(filename)
        report['errors']=b.ev('vehicleErrors');assert not report['errors'];b.ev('vehicleFixture.renderer.dispose();true')
(ROOT/'docs'/('vehicle-shell-'+args.label+'-'+args.backend+'.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'pass':True,'backend':args.backend,'captures':report['captures']},ensure_ascii=False),flush=True)
