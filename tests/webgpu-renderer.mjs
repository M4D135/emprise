// API/state regression tests. Native WGSL validation and image/performance parity
// run separately in Chrome; this fake device only observes command contracts.
import assert from 'node:assert/strict';
import '../src/ferro/renderer.js';
import '../src/ferro/webgpu-shaders.js';
import '../src/ferro/webgpu-renderer.js';
const constants=names=>Object.fromEntries(names.split(' ').map((s,i)=>[s,1<<i]));
globalThis.GPUBufferUsage=constants('MAP_READ MAP_WRITE COPY_SRC COPY_DST INDEX VERTEX UNIFORM STORAGE INDIRECT QUERY_RESOLVE');
globalThis.GPUTextureUsage=constants('COPY_SRC COPY_DST TEXTURE_BINDING STORAGE_BINDING RENDER_ATTACHMENT');
globalThis.GPUShaderStage=constants('VERTEX FRAGMENT COMPUTE');globalThis.GPUMapMode={READ:1};
function fakeDevice(validationError=null){
 const allocated=[],submissions=[];let destroyed=false;
 const resource=extra=>{const r={...extra,destroyed:false,destroy(){this.destroyed=true;}};allocated.push(r);return r;};
 const device={features:new Set(['timestamp-query']),lost:new Promise(()=>{}),addEventListener(){},pushErrorScope(){},async popErrorScope(){return validationError;},destroy(){destroyed=true;},
 createBuffer(d){return resource({descriptor:d,data:new ArrayBuffer(d.size),async mapAsync(){},getMappedRange(o=0,n=d.size){return this.data.slice(o,o+n);},unmap(){}});},
 createTexture(d){const r=resource({descriptor:d,createView(v={}){return {texture:r,descriptor:v};}});return r;},
 createSampler:d=>({descriptor:d}),createBindGroupLayout:d=>({descriptor:d}),createPipelineLayout:d=>({descriptor:d}),createBindGroup:d=>({descriptor:d}),createQuerySet:d=>resource({descriptor:d}),
 createShaderModule:d=>({descriptor:d,async getCompilationInfo(){return {messages:[]};}}),createRenderPipeline:d=>({descriptor:d,getBindGroupLayout(){return {};}}),
 createCommandEncoder(){const commands=[];return {beginRenderPass(d){const p={descriptor:d,pipeline:null,groups:[],draws:[],setViewport(...v){this.viewport=v;},setPipeline(v){this.pipeline=v;},setBindGroup(i,v){this.groups[i]=v;},setVertexBuffer(){},setIndexBuffer(){},draw(...args){this.draws.push({pipeline:this.pipeline,groups:this.groups.slice(),args});},drawIndexed(...args){this.draw(...args);},end(){}};commands.push(p);return p;},copyTextureToTexture(){},resolveQuerySet(q,first,count,b,offset){const a=new BigUint64Array(b.data,offset,2);a[0]=1000000n;a[1]=1400000n;},copyBufferToBuffer(a,o,b,d,n){new Uint8Array(b.data,d,n).set(new Uint8Array(a.data,o,n));},finish(){return commands;}};},
 queue:{writeBuffer(b,o,v){const a=v instanceof ArrayBuffer?new Uint8Array(v):new Uint8Array(v.buffer,v.byteOffset,v.byteLength);new Uint8Array(b.data,o,a.length).set(a);},writeTexture(){},copyExternalImageToTexture(){},submit(commands){submissions.push(commands.flat());}}
 };
 return {device,allocated,submissions,get destroyed(){return destroyed;}};
}
function install(fake){Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu:{async requestAdapter(){return {features:new Set(['timestamp-query']),async requestDevice(){return fake.device;}};},getPreferredCanvasFormat(){return 'bgra8unorm';}}}});const context={configured:false,configure(){this.configured=true;},unconfigure(){this.configured=false;},getCurrentTexture(){return {createView(){return {};}};}};return {canvas:{clientWidth:800,clientHeight:600,width:800,height:600,getContext(name){assert.equal(name,'webgpu');return context;}},context};}
const desc=FRenderWebGPUShaders.programs.world.uniforms,block=new ArrayBuffer(desc.byteLength),matrices=Array.from({length:48},(_,i)=>i+.25),positions=Array.from({length:36},(_,i)=>i+.5);
FRenderWebGPU.writeUniforms(block,desc.fields,{uLightCount:7,uLightPosition:positions,uShadowMatrix:matrices,uLightRange:Array(12).fill(13)});
const field=n=>desc.fields.find(f=>f.name===n),ints=new Int32Array(block),floats=new Float32Array(block);
assert.equal(ints[field('uLightCount').offset/4],7);assert.equal(floats[(field('uLightPosition').offset+16*3)/4],9.5);assert.equal(floats[field('uShadowMatrix').offset/4+16],16.25);assert.equal(floats[(field('uLightRange').offset+16*11)/4],13);
const fake=fakeDevice(),{canvas,context}=install(fake),renderer=await FRenderWebGPU.create(canvas,{msaa:4,shadowMapScale:2,vignette:.9,bloomThreshold:[.9,.99]});
assert.equal(renderer.gl,undefined);assert.equal(renderer.stats.backend,'webgpu');assert.equal(renderer.gpu.vignette,.9);
renderer.resize(1);renderer.setWorld([{shape:'box',p:[0,1,-8],s:[2,2,2],mat:8}], [{p:[2,4,-5],power:10}],{sunDirection:[.4,.8,.3]});
const cam={pos:[0,1.6,0],yaw:0,pitch:0,near:.15,overlayNear:.035,far:180},models=[{shape:'box',p:[1,1,-6],s:[1,1,1],mat:10},{shape:'box',p:[0,1,-.1],s:[.1,.1,.1],overlay:true,mat:2},{shape:'sphere',p:[0,1,-4],s:[1,1,1],fx:true,alpha:.4}];
const hooks=[];renderer.draw(cam,models,{time:4,foule:{gpuShadow(pass,v){hooks.push(['shadow',v.matrice.length]);return {appels:1,triangles:4};},gpuColor(pass,v){hooks.push(['color',v.msaa]);assert(v.ombre.textureView);return {appels:1,triangles:4,instances:1};}}});
assert.deepEqual(hooks,[['shadow',16],['color',4]]);assert(renderer.stats.reflections);assert.equal(renderer.stats.msaa,4);assert.equal(renderer.stats.shadowMaps,3);
const frame=fake.submissions.at(-1),shadow=frame.find(p=>p.descriptor.label==='FERRO shadow atlas'),post=frame.filter(p=>p.descriptor.label?.startsWith('FERRO bloom'));
assert.equal(post.length,3);const postPassOffset=FRenderWebGPUShaders.programs.post.uniforms.fields.find(f=>f.name==='uPass').offset/4;
assert.deepEqual(post.map(p=>new Int32Array(p.draws[0].groups[0].descriptor.entries[0].resource.buffer.data)[postPassOffset]),[0,1,2],'Distinct UBOs retain per-pass values until submission');
const shadowBuffers=new Set(shadow.draws.map(d=>d.groups[0].descriptor.entries[0].resource.buffer));assert.equal(shadowBuffers.size,3,'Lamp/sun/torch matrices need independent storage');
const main=frame.find(p=>p.descriptor.label==='FERRO scene'),overlay=frame.find(p=>p.descriptor.label==='FERRO close weapon');assert.notEqual(main.descriptor.depthStencilAttachment.view,overlay.descriptor.depthStencilAttachment.view,'Close weapon never destroys SSR world depth');
const buffers=fake.allocated.filter(x=>x.descriptor.usage&GPUBufferUsage.UNIFORM).length;
for(let i=0;i<12;i++){canvas.clientWidth=810+i;renderer.draw(cam,models,{time:4});}
assert.equal(fake.allocated.filter(x=>x.descriptor.usage&GPUBufferUsage.UNIFORM).length,buffers,'Resize reuses bounded uniform slots');
renderer.draw(cam,models,{time:4,msaa:false});assert.equal(renderer.gpu.samples,1);renderer.draw(cam,models,{time:4,msaa:true});assert.equal(renderer.gpu.samples,4);
await renderer.setProfiling(true);renderer.draw(cam,models,{time:4});const measured=await renderer.setProfiling(false);assert.equal(measured.available,true);assert.deepEqual(measured.samples,[.4]);
renderer.dispose();assert(fake.destroyed);assert.equal(context.configured,false);assert(fake.allocated.every(x=>x.destroyed));
const broken=fakeDevice({message:'forced initialization validation failure'}),bad=install(broken);await assert.rejects(()=>FRenderWebGPU.create(bad.canvas,{}),/initialization/);assert(broken.destroyed);assert(broken.allocated.every(x=>x.destroyed));assert.equal(bad.context.configured,false);
console.log('Native WebGPU contracts PASS: std140, independent pass UBOs, MSAA/SSR overlay depth, crowd hooks, bounded resize resources, timing ring, creation failure cleanup.');
