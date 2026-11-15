import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
const load=code=>{const c=vm.createContext({});vm.runInContext(code,c);return c.FRender.shared;};
const old=load(execFileSync('git',['show','76e5ed7:src/ferro/renderer.js'],{encoding:'utf8'})),S=load(fs.readFileSync(new URL('../src/ferro/renderer.js',import.meta.url),'utf8'));
const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength),env={outdoorZones:[{x:0,z:0,w:300,d:200}]},make=id=>({id,shape:id%2?'box':'bevel',p:[id%31*9-140,id%7,id%23*11-130],s:[1+id%4,1,2],r:[0,id*.03,0],color:[.3,.4,.5],detail:id%3,mat:id%20});
const create=api=>({api,partition:null,index:null,background:null,chunks:new Map(),categories:new WeakMap(),state:{index:null,epoch:0}}),reference=create(old),candidate=create(S);let checked=0;
function update(test,meshes,options,reset){
 const partition=test.api.partitionWorld(meshes,reset?null:test.partition,options),indexOptions=partition.meshDelta?{...options,meshDelta:partition.meshDelta}:options;
 test.index=test.api.spatialIndex(partition.world,env,reset?null:test.index,indexOptions);
 if(!partition.meshDelta)test.background=test.api.spatialIndex(partition.background,env,reset?null:test.background,options);
 const plan=test.api.planChunks(test.index,test.chunks,test.categories,test.state),next=new Map();for(const [key,c]of plan)next.set(key,{range:c.range,entries:c.nextEntries||c.entries.slice(0,c.nextCount)});test.chunks=next;test.partition=partition;
}
function check(label,meshes,delta,{fast=false,reset=false,trust=true}={}){
 update(reference,meshes,{revisionedMeshes:true},reset);update(candidate,meshes,trust?{revisionedMeshes:true,meshDelta:delta}:{},reset);
 for(const name of ['index','background']){
  const a=reference[name],b=candidate[name];assert.equal(a.entries.length,b.entries.length,label+' '+name+' count');
  for(let i=0;i<a.entries.length;i++){assert.equal(a.entries[i].mesh,b.entries[i].mesh,label+' '+name+' occurrence');assert.deepEqual(bytes(a.entries[i].row),bytes(b.entries[i].row),label+' '+name+' actual row');}
  assert.deepEqual(bytes(old.packIndexed(a.entries).values),bytes(S.packIndexed(b.entries).values),label+' '+name+' packed bytes');
  for(let i=0;i<8;i++){const eye=[i*31-130,i%7,i*23-100],ranges=[70,50,30];assert.equal(JSON.stringify(a.query(eye,ranges).map(e=>e.mesh.id)),JSON.stringify(b.query(eye,ranges).map(e=>e.mesh.id)),label+' '+name+' query order');}
 }
 assert.equal(JSON.stringify([...reference.chunks.keys()]),JSON.stringify([...candidate.chunks.keys()]),label+' chunk insertion order');
 for(const [key,a]of reference.chunks){const b=candidate.chunks.get(key);assert.equal(a.range,b.range);assert.equal(JSON.stringify(a.entries.map(e=>e.mesh.id)),JSON.stringify(b.entries.map(e=>e.mesh.id)),label+' chunk occurrence order');assert.deepEqual(bytes(old.packIndexed(a.entries).values),bytes(S.packIndexed(b.entries).values),label+' chunk bytes');}
 assert.equal(!!candidate.index.delta.fast,fast,label+' direct delta path');checked++;
}
let meshes=Array.from({length:180},(_,i)=>make(i));meshes.splice(0,0,{...make(900),backgroundWater:true});meshes.splice(80,0,{...make(901),backgroundWater:true});
check('initial source',meshes,null,{reset:true});
function change(label,splices,options={fast:true},alter=d=>d){const before=meshes,after=before.slice();for(const q of splices.slice().reverse())after.splice(q.start,q.deleteCount,...q.items);meshes=after;check(label,after,alter({before,after,full:false,splices}),options);}
change('insertion before first background water',[{start:0,deleteCount:0,items:[make(1000)]}]);
change('local replacement',[{start:14,deleteCount:2,items:[make(1001),make(1002),make(1003)]}]);
change('two local splices around water',[{start:55,deleteCount:1,items:[]},{start:105,deleteCount:1,items:[make(1004)]}]);
change('appended foreground',[{start:meshes.length,deleteCount:0,items:[make(1005)]}]);
change('unchanged source with fresh array',[]);
change('stale before reference',[{start:5,deleteCount:1,items:[make(1006)]}],{fast:false},d=>({...d,before:d.before.slice()}));
change('wrong after reference',[{start:7,deleteCount:1,items:[make(1007)]}],{fast:false},d=>({...d,after:d.after.slice()}));
change('invalid splice bounds',[{start:8,deleteCount:1,items:[make(1008)]}],{fast:false},d=>({...d,splices:[{start:-1,deleteCount:0,items:[]}]}));
change('null splice record',[{start:9,deleteCount:1,items:[make(1009)]}],{fast:false},d=>({...d,splices:[null]}));
change('inserted references do not match after',[{start:9,deleteCount:1,items:[make(1010)]}],{fast:false},d=>({...d,splices:[{...d.splices[0],items:[make(9999)]}]}));
change('strict default ignores delta',[{start:10,deleteCount:1,items:[make(1011)]}],{fast:false,trust:false});
change('full marker uses general path',[{start:11,deleteCount:1,items:[make(1012)]}],{fast:false},d=>({...d,full:true}));
change('inserted background water',[{start:6,deleteCount:0,items:[{...make(902),backgroundWater:true}]}],{fast:false});
change('removed background water',[{start:6,deleteCount:1,items:[]}],{fast:false});
change('valid delta after water fallback',[{start:18,deleteCount:1,items:[make(1013)]}]);
const duplicated=make(1014);change('new duplicate occurrence',[{start:20,deleteCount:0,items:[duplicated,duplicated]}],{fast:false});
change('previous duplicates need general path',[{start:20,deleteCount:1,items:[]}],{fast:false});
change('unique scene resumes direct delta',[{start:25,deleteCount:1,items:[make(1015)]}]);
const moved=meshes[30];change('existing identity moved',[{start:30,deleteCount:1,items:[]},{start:55,deleteCount:0,items:[moved]}],{fast:false});
meshes[35].color[0]=.02;meshes[35].renderRevision=1;check('fire recolor omits delta',meshes,null);
change('direct delta after fire',[{start:35,deleteCount:1,items:[make(1016)]}]);
change('large replacement uses general path',[{start:10,deleteCount:90,items:Array.from({length:90},(_,i)=>make(2000+i))}],{fast:false});
const staleBefore=meshes;meshes=Array.from({length:100},(_,i)=>make(3000+i));check('scene reset invalidates prior partition',meshes,null,{reset:true});
change('pre-reset delta cannot apply',[{start:12,deleteCount:1,items:[make(4000)]}],{fast:false},d=>({...d,before:staleBefore}));
change('current source after scene reset',[{start:13,deleteCount:1,items:[make(4001)]}]);

// A direct splice must not read fields of a retained mesh. This distinguishes
// the intended fast path from an ordinary full reconciliation under a flag.
const retained=make(5000),replace=make(5001),source=[retained,replace],partition=S.partitionWorld(source),index=S.spatialIndex(partition.world,env);
for(const key of ['backgroundWater','renderRevision','s'])Object.defineProperty(retained,key,{get(){throw Error('Retained mesh field read: '+key);}});
const replacement=make(5002),after=[retained,replacement],delta={before:source,after,full:false,splices:[{start:1,deleteCount:1,items:[replacement]}]},options={revisionedMeshes:true,meshDelta:delta};
const patched=S.partitionWorld(after,partition,options);S.spatialIndex(patched.world,env,index,{revisionedMeshes:true,meshDelta:patched.meshDelta});assert.equal(index.delta.fast,true);
console.log('PASS explicit mesh delta: '+checked+' stages against 76e5ed7; exact partition/index/query/chunk bytes and order, strict fallbacks, retained fields never inspected.');
