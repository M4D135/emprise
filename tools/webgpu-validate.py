#!/usr/bin/env python3
"""Compile the generated WGSL and real pipelines on native WebGPU, CDP pipe only."""
from pathlib import Path
import sys,json,hashlib
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tests'))
from browser_support import Browser
WORK=ROOT.parent.parent/'work/webgpu-shaders';WORK.mkdir(parents=True,exist_ok=True)
source=(ROOT/'src/ferro/webgpu-shaders.js').read_text();html=WORK/'compile.html';html.write_text('<!doctype html><meta charset="utf-8"><title>FERRO WGSL validation</title><script>'+source+'</script>')
with Browser() as browser:
 browser.cmd('Page.navigate',{'url':html.as_uri()});browser.wait('!!globalThis.FRenderWebGPUShaders')
 result=browser.ev('''(async()=>{
 const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});if(!adapter)throw Error('No native WebGPU adapter');const device=await adapter.requestDevice();
 const report={adapter:{vendor:adapter.info.vendor,architecture:adapter.info.architecture,device:adapter.info.device,description:adapter.info.description},programs:[],errors:[]};
 device.addEventListener('uncapturederror',e=>report.errors.push(e.error.message));
 const mainBuffers=[{arrayStride:24,attributes:[{shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'float32x3'}]},{arrayStride:64,stepMode:'instance',attributes:[2,3,4,5].map((l,i)=>({shaderLocation:l,offset:i*16,format:'float32x4'}))}];
 const crowdBuffers=[{arrayStride:36,attributes:[{shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'float32x3'},{shaderLocation:2,offset:24,format:'float32x2'},{shaderLocation:3,offset:32,format:'uint8x4'}]},{arrayStride:4,stepMode:'instance',attributes:[{shaderLocation:4,offset:0,format:'uint32'}]}];
 for(const [name,p]of Object.entries(FRenderWebGPUShaders.programs)){
  const row={name,messages:[],pipeline:false,stageSha256:{}};report.programs.push(row);const modules={};
  for(const stage of ['vertex','fragment']){row.stageSha256[stage]=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(p[stage]))),b=>b.toString(16).padStart(2,'0')).join('');modules[stage]=device.createShaderModule({label:name+' '+stage,code:p[stage]});const info=await modules[stage].getCompilationInfo();row.messages.push(...info.messages.map(m=>({stage,type:m.type,line:m.lineNum,message:m.message})));}
  if(row.messages.some(m=>m.type==='error'))continue;
  const entries=[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'uniform',minBindingSize:p.uniforms.byteLength}}];
  for(const t of p.textures){entries.push({binding:t.binding,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,texture:{sampleType:t.sampleType,viewDimension:t.dimension}});entries.push({binding:t.samplerBinding,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,sampler:{type:t.samplerType}});}
  const layout=device.createPipelineLayout({bindGroupLayouts:[device.createBindGroupLayout({entries})]}),depth=name==='depth'||name==='crowdShadow';
  const desc={label:name,layout,vertex:{module:modules.vertex,entryPoint:'main',buffers:['world','depth','fx'].includes(name)?mainBuffers:['crowd','crowdShadow'].includes(name)?crowdBuffers:[]},fragment:{module:modules.fragment,entryPoint:'main',targets:depth?[]:[{format:'rgba8unorm'}]},primitive:{topology:'triangle-list'},multisample:{count:depth?1:4}};
  if(['world','depth','fx','crowd','crowdShadow','crowdPoint'].includes(name))desc.depthStencil={format:'depth32float',depthWriteEnabled:true,depthCompare:'less-equal'};
  try{await device.createRenderPipelineAsync(desc);row.pipeline=true;}catch(e){row.messages.push({type:'error',stage:'pipeline',message:e.message});}
 }
 device.destroy();return report;
})()''')
result['shaderFileSha256']=hashlib.sha256(source.encode()).hexdigest();result['compiler']='Naga 30.0.1; Dawn native validation via Chrome';result['programCount']=len(result['programs'])
(ROOT/'docs/webgpu-shaders-validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False,indent=2),flush=True)
assert not result['errors'] and all(p['pipeline'] for p in result['programs'])
