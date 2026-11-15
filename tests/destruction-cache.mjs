import assert from 'node:assert/strict';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const smallOnly=process.argv.includes('--small');
if(smallOnly)await import('../src/ferro/destruction.js');else await import('./load.mjs');
const baseline=process.env.EMPRISE_BASELINE||'3ac8e4c';
const source=execFileSync('git',['show',baseline+':src/ferro/destruction.js'],{encoding:'utf8'}),old=vm.createContext({FRender:globalThis.FRender,console});
vm.runInContext(source,old);
const current=FDestruction.create,hash=o=>createHash('sha256').update(JSON.stringify(o)).digest('hex');
function checkSpans(dc,sourceCount,sourceOf){
 let at=0;for(let i=0;i<sourceCount;i++){const span=dc.sourceSpan(i);assert.equal(span.start,at,'source span begins after its predecessor');assert(Number.isInteger(span.length)&&span.length>=0);for(let j=0;j<span.length;j++)assert.equal(sourceOf(dc.meshes[at+j]),i,'source span contains only its original source');at+=span.length;}
 assert.equal(at,dc.meshes.length,'source spans partition the complete output');for(const i of [-1,sourceCount,.5,NaN,Infinity,'0',null])assert.equal(dc.sourceSpan(i),null);
 if(sourceCount){const snapshot=dc.sourceSpan(0);snapshot.start=-1;assert(dc.sourceSpan(0).start>=0,'span descriptors are detached snapshots');}
}
function smallFixtures(){
 const mesh=(x,y,z,s=[1,1,1])=>({shape:'box',p:[x,y,z],s,material:'stone'});
 const make=(meshes,destructibles)=>({meshes:meshes.map((m,i)=>Object.assign(m,{testSourceIndex:i})),destructibles,colliders:meshes.map((m,i)=>({mesh:i,minX:m.p[0]-m.s[0]/2,maxX:m.p[0]+m.s[0]/2,minY:m.p[1]-m.s[1]/2,maxY:m.p[1]+m.s[1]/2,minZ:m.p[2]-m.s[2]/2,maxZ:m.p[2]+m.s[2]/2}))});
 function pair(world){const a=old.FDestruction.create(world),b=current(world);return {a,b,check(label){checkSpans(b,world.meshes.length,m=>m.testSourceIndex);for(const [key,get]of [['geometry',c=>c.meshes],['collisions',c=>c.colliders],['persistence',c=>c.snapshot()],['lights',c=>c.lights]])assert.equal(hash(get(b)),hash(get(a)),label+' '+key);for(const d of world.destructibles)assert.equal(hash(b.describe(d.id)),hash(a.describe(d.id)),label+' describe '+d.id);},call(method,...args){const before=b.meshes,generation=b.meshDelta.generation,beforeA=a[method](...args),beforeB=b[method](...args);assert.equal(hash(beforeB),hash(beforeA),method+' result');if(before!==b.meshes){const delta=b.meshDelta;assert.equal(delta.before,before);assert.equal(delta.after,b.meshes);assert(delta.generation>generation);if(!delta.full){const rebuilt=before.slice(),removed=[],added=[];let end=0;for(const q of delta.splices){assert(q.start>=end);end=q.start+q.deleteCount;removed.push(...before.slice(q.start,end));added.push(...q.items);}for(const q of delta.splices.slice().reverse())rebuilt.splice(q.start,q.deleteCount,...q.items);assert.equal(rebuilt.length,b.meshes.length);assert(rebuilt.every((m,i)=>m===b.meshes[i]),method+' delta preserves exact ordered references');assert(removed.length===delta.removed.length&&removed.every((m,i)=>m===delta.removed[i]));assert(added.length===delta.added.length&&added.every((m,i)=>m===delta.added[i]));}}this.check(method);return beforeA;}};}
 // Pending damage changes the record, though it produces no geometry revision.
 // The next unrelated explosion must still recompile it in original order.
 let p=pair(make([mesh(0,1,0,[2,2,2]),mesh(20,1,0,[2,2,2])],[{id:'strong',meshes:[0],colliders:[0],kind:'wall',strength:20},{id:'remote',meshes:[1],colliders:[1],kind:'wall',strength:1}]));
 let initial=JSON.parse(JSON.stringify(p.a.snapshot()));assert(!p.call('hit',[1,1,0],4).changed);assert.equal(p.a.snapshot().states[0].damage,4);assert(p.call('blast',[20,1,0],2,80).changed);p.call('restore',initial);assert.equal(p.a.meshes.length,2);p.call('blast',[1,1,0],2,80);p.call('restore',initial);p.call('hit',[1,1,0],4);p.call('detach','remote');p.call('blast',[1,1,0],2,80);
 // Shared render slots deliberately belong to both A and B. B reaches the
 // negative spatial bucket first; A precedes B in definition/rebuild order.
 const shared=make([mesh(0,1,0,[2,2,2]),mesh(10,1,0,[2,2,2]),mesh(-10,1,0,[2,2,2]),mesh(20,1,0,[2,2,2])],[{id:'A',meshes:[0,1],colliders:[0,1],kind:'wall',strength:10},{id:'B',meshes:[0,2],colliders:[0,2],kind:'wall',strength:10},{id:'remote',meshes:[3],colliders:[3],kind:'wall',strength:1}]);
 p=pair(shared);initial=JSON.parse(JSON.stringify(p.a.snapshot()));p.call('hit',[10,1,0],2);p.call('blast',[-10,1,0],2,90);p.call('blast',[20,1,0],2,80);p.call('restore',initial);const reverse=p.call('blast',[0,1,0],12,90);assert.equal(reverse.events[0].sourceId,'B','The fixture actually queries B before A');p.call('restore',initial);p.call('detach','B');p.call('blast',[10,1,0],2,90);p.call('restore',initial);p.call('blast',[0,1,0],12,90);
 // Reviving a pristine snapshot must replenish cached support volumes/counts.
 const supportMeshes=[mesh(-3,.5,0,[.4,1,.4]),mesh(3,.5,0,[.4,1,.4]),mesh(0,3,0,[7,.3,2]),mesh(0,4,0,[1,.3,1]),mesh(0,5,0,[1,.3,1]),mesh(20,3,0,[1,.3,1]),mesh(30,.5,0,[.4,1,.4])],defs=[{id:'A'},{id:'B'},{id:'roof',supports:['A','B','A','missing'],supportRatio:.7,dependents:['trim']},{id:'trim'},{id:'upper',supports:['roof']},{id:'orphan',supports:['missing']},{id:'trigger'}].map((d,i)=>({kind:i<2||i===6?'wall':'roof',meshes:[i],colliders:[i],strength:1,...d}));
 for(const backwards of [false,true]){p=pair(make(supportMeshes,backwards?defs.slice().reverse():defs));initial=JSON.parse(JSON.stringify(p.a.snapshot()));for(let cycle=0;cycle<3;cycle++){p.call('blast',[-3,.5,0],1.5,1000);assert(p.a.isAlive('orphan'));const invalid={...initial,states:[{id:'A',damage:0,cuts:[],removed:true}],leaks:['missing-pipe']};assert.equal(p.call('restore',invalid),false);p.call('restore',initial);assert(p.a.isAlive('A')&&p.a.isAlive('roof')&&p.a.isAlive('upper'));}p.call('detach','A');p.call('blast',[30,.5,0],1.5,1000);}
 // Delayed collider reads snapshot external records at rebuild time, not at
 // getter time. Previously returned arrays remain snapshots after later blasts.
 const external=make([mesh(0,1,0,[2,2,2]),mesh(20,1,0,[2,2,2])],[{id:'solid',kind:'wall',strength:1,meshes:[0],colliders:[0]}]),eager=old.FDestruction.create(external),lazy=current(external);
 external.colliders[1].minX-=4;assert.equal(hash(lazy.colliders),hash(eager.colliders));const held=lazy.colliders,heldHash=hash(held);assert.equal(held,lazy.colliders);
 eager.blast([1,1,0],2,80);lazy.blast([1,1,0],2,80);external.colliders[1].maxX+=7;assert.equal(hash(lazy.colliders),hash(eager.colliders));assert.equal(hash(held),heldHash);assert.notEqual(lazy.colliders,held);
 console.log('PASS: small exact differentials for pending damage, shared render slots, reverse queries, support chains, rejected/pristine restoration and redestruction');
}
smallFixtures();
if(!smallOnly){let fixture;
FDestruction.create=w=>{fixture=w;return current(w);};
const session=RADE.session.create({pedestrians:0});session.urban.prepare();FDestruction.create=current;
assert(fixture.meshes.length>200000);
const a=old.FDestruction.create(fixture),b=current(fixture);
const sourceIndices=new Map(fixture.meshes.map((m,i)=>[m,i]));
function compare(label){
 checkSpans(b,fixture.meshes.length,m=>sourceIndices.get(m)??Number(/^piece-(\d+)$/.exec(m.destructibleId||'')?.[1]));
 assert.equal(hash(b.meshes),hash(a.meshes),label+' geometry');
 assert.equal(hash(b.colliders),hash(a.colliders),label+' collisions');
 assert.equal(hash(b.snapshot()),hash(a.snapshot()),label+' persistence');
}
compare('initial');
const initial=JSON.parse(JSON.stringify(a.snapshot()));
const wall=session.world.boxes.find(q=>q.mesh&&q.minY<.2&&q.maxY>6&&q.a>3&&q.b>3&&Math.abs(q.x)<260&&Math.abs(q.z)<260);
const face=[wall.x+wall.a*wall.c,1.4,wall.z+wall.a*wall.s];
for(const [i,point] of [[61.5,1.18,181],[65.5,1.18,163],[61.5,1.18,145],face,face,face,face].entries()){
 assert.equal(hash(b.blast(point,8,128)),hash(a.blast(point,8,128)),'blast events '+i);compare('blast '+i);
}
const saved=JSON.parse(JSON.stringify(a.snapshot()));assert(a.restore(saved));assert(b.restore(saved));compare('restore');
const id=fixture.destructibles.find(d=>a.isAlive(d.id)&&d.supports?.length)?.id;assert(id);
assert.equal(hash(b.detach(id)),hash(a.detach(id)));compare('detach');
assert.equal(hash(b.blast(face,6,180)),hash(a.blast(face,6,180)));compare('after detach');
assert(a.restore(initial));assert(b.restore(initial));compare('restore intact world');
assert.equal(hash(b.blast(face,8,128)),hash(a.blast(face,8,128)));compare('destroy again after restoration');
console.log('PASS: exact destruction events, debris, supports, geometry, collisions and saves on '+fixture.meshes.length+' Marseille pieces');

}
