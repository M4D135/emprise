import './load.mjs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/urban.js',import.meta.url),'utf8').split('/* Condition modifies')[0];
function fixture({throwAt=0,x=61.5,z=211}={}){
 const created=[];let clock=0,u,warming=false;
 const context=vm.createContext({RADE:{...RADE},FDestruction,BITUME,FPhysics:{...FPhysics,create(options){
  const engine=FPhysics.create({...options,clock:()=>clock+=.25}),record={engine,options,steps:0,initial:engine.snapshot(),stats:{...engine.stats},phases:engine.phaseMs.slice()},step=engine.step;
  engine.step=function(dt){
   if(warming){assert.equal(u.bodies.length,0,'Warmup bodies stay private');assert.equal(u.physicsZones.length,0,'Warmup never activates a zone');}
   const result=step(dt);record.steps++;record.phaseTotal=engine.phaseMs.reduce((a,b)=>a+b,0);
   if(warming&&record.steps===throwAt)throw Error('injected warmup failure');return result;
  };created.push(record);return engine;
 }}});
 vm.runInContext(source,context);
 const player={x,y:.08,z,hp:100,yaw:0,pitch:0},world={scenery:[],boxes:[],fleet:[],room:null,combatWorld:{},ground:()=>.08,candidates:()=>[],replaceScenery(){},dynamicBodies:[]};
 u=context.RADE.urban.create(world,{state:{player},hurt(){}});
 return {u,world,player,created,warm(){warming=true;try{return u.prewarmPhysics();}finally{warming=false;}}};
}
function equal(a,b,label,handles=[]){
 assert.equal(a.hash(),b.hash(),label+' hash');assert.deepEqual(a.snapshot(),b.snapshot(),label+' snapshot');
 assert.deepEqual(a.stats,b.stats,label+' stats');assert.equal(a.staticsHash,b.staticsHash,label+' statics');
 for(const h of handles){assert.deepEqual(a.body(h),b.body(h),label+' body '+h);for(const alpha of [0,.5,1])assert.deepEqual(a.pose(h,alpha),b.pose(h,alpha),label+' pose '+h);}
}
const s=fixture(),emptySave=JSON.stringify(s.u.save());assert(s.warm());assert.equal(s.created.length,1);
const record=s.created[0],b=record.engine,a=FPhysics.create(record.options);
assert.equal(record.steps,8);assert(record.phaseTotal>0,'Instrumentation really ran during warmup');
assert.deepEqual(b.snapshot(),record.initial);assert.deepEqual(b.stats,record.stats);assert.deepEqual(b.phaseMs,record.phases);
assert.equal(JSON.stringify(s.u.save()),emptySave);equal(a,b,'pristine after warmup');
assert(s.warm());assert.equal(record.steps,8,'Repeated reservation does not warm twice');assert.equal(s.created.length,1);

// Consume the reserve through the real urban path before comparing future work.
const first={shape:'box',p:[28,2,30],s:[.6,.6,.6],r:[0,0,0],mat:3,material:'stone'},q=s.u.spawnBody(first,[0,0,0],[0,0,0],120);
assert.equal(q.engine,b);assert.equal(q.handle,a.addBody({shape:'box',size:first.s,pos:first.p,rot:first.r,vel:[0,0,0],ang:[0,0,0],mass:120,material:'stone',asleep:false}));
assert.equal(s.warm(),false,'An active zone is never warmed');assert.equal(record.steps,8);
const handles=[q.handle];
for(let i=0;i<46;i++){
 const d={shape:['box','sphere','capsule'][i%3],size:[.4+i%3*.1,.5,.6],radius:.25,height:.8,pos:[28+i%8*.55,.26+Math.floor(i/8)*.48,30+(i%3)*.3],rot:[i%3*.03,i%4*.1,i%2*.02],vel:[.01*i,0,-.02*i],ang:[.1,.2,-.1],mass:20+i,material:['stone','wood','metal'][i%3],asleep:i%9===0};
 if(i%13===0)d.kinematic=true;const h=a.addBody(d);assert.equal(h,b.addBody(d),'Handle generations match an untouched engine');handles.push(h);
}
const boxes=[{center:[32,.4,32],half:[.5,.4,2],rotation:[1,0,0,0,1,0,0,0,1]}],floors=[{x:32,z:32,w:64,d:64,y:0}];
a.setStatics(boxes,floors);b.setStatics(boxes,floors);equal(a,b,'bodies added',handles);
for(let tick=0;tick<240;tick++){
 if(tick%19===0){const h=handles[tick%handles.length],body=a.body(h);if(!body.kinematic){a.impulse(h,...body.pos,.6,1.2,-.2);b.impulse(h,...body.pos,.6,1.2,-.2);}}
 if(tick%23===0){const h=handles[1],pos=[28+Math.sin(tick*.1),.5,30];a.setKinematic(h,...pos,0,0,0,1);b.setKinematic(h,...pos,0,0,0,1);}
 if(tick===80){a.setStatics(boxes,[{...floors[0],y:.03}]);b.setStatics(boxes,[{...floors[0],y:.03}]);}
 if(tick===120){a.restore(a.snapshot());b.restore(b.snapshot());}
 const dt=tick%41===0?0:tick%37===0?.1:tick%17===0?1/240:1/60;
 assert.equal(a.step(dt),b.step(dt));equal(a,b,'tick '+tick,handles);
}
// A failed private warmup still restores the solver and never publishes it.
const failed=fixture({throwAt:3});assert.throws(()=>failed.warm(),/injected warmup failure/);
const rejected=failed.created[0];assert.deepEqual(rejected.engine.snapshot(),rejected.initial);assert.deepEqual(rejected.engine.stats,rejected.stats);assert.deepEqual(rejected.engine.phaseMs,rejected.phases);
assert.equal(failed.u.physicsZones.length,0);assert.equal(failed.u.bodies.length,0);
const normal=failed.u.spawnBody(first,[0,0,0],[0,0,0],120);assert.notEqual(normal.engine,rejected.engine);assert.equal(failed.created[1].steps,0,'Ordinary spawning never warms during gameplay');
// The generic scene remains inside the reserved zone even far from the origin.
const distant=fixture({x:10000,z:-9000});assert(distant.warm());const far=distant.created[0];assert.deepEqual(far.engine.snapshot(),far.initial);assert.deepEqual(far.engine.stats,far.stats);
console.log('PASS reserved solver warmup: exactly 8 private steps, pristine snapshot/statics/stats/timers, handles and 240 future ticks/poses exact, active-engine guard, no ordinary-spawn warmup, failure cleanup and distant zone');
