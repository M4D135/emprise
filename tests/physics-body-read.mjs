import '../src/metal/physics.js';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
const old=vm.createContext({});vm.runInContext(execFileSync('git',['show','d22a5eb:src/metal/physics.js'],{encoding:'utf8'}),old);
const cfg={bounds:{minX:-12,maxX:12,minZ:-12,maxZ:12},ground:0,gravity:-9.81,capacity:16,maxStatics:32,maxContacts:1024,massMin:.035,massMax:12000,maxAwake:5,spawnBudget:2};
const a=old.FPhysics.create(cfg),b=FPhysics.create(cfg),handles=[],vectors=['size','realSize','pos','quat','vel','ang'],out={},refs={};
function exact(x,y,path=''){assert.equal(typeof x,typeof y,path);if(x&&typeof x==='object'){assert.equal(JSON.stringify(Object.keys(x)),JSON.stringify(Object.keys(y)),path+' keys/order');for(const k of Object.keys(x))exact(x[k],y[k],path+'.'+k);}else assert(Object.is(x,y),path+': '+x+' != '+y);}
const definitions=[{shape:'box',size:[.01,.5,1],pos:[-2,3,0],mass:.001,rot:[.2,.5,-.3],vel:[1,-1,.2],ang:[.3,-.2,.5],group:7,mask:39},{shape:'sphere',radius:.3,pos:[0,4,0],mass:100000,material:'glass'},{shape:'capsule',radius:.2,height:1.3,pos:[2,4,0],mass:30,material:'wood'},{shape:'box',size:[1,1,1],pos:[0,.5,3],mass:20,asleep:true},{shape:'box',size:[1,1,1],pos:[0,2,5],kinematic:true},{shape:'sphere',radius:.4,pos:[0,-80,0],mass:30}];
for(const d of definitions){const h=a.addBody(d);assert.equal(b.addBody(d),h);handles.push(h);}
function check(){assert.equal(b.hash(),a.hash());exact(b.snapshot(),a.snapshot(),'snapshot');exact(b.stats,a.stats,'stats');for(const h of handles){const before=b.body(h),previous=JSON.stringify(before),actual=b.bodyInto(h,out);assert.equal(actual,out);exact(actual,a.body(h),'bodyInto');exact(before,a.body(h),'body');for(const name of vectors){if(refs[name])assert.equal(out[name],refs[name],name+' is reused');else refs[name]=out[name];assert.notEqual(out[name],before[name]);}b.bodyInto(handles.at(-1),out);assert.equal(JSON.stringify(before),previous,'independent body() survives a later borrowed read');}}
check();const first=b.body(handles[0]),initial=JSON.stringify(first);
for(let t=0;t<360;t++){
 if(t===10){for(const p of [a,b])p.impulse(handles[0],-2,3,0,20,10,-2);}
 if(t===50){for(const p of [a,b])p.setVelocity(handles[2],-.5,1,.7,.1,.2,.3);}
 if(t===90){for(const p of [a,b])p.blast(0,1,0,8,120);}
 if(t===130){for(const p of [a,b])p.setKinematic(handles[4],1,2,5,0,.1,0,1);}
 if(t===160){for(const p of [a,b])p.setStatics([{minX:-3,maxX:3,minY:0,maxY:.2,minZ:-3,maxZ:3}]);}
 for(const p of [a,b])p.step(t%3===0?1/60:1/120);check();
}
assert.equal(JSON.stringify(first),initial,'independent snapshot survives simulation');
const invalidState=a.snapshot();assert.throws(()=>a.restore(invalidState),/position out of range/);assert.throws(()=>b.restore(invalidState),/position out of range/);check();
const restoredOld=old.FPhysics.create(cfg),restoredNew=FPhysics.create(cfg);for(const d of definitions.slice(0,5)){restoredOld.addBody(d);restoredNew.addBody(d);}for(let i=0;i<24;i++){restoredOld.step(1/120);restoredNew.step(1/120);}const state=restoredOld.snapshot();restoredOld.step(1/60);restoredNew.step(1/60);restoredOld.restore(state);restoredNew.restore(state);exact(restoredNew.snapshot(),restoredOld.snapshot());for(const h of handles.slice(0,5))exact(restoredNew.bodyInto(h,{}),restoredOld.body(h));
for(const h of [0,-1,.25,Infinity,NaN,'1',undefined,handles[0]+4096]){const previous=JSON.stringify(out);assert.equal(b.bodyInto(h,out),null);assert.equal(b.body(h),null);assert.equal(JSON.stringify(out),previous,'invalid handle leaves caller output unchanged');}
const beforeHash=b.hash();for(const name of vectors)out[name].fill(12345);assert.equal(b.hash(),beforeHash,'output vectors cannot mutate engine storage');b.bodyInto(handles[0],out);exact(out,a.body(handles[0]));
console.log('PASS bodyInto: 360 exact solver/contact snapshots, all shapes/flags/mass clamps, impulses, statics, restore, invalid handles, stable output vectors and independent public snapshots');
