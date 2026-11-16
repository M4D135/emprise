/* Actual session/campaign/weather/marine normalization, with a small metric coast.
   Compare direct loading to the real game's deferred title loading at fixed time. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=name=>fs.readFileSync(new URL('../src/'+name,import.meta.url),'utf8');
const game=read('game.js'),section=(a,b)=>{const start=game.indexOf(a),end=game.indexOf(b,start);assert(start>=0&&end>start);return game.slice(start,end);},clone=v=>JSON.parse(JSON.stringify(v));
function fixture(saved,opening=61000){
 let clock=opening,calls=0;const stored=clone(saved),noop=()=>{};
 const world=()=>{calls++;const w={bounds:{minX:-1000,maxX:1000,minZ:-1000,maxZ:1000},combatWorld:{spawn:{x:340,z:0},enemies:[]},fleet:[],car:{},scenery:[],water:x=>x<300,blocked:(x,z,r)=>x-r<300||Math.abs(x-650)<30,ground:()=>.08,candidates:()=>[],ray:(_o,_d,d)=>d};w.freeNear=(x,z,r,options={})=>{if(!w.blocked(x,z,r))return [x,z];if(options.required===false)return null;throw Error('No free point');};return w;};
 const context=vm.createContext({console,structuredClone,Date:{now:()=>clock},FRender:{forme:noop},PDR:{villeReelle:{hasard:()=>()=>.5}},RADE:{world:{create:world},traffic:{create:()=>({})},crowd:{create:()=>({people:[]})},storage:{load:()=>stored}},FSimulation:{create(w,options={}){const state={player:{...w.spawn,y:.08,yaw:0,pitch:0,hp:100},enemies:[],inventory:clone(options.inventory||{weapons:[true,true,true],ammo:[180,36,12]}),weapon:0};return {state,selectWeapon:value=>{state.weapon=value;},relocate(x,z,yaw){Object.assign(state.player,{x,z,yaw,y:.08});}};}}});
 for(const name of ['ferro/geometry.js','bitume/main.js','bitume/voiture.js','marine.js','weather.js','campaign.js','session.js'])vm.runInContext(read(name),context,{filename:name});
 context.RADE.campaign.layout=()=>({sites:[{id:'site-0',gang:1,rate:45,guards:[]}],reserves:[]});
 Object.assign(context,{R:context.RADE,testMode:false,session:null,live:null,liveSnapshot:null,pendingInitial:null});
 vm.runInContext(section('const copyState=','function rememberLive(')+section('function restoreLive(){','function releaseResident(){')+section('async function prepareInitial(){','async function init(){'),context);
 return {c:context,stored,get calls(){return calls;},setClock(value){clock=value;}};
}
function snapshot(s){return clone({saved:s.save(),state:s.campaign.state,law:s.campaign.law,player:s.player,mode:s.mode,time:s.time,history:s.history,weather:s.weather.save()});}
const saved={version:2,savedAt:1000,cash:871,xp:42,kills:3,earned:8,mapOwned:true,sites:[{id:'site-0',gang:0,upgrade:2}],player:{x:360,z:20,hp:56,yaw:.7},ammunition:{version:1,ammo:[71,17,6],weapon:1},weather:{clockHours:22,elapsed:811,cloud:.9,rain:.7,wet:.8,wind:.85,storm:.2,cloudX:8,cloudZ:2},journal:[{time:4,text:'Retained log'}]};
for(const input of [null,saved,{...saved,player:{x:650,z:0,hp:56}}, {...saved,marine:{version:2,mode:'swim',player:{x:100,z:10,yaw:.5,pitch:.3},boats:[]}}, {...saved,cash:2e9,xp:-1,nextRaid:999,ammunition:{version:1,ammo:[999,17,6],weapon:1},weather:{elapsed:-1,wet:4,cloud:9,wind:-4}}]){
 const direct=fixture(input),delayed=fixture(input);const initial=direct.c.RADE.session.create({saved:clone(input),now:61000});
 await delayed.c.prepareInitial();assert.equal(delayed.calls,0,'Title does not construct even the small oracle world');assert.equal(delayed.c.session,null);assert.equal(delayed.c.live,null);assert.equal(delayed.c.pendingInitial.now,61000);
 if(delayed.stored)delayed.stored.cash=0;
 direct.setClock(961000);delayed.setClock(961000);delayed.c.restoreLive();assert.equal(delayed.calls,1);assert.deepEqual(snapshot(delayed.c.live),snapshot(initial),'Deferred loading must exactly match direct normalization despite a much later Play');
 assert.equal(delayed.c.live.time,0);assert.equal(delayed.c.live.campaign.state.savedAt,61000);
 if(input?.sites?.[0]?.gang===0)assert.equal(delayed.c.live.campaign.state.offline,76.5,'Exactly one 60-second offline income interval');
 if(input===null){assert.equal(initial.campaign.state.cash,200);assert.equal(initial.player.hp,100);assert.deepEqual(clone(initial.sim.state.inventory),{weapons:[true,true,true],ammo:[180,36,12]});}
}
console.log('PASS direct/deferred actual session normalization: no title world, frozen offline endpoint, deep copied save, new and owned campaigns, ammo/weather, stale-position recovery, saved swimming and malformed values.');
