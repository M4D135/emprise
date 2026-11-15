/* Real session/campaign/marine restore order with a small metric coast fixture.
   Rendering, pedestrian simulation and campaign decoration are unnecessary here. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=name=>fs.readFileSync(new URL('../src/'+name,import.meta.url),'utf8');
let world;
const noop=()=>{},context=vm.createContext({console,structuredClone,FRender:{forme:noop},PDR:{villeReelle:{hasard:()=>()=>.5}},RADE:{world:{create:()=>world},traffic:{create:()=>({})},crowd:{create:()=>({people:[]})}},FSimulation:{create:()=>{const state={player:{...world.combatWorld.spawn,y:.08,yaw:0,pitch:0,hp:100},enemies:[],inventory:{ammo:[180,36,12]},weapon:0};return {state,relocate(x,z,yaw){Object.assign(state.player,{x,z,yaw,y:world.ground(x,z)});}}}}});
for(const name of ['bitume/carene.js','bitume/main.js','bitume/voiture.js','marine.js','campaign.js','session.js'])vm.runInContext(read(name),context,{filename:name});
context.RADE.campaign.layout=()=>({sites:[{id:'site-0',gang:1,rate:45,guards:[]}],reserves:[]});
function fixture(){const calls=[];const w={bounds:{minX:-1000,maxX:1000,minZ:-1000,maxZ:1000},combatWorld:{spawn:{x:340,z:0},enemies:[]},fleet:[],car:{},scenery:[],water:x=>x<300,blocked:(x,z,r)=>x-r<300||Math.abs(x-650)<30,ground:()=>.08,candidates:()=>[],ray:(_o,_d,d)=>d};w.freeNear=(x,z,r,opts={})=>{calls.push({x,z,r,...opts});if(!w.blocked(x,z,r))return [x,z];if(opts.required===false)return null;throw Error('Aucun point libre près de '+x+','+z);};return {w,calls};}
const p={x:9.89877439307345,z:176.93137656723448,hp:56,yaw:.7},save={version:2,cash:871,xp:42,kills:3,savedAt:1000,sites:[{id:'site-0',gang:0,upgrade:2}],player:p};
function restore(marine,player=p){const f=fixture();world=f.w;return {...f,s:context.RADE.session.create({pedestrians:0,now:1000,saved:{...save,player,marine}})};}
let f=restore({version:2,mode:'swim',player:{...p,pitch:.3},boats:[]});assert.equal(f.s.mode,'swim');assert.equal(f.s.player.x,p.x);assert.equal(f.s.player.z,p.z);assert.equal(f.s.player.hp,56);assert.equal(f.calls.length,0,'Campaign must not look for dry land before the swimming restore');assert.equal(f.s.campaign.state.cash,871);assert.equal(f.s.campaign.sites[0].gang,0);
f=restore({version:2,mode:'boat',boatId:'boat-0',boats:[{id:'boat-0',kind:'motorboat',x:100,z:p.z,cap:0}]});assert.equal(f.s.mode,'boat');assert.equal(f.s.marine.boat.x,100);assert.equal(f.calls.length,0);assert(Math.abs(f.s.player.x-99.3)<1e-8);assert.equal(f.s.player.y,context.RADE.marine.SEA_LEVEL);assert(f.s.marine.camera(f.s.player).pos.every(Number.isFinite));
// A stale terrestrial save can be deep in water or in a new solid building.
for(const player of [p,{...p,x:650,z:0}]){f=restore(null,player);assert.equal(f.s.mode,'foot');assert.equal(f.s.player.x,340);assert.equal(f.s.player.z,0);assert.equal(f.s.player.hp,56);assert.equal(f.s.campaign.state.cash,871);assert.equal(f.s.campaign.state.xp,42);assert.equal(f.s.campaign.sites[0].upgrade,2);assert.equal(f.calls[0].required,false);assert.equal(f.calls[1].x,340);assert(!f.w.blocked(f.s.player.x,f.s.player.z,.34));assert(f.s.history.some(e=>/progression est conservée/.test(e.text)));}
f=restore(null,{...p,x:360,z:20});assert.equal(f.s.player.x,360);assert.equal(f.s.player.z,20);assert.equal(f.calls.length,1);
f=restore({version:2,mode:'swim',player:{x:650,z:0},boats:[]});assert.equal(f.s.mode,'foot');assert.equal(f.s.player.x,340,'Invalid marine coordinates keep the safe fresh spawn');assert(!f.w.blocked(f.s.player.x,f.s.player.z,.34));
f=restore({version:99,mode:'swim',player:p});assert.equal(f.s.mode,'foot');assert.equal(f.s.player.x,340);assert.equal(f.calls.length,2,'Unknown marine formats do not bypass land validation');
console.log('PASS: actual session restore order, saved swim/boat positions, stale water/building positions, checked fallback and retained progress.');
