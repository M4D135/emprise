import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
const baseline=execFileSync('git',['show','3ac8e4c:src/ferro/renderer.js'],{encoding:'utf8'}),current=fs.readFileSync(new URL('../src/ferro/renderer.js',import.meta.url),'utf8');
function harness(source){
 const context=vm.createContext({});
 vm.runInContext(source.replace('globalThis.FRender={create,foliageTriangles,forme};','globalThis.FRender={spatialIndex,packIndexed,visible};'),context);context.FRender=context.FRender.shared||context.FRender;
 const a=source.indexOf('    let chunks=new Map();'),b=source.indexOf('    function drawChunks(',a);assert(a>=0&&b>a);
 return vm.runInContext(`(()=>{const events=[],stats={},gl={ARRAY_BUFFER:1,STATIC_DRAW:2,serial:0,createBuffer(){const b={id:++this.serial};events.push(['create',b.id]);return b;},bindBuffer(_,b){this.bound=b;events.push(['bind',b.id]);},bufferData(_,values){events.push(['data',this.bound.id,values.byteLength]);},deleteBuffer(b){events.push(['delete',b.id]);}},packIndexed=FRender.packIndexed,planChunks=FRender.planChunks;let worldIndex={entries:[],byMesh:new WeakMap()};${source.slice(a,b)}return {prepare(meshes,reset=false){worldIndex=FRender.spatialIndex(meshes,null,reset?null:worldIndex);},rebuild:rebuildChunks,get chunks(){return chunks;},get stats(){return stats;},get events(){return events;},resetEvents(){events.length=0;},entry(mesh){return worldIndex.byMesh.get(mesh);},restore(){chunks.clear();rebuildChunks();},visible:FRender.visible};})()`,context);
}
const before=harness(baseline),after=harness(current);let seed=135;
const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
const steps=[];
function compare(label,meshes,{reset=false,restore=false,incremental}={}){
 const previous=new Map(after.chunks);before.resetEvents();after.resetEvents();
 for(const api of [before,after]){api.prepare(meshes,reset);restore?api.restore():api.rebuild();}
 assert.equal(JSON.stringify([...before.chunks.keys()]),JSON.stringify([...after.chunks.keys()]),label+' key insertion order');
 let reused=0;
 for(const [key,a] of before.chunks){
  const b=after.chunks.get(key);
  assert.deepEqual([a.range,...a.min,...a.max,...a.p,a.radius],[b.range,...b.min,...b.max,...b.p,b.radius],label+' exact bounds');
  assert.equal(a.buffer.id,b.buffer.id,label+' buffer identities');
  assert.equal(JSON.stringify(a.batch.groups),JSON.stringify(b.batch.groups),label+' shape groups');
  assert.deepEqual(Buffer.from(a.batch.values.buffer),Buffer.from(b.batch.values.buffer),label+' exact instance bytes');
  assert.equal(a.entries.length,b.entries.length);
  for(let j=0;j<a.entries.length;j++)assert.equal(a.entries[j].mesh,b.entries[j].mesh,label+' retained mesh order');
  assert(!Object.hasOwn(b,'previous')&&!Object.hasOwn(b,'same'),'final chunk does not retain a previous generation');
  if(previous.get(key)===b)reused++;
  for(const x of [-140,0,65,200])for(const z of [-130,0,75]){
   const eye=[x,1.7,z],axes={right:[1,0,0],up:[0,1,0],forward:[0,0,1]};
   assert.equal(before.visible(a,eye,axes,1.2,.7,Math.min(6000,a.range)),after.visible(b,eye,axes,1.2,.7,Math.min(6000,b.range)),label+' identical visibility');
  }
 }
 assert.equal(JSON.stringify(before.events),JSON.stringify(after.events),label+' exact buffer allocation/upload/deletion sequence');
 assert.equal(JSON.stringify(before.stats),JSON.stringify(Object.fromEntries(Object.keys(before.stats).map(key=>[key,after.stats[key]]))),label+' unchanged pre-existing chunk statistics');
 if(incremental!==undefined)assert.equal(after.stats.chunkUpdateIncremental,incremental,label+' reconciliation path');
 steps.push({label,chunks:after.chunks.size,reused,uploadedBytes:after.stats.chunkBuildBytes,incremental:after.stats.chunkUpdateIncremental,entriesVisited:after.stats.chunkEntriesVisited});
}
let meshes=Array.from({length:2400},(_,i)=>({shape:['box','sphere','bevel','cylinder','unknown'][i%5],p:[(i%50)*7.1-170,random()*4,Math.floor(i/50)*6.5-160],s:[.3+random()*7,.02+random()*3,.2+random()*5],r:[0,random(),0],detail:i%8===0?2:i%3===0?1:0,ground:i%11===0,color:[random(),random(),random()],mat:i%20}));
for(const x of [-128,-32,-.001,0,31.999,32,127.999,128])for(const size of [.649999,.65,4,4.000001,81])meshes.push({shape:'box',p:[x,.16,x],s:[size,.149,1],color:[.3,.4,.5]});
meshes.push({shape:'box',p:[0,.2,0],s:[1,1,1,8],detail:'2'});
compare('initial',meshes,{incremental:false});compare('unchanged references',meshes.slice(),{incremental:true});assert.equal(steps.at(-1).uploadedBytes,0);assert.equal(steps.at(-1).reused,steps.at(-1).chunks);
meshes=meshes.filter((_,i)=>i!==11&&i!==917);compare('two removals',meshes,{incremental:true});
meshes=meshes.map((m,i)=>i===85?{...m,color:[.9,.2,.1],p:m.p.slice()}:m);compare('replacement with retained neighbours',meshes);
meshes=meshes.concat([{shape:'box',p:[33,.11,-33],s:[.4,.1,.4],ground:true},{shape:'sphere',p:[800,20,-900],s:[100,10,80],detail:2}]);compare('new small and large chunks',meshes);
meshes=[{shape:'box',p:[800,20,-900],s:[100,10,80],detail:2},...meshes];meshes.splice(900,0,{shape:'box',p:[1,1,1],s:[1,1,1]});compare('insertions at first and middle positions',meshes,{incremental:true});
meshes=meshes.slice(1);compare('removing first chunk member reorders keys',meshes,{incremental:true});
const unique=meshes.slice();meshes=[meshes[45],...meshes,meshes[102]];compare('duplicate occurrences force full path',meshes,{incremental:false});
compare('repeated duplicate list remains exact',meshes.slice(),{incremental:false});meshes=unique;compare('previous duplicates removed force full path',meshes,{incremental:false});
compare('unique list resumes incremental path',meshes.slice(),{incremental:true});
meshes.reverse();compare('reordered entries and chunk keys',meshes,{incremental:false});
meshes[10].p[0]+=180;meshes[10].p[1]=.01;meshes[10].s[1]=.02;meshes[10].detail=2;meshes[10].ground=true;compare('in-place category changes invalidate scalar cache',meshes);
const extended=meshes.find(m=>m.s.length===4);extended.s[3]=.5;compare('nonstandard size array remains uncached',meshes);
for(const api of [before,after])api.entry(meshes[20]).radius=90;compare('retained metadata radius threshold change',meshes);
compare('fresh spatial metadata on setWorld',meshes,{reset:true,incremental:false});compare('context restore uploads every chunk',meshes,{restore:true,incremental:false});compare('empty world deletes all buffers',[]);
if(process.argv.includes('--checks-only')){console.log('PASS chunk reconciliation: '+steps.length+' differential stages against 3ac8e4c; exact order, bounds, rows, buffer calls and fallback paths.');process.exit(0);}

// CPU-only benchmark of rebuildChunks, excluding spatialIndex and all GPU work.
// Alternating order and warmed caches avoid attributing JIT or fixture setup to the patch.
const large=Array.from({length:226000},(_,i)=>({shape:i%5?'box':'bevel',p:[(i%550)*2-550,.1+(i%19)*.31,Math.floor(i/550)*2-410],s:[1+(i%5)*.31,.13+(i%7)*.17,.7+(i%3)*.27],detail:i%4===0?2:i%3===0?1:0,color:[.4,.5,.6],mat:i%20}));
const oldBench=harness(baseline),newBench=harness(current);let frame=large;
for(const api of [oldBench,newBench]){api.prepare(frame,true);api.rebuild();api.resetEvents();}
const samples={before:[],after:[]};
for(let iteration=0;iteration<13;iteration++){
 const at=100000+(iteration%8)*3;frame=frame.slice();frame[at]={...frame[at],color:[.4,.5,.60+iteration*.0001]};
 for(const api of [oldBench,newBench])api.prepare(frame);
 for(const [name,api] of iteration%2?[['after',newBench],['before',oldBench]]:[['before',oldBench],['after',newBench]]){
  api.resetEvents();const start=performance.now();api.rebuild();const ms=performance.now()-start;if(iteration>=3)samples[name].push(ms);
 }
 assert.equal(oldBench.stats.chunkBuildBytes,newBench.stats.chunkBuildBytes,'benchmark uploads remain identical');
}
const summary=xs=>{const sorted=xs.slice().sort((a,b)=>a-b);return {samples:xs.length,medianMs:+sorted[Math.floor(sorted.length/2)].toFixed(3),minMs:+sorted[0].toFixed(3),maxMs:+sorted.at(-1).toFixed(3)};};
const report={baseline:'3ac8e4c',steps,benchmark:{entries:large.length,changedMeshesPerUpdate:1,method:'CPU only, spatialIndex and GPU excluded; 3 warmups, 10 measured alternating-order rebuilds',before:summary(samples.before),after:summary(samples.after)},checks:['Exact keys, insertion order and conservative bounds','Identical frustum decisions','Byte-identical batches and shape groups','Identical buffer reuse, upload and deletion sequence','Scalar cache invalidates on in-place category changes','No links from new chunks to replaced generations','setWorld, context restoration and empty-world cleanup'],limitation:'This measures rebuildChunks in Node with a buffer-call recorder, not browser frame time or a proven cause of the destruction spikes.'};
fs.writeFileSync(new URL('../docs/renderer-chunks-validation.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
