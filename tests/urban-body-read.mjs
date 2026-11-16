import './load.mjs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const baseline=process.env.EMPRISE_BASELINE||'22a330f',hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function implementation(old){const source=file=>old?execFileSync('git',['show',baseline+':src/'+file+'.js'],{encoding:'utf8'}):readFileSync(new URL('../src/'+file+'.js',import.meta.url),'utf8'),context=vm.createContext({RADE:{...RADE},FDestruction,BITUME,console});vm.runInContext(source(old?'metal/physics':'ferro/physics'),context);vm.runInContext(source('urban').split('/* Condition modifies')[0],context);return context.RADE.urban;}
vm.runInThisContext(readFileSync(new URL('./explosion-heavy-scenes.js',import.meta.url),'utf8'));
const mesh=m=>({shape:m.shape,p:m.p,s:m.s,r:m.r,mat:m.mat,color:m.color,material:m.material,emissive:m.emissive,alpha:m.alpha,fx:m.fx,collision:m.collision,breachShell:m.breachShell,breachInterior:m.breachInterior,sourceRoom:m.sourceRoom,destructibleId:m.destructibleId,renderRevision:m.renderRevision});
function colliders(list,geometry){const indices=new Map(geometry.map((m,i)=>[m,i]));return list.map(q=>({x:q.x,z:q.z,a:q.a,b:q.b,c:q.c,s:q.s,cap:q.cap,minY:q.minY,maxY:q.maxY,minX:q.minX,maxX:q.maxX,minZ:q.minZ,maxZ:q.maxZ,kind:q.kind,breachInterior:q.breachInterior,destroyed:q.destroyed,mesh:indices.get(q.mesh)??null}));}
function snapshot(s){const u=s.urban,w=s.world;return Object.fromEntries(Object.entries({destruction:u.controller.snapshot(),worldMeshes:w.scenery.map(mesh),worldColliders:colliders(w.boxes,w.scenery),urbanReport:{...u.report},bodies:u.bodies.map(q=>({scene:q.scene,mass:q.mass,material:q.material,mesh:mesh(q.mesh),body:q.engine.body(q.handle)})),projections:u.breachProjections.map(b=>({id:b.id,buildingId:b.buildingId,floor:b.floor,sceneId:b.room.sceneId,scale:b.scale,face:b.face,void:b.void,meshes:b.scenery.map(mesh),colliders:colliders(b.colliders,b.scenery),lights:b.lights})),save:u.save(),revision:u.revision}).map(([name,value])=>[name,hash(value)]));}
// Contact-event counters and optional joint diagnostics are new observability.
// Solver hashes, all other counters and published world state remain compared exactly.
const colliderValues=boxes=>boxes.map(q=>({x:q.x,z:q.z,a:q.a,b:q.b,c:q.c,s:q.s,minY:q.minY,maxY:q.maxY,mesh:mesh(q.mesh)}));
function run(api){
 RADE.urban=api;const s=RADE.session.create({pedestrians:0,now:1794700000000}),w=s.world;s.urban.prepare();s.urban.prewarmPhysics?.();s.weather.force('soleil');s.weather.setHour(14);s.weather.tick(0);s.sim.relocate(61.5,211,0);
 const facade=selectHeavyFacade(w,s.interiors,s.urban.controller),cars=w.fleet.filter(c=>c!==s.car&&!c.police&&!RADE.vehicles.SPECS[c.model].two).slice(0,3);
 cars.forEach((c,i)=>Object.assign(c,{x:61.5+(i%2)*4,z:181-i*18,cap:0,y:w.ground(61.5,181-i*18),ai:false,u:0,w:0,v:0,moteur:false}));
 const records=[],stateStream=createHash('sha256'),renderStream=createHash('sha256');let heldGeometry=null,heldColliders=null,heldSave=null;
 for(let tick=0;tick<900;tick++){
  if(tick===180)for(const c of cars)assert(s.urban.detonateVehicle(c));
  if(tick===420||tick===660){const result=s.urban.damage(facade.points[tick===420?0:1],240,10,facade.normal.map(v=>-v));assert(result.changed);records.push({tick,events:hash(result),state:snapshot(s)});}
  s.player.hp=100;s.update(1/120,{});
  if(heldGeometry)assert.equal(hash(heldGeometry.value),heldGeometry.hash,'Published render poses remain independent of later scratch reads');
  if(heldColliders)assert.equal(hash(colliderValues(heldColliders.value)),heldColliders.hash,'Published collision poses remain independent of later scratch reads');
  if(heldSave)assert.equal(hash(heldSave.value),heldSave.hash,'Saved body poses remain independent of later scratch reads');
  const geometry=s.urban.geometry(),boxes=w.dynamicBodies;renderStream.update(JSON.stringify([geometry,colliderValues(boxes)]));
  const engines=[...new Set(s.urban.bodies.map(q=>q.engine))];stateStream.update(JSON.stringify(engines.map(e=>[e.hash(),e.staticsHash,Object.fromEntries(Object.entries(e.stats).filter(([key])=>key!=='events'&&key!=='joints'))])));
  heldGeometry={value:geometry,hash:hash(geometry)};heldColliders={value:boxes,hash:hash(colliderValues(boxes))};
  if(tick===421){const value=s.urban.save().bodies;heldSave={value,hash:hash(value)};}
 }
 const result={facade:facade.sourceId,records,finalStateHashes:snapshot(s),solverHistory:stateStream.digest('hex'),renderHistory:renderStream.digest('hex'),bodies:s.urban.bodies.length,simulationTicks:900};s.sim.dispose();return result;
}
const current=RADE.urban;let a,b;try{a=run(implementation(true));b=run(implementation(false));}finally{RADE.urban=current;}
assert.deepEqual(b,a,'Exact heavy physics, contacts, scenery, body descriptions and saves vs '+baseline);
console.log(JSON.stringify({test:'PASS urban body reads vs '+baseline,facade:b.facade,simulationTicks:b.simulationTicks,bodies:b.bodies,solverHistory:b.solverHistory,renderHistory:b.renderHistory,finalStateHashes:b.finalStateHashes},null,2));
