// Exact render oracle: old render() body, current identical model geometry.
// No renderer, browser, physics stepping or reduced-detail model is substituted.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
const source=fs.readFileSync('src/vehicles.js','utf8'),baseline='0a68dbe2b907e6795c3c8fe2f7701fa9d59d191c';
const historical=execFileSync('git',['show',baseline+':src/vehicles.js'],{encoding:'utf8'});
const renderBody=s=>s.slice(s.indexOf('function render(car,out,options={}){'),s.indexOf('// Pre-register both geometries'));
const legacy=source.replace(renderBody(source),renderBody(historical));
const files=['src/ferro/geometry.js','src/bitume/main.js','src/bitume/voiture.js'];
function load(code,inspect=false){const c=vm.createContext({});for(const f of files)vm.runInContext(fs.readFileSync(f,'utf8'),c);vm.runInContext(code.replace('R.vehicles={model,render,',inspect?'R.__rotationCaches=rotationCaches;R.vehicles={model,render,':'R.vehicles={model,render,'),c);vm.runInContext(fs.readFileSync('src/urban.js','utf8'),c);return c;}
const old=load(legacy),now=load(source,true),snapshot=structuredClone;
const car=(type,n=0)=>({model:type,color:n%2?'#e7e7db':'#bb2729',x:72+n*.13,y:n%3?-.08:0,z:130-n*.17,cap:(n-12)*.319,tangage:Math.sin(n)*.21,roulis:Math.cos(n)*.14,volant:Math.sin(n*.3),distance:n*.7,braquage:Math.sin(n)*.5,moteur:true,regime:900+n*30,rapport:n%5+1,arriere:n%9===0,gaz:.7,v:n*.6});
function render(c,q,opt={}){const out=[];c.RADE.vehicles.render(q,out,opt);return out;}
let cases=0,meshes=0;
function compare(q,opt={}){const a=render(old,snapshot(q),opt),b=render(now,snapshot(q),opt);assert.deepEqual(snapshot(b),snapshot(a));cases++;meshes+=a.length;return b;}
for(const type of ['gti','r5'])for(let n=0;n<28;n++){
 const q=car(type,n);if(n%4)Object.assign(q,{condition:{body:[1,.82,.58,.24][n%4]},fireAge:n%6,glassBroken:n%7===0});
 compare(q,{cockpit:n%3===0,time:n*.09});
}
// Multiple cars sharing a template must never receive the previous car's pose.
for(const type of ['gti','r5'])for(const cap of [0,-0,Math.PI/2,-Math.PI/2,Math.PI,-Math.PI])compare({...car(type),cap,tangage:Math.PI/2,roulis:-.25});
// Real damage wrapper remains involved, including the separate raised bonnet.
for(const type of ['gti','r5'])for(const body of [.95,.94,.6,.59,0])compare({...car(type,4),condition:{body},fireAge:4,glassBroken:false});
for(const type of ['gti','r5'])compare({...car(type),exploded:true});
const ma=old.RADE.vehicles.model('gti','#bb2729'),mb=now.RADE.vehicles.model('gti','#bb2729'),savedA=ma.pieces[0].r,savedB=mb.pieces[0].r;
for(const r of [[.1,.2,.3],[-0,0,-0],[0,-0,0],[NaN,.2,.3],[Infinity,0,0],[],null,[0,0,0]]){
 ma.pieces[0].r=snapshot(r);mb.pieces[0].r=snapshot(r);compare(car('gti',2));
}
ma.pieces[0].r=[.1,.2,.3];mb.pieces[0].r=[.1,.2,.3];compare(car('gti',2));
for(const axis of [0,1,2]){ma.pieces[0].r[axis]+=.17;mb.pieces[0].r[axis]+=.17;compare(car('gti',2));}
// Cache churn is bounded; mutation in place, replacement and eviction cannot
// make a formerly cached panel stale. This bridge exists only in this VM.
for(let n=0;n<100;n++){ma.pieces[0].r=[n*.03,.2,.3];mb.pieces[0].r=[n*.03,.2,.3];compare(car('gti',2));}
assert(now.RADE.__rotationCaches.get(mb).groups.size<=64);
ma.pieces[0].r=savedA;mb.pieces[0].r=savedB;compare(car('gti',2));
const isolated=render(now,car('gti',2)),copy=snapshot(isolated),rotations=new Set(isolated.map(m=>m.r));assert.equal(rotations.size,isolated.length,'output rotations are never aliased');
isolated[0].r[0]=123;assert.deepEqual(snapshot(isolated.slice(1)),copy.slice(1));compare(car('gti',2));
// Pure render timing, both variants warmed, same poses and immutable geometry.
const fleet=Array.from({length:12},(_,i)=>car(i%2?'gti':'r5',i));
function sample(c,loops){let count=0;const start=performance.now();for(let n=0;n<loops;n++)for(const q of fleet)count+=render(c,q,{time:0}).length;return {ms:performance.now()-start,count,renders:loops*fleet.length};}
sample(old,8);sample(now,8);const trials=[];
for(let i=0;i<4;i++){let a,b;if(i%2){b=sample(now,20);a=sample(old,20);}else{a=sample(old,20);b=sample(now,20);}assert.equal(a.count,b.count);trials.push({beforeMs:a.ms,afterMs:b.ms,renders:a.renders});}
const median=a=>a.toSorted((x,y)=>x-y)[Math.floor(a.length/2)],before=median(trials.map(t=>t.beforeMs)),after=median(trials.map(t=>t.afterMs));
console.log(JSON.stringify({pass:true,oracle:baseline+' render() + current shared geometry',cases,meshes,lookupLimit:64,timing:{kind:'Node pure render; excludes GPU, simulation, model generation and renderer packing',trials,medianBeforeMs:before,medianAfterMs:after,ratio:after/before}},null,2));
