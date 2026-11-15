#!/usr/bin/env python3
"""Real native WebGPU shadow receivers, cast shadow and movement regression.

Loads FERRO's actual source modules. Pixels are copied from the real presentation
texture to a GPU readback buffer; no GL context or fabricated depth map is used.
Run only after the shared Chrome slot is released. --label before records the
existing defect; --label after also enforces clean receivers and real shadows.
"""
from browser_support import Browser, ROOT
from pathlib import Path
import argparse
import base64
import hashlib
import json
import tempfile

parser = argparse.ArgumentParser()
parser.add_argument('--label', choices=['before', 'after'], default='after')
args = parser.parse_args()
modules = ['ferro/renderer', 'ferro/webgpu-shaders', 'ferro/webgpu-renderer']
code = '\n'.join((ROOT / 'src' / (module + '.js')).read_text() for module in modules)
fixture = r'''
globalThis.shadowErrors=[];globalThis.shadowReady=false;
(async()=>{
 const canvas=document.querySelector('canvas'),width=640,height=480;
 const renderer=await FRenderWebGPU.create(canvas,{msaa:0,vignette:1,onError:error=>shadowErrors.push(error.message)});
 const gpu=renderer.gpu,device=gpu.device;
 // COPY_SRC changes only readback availability, never the render attachments,
 // depth texture, shader code, lighting or shadow-map generation.
 gpu.context.configure({device,format:gpu.canvasFormat,alphaMode:'opaque',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});
 const bytesPerRow=Math.ceil(width*4/256)*256;
 const readback=device.createBuffer({size:bytesPerRow*height,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
 const environment={sunDirection:[.6,.5,.6],sunColor:[1.8,1.7,1.5],ambient:[.2,.2,.2],skyTop:[.2,.3,.4],skyBottom:[.4,.5,.6],fog:[.4,.5,.6],fogDensity:.0001,wind:0,outdoorZones:[{x:0,z:0,w:1000,d:1000}]};
 const floor={shape:'box',p:[0,-.1,0],s:[100,.2,100],color:[.55,.55,.55],mat:0,outdoor:true};
 const fixtures={
  wall:{meshes:[{shape:'box',p:[0,10,0],s:[40,30,.2],color:[.65,.6,.52],mat:0,outdoor:true}],camera:{pos:[0,10,18],yaw:0,pitch:0}},
  floor:{meshes:[floor],camera:{pos:[0,6,12],yaw:0,pitch:-Math.atan2(6,12)}},
  occluder:{meshes:[floor,{shape:'box',p:[0,2,0],s:[3,4,3],color:[.6,.5,.4],mat:0,outdoor:true}],camera:{pos:[10,10,15],yaw:Math.atan2(-10,15),pitch:-Math.atan2(10,Math.hypot(10,15))}}
 };
 let current=null;
 const cameraFor=(name,shift)=>{const f=fixtures[name];return {...f.camera,pos:f.camera.pos.map((v,i)=>v+(i===0?shift:0)),near:.035,far:500,fov:60,allStatic:true,sun:{center:[shift,5,0],extent:110,depth:150}};};
 async function frame(name,on,full,shift=0){
  const f=fixtures[name],camera=cameraFor(name,shift);
  if(current!==name){renderer.setWorld(f.meshes,[],environment);current=name;}
  device.pushErrorScope('validation');
  renderer.draw(camera,[],{time:0,shadows:on,sunOnly:full,torch:false,bloom:false,reflections:false,msaa:false,adaptive:false});
  const encoder=device.createCommandEncoder({label:'Shadow regression real presentation readback'});
  encoder.copyTextureToBuffer({texture:gpu.context.getCurrentTexture()},{buffer:readback,bytesPerRow},[width,height]);
  device.queue.submit([encoder.finish()]);await readback.mapAsync(GPUMapMode.READ);
  const raw=new Uint8Array(readback.getMappedRange()),pixels=new Uint8Array(width*height*4),bgra=gpu.canvasFormat.startsWith('bgra');
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const a=y*bytesPerRow+x*4,b=(y*width+x)*4;pixels[b]=raw[a+(bgra?2:0)];pixels[b+1]=raw[a+1];pixels[b+2]=raw[a+(bgra?0:2)];pixels[b+3]=raw[a+3];}
  readback.unmap();const error=await device.popErrorScope();if(error)shadowErrors.push(error.message);
  if(shadowErrors.length)throw Error(shadowErrors.join('\n'));return pixels;
 }
 function png(pixels){const image=document.createElement('canvas');image.width=width;image.height=height;image.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels),width,height),0,0);return image.toDataURL('image/png');}
 function groundReceiver(camera,x,y){
  // Count occluder shadows only on the ground, excluding pixels belonging to
  // the box itself. The selection uses analytic rays, never shadow results.
  const axes=FRender.shared.cameraAxes(camera),tan=Math.tan(camera.fov*Math.PI/360),u=((x+.5)/width*2-1)*width/height*tan,v=(1-(y+.5)/height*2)*tan;
  const ray=axes.forward.map((n,i)=>n+axes.right[i]*u+axes.up[i]*v),eye=camera.pos;
  if(ray[1]>=0)return false;const floorTime=-eye[1]/ray[1],at=eye.map((n,i)=>n+ray[i]*floorTime);
  if(Math.abs(at[0])>49||Math.abs(at[2])>49)return false;
  let near=0,far=Infinity;const low=[-1.5,0,-1.5],high=[1.5,4,1.5];
  for(let i=0;i<3;i++){if(Math.abs(ray[i])<1e-9){if(eye[i]<low[i]||eye[i]>high[i])return true;continue;}const a=(low[i]-eye[i])/ray[i],b=(high[i]-eye[i])/ray[i];near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));}
  return !(far>=near&&near<floorTime);
 }
 async function pair(name,full,shift=0,capture=false){
  const off=await frame(name,false,full,shift),on=await frame(name,true,full,shift),later=await frame(name,true,full,shift),camera=cameraFor(name,shift);
  let pixels=0,darkPixels=0,darkChannels=0,totalDifference=0,maxDifference=0,stationaryChangedPixels=0;
  const box=name==='occluder'?[0,width,0,height]:[Math.floor(width*.3),Math.floor(width*.7),Math.floor(height*.35),Math.floor(height*.65)];
  for(let y=box[2];y<box[3];y++)for(let x=box[0];x<box[1];x++){
   if(name==='occluder'&&!groundReceiver(camera,x,y))continue;pixels++;let dark=false,changed=false;
   for(let c=0;c<3;c++){const i=(y*width+x)*4+c,difference=off[i]-on[i];maxDifference=Math.max(maxDifference,Math.abs(difference));totalDifference+=Math.abs(difference);if(difference>2){dark=true;darkChannels++;}if(on[i]!==later[i])changed=true;}
   if(dark)darkPixels++;if(changed)stationaryChangedPixels++;
  }
  return {name,full,shift,pixels,darkPixels,darkChannels,meanDifference:totalDifference/(pixels*3),maxDifference,stationaryChangedPixels,stats:{...renderer.stats},...(capture?{images:{off:png(off),on:png(on)}}:{})};
 }
 globalThis.shadowNative={pair,metadata:{backend:renderer.stats.backend,adapter:{vendor:gpu.adapter.info?.vendor,architecture:gpu.adapter.info?.architecture},format:gpu.canvasFormat,resolution:[width,height],readback:'GPUCommandEncoder.copyTextureToBuffer from actual canvas texture'},cleanup(){readback.destroy();renderer.dispose();}};
 shadowReady=true;
})().catch(error=>{shadowErrors.push(error.stack||String(error));shadowReady=true;});
'''

report = dict(label=args.label,
              fixtures='Actual native shadow passes on procedural wall/floor/occluder, fixed sun/time; camera translations 0, 0.003 and 0.25 m; full/tiled atlas. Occluder dark pixels counted only on analytic ground receiver.',
              sourceSha256=hashlib.sha256(code.encode()).hexdigest(),
              fixtureSha256=hashlib.sha256(fixture.encode()).hexdigest(),
              modules=modules, results=[], captures=[])
with tempfile.TemporaryDirectory(prefix='emprise-shadow-webgpu-') as temp:
    html = Path(temp) / 'index.html'
    html.write_text('<!doctype html><style>body{margin:0;background:#111}canvas{display:block;width:640px;height:480px}</style><canvas width="640" height="480"></canvas><script>' + code.replace('</script', '<\\/script') + '\n' + fixture + '</script>')
    with Browser() as browser:
        browser.cmd('Page.navigate', {'url': html.as_uri()})
        browser.wait('globalThis.shadowReady', 45)
        assert not browser.ev('shadowErrors'), browser.ev('shadowErrors')
        report['native'] = browser.ev('shadowNative.metadata')
        assert report['native']['backend'] == 'webgpu'
        for name in ['wall', 'floor', 'occluder']:
            for full in [True, False]:
                for shift in [0, .003, .25]:
                    result = browser.ev('shadowNative.pair(' + ','.join(json.dumps(v) for v in [name, full, shift, shift == 0]) + ')')
                    for kind, image in result.pop('images', {}).items():
                        filename = 'shadow-webgpu-' + args.label + '-' + name + '-' + ('full' if full else 'tile') + '-' + kind + '.png'
                        (ROOT / 'docs' / filename).write_bytes(base64.b64decode(image.split(',')[1]))
                        report['captures'].append(filename)
                    report['results'].append(result)
                    print(json.dumps({k: result[k] for k in ['name', 'full', 'shift', 'pixels', 'darkPixels', 'maxDifference', 'stationaryChangedPixels']}), flush=True)
        report['errors'] = browser.ev('shadowErrors')
        browser.ev('shadowNative.cleanup();true')
        (ROOT / 'docs' / ('shadow-webgpu-' + args.label + '.json')).write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')

assert not report['errors'], report['errors']
if args.label == 'after':
    receivers = [r for r in report['results'] if r['name'] != 'occluder']
    occluders = [r for r in report['results'] if r['name'] == 'occluder']
    assert all(r['darkPixels'] == 0 and r['maxDifference'] <= 1 for r in receivers), receivers
    assert all(r['stationaryChangedPixels'] == 0 for r in report['results']), report['results']
    assert all(r['darkPixels'] > 100 for r in occluders), 'A real occluder must cast a real ground shadow in every atlas/movement configuration'
print('PASS native WebGPU shadow ' + args.label, flush=True)
