import assert from 'node:assert/strict';
// Deterministic open grid with a physical wall; the navigation field points towards the noise.
const width=100,offset=50,field=new Uint8Array(width*width).fill(0);
globalThis.PDR={nav:{AUCUN:255,BUT:254,DX:[-1024,0],DZ:[0,0],creer:()=>({n:10000,libre:new Uint8Array(10000).fill(1),champs:Array.from({length:12},()=>({dir:field})),demander:()=>0,prendre(){},avancer(){},centreX:i=>(i%width-offset)*1000,centreZ:i=>(Math.floor(i/width)-offset)*1000,caseDe:(x,z)=>{const ix=Math.round(x/1000)+offset,iz=Math.round(z/1000)+offset;return ix<0||ix>=width||iz<0||iz>=width?-1:iz*width+ix;},caseProche:()=>offset*width+offset})},villeReelle:{hasard:seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}},regles:{coder:(...v)=>v[2]}};
await import('../src/crowd.js');
function fixture(){const world={fleet:[],car:{x:0,z:0,cap:0,v:0},blocked:()=>false,withoutCar:f=>f()},crowd=RADE.crowd.create(world,1),p=crowd.people[0];Object.assign(p,{x:1,z:0,cap:0});return {world,crowd,p};}
let s=fixture();s.crowd.update(.05,[{name:'enemyShot',x:0,z:0}]);for(let i=0;i<35;i++)s.crowd.update(.05);assert(s.p.x>5,'Flee keeps moving away even though normal navigation points back at the shooter');assert(s.p.panic>0);assert(s.p.walkDistance>4);assert(s.p.moveSpeed>0);
for(let i=0;i<120;i++)s.crowd.update(.05);assert.equal(s.p.panic,0);const resume=s.p.x;for(let i=0;i<20;i++)s.crowd.update(.05);assert(s.p.x<resume,'Normal navigation resumes once the threat is forgotten');
s=fixture();s.world.blocked=(x,z,r)=>x+r>2&&x-r<2.6&&Math.abs(z)<6;for(let i=0;i<60;i++)s.crowd.update(.05,i===0?[{name:'shot',x:0,z:0}]:[]);assert(s.p.x<1.77||Math.abs(s.p.z)>6);assert(Math.abs(s.p.z)>1,'Chooses a lateral escape instead of endlessly walking into the wall');
s=fixture();s.world.fleet.push({x:3,z:0,cap:0,v:6,u:-6});s.crowd.update(.05);assert(s.crowd.avoids>0);assert(Math.abs(s.p.z)>0,'Anticipates reversing traffic');
s=fixture();s.p.injury={leg:true};for(let i=0;i<20;i++)s.crowd.update(.05,i===0?[{name:'explosion',x:0,z:0}]:[]);assert(s.p.walkDistance<=.351);s.p.hp=0;const old=[s.p.x,s.p.z];s.crowd.update(.05,[{name:'shot',x:0,z:0}]);assert.deepEqual([s.p.x,s.p.z],old);assert.equal(s.p.moveSpeed,0);
s=fixture();Object.assign(s.p,{x:1000,z:1000});assert.doesNotThrow(()=>s.crowd.update(.05,[{name:'shot',x:NaN,z:0}]));assert([...s.crowd.packed].every(Number.isFinite));
const a=fixture(),b=fixture();for(let i=0;i<50;i++){const events=i===2?[{name:'shot',x:0,z:0}]:[];a.crowd.update(.05,events);b.crowd.update(.05,events);}assert.deepEqual(a.crowd.packed,b.crowd.packed);
console.log('Crowd: persistent escape, return to walking, wall detour, reverse traffic, leg injury/death, invalid grid/events, determinism — passed');
