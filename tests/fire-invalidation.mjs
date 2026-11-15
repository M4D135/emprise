import './load.mjs';
import assert from 'node:assert/strict';
const empty=RADE.session.create({pedestrians:0});empty.urban.prepare();
const initial=empty.urban.revision,meshes=empty.world.scenery.slice();
// Isolate an existing fire away from every destructible surface. Its particles
// still animate; it must not invalidate the 300,000-piece static world.
empty.urban.ignite(10,170,'street',1);
for(let i=0;i<4;i++)empty.urban.update(1,[]);
assert.equal(empty.urban.revision,initial);
assert.deepEqual(empty.world.scenery,meshes);
assert(empty.urban.geometry().some(m=>m.fxFire));
const hit=RADE.session.create({pedestrians:0});hit.urban.prepare();
const wall=hit.world.boxes.find(q=>q.mesh&&q.minY<.2&&q.maxY>6&&q.a>3&&q.b>3&&Math.abs(q.x)<260&&Math.abs(q.z)<260);
assert(wall);const x=wall.x+wall.a*wall.c,z=wall.z+wall.a*wall.s;
const prior=hit.urban.revision;hit.urban.ignite(x,z,'street',1);
for(let i=0;i<4;i++)hit.urban.update(1,[]);
assert(hit.urban.revision>prior,'Actual fire damage must invalidate rendering');
assert(hit.world.scenery.some(m=>m.renderRevision>0),'Scorched material must invalidate its cached instance row');
assert(hit.world.renderMutation>0,'In-place recolor must invalidate renderer delta trust');
assert.equal(hit.world.sceneryDelta,null,'A geometry delta must not hide an in-place fire recolor');
console.log('PASS fire: empty impact preserves static world; particles remain; actual scorch invalidates its mesh');
