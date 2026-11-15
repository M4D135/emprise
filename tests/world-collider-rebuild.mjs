import './load.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {performance} from 'node:perf_hooks';

// Exact previous collider construction. The oracle runs the same real city and
// current movement code; only collider registration/rebuild differs.
const legacy=` const boxes=[],buckets=new Map(),key=(x,z)=>Math.floor(x/8)+','+Math.floor(z/8);
 function addBox(q){
  q.c=Math.cos(q.cap);q.s=Math.sin(q.cap);
  const hx=Math.abs(q.c*q.a)+Math.abs(q.s*q.b),hz=Math.abs(q.s*q.a)+Math.abs(q.c*q.b);
  q.minX=q.x-hx;q.maxX=q.x+hx;q.minZ=q.z-hz;q.maxZ=q.z+hz;boxes.push(q);
  for(let z=Math.floor(q.minZ/8);z<=Math.floor(q.maxZ/8);z++)for(let x=Math.floor(q.minX/8);x<=Math.floor(q.maxX/8);x++){const k=x+','+z;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(q);}
  return q;
 }
 function fromMesh(m){
  if(m.terrain||m.coast||m.collision===false)return;
  if(m.vegetationPart&&m.vegetationPart!=='trunk')return;
  if(m.fx||m.shape==='foliage'||m.shape==='ring'||m.s[1]<.12||m.p[1]+m.s[1]/2<.4)return;
  if(!m.boundary&&!m.landmark&&(Math.abs(m.p[0])>580||Math.abs(m.p[2])>580))return;
  const rx=m.r?.[0]||0,rz=m.r?.[2]||0,s=m.s;
  const h=Math.abs(Math.cos(rx)*Math.cos(rz)*s[1])+Math.abs(Math.sin(rx)*s[2])+Math.abs(Math.sin(rz)*s[0]);
  const sx=Math.abs(Math.cos(rz)*s[0])+Math.abs(Math.sin(rz)*s[1]);
  const sz=Math.abs(Math.cos(rx)*s[2])+Math.abs(Math.sin(rx)*s[1]);
  m.collision=true;addBox({mesh:m,x:m.p[0],z:m.p[2],a:sx/2,b:sz/2,minY:m.p[1]-h/2,maxY:m.p[1]+h/2,cap:-(m.r?.[1]||0),kind:'urban'});
 }
`;
const oldReplace=' function replaceScenery(value){scenery=value;boxes.length=0;buckets.clear();for(const m of scenery)if(m.collision)fromMesh(m);}';
const source=fs.readFileSync(new URL('../src/world.js',import.meta.url),'utf8'),start=source.indexOf(' const boxes='),end=source.indexOf(' if(landmarks)scenery.push',start);
assert(start>=0&&end>start);
const replaceStart=source.indexOf(' function replaceScenery(value)'),replaceEnd=source.indexOf('\n // Port maintenance',replaceStart);assert(replaceStart>=0&&replaceEnd>replaceStart);
const referenceSource=(source.slice(0,start)+legacy+source.slice(end)).replace(source.slice(replaceStart,replaceEnd),oldReplace),originalFactory=RADE.world;
vm.runInThisContext(referenceSource,{filename:'world-collider-rebuild.baseline.js'});const reference=RADE.world;
// Expose the actual private Map in this test only, so untouched bucket arrays
// can be frozen. A needless clear/refill then fails instead of going unnoticed.
vm.runInThisContext(source.replace('buckets=new Map()','buckets=(globalThis.__colliderBucketProbe=new Map())'),{filename:'world-collider-rebuild.current.js'});const current=RADE.world;
const before=reference.create(),after=current.create(),bucketProbe=globalThis.__colliderBucketProbe,worlds=[before,after],checks=[],fields=['x','z','a','b','c','s','cap','minY','maxY','minX','maxX','minZ','maxZ','kind'];RADE.world=originalFactory;delete globalThis.__colliderBucketProbe;
assert.equal(before.scenery.length,after.scenery.length);
for(const w of worlds)w.scenery.forEach((m,i)=>m.fixtureId=i);
let scenes=worlds.map(w=>w.scenery.slice());
const snapshot=q=>Object.fromEntries(fields.map(k=>[k,q[k]]));
function compareBoxes(){assert.equal(before.boxes.length,after.boxes.length);for(let i=0;i<before.boxes.length;i++){const a=before.boxes[i],b=after.boxes[i];assert.equal(a.mesh?.fixtureId,b.mesh?.fixtureId,'Collider order');for(const field of fields)if(!Object.is(a[field],b[field]))assert.fail('Collider '+i+' '+field+' '+a[field]+' != '+b[field]);}}
function probe(){
 for(let i=0;i<90;i++){
  const x=i<30?60+i*.21:(i%9-4)*80,z=i<30?170+i*.32:(Math.floor(i/9)-4)*70,r=[.24,.5,3.6][i%3];
  assert.equal(before.blocked(x,z,r,.08,1.8),after.blocked(x,z,r,.08,1.8));
  const a=[...before.candidates(x,z,r)],b=[...after.candidates(x,z,r)];assert.equal(a.length,b.length,'Candidate count');for(let j=0;j<a.length;j++){assert.equal(a[j].mesh?.fixtureId,b[j].mesh?.fixtureId,'Candidate order');for(const field of fields)if(!Object.is(a[j][field],b[j][field]))assert.fail('Candidate bounds differ');}
  const origin=[x,1.6,z],angle=i*.618,dir=[Math.cos(angle),0,Math.sin(angle)];assert.equal(before.ray(origin,dir,30),after.ray(origin,dir,30),'Ray hit');
 }
}
function rebuild(label){for(let i=0;i<2;i++)worlds[i].replaceScenery(scenes[i]);compareBoxes();probe();checks.push(label);}
rebuild('Real Marseille initial rebuild: exact collider order, bounds, candidate order and ray hits');
const originalCount=after.boxes.length,kept=after.boxes.slice();rebuild('Repeated identical scenery');assert(after.boxes.every((q,i)=>q===kept[i]),'Unchanged boxes must be reused');
const tracked=after.boxes.find(q=>q.mesh?.fixtureId!==undefined),trackedId=tracked.mesh.fixtureId,priorSnapshot=snapshot(tracked);
for(const w of worlds)for(const q of w.boxes.slice(0,120)){q.mesh.color=[.1,.1,.1];q.mesh.renderRevision=(q.mesh.renderRevision||0)+1;}
rebuild('120 material/scorch revisions preserve exact geometry');assert(after.boxes.every((q,i)=>q===kept[i]),'Color-only edits must retain boxes');
const touched=new Set();for(let z=Math.floor(tracked.minZ/8);z<=Math.floor(tracked.maxZ/8);z++)for(let x=Math.floor(tracked.minX/8);x<=Math.floor(tracked.maxX/8);x++)touched.add(x+','+z);
const frozen=[];for(const [cell,list]of bucketProbe)if(!touched.has(cell)){Object.freeze(list);frozen.push(cell);}
for(const scene of scenes)scene[trackedId].collision=false;rebuild('Sparse removal never touches any unrelated frozen bucket');assert(frozen.length>100);
for(const cell of frozen)bucketProbe.set(cell,bucketProbe.get(cell).slice());
for(const scene of scenes)scene[trackedId].collision=true;rebuild('Sparse reinsertion restores original relative ordering');
for(const scene of scenes){const m=scene[trackedId];m.p[0]+=.031;m.p[1]+=.17;m.s[0]+=.125;m.r=[.21,(m.r?.[1]||0)+.13,.09];}
rebuild('In-place position, scale and all rotation components invalidate cached geometry');assert.deepEqual(snapshot(tracked),priorSnapshot,'Old contact snapshot must not be mutated');assert.notEqual(after.boxes.find(q=>q.mesh.fixtureId===trackedId),tracked);
for(const w of worlds){const q=w.boxes.find(q=>q.mesh.fixtureId===trackedId);q.a+=20;q.c=.123;q.minY-=3;}
rebuild('Caller edits to collider records are discarded by rebuild, exactly as before');
for(const scene of scenes)scene[trackedId].collision=false;rebuild('Collision flag removes an existing collider');
for(const scene of scenes){scene[trackedId].collision=true;scene[trackedId].vegetationPart='foliage';}rebuild('Vegetation classification excludes former collider');
for(const scene of scenes)delete scene[trackedId].vegetationPart;rebuild('Collider can be re-enabled after exclusion');
scenes=scenes.map(scene=>scene.filter((m,i)=>i%131!==0));rebuild('Sparse removals retain the original order of surviving colliders');
scenes=scenes.map(scene=>[...scene.slice(1000),...scene.slice(0,1000)]);rebuild('Scenery reordering is reflected exactly in each bucket');
for(let i=0;i<2;i++){const duplicate=scenes[i].find(m=>m.fixtureId===trackedId);assert(duplicate);scenes[i].push(duplicate,duplicate,{shape:'box',p:[63.9,1.4,181],s:[5,2.4,.8],r:[.13,.7,.2],color:[.4,.4,.4],collision:true,fixtureId:900001});}
rebuild('Duplicate source-mesh occurrences remain distinct colliders; added rotated mesh crosses buckets');
const duplicateBoxes=after.boxes.filter(q=>q.mesh.fixtureId===trackedId);assert.equal(duplicateBoxes.length,3);assert.equal(new Set(duplicateBoxes).size,3);
for(const w of worlds){const q=w.boxes.find(q=>q.mesh.fixtureId===trackedId);w.addBox(q);q.x+=28;q.z-=19;w.addBox(q);}
rebuild('Repeated public addBox of a mutated object clears all stale bucket memberships');
for(let iteration=0;iteration<3;iteration++){
 for(const w of worlds)w.addBox({x:65.5,z:180.5,a:2,b:.15,cap:.37,minY:.08,maxY:2.8,kind:'bridge'});
 compareBoxes();probe();rebuild('Bridge addBox records are removed and can be re-added on the next sync '+iteration);
}
const restored=scenes;scenes=[[],[]];rebuild('Empty scenery clears all old buckets');scenes=restored;rebuild('Full restoration after empty world has exact collision/candidate/ray ordering');
const report={checks,originalMeshes:before.scenery.length,originalColliders:originalCount,finalColliders:after.boxes.length,retainedUnchangedColliders:kept.length,untouchedFrozenBuckets:frozen.length,source:'Exact old addBox/fromMesh/replaceScenery differential against the actual current Marseille world',timing:null};
if(process.argv.includes('--bench')){
 const old=[],next=[];for(let trial=0;trial<5;trial++){const run=i=>{const t=performance.now();worlds[i].replaceScenery(scenes[i]);return performance.now()-t;};if(trial%2){next.push(run(1));old.push(run(0));}else{old.push(run(0));next.push(run(1));}}
 const median=a=>a.slice().sort((x,y)=>x-y)[a.length>>1];report.timing={beforeMs:old,afterMs:next,beforeMedianMs:median(old),afterMedianMs:median(next),ratio:median(next)/median(old),scope:'Alternating CPU collider rebuild microbenchmark; not total gameplay FPS'};
}
fs.writeFileSync(new URL('../docs/world-collider-rebuild.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
