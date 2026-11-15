import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
const original=execFileSync('git',['show','3ac8e4c:src/ferro/renderer.js'],{encoding:'utf8'}),current=fs.readFileSync(new URL('../src/ferro/renderer.js',import.meta.url),'utf8');
const api=code=>{const c=vm.createContext({});vm.runInContext(code,c);return c.FRender.shared;},before=api(original),after=api(current),bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
let seed=17;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296),environment={outdoorZones:[{x:0,z:0,w:200,d:180}]};
const make=id=>({id,shape:['box','sphere','bevel','ring'][id%4],p:[random()*300-150,random()*40,random()*300-150],s:id%19?[.2+random()*6,.2+random()*6,.2+random()*6]:[80,40,90],r:[random(),random(),random()],color:[random(),random(),random()],mat:id%23,detail:id%3});
let meshes=Array.from({length:900},(_,i)=>make(i)),index=null,checked=0,oldMeshes=[];
function check(label){
 const reference=before.spatialIndex(meshes,environment),previous=index;index=after.spatialIndex(meshes,environment,index);
 if(previous)assert.equal(index,previous,'index object is reconciled in place');assert.equal(index.entries.length,reference.entries.length);
 for(let i=0;i<index.entries.length;i++){const a=index.entries[i],b=reference.entries[i];assert.equal(a.mesh,b.mesh,label+' entry order');assert.equal(a.radius,b.radius);assert.equal(a.detail,b.detail);assert.deepEqual(bytes(a.row),bytes(b.row),label+' row bytes');}
 for(const mesh of oldMeshes)if(!meshes.includes(mesh))assert.equal(index.byMesh.get(mesh),undefined,'removed objects no longer occur in byMesh');
 for(let i=0;i<9;i++){const eye=[i*31-130,i%4*7,i*19-70],ranges=[22+i*3,12+i*2,i%2?7:0],a=index.query(eye,ranges),b=reference.query(eye,ranges);assert.equal(JSON.stringify(a.map(e=>e.mesh.id)),JSON.stringify(b.map(e=>e.mesh.id)),label+' exact query order');}
 const a=after.packIndexed(index.entries),b=before.packIndexed(reference.entries);assert.deepEqual(bytes(a.values),bytes(b.values));assert.equal(JSON.stringify(a.groups),JSON.stringify(b.groups));oldMeshes=meshes.slice();checked++;
}
check('initial');const retained=index.entries[50];check('unchanged');assert.equal(index.entries[50],retained,'unchanged metadata retained');
const recolored=meshes[50];recolored.color=[.03,.02,.01];recolored.renderRevision=1;check('in-place burn color revision');assert.notEqual(index.entries[50],retained);assert.equal(index.entries[50].row[12],Math.fround(.03));
meshes=meshes.filter((_,i)=>i%37!==0);check('sparse removals');meshes.splice(200,0,make(1001),make(1002));check('sparse additions');
meshes.splice(50,1,make(1003));check('replacement');meshes=[meshes[9],meshes[9],...meshes,meshes[9]];check('duplicate instances');check('retained duplicates');
meshes=meshes.slice().reverse();check('reordered instances');meshes[30].p=[203,9,-41];meshes[30].s=[80,.4,75];meshes[30].detail=0;meshes[30].renderRevision=(meshes[30].renderRevision||0)+1;check('revised position size and detail');
meshes=Array.from({length:22},(_,i)=>make(2000+i));check('complete scene replacement');meshes=[];check('empty world');meshes=oldMeshes.concat(make(3000));check('scene after empty world');
const solid={backgroundWater:false},water={backgroundWater:true},waterTruthy={backgroundWater:1},holey=[solid,,water,solid,waterTruthy];
for(const source of [null,undefined,[],holey]){const split=after.partitionWorld(source);for(const [key,predicate]of [['world',m=>!m.backgroundWater],['background',m=>m.backgroundWater]]){const expected=(source||[]).filter(predicate);assert.equal(split[key].length,expected.length);for(let i=0;i<expected.length;i++)assert.equal(split[key][i],expected[i],'single-pass partition preserves filtered occurrence order');}}
let stable=Array.from({length:300},(_,i)=>make(4000+i));const cursorIndex=after.spatialIndex(stable,environment),get=cursorIndex.byMesh.get.bind(cursorIndex.byMesh);let lookups=0;cursorIndex.byMesh.get=mesh=>{lookups++;return get(mesh);};
after.spatialIndex(stable,environment,cursorIndex);assert.equal(lookups,0,'Unchanged ordered scene needs no WeakMap lookups');
stable=stable.slice();stable.splice(40,1);stable.splice(120,0,make(5000));lookups=0;after.spatialIndex(stable,environment,cursorIndex);assert(lookups<=4,'Cursor resynchronizes after sparse insertion/removal');
const duplicate=stable[200];lookups=0;after.spatialIndex([duplicate,...stable,duplicate],environment,cursorIndex);assert.equal(cursorIndex.delta.full,true);
lookups=0;after.spatialIndex(stable,environment,cursorIndex);assert.equal(cursorIndex.delta.full,true);assert(lookups>=stable.length,'Previous duplicates disable direct reference shortcut');
console.log('PASS incremental spatial index: '+checked+' stages, exact entries/query order and packed bytes; burn revision, removals, duplicates, reordering, complete scene swap, stable cursor and single-pass partition.');
