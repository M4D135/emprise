import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
const load=code=>{const c=vm.createContext({});vm.runInContext(code,c);return c.FRender.shared;};
const old=load(execFileSync('git',['show','76e5ed7:src/ferro/renderer.js'],{encoding:'utf8'})),now=load(fs.readFileSync(new URL('../src/ferro/renderer.js',import.meta.url),'utf8'));
const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength),env={outdoorZones:[{x:0,z:0,w:300,d:200}]};let seed=733;
const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
const make=id=>({id,shape:['box','sphere','bevel'][id%3],p:[random()*300-150,random()*10,random()*240-120],s:id%37?[.5+random()*6,1,2]:[80,30,90],r:[0,random(),0],color:[.3,.4,.5],detail:id%3,mat:id%20});
let meshes=Array.from({length:500},(_,i)=>make(i)),a=null,b=null,checked=0;
function check(label,options={revisionedMeshes:true}){
 a=old.spatialIndex(meshes,env,a,options);b=now.spatialIndex(meshes,env,b,options);
 assert.equal(a.entries.length,b.entries.length,label+' occurrence count');
 for(let i=0;i<a.entries.length;i++){assert.equal(a.entries[i].mesh,b.entries[i].mesh,label+' occurrence order');assert.deepEqual(bytes(a.entries[i].row),bytes(b.entries[i].row),label+' row bytes');}
 assert.deepEqual(bytes(old.packIndexed(a.entries).values),bytes(now.packIndexed(b.entries).values),label+' packed bytes');
 for(let i=0;i<20;i++){const eye=[i*17-150,i%9,i*11-120],ranges=[60,40,20];assert.equal(JSON.stringify(a.query(eye,ranges).map(e=>e.mesh.id)),JSON.stringify(b.query(eye,ranges).map(e=>e.mesh.id)),label+' exact query order');}
 assert.equal(JSON.stringify(a.delta.removed.map(e=>e.mesh.id).sort((x,y)=>x-y)),JSON.stringify(b.delta.removed.map(e=>e.mesh.id).sort((x,y)=>x-y)),label+' exact removed occurrences');
 checked++;
}
check('initial');check('unchanged');
meshes.splice(5,1);meshes.splice(275,1);check('disjoint removals');
meshes.splice(0,0,make(1001));meshes.splice(210,0,make(1002));meshes.push(make(1003));check('beginning middle and end insertions');
meshes[48].renderRevision=1;meshes[48].color[0]=.05;check('color revision');
meshes[67].renderRevision=1;meshes[67].p[0]+=250;meshes[67].p[2]-=250;check('revised bucket move');
meshes[72].p[0]+=200;check('strict unversioned in-place position',{});
assert(b.query(meshes[72].p,[2,2,2]).some(e=>e.mesh===meshes[72]),'Moved strict mesh occurs in its new bucket');
for(const index of [a,b])index.byMesh.get(meshes[75]).radius=90;check('strict metadata small-to-large threshold',{});
const moved=meshes.splice(250,1)[0];moved.renderRevision=(moved.renderRevision||0)+1;meshes.unshift(moved);check('revised mesh moved ahead of retained prefix');
meshes.shift();moved.renderRevision++;meshes.splice(250,0,moved);check('revised mesh moved behind retained prefix');
const unique=meshes.slice();meshes=[meshes[50],...meshes,meshes[50]];check('duplicate occurrences');check('repeated duplicate occurrences');
meshes[0].renderRevision=(meshes[0].renderRevision||0)+1;check('revised duplicate occurrence');meshes=unique;check('previous duplicates removed');
meshes.reverse();check('reversed order');meshes=meshes.slice(80).concat(meshes.slice(0,80));check('rotated order');
for(let i=0;i<28;i++){
 const at=Math.floor(random()*meshes.length);
 if(i%4===0)meshes.splice(at,1);
 else if(i%4===1)meshes.splice(at,0,make(1100+i));
 else if(i%4===2){meshes[at]={...meshes[at],p:[random()*300-150,2,random()*240-120]};}
 else{meshes[at].renderRevision=(meshes[at].renderRevision||0)+1;meshes[at].s=[70+i,.5,90];}
 check('seeded sparse update '+i);
}
meshes=Array.from({length:20},(_,i)=>make(2000+i));check('complete replacement');meshes=[];check('empty scene');meshes=[make(3000)];check('restart');

// Unaffected bucket objects are frozen: touching their counters or replacing
// their arrays would throw, so this verifies actual locality, not just output.
const local={shape:'box',p:[0,1,0],s:[1,1,1]},anchors=Array.from({length:80},(_,i)=>({shape:'box',p:[100+i*16,1,100],s:[1,1,1]}));
const locality=now.spatialIndex([local,...anchors],env),frozen=anchors.map(mesh=>{const bucket=locality.byMesh.get(mesh).indexBucket;Object.freeze(bucket.entries);Object.freeze(bucket);return bucket;});
const replacement={...local,p:[2,1,1]};now.spatialIndex([replacement,...anchors],env,locality,{revisionedMeshes:true});
for(let i=0;i<anchors.length;i++)assert.equal(locality.byMesh.get(anchors[i]).indexBucket,frozen[i],'unaffected buckets retain exact identity');
assert.equal(locality.byMesh.get(local),undefined);assert.equal(locality.query([0,1,0],[10,0,0])[0].mesh,replacement);
console.log('PASS sparse renderer buckets: '+checked+' stages against 76e5ed7, exact rows/query order/removal occurrences; 80 unaffected buckets frozen during local replacement.');
