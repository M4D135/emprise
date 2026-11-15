import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
for(const name of ['ferro/renderer','bitume/carene','bitume/main','bitume/voiture','bitume/conduite','vehicles','mobility','pdr/ville-reelle','traffic','session'])await import('../src/'+name+'.js');
const create=RADE.session.trafficPresentation,near=(a,b,msg)=>assert(Math.abs(a-b)<1e-10,msg+' '+a+' != '+b);
const car=()=>({id:1,model:'gti',color:'#bb2729',ai:true,x:0,y:.08,z:0,cap:0,tangage:0,roulis:0,distance:0,braquage:0,volant:0,v:6,u:6,w:0,omega:1,moteur:true,driver:{id:20,inside:true,hp:100}});
let tested=0;
{
 const p=create(),c=car(),proxy=p.view(c,1),saved=structuredClone(c);assert.notEqual(proxy,c);assert.equal(Object.getPrototypeOf(proxy),Object.prototype,'view does not turn simulation into a prototype');
 p.before([c]);Object.assign(c,{x:.2,y:.10,z:.08,cap:.12,tangage:.1,roulis:.08,distance:.21,braquage:.1,volant:.3});p.after([c],1/30);
 const current=structuredClone(c);assert.equal(p.view(c,.5),proxy);near(proxy.x,.1,'x midpoint');near(proxy.y,.09,'y midpoint');near(proxy.z,.04,'z midpoint');near(proxy.cap,.06,'heading midpoint');near(proxy.distance,.105,'wheel travel midpoint');near(proxy.braquage,.05,'steering midpoint');near(proxy.volant,.15,'control midpoint');
 proxy.x=999;assert.equal(c.x,.2,'view scalar mutation never writes simulation');p.view(c,.5);near(proxy.x,.1,'view recomputed from private history');
 assert.deepEqual(c,current,'presentation did not change any simulation field');p.view(c,0);assert.equal(proxy.x,saved.x);p.view(c,1);assert.equal(proxy.x,c.x);p.view(c,5);assert.equal(proxy.x,c.x);
 c.color='#00aa44';assert.equal(p.view(c,.5).color,c.color,'non-pose attributes refresh, not frozen copies');
 c.condition={body:.4,engine:.2};c.glassBroken=true;c.fireAge=3;assert.equal(p.view(c,.5).condition,c.condition);assert.equal(proxy.glassBroken,true);assert.equal(proxy.fireAge,3);
 c.condition={body:1,engine:1};delete c.glassBroken;delete c.fireAge;p.view(c,.5);assert.equal(proxy.condition,c.condition);assert.equal(proxy.glassBroken,undefined,'deleted glass flag is cleared');assert.equal(proxy.fireAge,undefined,'deleted burn field is cleared');
 // External pose edits, including small relocations, never sweep through the
 // old trajectory. A subsequent normal traffic step can interpolate again.
 c.x+=.03;assert.equal(p.view(c,.2).x,c.x);p.before([c]);c.x+=.2;c.distance+=.2;p.after([c],1/30);near(p.view(c,.5).x,.33,'new segment after relocation');
 p.before([c]);c.x+=80;c.distance+=80;p.after([c],1/30);assert.equal(p.view(c,0).x,c.x,'teleport within traffic update snaps');
 p.before([c]);c.distance=0;p.after([c],1/30);assert.equal(p.view(c,.2).distance,0,'wheel-distance reset snaps');
 tested++;
}
{
 const inherited={color:'#22aabb',police:true,siren:true},c=Object.assign(Object.create(inherited),car());delete c.color;const p=create(),view=p.view(c,.5);assert.equal(Object.getPrototypeOf(view),Object.prototype);assert.equal(Object.getPrototypeOf(c),inherited);assert.equal(view.color,inherited.color);assert.equal(view.police,true);inherited.siren=false;assert.equal(p.view(c,.5).siren,false,'custom source prototype visual properties refresh without becoming a view prototype');tested++;
}
{
 const p=create(),c=car();c.cap=Math.PI-.04;p.view(c,1);p.before([c]);c.cap=-Math.PI+.04;p.after([c],1/30);near(p.view(c,.5).cap,Math.PI,'heading follows shortest arc across PI');assert.equal(p.view(c,1).cap,c.cap,'endpoint preserves exact simulation heading');tested++;
}
for(const mutate of [c=>c.driver={id:21,inside:true,hp:100},c=>c.driver.inside=false,c=>c.driver.hp=0,c=>c.ai=false,c=>c.exploded=true,c=>c.hidden=true,c=>c.uncontrolled=true,c=>c.policeStolen=true,c=>c.model='r5']){
 const p=create(),c=car();p.view(c);p.before([c]);c.x=.2;c.distance=.2;p.after([c],1/30);mutate(c);assert.equal(p.view(c,0).x,c.x,'driver/control/destruction change snaps immediately');tested++;
}
{
 const p=create(),c=car();p.view(c);p.before([c]);c.x=.2;c.distance=.2;p.after([c],1/30);assert.equal(p.view(c,.2,true),c,'player vehicle uses direct 120 Hz state');
 p.reset();assert.equal(p.view(c,0).x,c.x,'new installation resets history');const newCar={...c,id:c.id};assert.equal(p.view(newCar,0).x,newCar.x,'same id with new object does not reuse old history');
 c.driver.inside=false;c.ai=false;assert.equal(p.view(c,0),c);c.driver.inside=true;c.ai=true;assert.equal(p.view(c,0).x,c.x,'reclaimed vehicle starts at current pose');tested++;
}

// Real production traffic AI and BITUME/mobility integration, on a small
// deterministic road grid. Presentation is sampled at several phases between
// updates; the untouched twin receives exactly the same 30 Hz update calls.
function makeWorld(){
 const world={fleet:[],car:{x:-500,z:-500},weather:null,playerSeated:false,ground:()=>.08,surface:()=>({mu:1.15,type:'piste'}),city:{rues:{aretes:[]}},pedestrians:[],blocked:(x,z)=>Math.abs(x)>210||Math.abs(z)>210,withoutCar:fn=>fn(),carContact:()=>null};
 world.moveVehicle=(c,dx,dz,cap)=>{const x=c.x+dx,z=c.z+dz;if(world.blocked(x,z))return {nx:-Math.cos(cap),nz:-Math.sin(cap),depth:.1};c.x=x;c.z=z;c.cap=cap;return null;};
 for(let x=-60;x<=60;x+=20)world.city.rues.aretes.push({sorte:'rue',largeur:6,points:[x,-60,x,60]});for(let z=-60;z<=60;z+=20)world.city.rues.aretes.push({sorte:'rue',largeur:6,points:[-60,z,60,z]});return world;
}
const worlds=[makeWorld(),makeWorld()],traffic=worlds.map(w=>RADE.traffic.create(w,{count:12})),presentation=create(),law=()=>({heat:0,wanted:0,seen:false,lastKnown:null,reportRevision:0,cooldown:0}),laws=[law(),law()],player={x:4,z:2,hp:100};
for(const c of traffic[1].cars)presentation.view(c,1);
let renderedMoves=0;
for(let step=0;step<180;step++){
 if(step===50)for(const l of laws)Object.assign(l,{heat:2,wanted:2,lastKnown:{x:4,z:2},reportRevision:1});
 if(step===110)for(const l of laws)Object.assign(l,{heat:0,wanted:0});
 traffic[0].update(1/30,laws[0],player);presentation.before(traffic[1].cars);traffic[1].update(1/30,laws[1],player);presentation.after(traffic[1].cars,1/30);
 for(const c of traffic[1].cars){const x=presentation.view(c,0).x;for(const alpha of [.25,.5,.75,1]){const view=presentation.view(c,alpha);assert(Number.isFinite(view.x)&&Number.isFinite(view.cap));if(alpha===.5&&view.x!==x&&view.x!==c.x)renderedMoves++;}}
 assert.deepEqual(traffic[1].cars,traffic[0].cars,'actual AI/physics state remains exact at tick '+step);assert.deepEqual(laws[1],laws[0]);assert.deepEqual(traffic[1].metrics,traffic[0].metrics);
}
assert(renderedMoves>300,'production trajectories actually render intermediate positions');

// The actual session owner still schedules traffic every four simulation
// ticks. A light simulation shell avoids generating a city, while both
// versions execute the real session.update, traffic AI and vehicle physics.
function sessionFactory(source){
 const R={...RADE,weather:null,interiors:null,urban:null,marine:null,business:null,injuries:null,police:null,loot:null,phone:null,world:{create(){const w=makeWorld();w.car={...car(),id:-1,x:-500,z:-500,ai:true};w.mission={x:0,z:0};w.combatWorld={enemies:[],spawn:{x:0,z:0}};w.ray=(o,d,far)=>far;w.select=c=>w.car=c;w.freeNear=(x,z)=>[x,z];return w;}},crowd:{create(){let version=0;return {people:[],update(){version++;},get version(){return version;}};}},campaign:{layout:()=>({}),create(){const state={cash:200},lawState=law();return {state,law:lawState,tick(){},save(){return {version:2,cash:state.cash};},crime(){}};}}};
 const FSimulation={create(){const state={player:{x:0,y:.08,z:0,yaw:0,pitch:0,hp:100},events:[],enemies:[],locomotion:{speed:0}};return {state,step(){},hurt(){},revive(x,z){Object.assign(state.player,{x,z,hp:100});}};}};
 const realm=vm.createContext({RADE:R,FSimulation});vm.runInContext(source,realm);return R.session.create;
}
const baselineSession=execFileSync('git',['show','d22a5eb:src/session.js'],{encoding:'utf8',cwd:new URL('..',import.meta.url)}),sessionSource=fs.readFileSync(new URL('../src/session.js',import.meta.url),'utf8');
const sessions=[sessionFactory(baselineSession)(),sessionFactory(sessionSource)()];
for(let tick=1;tick<=240;tick++){
 for(const s of sessions)s.update(1/120,{});
 const s=sessions[1];near(s.trafficAlpha,(tick%4)/4,'fraction of ordinary traffic clock');
 for(const c of s.traffic.cars){const original=structuredClone(c);s.trafficView(c,Math.min(1,s.trafficAlpha+.125));assert.deepEqual(c,original);}
 assert.deepEqual(s.traffic.cars,sessions[0].traffic.cars,'real session trajectory exact at simulation tick '+tick);assert.deepEqual(s.player,sessions[0].player);assert.equal(s.traffic.time,sessions[0].traffic.time);assert.equal(s.time,sessions[0].time);
}
const selected=sessions[1].traffic.cars[0];Object.assign(selected,{v:0,u:0});Object.assign(sessions[1].player,{x:selected.x,z:selected.z});assert(sessions[1].interact());assert.equal(sessions[1].mode,'car');assert.equal(sessions[1].trafficView(selected,0),selected,'player cockpit never sees a delayed proxy');
sessions[1].respawn();assert.equal(sessions[1].mode,'foot');for(const c of sessions[1].traffic.cars)assert.equal(sessions[1].trafficView(c,0).x,c.x,'respawn clears interpolation history');

// Execute the actual game model/light functions with a fixed render fraction.
// Check geometry and attachment locations, not a copy of their implementation.
const game=fs.readFileSync(new URL('../src/game.js',import.meta.url),'utf8');
const localSource=game.slice(game.indexOf('function local('),game.indexOf('function models('));
const modelsSource=game.slice(game.indexOf('function models('),game.indexOf('function navigationHud('));
assert(modelsSource.endsWith('\n'));
const lightsSource=game.slice(game.indexOf('function sceneLights('),game.indexOf('function frame('));
for(const model of ['gti','policebike']){
 const c=car();Object.assign(c,{model,police:true,siren:true});const p=create();p.view(c);p.before([c]);Object.assign(c,{x:.2,z:.1,cap:.1,roulis:.06,distance:.2,braquage:.08});p.after([c],1/30);const original=structuredClone(c),driverPos=[];
 const session={world:{fleet:[c]},car:{},player:{x:0,z:0},mode:'foot',time:2,trafficAlpha:.25,trafficView:(car,alpha)=>p.view(car,alpha),sim:{state:{bullets:[],particles:[],enemies:[]}}};
 const R={...RADE,people:{build(e){driverPos.push(e);return [];}}},realm=vm.createContext({R,session,acc:1/120,renderer:{},BITUME,FEffects:{lights:()=>[],build:()=>[]},running:false,panel:null,overlay:null,view:'poursuite',clamp:(v,a,b)=>Math.max(a,Math.min(b,v))});
 vm.runInContext(localSource+modelsSource+lightsSource,realm);const got=vm.runInContext('models({pos:[0,2,0]})',realm),lights=vm.runInContext('sceneLights()',realm),proxy=p.view(c,.5),expected=[];
 RADE.vehicles.render(proxy,expected,{time:2,distance:Math.hypot(proxy.x,proxy.z),cockpit:false,rider:true});assert.deepEqual(structuredClone(got.slice(0,expected.length)),structuredClone(expected),model+' body/wheels/rider use identical interpolated pose');
 if(model==='gti'){assert.equal(driverPos.length,1);near(driverPos[0].x,proxy.x-.34*Math.cos(proxy.cap)+.34*Math.sin(proxy.cap),'seated driver follows body');near(driverPos[0].yaw,proxy.cap+Math.PI/2,'driver heading follows body');}
 const front=lights.lights.find(l=>l.cone);near(front.p[0],proxy.x+Math.cos(proxy.cap)*(RADE.vehicles.SPECS[model].length/2+.08),'headlight follows body');near(front.dir[0],Math.cos(proxy.cap),'headlight direction follows body');
 const beacon=lights.lights.find(l=>l.color[2]===1&&l.color[0]===.08);assert(beacon);
 if(model==='policebike'){const offset=BITUME.voiture.mul(BITUME.voiture.attitude(proxy.cap,0,proxy.roulis),[-.91,1.603,.14]);for(let i=0;i<3;i++)near(beacon.p[i],offset[i]+[proxy.x,proxy.y,proxy.z][i],'motorcycle beacon banks with rider/body');}
 else near(beacon.p[0],proxy.x,'car beacon follows body');
 assert.deepEqual(c,original,'rendering attachments does not mutate simulation');tested++;
}
console.log(JSON.stringify({pass:true,unitScenarios:tested,productionTrafficTicks:180,productionSessionTicks:240,vehicles:traffic[0].cars.length,intermediatePoses:renderedMoves,physicsAndAi:'exact every tick',attachments:['body','wheels','rider','seated driver','headlights','police beacons'],scope:'Render-only interpolation, no browser or FPS claim'},null,2));
