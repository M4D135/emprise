import './load.mjs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex'),source=readFileSync(new URL('../src/urban.js',import.meta.url),'utf8').split('/* Condition modifies')[0],oldSource=execFileSync('git',['show','22a330f:src/urban.js'],{encoding:'utf8'}).split('/* Condition modifies')[0];
function fixture(old=false){const created=[],context=vm.createContext({RADE:{...RADE},FDestruction,BITUME,FPhysics:{...FPhysics,create(options){const engine=FPhysics.create(options);created.push({engine,options});return engine;}}});vm.runInContext(old?oldSource:source,context);const player={x:61.5,y:.08,z:211,hp:100,yaw:0,pitch:0},world={scenery:[],boxes:[],fleet:[],room:null,combatWorld:{},ground:()=>.08,candidates:()=>[],replaceScenery(){},dynamicBodies:[]},u=context.RADE.urban.create(world,{state:{player},hurt(){}});return {player,world,u,created};}
const mesh=(x,y,z)=>({shape:'box',p:[x,y,z],s:[.6,.6,.6],r:[0,0,0],mat:3,material:'stone',structural:true});
const spawn=(s,x,y=8,z=211,v=[0,0,0],scene='street')=>s.u.spawnBody(mesh(x,y,z),v,[0,0,0],120,scene);
const state=s=>({zones:s.u.physicsZones,save:s.u.save(),geometry:s.u.geometry(),engines:[...new Set(s.u.bodies.map(q=>q.engine))].map(e=>({hash:e.hash(),snapshot:e.snapshot(),stats:e.stats,statics:e.staticsHash}))});
const a=fixture(true),b=fixture();assert.equal(b.u.prewarmPhysics(),true);assert.equal(b.created.length,1);assert.equal(b.u.prewarmPhysics(),true);assert.equal(b.created.length,1);assert.equal(hash(state(b)),hash(state(a)),'Reserve has no visible engine membership or saved state');
const reserved=b.created[0].engine,pristine=reserved.hash();const aa=spawn(a,65),bb=spawn(b,65);assert.equal(bb.engine,reserved);assert.equal(b.created.length,1);assert.equal(hash(b.created[0].options),hash(a.created[0].options));assert.equal(b.u.prewarmPhysics(),false);assert.equal(b.created.length,1);
for(let i=0;i<300;i++){a.u.update(1/60,[]);b.u.update(1/60,[]);assert.equal(hash(state(b)),hash(state(a)),'First spawn/solver/saves tick '+i);}assert.notEqual(reserved.hash(),pristine);
// Matching reserve must wait until ordinary active-zone reuse no longer applies.
const overlap=fixture();overlap.player.x=1025;assert(overlap.u.prewarmPhysics());const overlapReserve=overlap.created[0].engine,near=spawn(overlap,65),cross=spawn(overlap,1025);assert.equal(cross.engine,near.engine);assert.notEqual(cross.engine,overlapReserve);assert.equal(overlap.created.length,2);const beyond=spawn(overlap,1140);assert.equal(beyond.engine,overlapReserve);assert.equal(overlap.created.length,2);
// Room solvers do not consume the street reserve; invalid positions are no-ops.
const rooms=fixture();assert(rooms.u.prewarmPhysics());const streetReserve=rooms.created[0].engine;rooms.world.room={sceneId:'room-test',building:{id:'fixture'},floor:0};assert.equal(rooms.u.prewarmPhysics(),false);const room=spawn(rooms,1000,3,1000,[0,0,0],'room-test');assert.notEqual(room.engine,streetReserve);rooms.world.room=null;
for(const [x,z]of [[NaN,0],[0,Infinity],[undefined,0],['2',0],[1e100,0]]){Object.assign(rooms.player,{x,z});assert.equal(rooms.u.prewarmPhysics(),false);assert.equal(rooms.created.length,2);}
Object.assign(rooms.player,{x:61.5,z:211});assert(rooms.u.prewarmPhysics());assert.equal(spawn(rooms,65).engine,streetReserve);assert.equal(rooms.created.length,2);
// One reserve, not a pool: replacing its zone releases its ownership.
const replaced=fixture();assert(replaced.u.prewarmPhysics());const first=replaced.created[0].engine;replaced.player.x=10000;assert(replaced.u.prewarmPhysics());assert.equal(replaced.created.length,2);assert.notEqual(spawn(replaced,65).engine,first);assert.equal(replaced.created.length,3);
// A reserved engine cannot bypass the normal 24-zone cap.
const capped=fixture();assert(capped.u.prewarmPhysics());const cappedReserve=capped.created[0].engine;for(let i=1;i<=24;i++)assert(spawn(capped,i*3000,8,5000));assert.equal(capped.u.physicsZones.length,24);assert.equal(spawn(capped,65),null);assert.equal(capped.created.length,25);assert.equal(cappedReserve.stats.bodies,0);
// Prewarming remains dormant through the same source-engine reconstruction.
function migrate(warm){const s=fixture();Object.assign(s.player,{x:1000,z:0});if(warm)assert(s.u.prewarmPhysics());spawn(s,1000,500,0,[32,0,0]);spawn(s,950,4,0);for(let i=0;i<420;i++)s.u.update(1/60,[]);return state(s);}assert.equal(hash(migrate(true)),hash(migrate(false)));
console.log('PASS one explicit physics reserve: exact state/options/contact hashes, 300 ticks, first spawn, overlap priority, room isolation, invalid coordinates, replacement, 24-zone cap and migration');
