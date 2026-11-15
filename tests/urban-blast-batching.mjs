import './load.mjs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const baseline=process.env.EMPRISE_BASELINE||'76e5ed7',hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const oldSource=file=>execFileSync('git',['show',baseline+':src/'+file+'.js'],{encoding:'utf8'});
function implementation(breach,urban){
 const context=vm.createContext({RADE:{...RADE},FDestruction,FPhysics,BITUME,console});
 vm.runInContext(breach,context);vm.runInContext(urban.split('/* Condition modifies')[0],context);
 return {urban:context.RADE.urban,breaches:context.RADE.breaches};
}
const old=implementation(oldSource('breach'),oldSource('urban')),current={urban:RADE.urban,breaches:RADE.breaches};
vm.runInThisContext(readFileSync(new URL('./explosion-heavy-scenes.js',import.meta.url),'utf8'));
const mesh=m=>({shape:m.shape,p:m.p,s:m.s,r:m.r,mat:m.mat,color:m.color,material:m.material,emissive:m.emissive,alpha:m.alpha,fx:m.fx,collision:m.collision,breachShell:m.breachShell,breachInterior:m.breachInterior,sourceRoom:m.sourceRoom,destructibleId:m.destructibleId,renderRevision:m.renderRevision});
function colliders(list,geometry){const indices=new Map(geometry.map((m,i)=>[m,i]));return list.map(q=>({x:q.x,z:q.z,a:q.a,b:q.b,c:q.c,s:q.s,cap:q.cap,minY:q.minY,maxY:q.maxY,minX:q.minX,maxX:q.maxX,minZ:q.minZ,maxZ:q.maxZ,kind:q.kind,breachInterior:q.breachInterior,destroyed:q.destroyed,mesh:indices.get(q.mesh)??null}));}
function snapshot(s){const u=s.urban,w=s.world;return Object.fromEntries(Object.entries({destruction:u.controller.snapshot(),worldMeshes:w.scenery.map(mesh),worldColliders:colliders(w.boxes,w.scenery),urbanReport:{...u.report},bodies:u.bodies.map(q=>({scene:q.scene,mass:q.mass,material:q.material,mesh:mesh(q.mesh),body:q.engine.body(q.handle)})),projections:u.breachProjections.map(b=>({id:b.id,buildingId:b.buildingId,floor:b.floor,sceneId:b.room.sceneId,scale:b.scale,face:b.face,void:b.void,meshes:b.scenery.map(mesh),colliders:colliders(b.colliders,b.scenery),lights:b.lights})),save:u.save(),revision:u.revision}).map(([name,value])=>[name,hash(value)]));}
function run(api){
 Object.assign(RADE,api);const s=RADE.session.create({pedestrians:0,now:1794700000000}),w=s.world;s.urban.prepare();s.sim.relocate(61.5,211,0);
 const facade=selectHeavyFacade(w,s.interiors,s.urban.controller),cars=w.fleet.filter(c=>c!==s.car&&!c.police&&!RADE.vehicles.SPECS[c.model].two).slice(0,3);
 cars.forEach((c,i)=>Object.assign(c,{x:61.5+(i%2)*4,z:181-i*18,cap:0,y:w.ground(61.5,181-i*18),ai:false,u:0,w:0,v:0,moteur:false}));
 let syncs=0;const replace=w.replaceScenery;w.replaceScenery=(...args)=>{syncs++;return replace(...args);};
 const records=[];for(const c of cars){const before=syncs;assert(s.urban.detonateVehicle(c));records.push({kind:'vehicle',syncs:syncs-before,state:snapshot(s)});}
 for(const point of facade.points){const before=syncs,result=s.urban.damage(point,240,10,facade.normal.map(v=>-v));assert(result.changed);assert(s.urban.breachProjections.length>1);records.push({kind:'building',syncs:syncs-before,events:hash(result),state:snapshot(s)});}
 return {facade:{id:facade.sourceId,building:facade.buildingId,points:facade.points},records};
}
let a,b;try{a=run(old);b=run(current);}finally{Object.assign(RADE,current);}
assert.deepEqual(b.facade,a.facade);
for(let i=0;i<a.records.length;i++){const x=a.records[i],y=b.records[i];assert.deepEqual(y.state,x.state,'Exact final state after explosion '+i);assert.equal(y.events,x.events,'Exact event order after explosion '+i);assert(y.syncs<=x.syncs);}
assert(b.records.filter(q=>q.kind==='building').some((q,i)=>q.syncs<a.records.filter(q=>q.kind==='building')[i].syncs),'Real building blasts publish fewer scene rebuilds');
console.log(JSON.stringify({test:'PASS exact blast batching vs '+baseline,facade:b.facade,scenePublications:{before:a.records.map(q=>q.syncs),after:b.records.map(q=>q.syncs)},finalStateHashes:b.records.at(-1).state},null,2));
