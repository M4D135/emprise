import assert from 'node:assert/strict';
// Deterministic open grid with a physical wall; the navigation field points towards the noise.
const width=100,offset=50,field=new Uint8Array(width*width).fill(0);
globalThis.PDR={nav:{AUCUN:255,BUT:254,DX:[-1024,0],DZ:[0,0],creer:()=>({n:10000,libre:new Uint8Array(10000).fill(1),champs:Array.from({length:12},()=>({dir:field})),demander:()=>0,prendre(){},avancer(){},centreX:i=>(i%width-offset)*1000,centreZ:i=>(Math.floor(i/width)-offset)*1000,caseDe:(x,z)=>{const ix=Math.round(x/1000)+offset,iz=Math.round(z/1000)+offset;return ix<0||ix>=width||iz<0||iz>=width?-1:iz*width+ix;},caseProche:()=>offset*width+offset})},villeReelle:{hasard:seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}},regles:{coder:(...v)=>v[2]}};
globalThis.RADE={};await import('../src/people.js');await import('../src/crowd.js');
function fixture(){const world={fleet:[],car:{x:0,z:0,cap:0,v:0},blocked:()=>false,withoutCar:f=>f()},crowd=RADE.crowd.create(world,1),p=crowd.people[0];Object.assign(p,{x:1,z:0,cap:0});return {world,crowd,p};}
let s=fixture();s.crowd.update(.05,[{name:'enemyShot',x:0,z:0}]);for(let i=0;i<35;i++)s.crowd.update(.05);assert(s.p.x>5,'Flee keeps moving away even though normal navigation points back at the shooter');assert(s.p.panic>0);assert(s.p.walkDistance>4);assert(s.p.moveSpeed>0);
for(let i=0;i<120;i++)s.crowd.update(.05);assert.equal(s.p.panic,0);const resume=s.p.x;for(let i=0;i<20;i++)s.crowd.update(.05);assert(s.p.x<resume,'Normal navigation resumes once the threat is forgotten');
s=fixture();s.world.blocked=(x,z,r)=>x+r>2&&x-r<2.6&&Math.abs(z)<6;for(let i=0;i<60;i++)s.crowd.update(.05,i===0?[{name:'shot',x:0,z:0}]:[]);assert(s.p.x<1.77||Math.abs(s.p.z)>6);assert(Math.abs(s.p.z)>1,'Chooses a lateral escape instead of endlessly walking into the wall');
s=fixture();s.world.fleet.push({x:3,z:0,cap:0,v:6,u:-6});s.crowd.update(.05);assert(s.crowd.avoids>0);assert(Math.abs(s.p.z)>0,'Anticipates reversing traffic');
s=fixture();s.p.injury={leg:true};for(let i=0;i<20;i++)s.crowd.update(.05,i===0?[{name:'explosion',x:0,z:0}]:[]);assert(s.p.walkDistance<=.351);s.p.hp=0;const old=[s.p.x,s.p.z];s.crowd.update(.05,[{name:'shot',x:0,z:0}]);assert.deepEqual([s.p.x,s.p.z],old);assert.equal(s.p.moveSpeed,0);
s=fixture();Object.assign(s.p,{x:1000,z:1000});assert.doesNotThrow(()=>s.crowd.update(.05,[{name:'shot',x:NaN,z:0}]));assert([...s.crowd.packed].every(Number.isFinite));
const a=fixture(),b=fixture();for(let i=0;i<50;i++){const events=i===2?[{name:'shot',x:0,z:0}]:[];a.crowd.update(.05,events);b.crowd.update(.05,events);}assert.deepEqual(a.crowd.packed,b.crowd.packed);
console.log('Crowd: persistent escape, return to walking, wall detour, reverse traffic, leg injury/death, invalid grid/events, determinism — passed');
// Independent behavioural profile: no fear, spontaneous local assault, physical limits.
s=fixture();Object.assign(s.p,{temperament:'provocateur',provocationCooldown:0,x:3,z:0});s.world.player={x:0,z:0,hp:100};s.world.ray=(o,d,far)=>far;let strikes=0;
// callback is wired at creation, so use a dedicated fixture for actual damage.
const w={...s.world},c=RADE.crowd.create(w,1,{allowAggression:true,hurt:(damage)=>{strikes++;w.player.hp-=damage;}}),a2=c.people[0];Object.assign(a2,{temperament:'provocateur',provocationCooldown:0,x:3,z:0});
for(let i=0;i<80;i++)c.update(.05,[{name:'shot',x:0,z:0}]);assert.equal(a2.fear,0);assert(a2.aggression>0);assert(strikes>0&&w.player.hp<100,'Unprovoked attack inflicts damage at close range');
const before=w.player.hp;a2.injury={leg:true};for(let i=0;i<50;i++)c.update(.05);assert.equal(w.player.hp,before,'Leg injury disables standing melee');
a2.injury=null;a2.x=1;a2.z=0;w.blocked=()=>true;w.ray=(o,d,far)=>Math.min(.01,far/2);for(let i=0;i<50;i++)c.update(.05);assert.equal(w.player.hp,before,'No punching through an opaque wall');
w.playerSeated=true;w.ray=(o,d,far)=>far;for(let i=0;i<50;i++)c.update(.05);assert.equal(w.player.hp,before,'Does not punch a seated player through bodywork');
assert.equal(a2.fear,0);assert.equal(a2.aggression,0);
const distribution=Array.from({length:480},(_,i)=>RADE.crowd.temperament(10000+i));assert(distribution.filter(t=>t==='provocateur').length>=10&&distribution.filter(t=>t==='provocateur').length<=35);
console.log('Provocateurs: fear immunity, unprovoked melee, leg injury, wall/vehicle protection, bounded independent distribution — passed');

const legacy=RADE.crowd.create({...w,player:{x:0,z:0,hp:100},playerSeated:false,blocked:()=>false},3);for(const p of legacy.people)Object.assign(p,{temperament:'provocateur',x:2,z:0,provocationCooldown:0});for(let i=0;i<40;i++)legacy.update(.05);assert(legacy.people.every(p=>p.aggression===0),'No untargetable aggressors without the combat layer');
const group=RADE.crowd.create({...w,player:{x:0,z:0,hp:100},playerSeated:false,blocked:()=>false},3,{allowAggression:true});for(const p of group.people)Object.assign(p,{temperament:'provocateur',x:2,z:0,provocationCooldown:0});for(let i=0;i<25;i++)group.update(.05);assert.equal(group.people.filter(p=>p.aggression>0).length,2,'At most two simultaneous aggressors');
