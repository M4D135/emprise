/* Render orchestration only: execute the game's actual helpers without a browser. */
import './load.mjs';import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../src/game.js',import.meta.url),'utf8'),modelCode=source.slice(source.indexOf('function local('),source.indexOf('function hud(')),lightCode=source.slice(source.indexOf('function sceneLights('),source.indexOf('function frame('));
function fixture(vehicle,{mounted=false,cockpit=false}={}){
 const renders=[],people=[],session={time:2.25,player:{x:0,y:.08,z:0},world:{fleet:[vehicle],boundaryOfficers:[],combatWorld:{}},sim:{state:{enemies:[],bullets:[],particles:[]}},car:mounted?vehicle:null,mode:mounted?'car':'foot'};
 const context={R:{vehicles:{SPECS:RADE.vehicles.SPECS,rgb:RADE.vehicles.rgb,render:(v,out,opt)=>renders.push({v,opt})},people:{build:e=>{people.push(e);return [];}}},BITUME,FEffects:{build:()=>[],lights:()=>[]},FWeapon:{build:()=>[]},session,renderer:{},running:false,panel:null,view:cockpit?'cockpit':'poursuite'};
 vm.createContext(context);vm.runInContext(modelCode+lightCode,context);const meshes=context.models({pos:[0,1.6,0]});return {session,renders,people,meshes,lights:context.sceneLights()};
}
const bike=(overrides={})=>({id:17,model:'tmax',police:true,siren:true,x:0,y:.08,z:0,cap:0,roulis:0,color:'#e6e9e8',moteur:true,ai:true,driver:{inside:true,hp:100,police:true},...overrides});
let f=fixture(bike());assert.equal(f.meshes.length,0,'TMAX receives no car roof bar or door stripes from game');assert.equal(f.people.length,0,'motorcycle rider has only one rendering owner');assert.equal(f.renders.length,1);assert.equal(f.renders[0].opt.rider,true);assert.equal(f.renders[0].opt.time,f.session.time);
for(const driver of [{inside:false,hp:100},{inside:true,hp:0},null]){f=fixture(bike({driver}));assert.equal(f.renders[0].opt.rider,false,'AI flag cannot create a missing, dead or dismounted rider');}
f=fixture(bike({ai:false,driver:{inside:true,hp:100}}));assert.equal(f.renders[0].opt.rider,true,'stopped living seated officer remains visible');
f=fixture(bike({ai:false,driver:{inside:false,hp:100}}),{mounted:true});assert.equal(f.renders[0].opt.rider,true,'player in the saddle is visible');assert.equal(f.people.length,0);
f=fixture(bike(),{mounted:true,cockpit:true});assert.equal(f.renders[0].opt.cockpit,true,'mobility receives cockpit visibility gate');
const car=bike({model:'gti'});f=fixture(car);assert.equal(f.meshes.length,5,'car keeps its own roof bar, lights and door markings');assert.equal(f.people.length,1,'car retains one seated driver');
f=fixture(bike({model:'gti',exploded:true}));assert.equal(f.meshes.length,0,'wreck receives no floating police equipment');assert(!f.lights.lights.some(l=>l.range===10));
for(const cap of [0,.7,-2.2])for(const roll of [-.25,0,.3]){const v=bike({model:'policebike',x:5,z:8,cap,roulis:roll});f=fixture(v);const beacon=f.lights.lights.find(l=>l.range===10);assert(beacon);const want=BITUME.voiture.mul(BITUME.voiture.attitude(cap,0,roll),[-.91,1.603,.14]).map((n,i)=>n+[v.x,v.y,v.z][i]);assert(Math.hypot(...beacon.p.map((n,i)=>n-want[i]))<1e-10,'beacon light follows motorcycle rear mast including lean');}
f=fixture(bike({model:'policebike',siren:false}));assert(!f.lights.lights.some(l=>l.range===10));
console.log('Police render: TMAX without car attachments, one actual seated rider, player/cockpit cases, intact car appearance, wrecks, rear beacon yaw/lean — passed');
