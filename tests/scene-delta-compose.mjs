import assert from 'node:assert/strict';
import '../src/world.js';
const compose=RADE.world.composeSceneDeltas;
let state=712311,id=0,checked=0;
const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
const apply=(before,splices)=>{const after=before.slice();for(const q of splices.slice().reverse())after.splice(q.start,q.deleteCount,...q.items);return after;};
function check(before,changes){const d=compose(before,changes);assert(d);assert.equal(d.before,before);assert.equal(d.after,changes.at(-1).after);const actual=apply(before,d.splices);assert.equal(actual.length,d.after.length);for(let i=0;i<actual.length;i++)assert.equal(actual[i],d.after[i]);checked++;}
for(let trial=0;trial<500;trial++){
 const before=Array.from({length:Math.floor(random()*200)},()=>({id:id++})),changes=[];let current=before;
 for(let step=0;step<1+trial%16;step++){
  let cursor=0;const splices=[];
  for(let j=0;j<1+step%5&&cursor<=current.length;j++){
   const start=cursor+Math.floor(random()*(current.length-cursor+1)),deleteCount=Math.min(Math.floor(random()*8),current.length-start),items=Array.from({length:Math.floor(random()*5)},()=>random()<.2&&before.length?before[Math.floor(random()*before.length)]:({id:id++}));
   splices.push({start,deleteCount,items});cursor=start+deleteCount+1;
  }
  const after=apply(current,splices);changes.push({before:current,after,full:false,splices});current=after;check(before,changes);
 }
 assert.equal(compose(before,[{...changes[0],full:true}]),null);
 assert.equal(compose(before,[{...changes[0],before:before.slice()}]),null);
}
const a=[{id:1},{id:2}],empty=[];check(a,[{before:a,after:empty,splices:[{start:0,deleteCount:2,items:[]}]}]);check(empty,[{before:empty,after:a,splices:[{start:0,deleteCount:0,items:a}]}]);
console.log(`PASS ${checked} exact scene-delta compositions, including adjacent edits, empty worlds, shared identities and 16 successive blasts`);

let diffChecks=0;
function checkDiff(before,after){const copyA=before.slice(),copyB=after.slice(),d=RADE.world.diffScenery(before,after),actual=apply(before,d.splices);assert.equal(actual.length,after.length);for(let i=0;i<actual.length;i++)assert.equal(actual[i],after[i]);assert.deepEqual(before,copyA);assert.deepEqual(after,copyB);diffChecks++;}
for(let trial=0;trial<1000;trial++){const before=Array.from({length:Math.floor(random()*300)},()=>({id:id++}));let after=before.slice();for(let step=0;step<10;step++){const start=Math.floor(random()*(after.length+1));after.splice(start,Math.floor(random()*12),...Array.from({length:Math.floor(random()*8)},()=>random()<.2&&before.length?before[Math.floor(random()*before.length)]:{id:id++}));}if(trial%4===0)after.reverse();checkDiff(before,after);}
const long=Array.from({length:13000},()=>({id:id++}));
for(const gap of [0,1,4095,4096,4097,10000]){checkDiff(long,long.slice(gap));checkDiff(long.slice(gap),long);checkDiff(long,[...long.slice(0,20),...Array.from({length:gap},()=>({id:id++})),...long.slice(21)]);}
checkDiff([],[]);checkDiff([a[0],a[0],a[1]],[a[1],a[0],a[0]]);
console.log(`PASS ${diffChecks} exact bounded scenery differences, reordered/shared references and anchors around/beyond 4096`);
