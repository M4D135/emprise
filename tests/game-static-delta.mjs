import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../src/ferro/renderer.js';

// Execute the production combiner verbatim, without loading game DOM/timers.
const source=fs.readFileSync(new URL('../src/game.js',import.meta.url),'utf8');
const from=source.indexOf('const staticScenes='),to=source.indexOf('async function warmCity(',from);assert(from>=0&&to>from);
const context=vm.createContext({});vm.runInContext(source.slice(from,to)+'\nglobalThis.combine=staticScenery;globalThis.deltaFor=s=>staticScenes.get(s).meshDelta;',context);
let id=0;const mesh=()=>({shape:'box',p:[id++%100,1,id%71],s:[1,1,1],r:[0,0,0],color:[.2,.3,.4],mat:3}),core=Array.from({length:512},mesh),landscape=[{...mesh(),backgroundWater:true}],stream=Array.from({length:100},mesh);
let coreChange=null,streamChange=null;const world={scenery:core,landscape,renderMutation:0,takeSceneryDelta:()=>coreChange,cityStream:{geometry:stream,takeGeometryDelta:()=>streamChange}},session={world};
const S=FRender.shared;let previous,partition,index,stages=0;
function apply(before,splices){let read=0;const ranges=[];for(const q of splices){assert(q.start>=read);ranges.push(before.slice(read,q.start),q.items);read=q.start+q.deleteCount;}ranges.push(before.slice(read));return [].concat(...ranges);}
function check(label,{delta=true,fast=true}={}){
 const result=context.combine(session),change=context.deltaFor(session),expected=world.scenery.concat(world.landscape||[],world.cityStream?.geometry||[]);
 assert.equal(result.length,expected.length);for(let i=0;i<result.length;i++)assert.equal(result[i],expected[i],label+' scene order');
 if(delta){assert(change,label+' valid delta');assert.equal(change.before,previous);assert.equal(change.after,result);const replayed=apply(previous,change.splices);assert.equal(replayed.length,result.length);for(let i=0;i<result.length;i++)assert.equal(replayed[i],result[i],label+' delta identity');}else assert.equal(change,null,label+' strict fallback');
 const options={revisionedMeshes:true,meshDelta:change};partition=S.partitionWorld(result,partition,options);index=S.spatialIndex(partition.world,null,index,{...options,meshDelta:partition.meshDelta});
 if(previous)assert.equal(!!index.delta.fast,fast,label+' renderer path');
 const oracle=S.spatialIndex(partition.world,null);for(let i=0;i<index.entries.length;i++){assert.equal(index.entries[i].mesh,oracle.entries[i].mesh);assert.deepEqual(index.entries[i].row,oracle.entries[i].row);}
 previous=result;stages++;return change;
}
function edit(key,splices){const before=key==='core'?world.scenery:world.cityStream.geometry,after=apply(before,splices),delta={before,after,full:false,splices};if(key==='core'){world.scenery=after;coreChange=delta;}else{world.cityStream.geometry=after;streamChange=delta;}return delta;}
check('first installation',{delta:false});
check('unchanged arrays produce empty delta');
const oldOffset=world.scenery.length+world.landscape.length;
edit('core',[{start:23,deleteCount:1,items:[mesh(),mesh(),mesh()]}]);
edit('stream',[{start:0,deleteCount:4,items:[]},{start:100,deleteCount:0,items:[mesh(),mesh()]}]);
const combined=check('core grows while chunks unload and append');assert.equal(combined.splices[1].start,oldOffset,'Stream offsets refer to old core size');
coreChange=null;edit('stream',[{start:4,deleteCount:1,items:[mesh()]}]);check('stream-only update with absent core delta');
streamChange=null;edit('core',[{start:80,deleteCount:2,items:[]}]);check('core-only update with absent stream delta');
world.scenery=world.scenery.concat(mesh());coreChange=null;check('missing core delta',{delta:false,fast:false});
edit('stream',[{start:4,deleteCount:0,items:[mesh()]}]);streamChange={...streamChange,before:[]};check('stale stream origin',{delta:false,fast:false});
edit('stream',[{start:5,deleteCount:1,items:[mesh()]}]);streamChange.full=true;check('full stream marker',{delta:false,fast:false});
edit('stream',[{start:6,deleteCount:1,items:[mesh()]}]);streamChange=null;check('missing stream delta',{delta:false,fast:false});
world.landscape=world.landscape.slice();check('landscape identity changes',{delta:false,fast:false});
world.scenery[0].color=[.1,.8,.3];world.scenery[0].renderRevision=1;world.renderMutation++;check('material revision invalidates delta',{delta:false,fast:false});
check('next unchanged publication resumes incremental path');
world.landscape=[];check('remove landscape',{delta:false,fast:false});
const end=world.scenery.length;edit('core',[{start:end,deleteCount:0,items:[mesh(),mesh()]}]);edit('stream',[{start:0,deleteCount:2,items:[]}]);
const adjacent=check('adjacent core append and stream removal');assert.equal(adjacent.splices[0].start,adjacent.splices[1].start,'Zero-width insertion and removal at shared boundary retain order');
const other={world:{scenery:[],landscape:[],renderMutation:0}};context.combine(other);assert.equal(context.deltaFor(other),null,'Sessions have independent baselines');
console.log(`PASS production staticScenery: ${stages} exact combinations, simultaneous core/stream changes, old offsets, adjacent splices, renderer bytes and strict invalidation fallbacks.`);
