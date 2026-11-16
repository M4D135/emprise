import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,root));
const manifest=JSON.parse(read('dist/ferro-runtime/manifest.json'));
function host(music=false){const ctx=vm.createContext({});vm.runInContext(read('dist/ferro-runtime/ferro-runtime.js').toString(),ctx);if(music)vm.runInContext(read('dist/ferro-runtime/ferro-music.js').toString(),ctx);return ctx;}

test('distributed modules match the canonical source and the package manifest',()=>{
 for(const f of manifest.files){const data=read('dist/ferro-runtime/'+f.packagePath);assert.equal(data.length,f.bytes);assert.equal(createHash('sha256').update(data).digest('hex'),f.sha256);if(f.path)assert.deepEqual(data,read(f.path));}
});
test('a fresh non-browser host loads without EMPRISE and compiles deterministic recipes',()=>{
 const g=host(),f=g.FERRO;assert.equal(g.RADE,undefined);assert.equal(f.version,manifest.version);assert.equal(f.apiVersion,manifest.apiVersion);
 for(const [key,value] of Object.entries(f.capabilities()))assert.equal(value,!['music','musicTransitions'].includes(key),key);
 assert.throws(()=>f.require('absent'),/non chargé/);assert.throws(()=>f.music,/non chargé/);
 assert.equal(f.geometry,g.BITUME.carene);assert.equal(f.navigation,g.PDR.nav);
 const recipe=f.recipes.demo(),a=f.compileRecipe(recipe),b=host().FERRO.compileRecipe(recipe);assert(a.meshes.length>0);assert.equal(JSON.stringify(a),JSON.stringify(b));
});
test('merged physics exposes geometry, joints and reusable reads in the standalone bundle',()=>{
 const f=host().FERRO,options={bounds:{minX:-20,maxX:20,minZ:-20,maxZ:20},capacity:32,maxStatics:16,maxContacts:512,ground:0,maxJoints:16};
 const w=f.createPhysics(options),box={minX:3,minY:0,minZ:-3,maxX:3.12,maxY:4,maxZ:3};w.setStatics([box],[]);
 const sweep=w.sweepCapsule([0,0,0],[10,0,0],{radius:.28,height:1.8});assert(sweep.hit);assert(sweep.fraction<.3);
 const h=w.addBody({size:[.4,.4,.4],pos:[0,6,0],mass:30,vel:[3,0,0]});w.addJoint({type:'cable',a:0,b:h,anchorA:[0,8,0],max:2});
 for(let i=0;i<360;i++)w.step(1/60);assert.equal(w.joints.count,1);const out={};assert.equal(w.bodyInto(h,out),out);assert.equal(JSON.stringify(out),JSON.stringify(w.body(h)));
 const copy=f.createPhysics(options);copy.setStatics([box],[]);copy.restore(w.snapshot());for(let i=0;i<120;i++){w.step(1/60);copy.step(1/60);assert.equal(w.hash(),copy.hash());}
 w.removeBody(h);assert.equal(w.body(h),null);
});
test('the optional synthesized music transport can be loaded after the core',()=>{
 const g=host(true);assert.equal(g.FERRO.music,g.FMusic);assert.equal(g.FERRO.musicTransitions,g.FImuse);assert.equal(typeof g.FERRO.music.create,'function');assert.equal(typeof g.FERRO.musicTransitions.create,'function');
});
test('METAL capsule queries preserve EMPRISE oriented static geometry',()=>{
 const f=host().FERRO,w=f.createPhysics({bounds:{minX:-10,maxX:10,minZ:-10,maxZ:10},ground:null,capacity:16,maxStatics:16,maxContacts:256}),c=Math.SQRT1_2;
 w.setStatics([{center:[0,1,0],half:[2,1,.1],rotation:[c,0,c,0,1,0,-c,0,c]}],[]);
 assert.equal(w.sweepCapsule([-1,0,-1],[0,0,0],{radius:.1,height:1.8}).hit,false,'empty corner of the enclosing AABB stays traversable');
 const hit=w.sweepCapsule([-3,0,0],[6,0,0],{radius:.1,height:1.8});assert(hit.hit);assert(Math.abs(hit.nx)>.7&&Math.abs(hit.nz)>.7,'collision normal follows the rotated wall');
 const before=w.staticsHash;assert.throws(()=>w.setStatics([{center:[0,1,0],half:[2,1,.1],rotation:[1,1,0,0,1,0,0,0,1]}],[]));assert.equal(w.staticsHash,before,'invalid replacement leaves the world intact');
});
