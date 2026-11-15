import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Only the real rotation function and clearance module: no city generation,
// renderer, physics step, or timing benchmark is needed for this differential.
const vehicleSource=fs.readFileSync(new URL('../src/bitume/voiture.js',import.meta.url),'utf8');
const rotation=vehicleSource.match(/function euler\(rx, ry, rz\) \{[\s\S]*?\n  \}/)[0];
const context={BITUME:{voiture:{euler:vm.runInNewContext('('+rotation+')')}},RADE:{}};
vm.runInNewContext(fs.readFileSync(new URL('../src/clearance.js',import.meta.url),'utf8'),context);
const {create}=context.RADE.clearance;
function body(p,s,r=[0,0,0]){
 const axes=context.BITUME.voiture.euler(...r),half=s.map(v=>v/2),ext=[0,1,2].map(k=>axes.reduce((n,a,i)=>n+Math.abs(a[k])*half[i],0));
 return {x:p[0],z:p[2],a:ext[0],b:ext[2],minY:p[1]-ext[1],maxY:p[1]+ext[1],mesh:{p,s,r},body:{}};
}
let seed=47231;
const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
let list=Array.from({length:240},(_,i)=>body([(i%3)*80+(random()-.5)*30,random()*5,Math.floor(i/3)%3*60+(random()-.5)*30],[.12+random()*2.6,.08+random()*1.8,.12+random()*2.6],[random()*3,random()*6,random()*3]));
const wall=(x,z,r)=>x+r>17&&x-r<17.12&&Math.abs(z)<7;
const strict=create({bodies:()=>list,staticBlocked:wall}),indexed=create({bodies:()=>list,staticBlocked:wall});
indexed.prepareBodies(list);
let probes=0;
function compare(args){assert.equal(indexed.blocked(...args),strict.blocked(...args),'probe '+JSON.stringify(args));probes++;}
for(let i=0;i<1800;i++){
 const q=list[i%list.length],near=i%3!==0;
 compare([near?q.x+(random()-.5)*4:(random()-.2)*240,near?q.z+(random()-.5)*4:(random()-.2)*200,[.24,.28,.8,2][i%4],random()*5-.3,[.35,1.8,3][i%3]]);
}
// Cell boundaries, zero radius, exact tangencies, negative coordinates, large
// boxes and unusually large/non-finite queries all keep the strict result.
list=[body([-8,.9,8],[16,1.8,.4]),body([8,.4,-8],[.4,.8,16]),body([0,4,0],[5000,.2,5000]),body([1e20,.9,1e20],[2,1.8,2])];
indexed.prepareBodies(list);
for(const x of [-16,-8,-.28,0,.28,8,16])for(const z of [-8,-.28,0,8])for(const r of [0,.24,.28,8,500,Infinity,NaN,-.1])compare([x,z,r,.08,1.8]);
for(const x of [8-.28-1e-14,8-.28,8-.28+1e-14,1e20])compare([x,x,.28,.08,1.8]);
// Publication replaces proxies, removal clears the index, and switching to an
// unprepared list preserves mutation semantics without opting into snapshots.
list=[body([0,.9,0],[2,1.8,2])];indexed.prepareBodies(list);compare([0,0,.28,.08,1.8]);
list=[body([20,.9,20],[2,1.8,2])];compare([20,20,.28,.08,1.8]);
list.push(body([0,.9,0],[2,1.8,2]));compare([0,0,.28,.08,1.8]);
indexed.prepareBodies(list);compare([0,0,.28,.08,1.8]);
list.splice(1,1);compare([0,0,.28,.08,1.8]);
indexed.prepareBodies(list);compare([0,0,.28,.08,1.8]);
list=[];indexed.prepareBodies(list);compare([0,0,.28,.08,1.8]);
// Invalid bounds use the overflow list, rather than disappearing from probes.
list=[body([0,.9,0],[1,1.8,1])];list[0].a=NaN;indexed.prepareBodies(list);compare([0,0,.28,.08,1.8]);
// A prepared publication may be refreshed in-place explicitly.
list=[body([0,.9,0],[1,1.8,1])];indexed.prepareBodies(list);compare([0,0,.28,.08,1.8]);
list[0]=body([32,.9,32],[1,1.8,1]);indexed.prepareBodies(list);compare([0,0,.28,.08,1.8]);compare([32,32,.28,.08,1.8]);

// Candidate order and duplicate occurrences survive the merge of cell lists
// and overflow records. Reading maxY happens in contact(), not index building.
const order=[];
list=[body([9,.05,9],[2,.1,2]),body([0,.05,0],[5000,.1,5000]),body([7,.05,7],[2,.1,2])];list.push(list[0]);
list.forEach((q,i)=>{if(i===3)return;Object.defineProperty(q,'maxY',{get(){order.push(i);return .1;}});});
indexed.prepareBodies(list);assert.equal(indexed.blocked(8,8,2,1,1.8),false);assert.deepEqual(order,[0,1,2,0]);

// The recovery path is unchanged, including exact accumulation order and
// persistent body identities when a physics frame publishes fresh proxies.
let left=[body([-.4,.9,0],[1.6,1.8,2]),body([.4,.9,0],[1.6,1.8,2])],right=left.slice();
const a=create({bodies:()=>left,staticBlocked:()=>false}),b=create({bodies:()=>right,staticBlocked:()=>false});
const actorA={x:0,z:0,y:0,hp:100},actorB={...actorA};
for(let i=0;i<360;i++){
 if(i%2===0){left=left.map(q=>({...body(q.mesh.p,q.mesh.s,q.mesh.r),body:q.body}));right=left.slice();b.prepareBodies(right);}
 assert.equal(b.resolve(actorB,1/120),a.resolve(actorA,1/120));assert.deepEqual(actorB,actorA);
 assert.equal(b.moveBlocked(actorB.x,actorB.z,actorB.x+.02,actorB.z,.28,0,1.8),a.moveBlocked(actorA.x,actorA.z,actorA.x+.02,actorA.z,.28,0,1.8));
 assert.equal(b.blocked(actorB.x,actorB.z,.28,0,1.8),a.blocked(actorA.x,actorA.z,.28,0,1.8));
}
assert.deepEqual({...b.metrics},{...a.metrics});

// Structural work proof, not a timing claim: 960 distant pedestrian probes
// must not invoke the narrow phase on 240 unrelated rubble proxies.
let contacts=0;
list=Array.from({length:240},(_,i)=>{const q=body([100+i%20,1,100+Math.floor(i/20)],[.3,.3,.3]);Object.defineProperty(q,'maxY',{get(){contacts++;return 1.15;}});return q;});
indexed.prepareBodies(list);
for(let i=0;i<960;i++)assert.equal(indexed.blocked(-100+i%32*.2,-100+Math.floor(i/32)*.2,.24,.08,1.8),false);
assert.equal(contacts,0);const optimizedContacts=contacts;
for(let i=0;i<960;i++)assert.equal(strict.blocked(-100+i%32*.2,-100+Math.floor(i/32)*.2,.24,.08,1.8),false);
assert.equal(contacts,960*240);
console.log(JSON.stringify({pass:true,differentialProbes:probes,recoveryFrames:360,candidateOrder:'exact including duplicates',distantProbes:960,strictContacts:contacts,optimizedContacts,scope:'No city, renderer, reduced effects, or timing benchmark'},null,2));
