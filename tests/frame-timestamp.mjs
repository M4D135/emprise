import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const game=fs.readFileSync(new URL('../src/game.js',import.meta.url),'utf8'),start=game.indexOf('function frame(now){'),end=game.indexOf('async function init(){',start);assert(start>=0&&end>start);
// Execute the real frame scheduling, clock and fixed-step simulation. Stop at
// presentation so this causal regression requires neither a DOM nor a GPU.
const code=game.slice(start,end).replace(' motion.update(dt,session.sim.state.locomotion',' return;motion.update(dt,session.sim.state.locomotion');
function fixture(source=code){
 const steps=[],inputTimes=[],failures=[],context=vm.createContext({performance:{now:()=>1000},requestAnimationFrame(){},updatePad(){},input:{frame:dt=>inputTimes.push(dt)},recorder:{push(){}},command:raw=>raw,pad:{event(){}},motion:{impulse(){}},fail:e=>failures.push(e),$ :()=>({hidden:true}),R:{replays:[]},session:{events:[],update:dt=>steps.push(dt)},testInput:()=>({})});
 vm.runInContext('var ready=true,fatal=false,last=1000,acc=.004,frameDt=0,touchActive=false,overlay=null,testMode=true,demo=false,running=true,sessionTransition=null,panel=null,lastCommand={},processedEvents=0,silent=true;',context);
 vm.runInContext(source,context);return {context,steps,inputTimes,failures};
}
const f=fixture();f.context.frame(200);
assert.equal(f.context.last,1000,'A queued old rAF timestamp cannot move the clock backwards');assert.equal(f.context.acc,.004,'No negative simulation debt');assert.equal(f.context.frameDt,0);assert.deepEqual(f.steps,[]);assert.deepEqual(f.inputTimes,[0]);
f.context.frame(1016);assert.equal(f.context.last,1016);assert.equal(f.context.frameDt,.016,'Only the real next 16 ms counts, no fictitious 816 ms');assert.equal(f.steps.length,2);assert(f.context.acc>=0&&f.context.acc<1/120);assert.deepEqual(f.failures,[]);
// Repeat stale timestamps; neither a second debt nor a catch-up burst is valid.
f.context.frame(900);f.context.frame(1016);assert.equal(f.context.last,1016);assert.equal(f.steps.length,2);f.context.frame(1033);assert.equal(f.steps.length,4);
// Independent normal-clock oracle is the previous production arithmetic.
const old=code.replace('Math.max(0,now-last)','now-last').replace('last=Math.max(last,now)','last=now'),a=fixture(),b=fixture(old);
for(const now of [1016,1033,1050,1100,1116,1150,1166,1200]){a.context.frame(now);b.context.frame(now);assert.equal(a.context.acc,b.context.acc);assert.equal(a.context.frameDt,b.context.frameDt);assert.deepEqual(a.steps,b.steps);}
const broken=fixture(old);broken.context.frame(200);broken.context.frame(1016);assert(broken.context.acc<-.7&&broken.steps.length===0,'The old arithmetic reproduces the observed 800 ms stall');
console.log('PASS real frame clock: stale rAF 200 after last=1000 adds no negative time or debt, next 1016 counts exactly 16 ms, repeated/duplicate stamps are safe, normal fixed-step trajectories unchanged; old code reproduces stall.');
