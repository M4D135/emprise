import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
const baseline=execFileSync('git',['show','509b2ec:src/ferro/renderer.js'],{encoding:'utf8'}),current=fs.readFileSync(new URL('../src/ferro/renderer.js',import.meta.url),'utf8');
function api(code){const c=vm.createContext({});vm.runInContext(code.replace('globalThis.FRender={create,foliageTriangles,forme};','globalThis.FRender={pack,packEffects};'),c);return c.FRender;}
const before=api(baseline),after=api(current);let seed=135;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296),shapes=['box','bevel','sphere','cylinder','ring',null,'unknown'];let compared=0;
for(let n=0;n<60;n++){
 const meshes=Array.from({length:[0,1,6,90,500][n%5]},(_,i)=>({shape:shapes[i%7],p:[random()*100-50,random()*5,random()*100-50],s:i%3?[random()*3,random()*3,random()*3]:undefined,r:i%2?[random(),-random(),random()]:undefined,color:i%3?[random(),0,random()]:undefined,mat:i%21,emissive:i%4?0:.5,alpha:(i%11-1)/9,innerRatio:i%7/5,window:i%13===0,fxFire:i%17===0,fxSmoke:i%19===0,fxSpark:i%23===0,fxPriority:i%29===0?'hazard':undefined,overlay:i%3===0,surface:i%4?'object':'architecture'}));
 const env=n%3?{outdoorZones:[{x:0,z:0,w:45,d:80}],biome:'ville'}:null,eye=[random()*20,1.7,random()*20];
 for(const [key,args] of [['pack',[meshes,env,n%2===0]],['packEffects',[meshes,env,eye]]]){
  const a=before[key](...args),b=after[key](...args);assert.deepEqual(Buffer.from(a.values.buffer),Buffer.from(b.values.buffer));assert.equal(JSON.stringify(a.groups),JSON.stringify(b.groups));compared++;
 }
}
const report={compared,baseline:'509b2ec',checks:['Exact float buffer bytes and shape groups','Empty batches, default shapes, unknown shapes, missing transforms/color','Overlay/architecture/outdoor flags','Transparent sort, windows, rings, smoke, fire, sparks and clamped alpha'],claim:'Removes one temporary JS array per packed instance. No FPS gain inferred from this equivalence check.'};fs.writeFileSync(new URL('../docs/renderer-pack-validation.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(report);
