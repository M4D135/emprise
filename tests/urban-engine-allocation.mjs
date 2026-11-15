import './load.mjs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const baseline='22a330f',hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex'),old=vm.createContext({RADE:{...RADE},FDestruction,FPhysics,BITUME,console});
vm.runInContext(execFileSync('git',['show',baseline+':src/urban.js'],{encoding:'utf8'}).split('/* Condition modifies')[0],old);
function fixture(api){const player={x:3980,z:-3000,y:3.5,hp:100,yaw:0,pitch:0},car={id:1,model:'gti',x:4000,z:-3000,y:3.5,cap:0,u:3,v:3,w:0},world={scenery:[],boxes:[],fleet:[car],room:null,coreBounds:{minX:-550,maxX:550,minZ:-550,maxZ:550},combatWorld:{},ground:()=>3.5,candidates:()=>[],replaceScenery(){},ray:()=>100,dynamicBodies:[]},urban=api.create(world,{state:{player},hurt(){}});return {player,world,urban,car};}
const mesh=(x,y,z)=>({shape:'box',p:[x,y,z],s:[.6,.6,.6],r:[0,0,0],color:[.4,.4,.4],mat:3,material:'stone',structural:true});
function capture(s){return {save:s.urban.save(),zones:s.urban.physicsZones,engines:[...new Set(s.urban.bodies.map(q=>q.engine))].map(e=>[e.hash(),e.stats,e.staticsHash]),geometry:s.urban.geometry(),colliders:s.world.dynamicBodies.map(c=>({x:c.x,z:c.z,a:c.a,b:c.b,minY:c.minY,maxY:c.maxY,mesh:c.mesh}))};}
function run(api){const s=fixture(api),u=s.urban,states=[];
 u.spawnBody(mesh(1000,500,0),[32,0,0],[0,0,0],120,'street');u.spawnBody(mesh(950,4,0),[0,0,0],[0,0,0],120,'street');
 u.spawnBody(mesh(4000,12,-3000),[0,0,0],[0,0,0],120,'street');u.spawnBody(mesh(6000,-80,0),[0,0,0],[0,0,0],120,'street');
 let handler=null;for(let i=0;i<480;i++){
  u.update(1/60,[]);if(i===0)handler=s.car.impactHandler;
  if(i===80)s.car.impactHandler({nx:1,nz:0,obstacle:{body:u.bodies[2]}});
  if(i===120)s.car.impactHandler=()=>{throw Error('custom handler must be replaced on next update');};
  if(i%30===0)states.push(hash(capture(s)));
 }
 if(api===RADE.urban)assert.equal(s.car.impactHandler,handler,'Stable private handler restores the same implementation after external replacement');
 assert(u.bodies.some(q=>q.engine.body(q.handle).pos[0]>1104));assert(u.bodies.every(q=>!q.engine.body(q.handle).lost));
 // Force a nested clean while the outer clean reads the original body array.
 // The new body must not be included in the outer map's captured length.
 const first=u.bodies[0],engine=first.engine;let trigger=true;
 Object.defineProperty(first,'engine',{configurable:true,get(){if(trigger){trigger=false;u.spawnBody(mesh(22000,10,20000),[0,0,0],[0,0,0],120);}return engine;},set(value){Object.defineProperty(first,'engine',{value,writable:true,configurable:true});}});
 Object.assign(s.player,{x:20000,z:20000});u.physics;states.push(hash(capture(s)));Object.defineProperty(first,'engine',{value:engine,writable:true,configurable:true});
 u.update(1/60,[]);states.push(hash(capture(s)));return states;
}
assert.deepEqual(run(RADE.urban),run(old.RADE.urban));
console.log('PASS exact urban engine ownership vs '+baseline+': migrations, lost cleanup, overlapping zones, impact handlers, external replacement, nested cleanup and independent saves/geometry');
