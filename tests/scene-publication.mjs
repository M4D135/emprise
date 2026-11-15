import './load.mjs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const baseline=process.env.EMPRISE_BASELINE||'d22a5eb',hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const oldSource=file=>execFileSync('git',['show',baseline+':src/'+file+'.js'],{encoding:'utf8'});
function implementation(){
 const context=vm.createContext({RADE:{...RADE},FRender,FPhysics,BITUME,PDR,console});
 vm.runInContext(oldSource('ferro/destruction'),context);
 for(const name of ['world','breach','urban'])vm.runInContext(oldSource(name).split('/* Condition modifies')[0],context);
 return {world:context.RADE.world,urban:context.RADE.urban,breaches:context.RADE.breaches};
}
const old=implementation(),current={world:RADE.world,urban:RADE.urban,breaches:RADE.breaches};
vm.runInThisContext(readFileSync(new URL('./explosion-heavy-scenes.js',import.meta.url),'utf8'));
const mesh=m=>({shape:m.shape,p:m.p,s:m.s,r:m.r,mat:m.mat,color:m.color,material:m.material,emissive:m.emissive,alpha:m.alpha,fx:m.fx,collision:m.collision,breachShell:m.breachShell,breachInterior:m.breachInterior,sourceRoom:m.sourceRoom,destructibleId:m.destructibleId,renderRevision:m.renderRevision});
function colliders(list,geometry){const indices=new Map(geometry.map((m,i)=>[m,i]));return list.map(q=>({x:q.x,z:q.z,a:q.a,b:q.b,c:q.c,s:q.s,cap:q.cap,minY:q.minY,maxY:q.maxY,minX:q.minX,maxX:q.maxX,minZ:q.minZ,maxZ:q.maxZ,kind:q.kind,breachInterior:q.breachInterior,destroyed:q.destroyed,mesh:indices.get(q.mesh)??null}));}
function snapshot(s){const u=s.urban,w=s.world;return Object.fromEntries(Object.entries({destruction:u.controller.snapshot(),worldMeshes:w.scenery.map(mesh),worldColliders:colliders(w.boxes,w.scenery),urbanReport:{...u.report},bodies:u.bodies.map(q=>({scene:q.scene,mass:q.mass,material:q.material,mesh:mesh(q.mesh),body:q.engine.body(q.handle)})),projections:u.breachProjections.map(b=>({id:b.id,buildingId:b.buildingId,floor:b.floor,sceneId:b.room.sceneId,scale:b.scale,face:b.face,void:b.void,meshes:b.scenery.map(mesh),colliders:colliders(b.colliders,b.scenery),lights:b.lights})),save:u.save(),revision:u.revision}).map(([name,value])=>[name,hash(value)]));}
function run(api){
 Object.assign(RADE,api);const s=RADE.session.create({pedestrians:0,now:1794700000000}),w=s.world;s.urban.prepare();s.sim.relocate(61.5,211,0);let prewarm=null;if(api===current&&process.env.EMPRISE_PREWARM_INTERIORS==='1'){const saved=hash({urban:s.urban.save(),interiors:s.interiors.save()});prewarm=s.urban.prewarmInteriors();assert.equal(hash({urban:s.urban.save(),interiors:s.interiors.save()}),saved,'Prewarm must not change live persistence');}
 const facade=selectHeavyFacade(w,s.interiors,s.urban.controller),cars=w.fleet.filter(c=>c!==s.car&&!c.police&&!RADE.vehicles.SPECS[c.model].two).slice(0,3);
 cars.forEach((c,i)=>Object.assign(c,{x:61.5+(i%2)*4,z:181-i*18,cap:0,y:w.ground(61.5,181-i*18),ai:false,u:0,w:0,v:0,moteur:false}));
 let syncs=0,localDeltas=0,changedReferences=0;const replace=w.replaceScenery;w.replaceScenery=(...args)=>{
  syncs++;const d=args[1]?.meshDelta;if(d&&!d.full&&d.before===w.scenery&&d.after===args[0]){
   const rebuilt=d.before.slice();for(const q of d.splices.slice().reverse())rebuilt.splice(q.start,q.deleteCount,...q.items);
   assert.equal(rebuilt.length,d.after.length);assert(rebuilt.every((m,i)=>m===d.after[i]),'Exact published delta');localDeltas++;changedReferences+=d.splices.reduce((n,q)=>n+q.deleteCount+q.items.length,0);
  }return replace(...args);
 };
 const records=[];for(const c of cars){const before=syncs;assert(s.urban.detonateVehicle(c));records.push({kind:'vehicle',syncs:syncs-before,state:snapshot(s)});}
 for(const point of facade.points){const before=syncs,result=s.urban.damage(point,240,10,facade.normal.map(v=>-v));assert(result.changed);assert(s.urban.breachProjections.length>1);records.push({kind:'building',syncs:syncs-before,events:hash(result),state:snapshot(s)});}
 return {facade:{id:facade.sourceId,building:facade.buildingId,points:facade.points},records,localDeltas,changedReferences,prewarm,prewarmAfter:prewarm?s.urban.interiorPrewarm:null};
}
let a,b;try{a=run(old);b=run(current);}finally{Object.assign(RADE,current);}
assert.deepEqual(b.facade,a.facade);
for(let i=0;i<a.records.length;i++){const x=a.records[i],y=b.records[i];assert.deepEqual(y.state,x.state,'Exact final state after explosion '+i);assert.equal(y.events,x.events,'Exact event order after explosion '+i);assert(y.syncs<=x.syncs);}
const eliminatedPublications=a.records.reduce((n,q)=>n+q.syncs,0)-b.records.reduce((n,q)=>n+q.syncs,0);
assert(b.localDeltas+eliminatedPublications>=a.localDeltas,'Remaining publications retain exact local deltas');
console.log(JSON.stringify({test:'PASS exact scene publication vs '+baseline,facade:b.facade,scenePublications:{before:a.records.map(q=>q.syncs),after:b.records.map(q=>q.syncs)},localDeltas:{before:a.localDeltas,after:b.localDeltas},changedReferences:{before:a.changedReferences,after:b.changedReferences},prewarm:{before:b.prewarm,after:b.prewarmAfter},finalStateHashes:b.records.at(-1).state},null,2));
