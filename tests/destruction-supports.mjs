import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const original=vm.createContext({}),candidate=vm.createContext({});
vm.runInContext(execFileSync('git',['show','3ac8e4c:src/ferro/destruction.js'],{encoding:'utf8'}),original);
vm.runInContext(fs.readFileSync(new URL('../src/ferro/destruction.js',import.meta.url),'utf8'),candidate);
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
let operations=0,fixtures=0;
function make(definitions){
 const meshes=definitions.map((d,i)=>({shape:'box',p:[i*20,d.kind==='wall'?.5:3,0],s:d.kind==='wall'?[.4,1,.4]:[1,.3,1],material:'stone'}));
 return {meshes,colliders:meshes.map((m,i)=>({mesh:i,minX:m.p[0]-m.s[0]/2,maxX:m.p[0]+m.s[0]/2,minY:m.p[1]-m.s[1]/2,maxY:m.p[1]+m.s[1]/2,minZ:-m.s[2]/2,maxZ:m.s[2]/2})),destructibles:definitions.map((d,i)=>({strength:1,meshes:[i],colliders:[i],...d}))};
}
function pair(world){
 fixtures++;const a=original.FDestruction.create(world),b=candidate.FDestruction.create(world);
 const p={a,b,world,check(label){for(const [kind,get]of [['meshes',x=>x.meshes],['colliders',x=>x.colliders],['snapshot',x=>x.snapshot()],['lights',x=>x.lights]])assert.equal(hash(get(b)),hash(get(a)),label+' '+kind);for(const d of world.destructibles){assert.equal(b.isAlive(d.id),a.isAlive(d.id));assert.equal(hash(b.describe(d.id)),hash(a.describe(d.id)),label+' describe '+d.id);}},call(name,...args){operations++;const old=a[name](...args),next=b[name](...args);assert.equal(hash(next),hash(old),name+' exact ordered result');this.check(name);return old;},blast(id,power=1000){const d=world.destructibles.find(d=>d.id===id);return this.call('blast',world.meshes[d.meshes[0]].p,2,power);},hit(id,power=.1){const d=world.destructibles.find(d=>d.id===id);return this.call('hit',world.meshes[d.meshes[0]].p,power);}};
 p.check('initial');return p;
}
const chain=[{id:'base',kind:'wall'},{id:'r0',kind:'roof',supports:['base']},{id:'r1',kind:'roof',supports:['r0']},{id:'r2',kind:'roof',supports:['r1']},{id:'trigger0',kind:'wall'},{id:'trigger1',kind:'wall'},{id:'trigger2',kind:'wall'}];
for(const reverse of [false,true]){
 const world=make(chain);if(reverse)world.destructibles.reverse();const p=pair(world),pristine=JSON.parse(JSON.stringify(p.a.snapshot()));
 p.blast('base');assert(!p.b.isAlive('r0'));assert.equal(p.b.isAlive('r1'),reverse);assert.equal(p.b.isAlive('r2'),reverse);
 // Neither a miss nor pending material damage consumes backward dependencies.
 assert(!p.call('blast',[999,0,999],1,3).changed);assert(!p.hit('trigger0').changed);
 if(reverse){assert(p.b.isAlive('r1'));p.blast('trigger0');assert(!p.b.isAlive('r1'));assert(p.b.isAlive('r2'));p.blast('trigger1');assert(!p.b.isAlive('r2'));}
 p.call('restore',pristine);assert(p.b.isAlive('r0')&&p.b.isAlive('r1')&&p.b.isAlive('r2'));
 // Detachment is not a support pass. An invalid restore must keep the queue.
 p.call('detach','base');assert(p.b.isAlive('r0'));assert(!p.hit('trigger0').changed);
 const invalid={...pristine,states:[{id:'base',damage:0,cuts:[],removed:true}],leaks:['missing-pipe']};assert.equal(p.call('restore',invalid),false);assert(p.b.isAlive('r0'));
 p.blast('trigger0');assert(!p.b.isAlive('r0'));assert.equal(p.b.isAlive('r1'),reverse);
 // A valid pristine restore cancels stale backward dependencies, even when
 // the next blast changes a completely unrelated group.
 p.call('restore',pristine);p.blast('trigger1');assert(p.b.isAlive('r0')&&p.b.isAlive('r1')&&p.b.isAlive('r2'));
 p.call('restore',pristine);p.call('detach','base');const unsupported=JSON.parse(JSON.stringify(p.a.snapshot()));p.call('restore',pristine);p.call('restore',unsupported);p.blast('trigger2');assert(!p.b.isAlive('r0'));
}

// Initial predicates cannot simply be assumed false: ratios above one already
// fail in a pristine world, but only a changed damage call causes collapse.
let p=pair(make([{id:'base',kind:'wall'},{id:'excess',kind:'roof',supports:['base','base','missing'],supportRatio:1.1,dependents:['trim']},{id:'trim',kind:'roof'},{id:'above',kind:'roof',supports:['trim']},{id:'orphan',kind:'roof',supports:['missing'],supportRatio:2},{id:'zero',kind:'roof',supports:['base'],supportRatio:0},{id:'trigger',kind:'wall'}]));
const initial=JSON.parse(JSON.stringify(p.a.snapshot()));assert(p.b.isAlive('excess'));assert(!p.hit('trigger').changed);assert(p.b.isAlive('excess'));p.blast('trigger');assert(!p.b.isAlive('excess')&&!p.b.isAlive('trim')&&!p.b.isAlive('above'));assert(p.b.isAlive('orphan')&&p.b.isAlive('zero'));p.call('restore',initial);assert(p.b.isAlive('excess'));p.blast('trigger');

// Exact sums retain duplicate supports, zero-volume nodes, self-links, cycles,
// missing ids and stable group order over repeated detach/restore operations.
let randomState=90123;const random=()=>((randomState=Math.imul(randomState,1664525)+1013904223>>>0)/4294967296);
for(let fixture=0;fixture<24;fixture++){
 const defs=Array.from({length:11},(_,i)=>({id:'g'+i,kind:i<3||i>8?'wall':'roof',...(i>=3&&i<=8?{supports:Array.from({length:1+Math.floor(random()*4)},()=>random()<.15?'missing':'g'+Math.floor(random()*9)),supportRatio:[0,.38,.7,1,1.1][Math.floor(random()*5)],...(random()<.3?{dependents:['g'+Math.floor(random()*9)]}:{})}: {})}));
 const world=make(defs);if(fixture%3===0)world.destructibles[4].colliders=[];if(fixture%2)world.destructibles.reverse();p=pair(world);const saved=JSON.parse(JSON.stringify(p.a.snapshot()));
 for(let op=0;op<12;op++){const id='g'+Math.floor(random()*11);if(op===3)p.call('restore',saved);else if(op%4===0)p.call('detach',id);else if(op%4===1)p.hit(id,.1);else p.blast(id,50+random()*300);}
 p.call('restore',saved);p.blast('g0');
}
console.log(JSON.stringify({pass:true,fixtures,operations,comparisons:'Exact ordered events/debris, meshes, colliders, persisted state and group descriptions',coverage:['forward/backward single-pass chains','pending hits and misses','detach without eager collapse','invalid and pristine restores','restore already unsupported','ratios above one','duplicates/missing/zero-volume supports','cycles/self-links/dependents']},null,2));
