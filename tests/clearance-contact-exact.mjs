import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';

const baseline='22a330f',old=execFileSync('git',['show',baseline+':src/clearance.js'],{encoding:'utf8'}),current=fs.readFileSync(new URL('../src/clearance.js',import.meta.url),'utf8');
const vehicle=fs.readFileSync(new URL('../src/bitume/voiture.js',import.meta.url),'utf8'),euler=vm.runInNewContext('('+vehicle.match(/function euler\(rx, ry, rz\) \{[\s\S]*?\n  \}/)[0]+')');
function load(source,rotation=euler){const c=vm.createContext({RADE:{},BITUME:{voiture:{euler:rotation}}});vm.runInContext(source,c);return c.RADE.clearance;}
const reference=load(old),candidate=load(current);
function body(p,s,r=[0,0,0]){const axes=euler(...r),h=s.map(v=>Math.abs(v)/2),ext=[0,1,2].map(k=>axes.reduce((n,a,i)=>n+Math.abs(a[k])*h[i],0));return {x:p[0],z:p[2],a:ext[0],b:ext[2],minY:p[1]-ext[1],maxY:p[1]+ext[1],mesh:{p,s,r},body:{}};}
let seed=135,cases=0,positive=0;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
const fixtures=[];
function check(q,args,label){const a=reference.contact(q,...args),b=candidate.contact(q,...args);assert(Object.is(b,a),label+': '+b+' !== '+a);cases++;if(a>0)positive++;return a;}
for(let i=0;i<12000;i++){
 const q=body([(random()-.5)*30,random()*4,(random()-.5)*30],[.02+random()*5,.02+random()*4,.02+random()*5],[(random()-.5)*Math.PI*4,(random()-.5)*Math.PI*4,(random()-.5)*Math.PI*4]);
 const args=[q.x+(random()-.5)*q.a*3,q.z+(random()-.5)*q.b*3,.01+random()*1.3,q.mesh.p[1]-random()*2,.01+random()*3];check(q,args,'oriented body '+i);if(i<1024)fixtures.push({q,args});
}
for(const angle of [0,-0,1e-11,1e-10,1e-9,Math.PI/2,Math.PI,Math.PI*2,NaN,Infinity])for(const size of [0,-0,1e-12,.2,1,20,1e8,-2,NaN,Infinity]){
 const q=body([0,.9,0],[size,1.8,.4],[angle,angle,-angle]);for(const args of [[0,0,.28,0,1.8],[.2,.2,.24,.08,1.7],[0,0,0,0,0],[0,0,-.1,0,1.8],[0,0,Infinity,0,1.8],[NaN,0,.28,0,1.8],[0,0,.28,NaN,1.8],[0,0,.28,0,Infinity]])check(q,args,'degenerate/nonfinite '+angle+','+size);
}
const flat=body([0,.9,0],[2,1.8,2]);
for(const r of [.24,.28,1])for(const epsilon of [-1e-10,-1e-14,0,1e-14,1e-10])for(const y of [0,1.58,1.8])check(flat,[1+r-1e-5+epsilon,0,r,y,1.8],'contact threshold');
assert(positive>1000);

// Custom rotation shapes keep the original Array.map handling of holes and
// extra axes instead of assuming the procedural provider's dense 3x3 matrix.
for(const axes of [[],[[1,0,0]],[[1,0,0],,[0,0,1]],[[1,0,0],[0,1,0],[0,0,1],[1,1,1]]]){
 const a=load(old,()=>axes),b=load(current,()=>axes),q=body([0,.9,0],[2,1.8,2]);assert(Object.is(b.contact(q,0,0,.28,0,1.8),a.contact(q,0,0,.28,0,1.8)));cases++;
}

// Re-enter while the outer contact owns its scratch. A throwing getter must
// also release that slot before another normal contact.
const inspect=current.replace('R.clearance={contact,create};','R.clearance={contact,create,inspect:()=>({depth:contactDepth,slots:contactWork.length,arrays:contactWork.map(w=>[w.a,w.d,w.knots])})};');
const instrumented=load(inspect),child=body([0,.6,0],[2,1.2,2],[.4,.7,.2]);
function nested(api,fail=false){
 const q=body([0,.9,0],[2,1.8,2],[.1,.3,.4]);let count=0,armed=true;
 Object.defineProperty(q.mesh.p,0,{get(){count++;const n=api.contact(child,.1,.1,.28,.08,1.8);assert(n>0);if(armed&&fail){armed=false;throw Error('deliberate position getter');}return 0;}});
 if(fail)assert.throws(()=>api.contact(q,.2,.1,.28,0,1.8),/deliberate position getter/);
 const value=api.contact(q,.2,.1,.28,0,1.8);return {count,value};
}
assert.deepEqual(nested(instrumented),nested(reference));assert.deepEqual(nested(instrumented,true),nested(reference,true));
const scratch=instrumented.inspect();assert.equal(scratch.depth,0);assert.equal(scratch.slots,2);
for(let i=0;i<100;i++)instrumented.contact(child,.1,.1,.28,.08,1.8);
const next=instrumented.inspect();assert.equal(next.depth,0);assert.equal(next.slots,2);for(let i=0;i<2;i++)for(let j=0;j<3;j++)assert.equal(next.arrays[i][j],scratch.arrays[i][j],'scratch buffer reused');

// Real recovery, cancellation, static walls, and proxy publication use exactly
// the same numeric contact results and accumulation order in both versions.
let recoveryFrames=0;
for(const scenario of ['pile','wall','new-debris','moving-proxy','sealed']){
 let list=[body([-.4,.9,0],[1.6,1.8,2]),body([.4,.9,0],[1.6,1.8,2])],wall=false;
 const staticBlocked=(x,z,r)=>scenario==='sealed'?Math.abs(x)+r>.4||Math.abs(z)+r>.4:wall&&Math.abs(x)<4+r&&z+r>.7&&z-r<.8;
 const pair=[reference,candidate].map(api=>({c:api.create({bodies:()=>list,staticBlocked}),p:{x:0,z:0,y:0,hp:100}}));
 for(let frame=0;frame<360;frame++){
  if(scenario==='wall'&&frame===2)wall=true;
  if(scenario==='new-debris'&&frame===2)list.push(body([0,.9,.75],[8,1.8,.1]));
  if(scenario==='moving-proxy')list=list.map(q=>({...body(q.mesh.p,q.mesh.s,q.mesh.r),body:q.body}));
  for(const q of pair)q.c.prepareBodies(list);
  assert.equal(pair[1].c.resolve(pair[1].p,1/120),pair[0].c.resolve(pair[0].p,1/120),scenario+' resolve');
  assert.deepEqual(pair[1].p,pair[0].p,scenario+' exact recovery trajectory '+frame);
  assert.equal(pair[1].c.blocked(pair[1].p.x,pair[1].p.z,.28,0,1.8),pair[0].c.blocked(pair[0].p.x,pair[0].p.z,.28,0,1.8));
  assert.equal(pair[1].c.moveBlocked(pair[1].p.x,pair[1].p.z,pair[1].p.x+.02,pair[1].p.z,.28,0,1.8),pair[0].c.moveBlocked(pair[0].p.x,pair[0].p.z,pair[0].p.x+.02,pair[0].p.z,.28,0,1.8));recoveryFrames++;
 }
 assert.deepEqual({...pair[1].c.metrics},{...pair[0].c.metrics},scenario+' recovery decisions');
}
console.log(JSON.stringify({pass:true,baseline,cases,positive,recoveryFrames,reentrantScratchSlots:scratch.slots,scope:'Object.is equality of narrow-phase values including NaN/signed zero; exact recovery states and metrics. Scratch allocations bounded by observed call depth.'}));

if(process.argv.includes('--bench')){
 // Optional, isolated CPU microbenchmark only. Both sides receive the same
 // prewarmed OBBs/queries; alternating order reduces warmup/order bias.
 const work=fixtures.filter(({q,args})=>q.maxY>args[3]+.22&&q.minY<args[3]+args[4]&&Math.abs(args[0]-q.x)<=q.a+args[2]&&Math.abs(args[1]-q.z)<=q.b+args[2]);
 let sum=0;const run=api=>{const start=performance.now();for(let n=0;n<128;n++)for(const {q,args}of work)sum+=api.contact(q,...args);return performance.now()-start;};
 for(let i=0;i<3;i++){run(reference);run(candidate);}const ms={before:[],after:[]};
 for(let i=0;i<8;i++)for(const key of i%2?['after','before']:['before','after'])ms[key].push(run(key==='before'?reference:candidate));
 const median=a=>a.slice().sort((a,b)=>a-b)[Math.floor(a.length/2)];assert(Number.isFinite(sum));
 console.log(JSON.stringify({microbenchmark:true,queriesPerTrial:work.length*128,ms,medianMs:{before:median(ms.before),after:median(ms.after)},limitation:'Narrow-phase CPU only in Node; no claim about browser frames, GPU or overall game speed.'}));
}
