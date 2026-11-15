import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
const load=source=>{const context=vm.createContext({});vm.runInContext(source,context);return context.FRender.shared;};
const S=load(fs.readFileSync(new URL('../src/ferro/renderer.js',import.meta.url),'utf8'));
const baseline=load(execFileSync('git',['show','3ac8e4c:src/ferro/renderer.js'],{encoding:'utf8'}));
const env={outdoorZones:[{x:0,z:0,w:200,d:180}]},bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
const make=id=>({id,shape:['box','sphere','bevel','ring'][id%4],p:[id%31*9-140,id%7,(id*13)%41*7-140],s:id%29?[1+id%3,.4+id%6,1.5]:[90,30,70],r:[0,id*.03,0],color:[.3,.4,.5],detail:id%3,mat:id%20});
const create=options=>({options,index:null,chunks:new Map(),categories:new WeakMap(),state:{index:null,epoch:0}}),strict=create(undefined),trusted=create({revisionedMeshes:true});
let meshes=Array.from({length:700},(_,i)=>make(i)),checked=0;
function update(test,reset){
 test.index=S.spatialIndex(meshes,env,reset?null:test.index,test.options);
 const plan=S.planChunks(test.index,test.chunks,test.categories,test.state),next=new Map();
 for(const [key,chunk]of plan)next.set(key,{range:chunk.range,entries:chunk.nextEntries||chunk.entries.slice(0,chunk.nextCount)});
 test.chunks=next;
}
function check(label,reset=false){
 update(strict,reset);update(trusted,reset);const reference=baseline.spatialIndex(meshes,env);
 for(const test of [strict,trusted]){
  assert.equal(test.index.entries.length,reference.entries.length,label+' occurrence count');
  for(let i=0;i<reference.entries.length;i++){const a=test.index.entries[i],b=reference.entries[i];assert.equal(a.mesh,b.mesh,label+' occurrence order');assert.deepEqual([a.radius,a.detail,...a.p],[b.radius,b.detail,...b.p],label+' spatial metadata');assert.deepEqual(bytes(a.row),bytes(b.row),label+' actual packed row');}
  assert.deepEqual(bytes(S.packIndexed(test.index.entries).values),bytes(baseline.packIndexed(reference.entries).values),label+' baseline bytes');
  for(let i=0;i<10;i++){const eye=[i*31-140,i%7,i*21-130],ranges=[80,45,20];assert.equal(JSON.stringify(test.index.query(eye,ranges).map(e=>e.mesh.id)),JSON.stringify(reference.query(eye,ranges).map(e=>e.mesh.id)),label+' baseline query order');}
 }
 assert.equal(JSON.stringify([...strict.chunks.keys()]),JSON.stringify([...trusted.chunks.keys()]),label+' chunk insertion order');
 for(const [key,a]of strict.chunks){const b=trusted.chunks.get(key);assert.equal(a.range,b.range);assert.equal(JSON.stringify(a.entries.map(e=>e.mesh.id)),JSON.stringify(b.entries.map(e=>e.mesh.id)),label+' chunk occurrence order');assert.deepEqual(bytes(S.packIndexed(a.entries).values),bytes(S.packIndexed(b.entries).values),label+' chunk bytes');}
 assert.equal(trusted.state.incremental,strict.state.incremental,label+' same safe fallback');checked++;
}
const revise=mesh=>mesh.renderRevision=(mesh.renderRevision||0)+1;
check('initial');check('unchanged');
meshes[45]={...meshes[45],color:[.9,.2,.1]};check('replacement identity');
meshes[70].color[0]=.08;revise(meshes[70]);check('revised in-place burn color');
meshes[90].p[0]+=180;meshes[90].p[2]-=70;revise(meshes[90]);check('revised in-place position');
meshes[95].s=[90,12,60];revise(meshes[95]);check('revised size crosses spatial and chunk thresholds');
Object.assign(meshes[100],{r:[.2,.4,.3],mat:8,emissive:.8,detail:2,ground:true,shape:'bevel'});revise(meshes[100]);check('revised rotation material flags shape and detail');
meshes.splice(0,0,make(1001));meshes.splice(300,0,make(1002));check('insertions');
meshes.splice(50,1);meshes.splice(280,1);check('removals');
const unique=meshes.slice();meshes=[meshes[20],...meshes,meshes[20]];check('duplicate occurrences');check('repeated duplicates');
meshes=unique;check('duplicates removed');meshes.reverse();check('reordered scene');check('unchanged after reorder');
meshes=Array.from({length:25},(_,i)=>make(2000+i));check('complete scene replacement');check('setWorld replacement index',true);meshes=[];check('empty scene');meshes=[make(3000)];check('return from empty scene');

// Verify that opt-in really skips retained signatures, and that omitting it
// on the next update restores strict validation rather than latching the mode.
const observed=make(5000),size=observed.s;let reads=0;Object.defineProperty(observed,'s',{get(){reads++;return size;}});
const index=S.spatialIndex([observed],env),categories=new WeakMap(),state={index:null,epoch:0};let chunks=S.planChunks(index,new Map(),categories,state);
for(const [key,c]of chunks)chunks.set(key,{range:c.range,entries:c.nextEntries});
reads=0;S.spatialIndex([observed],env,index,{revisionedMeshes:true});assert.equal(reads,0,'Opt-in skips unchanged size signature');
reads=0;S.spatialIndex([observed],env,index);assert(reads>0,'Strict validation remains the default on every call');
console.log('PASS revisioned meshes: '+checked+' stages; strict/opt-in exact rows, query and chunk order; fresh baseline 3ac8e4c bytes, revision refresh and non-latching contract.');
