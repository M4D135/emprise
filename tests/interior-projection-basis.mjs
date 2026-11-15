// No browser. Compare the complete projected mesh/collider/light values with
// the pre-cache algorithm, including signed zero and independent output arrays.
import './load.mjs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const prior=process.env.EMPRISE_PROJECTION_ORACLE?readFileSync(process.env.EMPRISE_PROJECTION_ORACLE,'utf8'):execFileSync('git',['show','22a330f:src/interiors.js'],{encoding:'utf8'}),current=readFileSync('src/interiors.js','utf8');
function load(source){
 let calculations=0;const originalEuler=BITUME.voiture.euler,voiture={...BITUME.voiture,euler(...args){calculations++;return originalEuler(...args);}},context=vm.createContext({RADE:{...RADE},BITUME:{...BITUME,voiture},console});vm.runInContext(source,context);return {api:context.RADE.interiors,voiture,get calculations(){return calculations;}};
}
function setup(module,angle=.61){
 const q={x:20,z:-30,lx:20,lz:24,lacet:angle},n=[Math.sin(angle),Math.cos(angle)],building={id:'basis-fixture',index:7,type:'restaurant',name:'Restaurant',floors:4,h:12.4,boxes:[q],places:[{id:'place',name:'Restaurant',type:'restaurant',kind:'restaurant',sourceUrl:'fixture://projection',x:q.x,z:q.z}],x:q.x+n[0]*13,z:q.z+n[1]*13,nx:n[0],nz:n[1]},mesh={shape:'box',p:[q.x,6.2,q.z],s:[q.lx,12.4,q.lz],r:[0,angle,0],mat:13};
 const player={x:0,y:.08,z:0,yaw:.4,hp:100},world={addresses:{entries:[building],shared:0},blocked:()=>false,freeNear:(x,z)=>[x,z],rayBox:()=>100,room:null},sim={state:{player,dead:false},relocate(x,z,yaw=0){Object.assign(player,{x,z,y:.08,yaw});}},interiors=module.api.create(world,sim),bridge=interiors.breachProjection({mesh,point:[q.x+n[0]*12,1.1,q.z+n[1]*12],normal:[n[0],0,n[1]]});
 return {module,bridge,interiors,world,mesh,q,n};
}
const before=setup(load(prior)),after=setup(load(current));let comparisons=0;
const snapshot=b=>({scenery:b.scenery,colliders:b.colliders.map(c=>({...c,mesh:b.scenery.indexOf(c.mesh)})),lights:b.lights});
function equal(label){assert.deepEqual(structuredClone(snapshot(after.bridge)),structuredClone(snapshot(before.bridge)),label);comparisons++;}
function refresh(label){before.bridge.refresh();after.bridge.refresh();equal(label);}
equal('Initial real procedural restaurant projection');
const count=after.module.calculations;refresh('Repeated projection retains exact values');assert(after.module.calculations-count<before.bridge.scenery.length/2,'Repeated furniture rotations reuse their basis');
function mesh(i,r=[0,0,0]){return {shape:'box',p:[998+i*.01,.5+i*.001,1001-i*.01],s:[.8,.6,1.2],r:r.slice(),color:[.4,.5,.6],mat:7,material:'wood',mass:8,collision:true};}
function setMeshes(list){for(const side of [before,after]){const room=side.bridge.room;room.scenery=structuredClone(list);room.colliders=room.scenery.map(m=>({x:m.p[0],z:m.p[2],a:m.s[0]/2,b:m.s[2]/2,c:1,s:0,cap:0,minY:.1,maxY:1.2,mesh:m}));room.lights=[{p:[1000,2,1000],range:8,color:[1,.7,.5]}];}}
setMeshes(Array.from({length:20},(_,i)=>mesh(i,[.2,-.3,.4])));refresh('Replicated rotation');
for(const side of [before,after]){
 const b=side.bridge;assert.notEqual(b.scenery[0].r,b.scenery[1].r);assert.notEqual(b.scenery[0].r,b.room.scenery[0].r);assert.notEqual(b.scenery[0].p,b.scenery[1].p);assert.notEqual(b.scenery[0].s,b.scenery[1].s);
 b.scenery[0].r[0]=123;b.scenery[0].p[0]=456;b.scenery[0].s[0]=789;
}
refresh('Mutating an old output cannot mutate the cache or another output');
for(const side of [before,after]){const room=side.bridge.room,m=room.scenery[0];m.p[0]+=.125;m.s[1]*=1.13;m.r[2]=-.2;m.color[0]=.1;m.mat=8;m.material='stone';m.mass=23;m.renderRevision=7;room.scenery[1].destroyed=true;room.scenery[2].interiorShell=true;room.colliders[0].maxY=1.9;room.lights[0].p[1]=2.9;}
refresh('Position/scale/rotation/color/material/mass/filter/collider/light mutations are live');
for(const side of [before,after]){side.bridge.scale[0]*=1.1;side.bridge.scale[1]=.73;side.bridge.scale[2]*=.91;side.bridge.room.scenery[0].r=[.2,-.3,.4];}
refresh('Mutable projection scale invalidates all cached bases');
const rotations=[[0,0,0],[-0,0,0],[0,-0,0],[0,0,-0],[Math.PI/2,0,0],[0,Math.PI/2,0],[0,0,Math.PI],[Number.MIN_VALUE,0,0],[NaN,0,0],[Infinity,0,0],[0,-Infinity,0]];
setMeshes(rotations.map((r,i)=>mesh(i,r)));refresh('Signed zero, axis singularities, subnormal, NaN and Infinity preserve exact JS values');refresh('Non-finite rotations retain the uncached path');
for(const side of [before,after])side.bridge.scale[0]=NaN;refresh('Non-finite projection scale');
for(const side of [before,after])side.bridge.scale[0]=1.01;refresh('Recovery from non-finite projection scale');
// Fill exactly 32 distinct rotations, then one extra: old entries are evicted,
// while recent ones remain cached. No unbounded table of arbitrary poses.
const poses=Array.from({length:33},(_,i)=>mesh(i,[.001+i*.013,.002+i*.017,-.003-i*.019]));setMeshes(poses.slice(0,32));refresh('32 distinct bases');
let calls=after.module.calculations;refresh('32 cached bases repeat');assert.equal(after.module.calculations,calls);
setMeshes(poses);refresh('33rd distinct basis');assert.equal(after.module.calculations-calls,1);
setMeshes([poses[0],poses[31]]);calls=after.module.calculations;refresh('Oldest evicted, recent retained');assert.equal(after.module.calculations-calls,1,'Basis cache is bounded to 32 entries');
// Function identity guards keep FERRO matrix hot-swaps observable as before.
for(const side of [before,after]){const old=side.module.voiture.euler;side.module.voiture.euler=(x,y,z)=>old(x+.07,y,z);}
refresh('Matrix implementation replacement invalidates cached results');
// A second face/bridge owns its own bounded cache and independent output arrays.
for(const side of [before,after]){const reverse=side.interiors.breachProjection({mesh:side.mesh,point:[side.q.x-side.n[0]*12,1.1,side.q.z-side.n[1]*12],normal:[-side.n[0],0,-side.n[1]]});assert.equal(reverse.room,side.bridge.room);assert.notEqual(reverse.scenery[0].r,side.bridge.scenery[0].r);side.reverse=reverse;}
assert.deepEqual(structuredClone(snapshot(after.reverse)),structuredClone(snapshot(before.reverse)));comparisons++;
console.log(JSON.stringify({status:'PASS',comparisons,oracle:process.env.EMPRISE_PROJECTION_ORACLE||'22a330f',checks:['complete procedural projection','independent arrays','all live mesh fields','projection scale mutation','signed zero/nonfinite','32-entry eviction','matrix hot-swap','separate bridges']},null,2));
