import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
// Isolate the ownership boundary: failure in a later room must still publish
// earlier successful room changes, and must not leave the next blast batched.
const rooms=Array.from({length:3},(_,i)=>({sceneId:'room-'+i,scenery:[],colliders:[],w:4,d:4})),published=[],changed=[];
let count=0,fail=true;
const projections=rooms.map(room=>({room,scale:[1,1,1],void:{minY:0,maxY:3},toRoom:p=>[1000,p[1],1000],toWorld:p=>p}));
const world={scenery:[],boxes:[],fleet:[],room:null,combatWorld:{},ground:()=>0},sim={state:{player:{x:0,y:0,z:0}}};
const context=vm.createContext({RADE:{breaches:{create:()=>({inside:()=>null,projections,observe(){},roomChanged:room=>changed.push(room.sceneId),update:()=>published.push(rooms.map(r=>r.scenery.map(m=>m.damage))),save:()=>[]})}},FDestruction:{create:()=>{const id=count++,dc={meshes:[],colliders:[],blast(){if(id===0)return {changed:false,events:[],debris:[]};if(id===2&&fail){fail=false;throw Error('injected second room failure');}dc.meshes=[{damage:id}];return {changed:true,events:[],debris:[]};}};return dc;}},console});
vm.runInContext(readFileSync(new URL('../src/urban.js',import.meta.url),'utf8').split('/* Condition modifies')[0],context);
const urban=context.RADE.urban.create(world,sim);urban.prepare();
assert.throws(()=>urban.damage([0,1,0],240,10),/injected second room failure/);
assert.equal(published.length,1,'Finally flushes completed first room exactly once');
assert.equal(JSON.stringify(published[0]),'[[1],[],[]]');assert.deepEqual(changed,['room-0']);assert.equal(urban.revision,1);
const result=urban.damage([0,1,0],240,10);assert(result.changed);
assert.equal(published.length,2,'A later blast creates a fresh, single publication');
assert.equal(JSON.stringify(published[1]),'[[1],[2],[3]]');assert.equal(urban.revision,4);
console.log('PASS projected blast batching: earlier changes flushed on exception; next blast, room notifications and revision order retained');
