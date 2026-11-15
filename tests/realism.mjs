import './load.mjs';import assert from 'node:assert/strict';import fs from 'node:fs';
const V=RADE.vehicles;
function road(mu=1.15){return {surface:()=>({mu,type:'piste',pente:0,devers:0}),ground:()=>.08,moveVehicle(c,x,z,cap){c.x+=x;c.z+=z;c.cap=cap;return null;}};}
function car(model='gti'){return Object.assign(BITUME.conduite.creer(),{model,moteur:true,id:0});}
function run(c,seconds,cmd={},w=road()){for(let i=0;i<Math.round(seconds*120);i++)V.step(c,cmd,w,1/120);return c;}
const straight=run(car(),6,{gaz:1});assert(straight.v>15&&straight.x>40);assert(Math.abs(straight.z)<.001);
const damaged=car();damaged.condition={body:.6,engine:.35,tires:.7,steering:1};run(damaged,6,{gaz:1});assert(damaged.x<straight.x*.85,'damaged engine visibly loses acceleration');
const hand=run(car(),4,{gaz:1});run(hand,2,{gaz:.2,volant:.5,handbrake:1});run(hand,1,{gaz:1});assert.equal(hand.turbo.reste,0);assert.equal(hand.turbo.poussee,0);assert(!hand.derive.actif,'street handbrake does not charge racing boost');
function brake(mu){const c=car();c.u=c.v=20;c.rapport=3;const w=road(mu);for(let i=0;i<1200&&c.v>.1;i++)V.step(c,{frein:1},w,1/120);assert(c.u>=-.001&&c.v<.1);return c.x;}
const dry=brake(1.15),wet=brake(.828);assert(wet>dry*1.08,'wet road needs longer stopping distance');
const reverse=run(car(),2,{gaz:.5,marcheArriere:true});assert(reverse.x<-.5&&reverse.u<0);
const steer=car();V.step(steer,{volant:1},road(),1/120);assert(steer.volant>0&&steer.volant<.08,'steering has inertia');run(steer,.6,{volant:1});assert(steer.volant>.9);run(steer,.6,{});assert(steer.volant<.01,'centering remains responsive');
const r5=run(car('r5'),6,{gaz:1});assert(r5.boost>.9&&Math.abs(r5.x-straight.x)>.5,'turbo hatch has its own response');
for(const model of ['gti','r5','policebike']){const c=run(car(model),4,{gaz:.6,volant:.15});assert([c.x,c.z,c.u,c.v,c.omega,c.roulis].every(Number.isFinite));assert(c.distance>10);}
const gait={phase:1,amount:0};let maxJump=0;for(let i=0;i<100;i++){const old=gait.phase;RADE.people.advanceGait(gait,.05,1,.05);maxJump=Math.max(maxJump,gait.phase-old);}const stopped=gait.phase;for(let i=0;i<40;i++)RADE.people.advanceGait(gait,0,0,.05);assert.equal(gait.phase,stopped,'blocked or stopped actor does not march in place');assert.equal(gait.amount,0);
RADE.people.advanceGait(gait,.155,3.1,.05);assert(gait.phase>stopped&&gait.phase-stopped<1,'sprint keeps existing foot cycle');assert(maxJump<1);
const report={checks:['Flat-road acceleration and reverse','Engine damage reduces acceleration','Street handbrake cannot trigger racing turbo','Wet braking distance exceeds dry','Steering filters and recenters','Distinct R5 turbo response','Motorcycle drives and turns with finite state','Distance-driven animation stops when blocked and preserves phase when sprinting'],metrics:{distanceAt6Seconds:{gti:straight.x,r5:r5.x,damaged:damaged.x},stoppingDistanceFrom72kmh:{dry,wet},maxAnimationPhaseStep:maxJump},scope:'Deterministic simulation fixtures, no homologated vehicle measurements'};fs.writeFileSync(new URL('../docs/realism-validation.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
