import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
for(const name of ['ferro/renderer','ferro/geometry','bitume/main','bitume/voiture','ferro/vehicle-dynamics','bitume/conduite','vehicles','mobility','pdr/ville-reelle'])await import('../src/'+name+'.js');
const source=fs.readFileSync(new URL('../src/traffic.js',import.meta.url),'utf8'),sessionSource=fs.readFileSync(new URL('../src/session.js',import.meta.url),'utf8');
const law=()=>({heat:0,wanted:0,seen:false,lastKnown:null,reportRevision:0,cooldown:0,arrest:0});
function world(){
 const w={fleet:[],car:{x:-500,z:-500},weather:null,playerSeated:false,ground:()=>.08,surface:()=>({mu:1.15,type:'piste'}),city:{rues:{aretes:[]}},pedestrians:[],policeOfficers:[],blocked:()=>false,withoutCar:fn=>fn(),carContact:()=>null};
 w.moveVehicle=(c,dx,dz,cap)=>{c.x+=dx;c.z+=dz;c.cap=cap;return null;};
 for(let x=-60;x<=60;x+=20)w.city.rues.aretes.push({sorte:'rue',largeur:6,points:[x,-60,x,60]});
 for(let z=-60;z<=60;z+=20)w.city.rues.aretes.push({sorte:'rue',largeur:6,points:[-60,z,60,z]});return w;
}
function fixture({real=false,police=false,sourceText=source}={}){
 const w=world(),commands=[],R={vehicles:{...RADE.vehicles,step:real?RADE.vehicles.step:(c,cmd)=>{commands.push({...cmd});c.v=0;return [];}}};
 vm.runInNewContext(sourceText,{RADE:R,PDR,BITUME});const t=R.traffic.create(w,{count:3}),c=t.cars[0];
 for(const other of t.cars){other.ai=false;other.x=-180;other.z=-180;}
 Object.assign(c,{x:0,y:.08,z:1.15,cap:0,model:'gti',ai:true,police,moteur:true,u:0,v:0,w:0,omega:0,stuck:0,reverse:0,driver:{id:100,inside:true,hp:100}});
 c.node=t.nearest(6.666666666666664,0);c.prev=t.nearest(0,0);w.fleet=[c];
 const player={x:-100,z:-100,y:.08,yaw:0,hp:100},l=law(),heard=[];
 function run(ticks,hook){for(let i=0;i<ticks;i++){hook?.(i);t.update(1/30,l,player);for(const e of t.events||[])heard.push({time:t.time,...e});}return heard;}
 return {w,t,c,player,law:l,heard,run,commands};
}
let cases=0;
for(const kind of ['player','vehicle','pedestrian','crawling']){
 const f=fixture();
 if(kind==='player')Object.assign(f.player,{x:3,z:1.15});
 else if(kind==='vehicle')f.w.fleet.push({id:90,model:'gti',x:4,z:1.15,cap:0,ai:false});
 else f.w.pedestrians.push({id:9,x:3,z:1.15,baseY:.08,hp:100,...(kind==='crawling'?{legL:0,legR:0,crawling:true}:null)});
 f.run(60);assert.equal(f.heard.length,1,kind+' one short event after waiting');const e=f.heard[0];
 assert(e.time>=1.6&&e.time<=2.04,kind+' delayed horn');assert.equal(e.name,'carHorn');assert.equal(e.type,'klaxon');assert.equal(e.reason,kind==='crawling'?'pedestrian':kind);assert.equal(e.vehicleId,f.c.id);assert(e.level>=.7&&e.level<=.9);assert.equal(e.blockedFor,e.time);assert.equal(f.commands[0].gaz,0,'front obstruction removes throttle');
 cases++;
}
{
 const f=fixture({police:true});Object.assign(f.player,{x:3,z:1.15});f.run(720);assert(f.heard.length>=4);for(let i=1;i<f.heard.length;i++){const gap=f.heard[i].time-f.heard[i-1].time;assert(gap>=3.5&&gap<=6.04,'variable bounded cooldown '+gap);}assert(new Set(f.heard.slice(1).map((e,i)=>Math.round((e.time-f.heard[i].time)*30))).size>1,'successive delays vary deterministically');
 const oldTime=f.t.time;for(const dt of [0,-1,NaN,Infinity]){f.t.update(dt,f.law,f.player);assert.equal(f.t.time,oldTime);assert.equal(f.t.events.length,0,'paused/invalid step does not repeat previous horn');}cases++;
}
for(const change of [c=>delete c.driver,c=>c.driver.hp=0,c=>c.driver.inside=false,c=>c.ai=false,c=>c.hidden=true,c=>c.parked=true,c=>c.exploded=true,c=>c.burning=true,c=>c.burned=true,c=>c.uncontrolled=true,c=>c.moteur=false]){
 const f=fixture();Object.assign(f.player,{x:3,z:1.15});change(f.c);f.run(95);assert.equal(f.heard.length,0,'ineligible vehicle remains silent: '+change);cases++;
}
for(const change of [p=>p.hp=0,p=>p.inside=true,p=>p.hidden=true,p=>p.x=-3,p=>p.z=5,p=>p.x=50,p=>p.baseY=5,p=>p.x=NaN]){
 const f=fixture(),p={id:9,x:3,z:1.15,baseY:.08,hp:100};change(p);f.w.pedestrians=[p];f.run(95);assert.equal(f.heard.length,0,'irrelevant person does not block/honk: '+change);assert(f.commands[0].gaz>0);cases++;
}
{
 const f=fixture();f.w.pedestrians=[{id:1,x:3,z:1.15,hp:100}];f.w.blocked=(x,z,r)=>r===.12&&x>1;f.run(90);assert.equal(f.heard.length,0,'occluded person does not trigger honking');assert(f.commands[0].gaz>0);cases++;
}
{
 const f=fixture();Object.assign(f.player,{x:3,z:1.15});f.run(30);f.player.x=-100;f.run(1);f.player.x=3;f.run(30);assert.equal(f.heard.length,0,'moving clearance resets accumulated waiting');f.run(30);assert.equal(f.heard.length,1);cases++;
}
{
 const f=fixture();Object.assign(f.player,{x:3,z:1.15});f.run(30);f.c.driver={id:101,inside:true,hp:100};f.run(30);assert.equal(f.heard.length,0,'new driver starts fresh');f.run(30);assert.equal(f.heard.length,1);cases++;
}
{
 const f=fixture();Object.assign(f.player,{x:3,z:1.15});f.c.reverse=10;f.run(90);assert.equal(f.heard.length,0,'recovery reverse is not a waiting queue');cases++;
}
{
 const f=fixture({police:true});Object.assign(f.law,{wanted:1,heat:1,lastKnown:{x:-100,z:-100},reportRevision:1});f.run(210);f.heard.length=0;Object.assign(f.player,{x:3,z:1.15});Object.assign(f.law,{lastKnown:{x:3,z:1.15},reportRevision:2});f.c.reverse=0;f.run(90);assert.equal(f.c.state,'pursuit');assert.equal(f.heard.length,0,'police intentionally arresting does not honk');cases++;
}
{
 // Spatial index reads far coordinates once per update, independent of fleet
 // size; only nearby cell members require forward/visibility projections.
 const f=fixture(),reads={x:0,z:0};f.w.pedestrians=Array.from({length:480},(_,i)=>({id:i,hp:100,get x(){reads.x++;return 500+i%30;},get z(){reads.z++;return 500+Math.floor(i/30);}}));
 for(const c of f.t.cars){c.ai=true;c.driver={inside:true,hp:100};}f.run(1);assert.equal(reads.x,960);assert.equal(reads.z,960);assert.equal(f.heard.length,0);cases++;
}
{
 // Actual BITUME dynamics: an initially moving car brakes for a person,
 // settles behind them, honks, then drives away after the crossing clears.
 const f=fixture({real:true,police:true});f.c.u=f.c.v=3;f.w.pedestrians=[{id:5,x:5,z:1.15,baseY:.08,hp:100}];f.run(180);
 assert(f.c.x<4,'car stays before pedestrian');assert(f.c.v<.7,'car settles');assert(f.heard.some(e=>e.reason==='pedestrian'),'actual dynamics reaches waiting horn');const stopped=f.c.x;f.w.pedestrians=[];f.run(90);assert(f.c.x>stopped+1,'car resumes after crossing');cases++;
}
{
 // Audio timers must not consume traffic random draws or change the old
 // trajectory without pedestrians. Real physics, every tick, not just digest.
 const old=execFileSync('git',['show','0a68dbe:src/traffic.js'],{encoding:'utf8',cwd:new URL('..',import.meta.url)}),a=fixture({real:true,sourceText:old}),b=fixture({real:true});
 Object.assign(a.player,{x:3,z:1.15});Object.assign(b.player,{x:3,z:1.15});for(let i=0;i<360;i++){if(i===100){a.player.x=b.player.x=-100;}a.run(1);b.run(1);assert.deepEqual(structuredClone(b.t.cars),structuredClone(a.t.cars),'unchanged physics/random state tick '+i);assert.deepEqual({...b.t.metrics},{...a.t.metrics});}assert(b.heard.length>0);cases++;
}
{
 // Production session logic emits the 30 Hz batch once, not on each 120 Hz
 // simulation substep. A light shell avoids unrelated city construction.
 const sources=[{name:'carHorn',type:'klaxon',vehicleId:1,x:9,z:0,level:.8},{name:'carHorn',type:'klaxon',vehicleId:2,x:-9,z:0,level:.8},{name:'carHorn',type:'klaxon',vehicleId:3,x:0,z:-22.5,level:.8},{name:'carHorn',type:'klaxon',vehicleId:4,x:45,z:0,level:.8}],saved=structuredClone(sources);let calls=0;
 const R={vehicles:RADE.vehicles,world:{create(){const w=world();w.car={x:-100,z:-100,ai:true,v:0};w.mission={x:100,z:100};w.combatWorld={};return w;}},traffic:{create(){return {cars:[],events:[],update(){calls++;this.events=sources;},arrestStatus:()=>({eligible:false})};}},campaign:{layout:()=>({}),create:()=>({law:law(),tick(){}})},crowd:{create:()=>({people:[],update(){}})}};
 const FSimulation={create:()=>({state:{player:{x:0,y:.08,z:0,yaw:0,hp:100},locomotion:{speed:0},events:[],enemies:[]},step(){}})};
 vm.runInNewContext(sessionSource,{RADE:R,FSimulation});const s=R.session.create({expanded:true});let count=0;
 for(let tick=1;tick<=16;tick++){s.update(1/120,{});if(tick%4){assert.equal(s.events.length,0,'no replay between traffic ticks');continue;}assert.equal(s.events.length,3,'45m horn omitted');count+=s.events.length;const [right,left,front]=s.events;assert.equal(right.pan,1);assert.equal(left.pan,-1);assert.equal(front.pan,0);assert(Math.abs(right.level-.8*.8*.8)<1e-12);assert.equal(front.level,.2);assert.notEqual(right,sources[0]);}
 assert.equal(calls,4);assert.equal(count,12);assert.deepEqual(sources,saved,'attenuation never mutates traffic event batch');s.player.yaw=Math.PI/2;for(let i=0;i<4;i++)s.update(1/120,{});assert(Math.abs(s.events[0].pan)<1e-12);assert.equal(s.events[2].pan,-1,'pan follows camera yaw');cases++;
}
console.log(JSON.stringify({pass:true,cases,productionPhysicsTicks:630,sessionSubsteps:20,pedestriansIndexed:480,scope:'Horn timing, cooldown, driver eligibility, crawling/occluded/irrelevant pedestrians, queue/player/legitimate stops, real braking/resume, unchanged no-pedestrian trajectories and exact-once 120Hz audio delivery; no browser/performance claim'},null,2));
