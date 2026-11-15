import './load.mjs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

// Frozen production implementations are the oracle. Reuse only the rotated
// building fixture data/world from breach-urban, never its assertions or logic.
const baseline='22a330f',read=name=>fs.readFileSync(new URL('../src/'+name+'.js',import.meta.url),'utf8'),old=name=>execFileSync('git',['show',baseline+':src/'+name+'.js'],{encoding:'utf8'});
const source=fs.readFileSync(new URL('./breach-urban.mjs',import.meta.url),'utf8'),start=source.indexOf('function fixture('),end=source.indexOf('\nconst s=fixture()',start);assert(start>=0&&end>start);
const fixtureCode=source.slice(start,end).replace('world.withoutCar=fn=>fn();','world.withoutCar=fn=>fn();world.collisionQueriesPure=true;').replace('interiors,saved:saved?.urban','interiors,saved:saved?.urban,batchStreetExplosions:batchEnabled');
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const mesh=m=>({shape:m.shape,p:m.p,s:m.s,r:m.r,mat:m.mat,color:m.color,material:m.material,mass:m.mass,collision:m.collision,breachShell:m.breachShell,breachInterior:m.breachInterior,sourceRoom:m.sourceRoom,renderRevision:m.renderRevision});
function scene(s){const indices=new Map(s.world.scenery.map((m,i)=>[m,i]));return {meshes:hash(s.world.scenery.map(mesh)),boxes:hash(s.world.boxes.map(c=>({x:c.x,z:c.z,a:c.a,b:c.b,c:c.c,s:c.s,cap:c.cap,minX:c.minX,maxX:c.maxX,minY:c.minY,maxY:c.maxY,minZ:c.minZ,maxZ:c.maxZ,breachInterior:c.breachInterior,mesh:indices.get(c.mesh)??null}))) };}
function snapshot(s){return {...scene(s),revision:s.urban.revision,report:hash(s.urban.report),save:hash(s.urban.save()),rooms:hash(s.urban.breachProjections.map(b=>({id:b.id,room:b.room.scenery.map(mesh),meshes:b.scenery.map(mesh),lights:b.lights}))),bodies:hash(s.urban.bodies.map(q=>({scene:q.scene,mesh:mesh(q.mesh),mass:q.mass,body:q.engine.body(q.handle)})))};}
function fixture(legacy,batch=true,initialSave=null){
 let s,armed=null,roomCalls=0,nested=0;const queries=[],publications=[],results=[],impulses=[],physics={...FPhysics,create(options){const engine=FPhysics.create(options),impulse=engine.impulse;engine.impulse=(...args)=>{impulses.push(args.slice());return impulse(...args);};return engine;}};
 const destruction={...FDestruction,create(data){const dc=FDestruction.create(data),blast=dc.blast,isRoom=typeof data.seed==='string';dc.blast=function(...args){
  if(armed&&!isRoom&&nested)queries.push(scene(s));
  if(armed&&isRoom&&!nested){roomCalls++;if(armed==='throw-room'&&roomCalls===2){armed=null;throw Error('injected second room failure');}if(armed==='reentrant'&&roomCalls===1){nested++;try{s.urban.damage([s.point[0],4.6,s.point[2]],45,.8,s.n.map(v=>-v));}finally{nested--;}}}
  return blast(...args);
 };return dc;}};
 const context=vm.createContext({RADE:{...RADE},FDestruction:destruction,FPhysics:physics,BITUME,batchEnabled:batch,initialSave,assert});
 for(const name of ['breach','urban'])vm.runInContext(legacy?old(name):read(name),context);
 s=vm.runInContext(fixtureCode+';fixture(initialSave)',context);const replace=s.world.replaceScenery;
 s.world.replaceScenery=(...args)=>{const result=replace(...args);publications.push(hash(s.world.scenery.map(mesh)));return result;};
 return {s,queries,publications,results,impulses,arm(mode){armed=mode;roomCalls=0;},clear(){publications.length=queries.length=results.length=impulses.length=0;},get roomCalls(){return roomCalls;}};
}
let stages=0;
function compare(pair,label){assert.deepEqual(snapshot(pair[1].s),snapshot(pair[0].s),label+' exact scene/controllers/debris/save');assert.deepEqual(pair[1].queries,pair[0].queries,label+' nested query sees original published geometry');assert.deepEqual(pair[1].results,pair[0].results,label+' exact event/result order');assert.deepEqual(pair[1].impulses,pair[0].impulses,label+' exact impulse order and values');stages++;}
function blast(f,power=200,radius=1.8,y=1.2){const s=f.s,result=s.urban.damage([s.point[0],y,s.point[2]],power,radius,s.n.map(v=>-v));f.results.push(hash(result));return result;}

const normal=[fixture(true),fixture(false)],counts=[];
for(const y of [1.2,4.3,7.4]){
 for(const f of normal){f.clear();blast(f,200,1.8,y);}compare(normal,'opening floor '+y);counts.push(normal.map(f=>f.publications.length));
}
for(const f of normal){f.clear();blast(f,240,10,4.3);}compare(normal,'multi-room blast');counts.push(normal.map(f=>f.publications.length));
assert(counts.some(([a,b])=>b<a),'At least one production blast combines publications');
for(const dt of [0,.01,.24,.01,.3]){for(const f of normal)f.s.urban.update(dt,[]);compare(normal,'subsequent update '+dt);}
for(const far of [true,false]){for(const f of normal){f.s.p.x=far?150:f.s.b.x;f.s.p.z=far?150:f.s.b.z;f.s.urban.update(.3,[]);}compare(normal,far?'leave projected rooms':'return to projected rooms');}
const tiny=[fixture(true),fixture(false)];for(const f of tiny)blast(f,200,.1);compare(tiny,'facade change without interior damage');assert.deepEqual(tiny[1].publications,tiny[0].publications);for(const f of tiny)f.s.urban.update(.24,[]);compare(tiny,'clock after facade-only publication');
const capacity=[fixture(true),fixture(false)];for(const f of capacity){for(let i=0;i<239;i++)assert(f.s.urban.spawnBody({shape:'box',p:[70+i%10*.1,.2,70+Math.floor(i/10)*.1],s:[.05,.05,.05],mat:7,material:'wood'},[0,0,0],[0,0,0],.1,'street'));blast(f);}compare(capacity,'239 bodies preserve final debris-slot ownership');

// First projection fails before a publication is ready: never publish a
// partial preparation. A subsequent update must recover identically.
const preparation=[fixture(true),fixture(false)];
for(const f of preparation){const create=f.s.interiors.breachProjection;f.s.interiors.breachProjection=()=>{throw Error('injected preparation failure');};assert.throws(()=>blast(f),/injected preparation failure/);f.s.interiors.breachProjection=create;assert.equal(f.publications.length,0);}
compare(preparation,'preparation failure');for(const f of preparation)f.s.urban.update(.3,[]);compare(preparation,'after preparation failure');
const refreshFailure=[fixture(true),fixture(false)];
for(const f of refreshFailure){const project=f.s.interiors.breachProjection;let refreshes=0,fail=true;f.s.interiors.breachProjection=(...args)=>{const bridge=project(...args),refresh=bridge.refresh;bridge.refresh=function(){if(++refreshes===2&&fail){fail=false;throw Error('injected final refresh failure');}return refresh.call(this);};return bridge;};assert.throws(()=>blast(f),/injected final refresh failure/);assert.equal(f.publications.length,1,'First completed exterior remains published when final refresh fails');}
compare(refreshFailure,'final refresh failure');for(const f of refreshFailure)f.s.urban.update(.3,[]);compare(refreshFailure,'final refresh recovery');

for(const mode of ['throw-room','reentrant']){
 // Restore valid saved openings on three storeys without exhausting the
 // structural solver's twelve-solid cap before reaching the failure hook.
 const seed=fixture(true).s,initialSave={urban:{damage:structuredClone(seed.urban.controller.snapshot()),openings:[0,1,2].map(floor=>({sourceId:'piece-0',point:[seed.point[0],1.2+floor*3.1,seed.point[2]],floor}))}};
 const pair=[fixture(true,true,initialSave),fixture(false,true,initialSave)];compare(pair,mode+' restored setup');
 for(const f of pair){f.clear();f.arm(mode);assert(f.s.urban.breachProjections.length>=2,'Fixture exposes several floors before the injected failure');if(mode==='throw-room'){let error;try{blast(f,240,3.4,4.3);}catch(e){error=e;}assert.match(error?.message||JSON.stringify({roomCalls:f.roomCalls,projections:f.s.urban.breachProjections.map(b=>b.floor),publications:f.publications.length}),/injected second room failure/);}else blast(f,240,3.4,4.3);assert(f.roomCalls>=2);}
 compare(pair,mode);if(mode==='reentrant')assert(pair.every(f=>f.queries.length>0),'Nested real controller query actually observed the scene');
 for(const f of pair){f.arm(null);blast(f,240,10,4.3);f.s.urban.update(.3,[]);}compare(pair,mode+' subsequent blast');
}

// Custom default, current room and outside-core paths stay synchronous.
for(const mode of ['strict-default','inside-room','outside-core']){
 const pair=[fixture(true,false),fixture(false,mode!=='strict-default')];for(const f of pair){blast(f);f.clear();if(mode==='inside-room')f.s.world.room={sceneId:'custom-room',contains:()=>false};if(mode==='outside-core')f.s.world.coreBounds={minX:-1,maxX:1,minZ:-1,maxZ:1};blast(f,240,10,4.3);}
 compare(pair,mode);assert.deepEqual(pair[1].publications,pair[0].publications,mode+' exact intermediate publications');
}
const publisherFailure=[fixture(true,false),fixture(false,false)];
for(const f of publisherFailure){const replace=f.s.world.replaceScenery;f.s.world.replaceScenery=()=>{throw Error('custom publisher failed');};assert.throws(()=>blast(f),/custom publisher failed/);f.s.world.replaceScenery=replace;}
compare(publisherFailure,'strict custom publisher failure');for(const f of publisherFailure)f.s.urban.update(.3,[]);compare(publisherFailure,'strict custom publisher recovery');
console.log(JSON.stringify({pass:true,baseline,stages,publications:counts,scope:'Frozen oracle; actual FERRO destruction/physics and rotated procedural rooms. Final snapshots, geometry/collider/event/impulse order, partial failures, reentrant queries, debris capacity and strict fallbacks.'},null,2));
