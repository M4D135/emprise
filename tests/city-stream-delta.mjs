import './load.mjs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

// The independent producer is the shipped implementation before this change.
// Compare geometry, lights, collision order and persistence as well as splices.
const context=vm.createContext({RADE:{},FRender,BITUME,FDestruction,performance});
vm.runInContext(execFileSync('git',['show','0a68dbe:src/city-stream.js'],{encoding:'utf8'}),context);
const tiles={};
for(let x=0;x<7;x++)for(let z=0;z<2;z++){
 const ox=x*512,oz=z*512;
 tiles[x+','+z]={buildings:[{id:'house-'+x+'-'+z,points:[[ox+130,oz+20],[ox+150,oz+20],[ox+150,oz+40],[ox+130,oz+40]],height:12,bounds:[ox+130,oz+20,ox+150,oz+40]}],roads:[{id:'street-'+x+'-'+z,points:[[ox+40,oz+80],[ox+470,oz+80]],class:'minor'}],water:[],green:[]};
}
const data={chunkSize:512,bounds:[0,0,3584,1024],tiles},options={maxBuildingsPerTick:1,budgetMs:1000};
const original=context.RADE.cityStream.create(data,options),candidate=RADE.cityStream.create(data,options);
const plain=v=>JSON.parse(JSON.stringify(v)),initial=candidate.geometry,snapshots=[];
const apply=d=>{let end=0;const ranges=[];for(const q of d.splices){assert(Number.isInteger(q.start)&&q.start>=end);assert(q.deleteCount>=0&&q.start+q.deleteCount<=d.before.length);ranges.push(d.before.slice(end,q.start),q.items);end=q.start+q.deleteCount;}ranges.push(d.before.slice(end));return [].concat(...ranges);};
function delta(before){const d=candidate.takeGeometryDelta(before);assert(d);assert.equal(d.before,before);assert.equal(d.after,candidate.geometry);assert.equal(d.full,false);const actual=apply(d);assert.equal(actual.length,candidate.geometry.length);for(let i=0;i<actual.length;i++)assert.equal(actual[i],candidate.geometry[i]);return d;}
let stages=0,publications=0,fast=0,index=null,partition=null,combined=null;
const S=FRender.shared,core=Array.from({length:6000},(_,i)=>({shape:'box',p:[i%100,0,Math.floor(i/100)],s:[1,1,1],r:[0,0,0],mat:0})),landscape=[{shape:'box',p:[0,-1,0],s:[10,.1,10],r:[0,0,0],backgroundWater:true}];
function rendered(before,label){
 const d=delta(before),next=core.concat(landscape,candidate.geometry),offset=core.length+landscape.length,meshDelta=combined?{before:combined,after:next,full:false,splices:d.splices.map(q=>({...q,start:q.start+offset}))}:null;
 const options={revisionedMeshes:true,meshDelta};partition=S.partitionWorld(next,partition,options);index=S.spatialIndex(partition.world,null,index,{...options,meshDelta:partition.meshDelta});
 const oracle=S.spatialIndex(partition.world,null);assert.equal(index.entries.length,oracle.entries.length,label);
 for(let i=0;i<index.entries.length;i++){assert.equal(index.entries[i].mesh,oracle.entries[i].mesh);assert.deepEqual(index.entries[i].row,oracle.entries[i].row);}
 if(index.delta.fast)fast++;combined=next;
}
function check(label,action,{remember=false}={}){
 const before=candidate.geometry,copy=before.slice(),beforeValues=JSON.stringify(before),a=action(original),b=action(candidate);
 assert.deepEqual(plain(b),plain(a),label+' return');assert.equal(JSON.stringify(candidate.geometry),JSON.stringify(original.geometry),label+' geometry');assert.equal(candidate.revision,original.revision,label+' revision');assert.equal(candidate.pending,original.pending,label+' pending');
 assert.equal(JSON.stringify(before),beforeValues,label+' previous snapshot values');assert.equal(before.length,copy.length);for(let i=0;i<copy.length;i++)assert.equal(before[i],copy[i],label+' previous snapshot identity');
 if(before!==candidate.geometry){publications++;delta(before);delta(initial);for(const snapshot of snapshots)delta(snapshot);}
 for(const [x,z]of [[660,80],[1160,80],[1700,80],[2200,80]]){assert.deepEqual(plain(candidate.streetLights(x,z,180,1)),plain(original.streetLights(x,z,180,1)),label+' lights');assert.deepEqual(plain(candidate.candidates(x,z,3)),plain(original.candidates(x,z,3)),label+' collisions');assert.equal(candidate.blocked(x,z),original.blocked(x,z));}
 assert.deepEqual(plain(candidate.save()),plain(original.save()),label+' save');
 if(remember)snapshots.push(candidate.geometry);stages++;
}
let renderedSnapshot=initial;
function flush(x,z,{remember=true}={}){for(let i=0;i<400;i++){check('tick '+x+','+z+'/'+i,s=>s.tick(x,z));if(!candidate.pending)break;if(i===399)assert.fail('Stream stuck');}rendered(renderedSnapshot,'publish '+x+','+z);renderedSnapshot=candidate.geometry;if(remember)snapshots.push(candidate.geometry);}

assert.equal(candidate.takeGeometryDelta([]),null,'Unknown snapshot uses strict fallback');
assert.equal(candidate.takeGeometryDelta(null),null);assert.equal(candidate.takeGeometryDelta(undefined),null);
delta(initial);flush(660,80);assert.equal(candidate.stats.residentChunks,6);
const lamps=candidate.streetLights(660,80,180,1);assert(lamps.length>2);
const lamp=lamps[0];check('lamp break',s=>s.damage([lamp.x,lamp.y,lamp.z],70,0,[0,0,1]));assert(!candidate.geometry.some(m=>m.lampId===lamp.id));
check('first breach',s=>s.damage([652,1.4,20],240,1.2,[0,0,1]),{remember:true});
assert(candidate.geometry.some(m=>m.building==='house-1-0'&&m.interior));
check('second breach before renderer observes first',s=>s.damage([664,1.4,20],240,1.2,[0,0,1]));
rendered(renderedSnapshot,'lamp plus two breaches');renderedSnapshot=candidate.geometry;
const saved=plain(candidate.save());
flush(1160,80);assert(candidate.stats.residentChunks<=9);
flush(2700,80);assert(!candidate.geometry.some(m=>m.building==='house-1-0'));
flush(660,80);assert(candidate.geometry.some(m=>m.building==='house-1-0'&&m.interior));assert(!candidate.streetLights(660,80,180).some(q=>q.id===lamp.id));
check('restore pristine',s=>s.restore(null));rendered(renderedSnapshot,'restore pristine');renderedSnapshot=candidate.geometry;
assert(candidate.streetLights(660,80,180).some(q=>q.id===lamp.id));
check('restore damage',s=>s.restore(saved));rendered(renderedSnapshot,'restore damage');renderedSnapshot=candidate.geometry;
// Reorder chunk insertion order, unloading/reloading a key without consuming
// its delta. All historical snapshots must still reconstruct exact occurrences.
flush(1700,80);flush(660,80);flush(3500,80);flush(10,80);
assert(fast>=4,'Actual renderer delta path must handle normal additions/removals');
assert.deepEqual(candidate.takeGeometryDelta(candidate.geometry).splices,[]);
console.log(`PASS streamed geometry deltas: ${stages} original-producer stages, ${publications} publications, ${fast} native index updates; unchanged geometry/light/collision/persistence values, reference order, historical snapshots, loads/unloads, lamp damage, breaches and restores.`);
