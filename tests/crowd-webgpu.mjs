import assert from 'node:assert/strict';
import fs from 'node:fs';
for(const file of ['ferro/renderer','ferro/geometry','bitume/main','bitume/voiture','human-data','body-data','human','pdr/sim/regles','pdr/foule','ferro/webgpu-shaders','pdr/foule-webgpu'])await import('../src/'+file+'.js');
globalThis.GPUBufferUsage={COPY_DST:8,VERTEX:32,INDEX:16,UNIFORM:64};globalThis.GPUTextureUsage={COPY_DST:2,TEXTURE_BINDING:4};globalThis.GPUShaderStage={VERTEX:1,FRAGMENT:2};
const buffers=[],textures=[],pipelines=[],writes=[],groups=[];
const device={
 createBuffer(d){const b={...d,data:new Uint8Array(d.size),destroy(){this.destroyed=true;}};buffers.push(b);return b;},
 createTexture(d){const t={...d,view:null,destroy(){this.destroyed=true;},createView(){return this.view??={texture:this};}};textures.push(t);return t;},
 createSampler(d){return {...d};},createBindGroupLayout(d){return d;},createPipelineLayout(d){return d;},createShaderModule(d){assert(d.code.includes('@vertex')||d.code.includes('@fragment'));return d;},
 createRenderPipeline(d){pipelines.push(d);return d;},
 createBindGroup(d){for(const e of d.entries){const layout=d.layout.entries.find(q=>q.binding===e.binding);assert(layout);if(layout.sampler?.type==='non-filtering')assert.equal(e.resource.magFilter,'nearest');if(layout.texture?.sampleType==='unfilterable-float')assert.equal(e.resource.texture.format,'rgba32float');}groups.push(d);return d;},
 queue:{writeBuffer(b,at,data,start=0,length){assert(!b.destroyed);const width=data.BYTES_PER_ELEMENT||1,raw=ArrayBuffer.isView(data)?new Uint8Array(data.buffer,data.byteOffset+start*width,(length??data.length-start)*width):new Uint8Array(data,start,length??data.byteLength-start);b.data.set(raw,at);writes.push(['buffer',b.label,raw.byteLength]);},writeTexture(target,data,layout,size){assert(!target.texture.destroyed);const bytes=ArrayBuffer.isView(data)?new Uint8Array(data.buffer,data.byteOffset,data.byteLength):new Uint8Array(data);const start=layout.offset||0,count=(layout.bytesPerRow||1)*(size[1]||1);target.texture.upload=bytes.slice(start,start+count);writes.push(['texture',target.texture.label,count,target.origin||[0,0,0]]);}}
};
const renderer={gpu:{device,format:'rgba8unorm',samples:4,depthFormat:'depth32float',shadowView:{shadow:true},vignette:.9,generation:1},stats:{width:1440,height:900,contextLost:false}};
const population=new Float32Array(16*4),gait=new Float32Array(16*4);for(let i=0;i<16;i++){population.set([(i%4-1.5)*.6,-3-Math.floor(i/4)*2,0,((i%11)<<2)|(32<<10)],i*4);gait.set([i*.3,i*.3+.1,.4,.6],i*4);}
population[15*4+3]=3; // The hidden faction is retained in state and rejected by both render shaders.
const view={pos:[0,1.7,0],yaw:0,pitch:0,fov:74,near:.15};
const crowd=PDR.foule.creerFoule(renderer,{ville:{etendue:{x0:-4,z0:-12,x1:4,z1:1},sol:()=>.08},plafond:8,seuil:3});
assert.equal(crowd.mesure.backend,'webgpu');assert.equal(pipelines.length,3);assert(pipelines.every(p=>p.vertex.module.code.includes('@vertex')));
crowd.regler({joueur:-1,brouillard:false});crowd.recevoir(population,16,gait);crowd.cadre(view,10,.35);
const expected=PDR.foule.creerListeur(8).lister(population,16,view,{largeur:1440,hauteur:900},{seuil:3,brouillard:null});
assert.equal(crowd.listeur.resultat.total,expected.total);assert.deepEqual(crowd.listeur.resultat.liste.slice(0,expected.total),expected.liste.slice(0,expected.total));assert.equal(crowd.etat.alpha,.35);assert.equal(crowd.etat.nPrec,0);
assert.deepEqual(textures.find(t=>t.label==='PDR crowd state 1').upload,new Uint8Array(population.buffer));
const next=population.slice();next[0]+=.4;crowd.recevoir(next,16,gait);crowd.cadre(view,10.05,.6);assert.equal(crowd.etat.nPrec,16);assert.deepEqual(crowd.etat.prec.slice(0,64),population);assert.deepEqual(textures.find(t=>t.label==='PDR crowd state 0').upload,new Uint8Array(next.buffer));
assert.deepEqual(textures.find(t=>t.label==='PDR distance gait').upload,new Uint8Array(gait.buffer));
crowd.selectionner([1,2,2,999999]);crowd.cadre(view,10.05,.6);assert.equal(crowd.selection,2);const marks=textures.find(t=>t.label==='PDR crowd marks').upload;assert.equal(marks[1]&1,1);assert.equal(marks[2]&1,1);for(const id of crowd.listeur.resultat.liste.slice(0,crowd.listeur.resultat.total))assert.equal(marks[id]&2,2);
const commands=[],pass={setPipeline(p){commands.push(['pipeline',p.label,p]);},setBindGroup(n,g){commands.push(['group',n,g]);},setVertexBuffer(...a){commands.push(['vertex',...a]);},setIndexBuffer(...a){commands.push(['index',...a]);},drawIndexed(...a){commands.push(['indexed',...a]);},draw(...a){commands.push(['draw',...a]);}};
const identity=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),light={matrice:identity};
const shadow=crowd.fx.gpuShadow(pass,light);assert.equal(shadow.instances,expected.total);const shadowIndices=commands.filter(c=>c[0]==='indexed');assert.equal(shadowIndices.reduce((n,c)=>n+c[2],0),expected.total);
commands.length=0;const vue={vp:identity,oeil:view.pos,droite:[1,0,0],focale:600,largeur:1440,hauteur:900,temps:10,soleil:[.4,.8,.3],couleurSoleil:[1,1,1],ambiance:[.2,.3,.4],brouillard:[.1,.2,.3],densiteBrouillard:.001,cielHaut:[.1,.3,.5],cielBas:[.4,.5,.7],ombre:{textureView:renderer.gpu.shadowView,matrice:identity,active:true,plein:true,texel:1/2048},lumieres:{nombre:1,positions:[2,3,4],couleurs:[1,.6,.2],directions:[0,-1,0],cones:[.2,.3],portees:[12]}};
const colour=crowd.fx.gpuColor(pass,vue);assert.equal(colour.instances,16);assert.deepEqual(commands.filter(c=>c[0]==='draw'),[['draw',6,16]]);assert(commands.some(c=>c[0]==='pipeline'&&c[1]==='PDR crowdPoint'));
const data=buffers.find(b=>b.label==='PDR crowd uniforms').data,fields=FRenderWebGPUShaders.programs.crowd.uniforms.fields,read=(name,word=0)=>new DataView(data.buffer).getFloat32(fields.find(f=>f.name===name).offset+word*4,true);
assert(Math.abs(read('uVignette')-.9)<1e-6);assert.equal(read('uDistanceGait'),1);assert(Math.abs(read('uReglages')-.6)<1e-6);assert.equal(new DataView(data.buffer).getInt32(fields.find(f=>f.name==='uCamps').offset,true),-1);assert.equal(read('uPdrLumierePosition',2),4);assert.equal(read('uPdrLumierePosition',4),0,'std140 vec3 array stride remains16');
const before=groups.length;crowd.fx.gpuColor(pass,vue);assert.equal(groups.length,before,'Bind groups retained while resources do not change');
const beforeBuffers=buffers.length,beforeTextures=textures.length,initialColourPipelines=commands.filter(c=>c[0]==='pipeline'&&c[1]!=='PDR crowdShadow').map(c=>c[2]);
for(let i=0;i<20;i++){
 renderer.gpu.samples=i%2?4:1;commands.length=0;crowd.fx.gpuColor(pass,vue);
 for(const command of commands.filter(c=>c[0]==='pipeline')){assert.equal(command[2].multisample.count,renderer.gpu.samples,'Crowd pipeline matches active color pass sample count');if(renderer.gpu.samples===4)assert(initialColourPipelines.includes(command[2]),'Returning to MSAA4 reuses the original pipeline');}
 commands.length=0;crowd.fx.gpuShadow(pass,light);assert(commands.filter(c=>c[0]==='pipeline').every(c=>c[2].multisample.count===1),'Shadow remains single-sampled');
}
assert.equal(pipelines.length,5,'Only two color variants added for repeated MSAA transitions');assert.equal(groups.length,before,'MSAA transition preserves bind groups');assert.equal(buffers.length,beforeBuffers,'MSAA transition preserves uniforms and geometry buffers');assert.equal(textures.length,beforeTextures,'MSAA transition preserves state textures');
const beforePipelines=pipelines.length,sharedVertex=buffers.find(b=>b.label==='PDR crowd geometry');crowd.liberer();assert(!sharedVertex.destroyed,'Geometry cache belongs to device');assert(buffers.filter(b=>b!==sharedVertex&&b.label!=='PDR crowd indices').every(b=>b.destroyed));assert(textures.every(t=>t.destroyed));const oldWrites=writes.length;crowd.cadre(view,11,1);assert.equal(crowd.fx.gpuColor(pass,vue),null);assert.equal(writes.length,oldWrites);
const second=PDR.foule.creerFoule(renderer,{plafond:8});assert.equal(pipelines.length,beforePipelines,'Pipelines reused across live/demo crowd lifetimes');
const longState=new Float32Array(1033*4);for(let i=0;i<1033;i++)longState.set([i,-10,.2,3],i*4);const rowStart=writes.length;second.recevoir(longState,1033);const rowWrites=writes.slice(rowStart).filter(q=>q[0]==='texture'&&q[1]==='PDR crowd state 1');assert.deepEqual(rowWrites.map(q=>[q[2],q[3]]),[[16384,[0,0,0]],[144,[0,1,0]]]);assert.deepEqual(textures.filter(t=>t.label==='PDR crowd state 1').at(-1).upload,new Uint8Array(longState.buffer,16384,144));
second.recevoir(longState,0);second.cadre(view,12,1);assert.equal(second.fx.gpuColor(pass,vue),null);second.liberer();
const report={checks:['Same procedural meshes and LOD instance lists','Double-buffered state/gait texture bytes and mark bits','Native indexed mesh and six-vertex distant-quad draw commands','Uniform std140 fields, integer camps and light strides','Non-filtering float/integer/depth bindings without float32-filterable dependency','MSAA4 to MSAA1 and back, 20 transitions, bounded pipeline cache and unchanged UBO/bind groups/textures','Cached pipelines/bind groups and deterministic resource disposal'],backend:'native-webgpu',gpuValidation:'GPU API instrumented stub; real-device shader/visual validation is separate'};
fs.writeFileSync(new URL('../docs/crowd-webgpu-validation.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
