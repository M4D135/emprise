#!/usr/bin/env python3
"""Real WebGPU validation of procedural crowd pipelines, poses and resource lifecycle."""
from browser_support import Browser,ROOT
from pathlib import Path
import tempfile,json,time,hashlib

modules=['ferro/renderer','ferro/geometry','bitume/main','bitume/voiture','human-data','body-data','human','pdr/sim/regles','ferro/crowd','pdr/foule','ferro/webgpu-shaders','ferro/crowd-webgpu','pdr/foule-webgpu']
code='\n'.join((ROOT/'src'/f'{m}.js').read_text() for m in modules)
fixture=r'''
globalThis.errors=[];globalThis.ready=false;globalThis.frames=[];
async function start(){
 const adapter=await navigator.gpu.requestAdapter();if(!adapter)throw Error('No WebGPU adapter');
 const device=await adapter.requestDevice();device.addEventListener('uncapturederror',e=>errors.push(e.error.message));device.pushErrorScope('validation');
 const canvas=document.querySelector('canvas'),context=canvas.getContext('webgpu');context.configure({device,format:'rgba8unorm',alphaMode:'opaque'});
 const depth=device.createTexture({size:[1440,900],format:'depth32float',usage:GPUTextureUsage.RENDER_ATTACHMENT});
 const shadow=device.createTexture({size:[16,16],format:'depth32float',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});
 const renderer={gpu:{device,format:'rgba8unorm',samples:1,depthFormat:'depth32float',shadowView:shadow.createView(),vignette:.9,generation:1},stats:{width:1440,height:900}};
 const crowd=PDR.foule.creerFoule(renderer,{ville:{etendue:{x0:-100,z0:-200,x1:100,z1:20},sol:()=>.08},plafond:1000,seuil:3});
 const state=new Float32Array(52*4),gait=new Float32Array(52*4);
 for(let i=0;i<52;i++){state.set([(i%13-6)*.65,-6-Math.floor(i/13)*3,Math.PI,(i%11)<<2|(1<<6)|(40<<10)],i*4);gait.set([i*.31,i*.31+.2,.8,.8],i*4);}
 state.set([0,-500,0,40<<10],51*4);
 const view={pos:[0,2,2],yaw:0,pitch:-.07,fov:60,near:.15},axes=PDR.foule.axesCamera(view),f=1/Math.tan(view.fov*Math.PI/360),near=.15,far=1200;
 const matrix=new Float32Array([axes.right[0],axes.up[0],-axes.forward[0],0,axes.right[1],axes.up[1],-axes.forward[1],0,axes.right[2],axes.up[2],-axes.forward[2],0,-axes.right.reduce((s,n,i)=>s+n*view.pos[i],0),-axes.up.reduce((s,n,i)=>s+n*view.pos[i],0),axes.forward.reduce((s,n,i)=>s+n*view.pos[i],0),1]);
 const projection=new Float32Array([f/1.6,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]),vp=new Float32Array(16);
 for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)vp[c*4+r]+=projection[k*4+r]*matrix[c*4+k];
 const vue={vp,oeil:view.pos,droite:axes.right,focale:900*f*.5,largeur:1440,hauteur:900,temps:10,soleil:[.4,.8,.3],couleurSoleil:[1,.95,.8],ambiance:[.36,.38,.42],brouillard:[.1,.14,.2],densiteBrouillard:.0005,cielHaut:[.1,.3,.5],cielBas:[.4,.5,.7],ombre:{textureView:renderer.gpu.shadowView,matrice:vp,active:false,plein:true,texel:1/16},lumieres:{nombre:0}};
 crowd.regler({brouillard:false});crowd.recevoir(state,52,gait);crowd.cadre(view,10,.5);
 globalThis.advancePose=()=>{for(let i=0;i<52;i++){gait[i*4]+=.9;gait[i*4+1]+=.9;}crowd.recevoir(state,52,gait);return true;};
 globalThis.render=async(t)=>{device.pushErrorScope('validation');vue.temps=t;crowd.cadre(view,t,.5);const encoder=device.createCommandEncoder();const shadowPass=encoder.beginRenderPass({colorAttachments:[],depthStencilAttachment:{view:renderer.gpu.shadowView,depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'store'}});const shadows={...crowd.fx.gpuShadow(shadowPass,{matrice:vp})};shadowPass.end();const pass=encoder.beginRenderPass({colorAttachments:[{view:context.getCurrentTexture().createView(),clearValue:[.06,.08,.11,1],loadOp:'clear',storeOp:'store'}],depthStencilAttachment:{view:depth.createView(),depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'store'}});const result=crowd.fx.gpuColor(pass,vue);pass.end();device.queue.submit([encoder.finish()]);await device.queue.onSubmittedWorkDone();const error=await device.popErrorScope();if(error)errors.push(error.message);frames.push({...result,shadows});return true;};
 await render(10);const validation=await device.popErrorScope();if(validation)errors.push(validation.message);
 globalThis.audit={backend:'webgpu',nativeAdapter:true,adapter:adapter.info?{vendor:adapter.info.vendor,architecture:adapter.info.architecture,device:adapter.info.device}:null,mesure:crowd.mesure,sourceCount:52,visibleMeshes:crowd.listeur.resultat.total};
 globalThis.cleanup=()=>{crowd.liberer();depth.destroy();shadow.destroy();device.destroy();};ready=true;
}
start().catch(e=>{errors.push(e.stack||String(e));ready=true;});
'''
with tempfile.TemporaryDirectory(prefix='emprise-crowd-webgpu-') as temp:
 path=Path(temp)/'index.html';path.write_text('<!doctype html><style>body{margin:0}canvas{display:block;width:1440px;height:900px}</style><canvas width="1440" height="900"></canvas><script>'+code.replace('</script','<\\/script')+'\n'+fixture+'</script>')
 with Browser() as b:
  b.cmd('Page.navigate',{'url':path.as_uri()});b.cmd('Page.bringToFront');b.wait('globalThis.ready',45)
  errors=b.ev('errors');assert not errors,errors;b.capture('crowd-webgpu-native.png')
  b.ev('advancePose();render(10.4)');b.capture('crowd-webgpu-native-pose.png');assert not b.ev('errors')
  report=b.ev('({audit,frames,errors})');assert report['audit']['visibleMeshes']>0;assert report['frames'][0]['instances']==52;assert report['frames'][0]['shadows']['instances']==51
  first=(ROOT/'docs/crowd-webgpu-native.png').read_bytes();second=(ROOT/'docs/crowd-webgpu-native-pose.png').read_bytes();assert first!=second,'Locomotion must change the rendered pose'
  report['poseChanged']=True;report['sourceSha256']=hashlib.sha256((code+fixture).encode()).hexdigest();report['fixture']='Isolated native crowd: fixed camera and procedural population, actual GPUDevice, color and shadow passes, two explicitly advanced interpolated gait phases. Renderer-world parity is tested separately.'
  (ROOT/'docs/crowd-webgpu-browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');b.ev('cleanup();true');print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)
