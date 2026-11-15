import './load.mjs';
import assert from 'node:assert/strict';
const register=FRender.forme,shapes=[];
FRender.forme=(name,triangles)=>shapes.push({name,triangles});
await import('../src/marine-water.js');FRender.forme=register;
assert.equal(shapes.length,1);const {triangles}=shapes[0];assert.equal(triangles.length,8192);
for(const [a,b,c,...normals] of triangles){
 assert([...a,...b,...c].every(Number.isFinite));
 assert([...a,...b,...c].every(v=>v>=-.5&&v<=.5));
 assert.equal(a[1],0);assert.equal(b[1],0);assert.equal(c[1],0);
 const up=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);assert(up>0);
 assert(normals.every(n=>n[0]===0&&n[1]===1&&n[2]===0));
}
const s={mode:'foot',time:1000,player:{x:2,z:4},marine:{time:12,boat:{x:19,z:25}},weather:{state:{wind:.8,windDirection:.45}}};
assert.equal(RADE.marineWater.state(s),null);s.mode='boat';const q=RADE.marineWater.state(s);
assert.deepEqual(q.origin,[16,24,64,.8]);assert.deepEqual(q.motion,[12,.45,-1.25,1]);
const mesh=RADE.marineWater.mesh(q);assert.equal(mesh.mat,12.25);assert.equal(mesh.collision,false);assert.equal(mesh.surface,'architecture','Water noise must stay in world space across patch recentering');assert.deepEqual(mesh.p,[16,-1.25,24]);
s.mode='swim';assert.deepEqual(RADE.marineWater.state(s).origin,[0,8,64,.8]);
s.interiors={active:{}};assert.equal(RADE.marineWater.state(s),null);
const world=RADE.world.create(),port=world.scenery.filter(m=>m.mat===12&&m.p[1]<0);
assert.equal(port.length,1);assert.deepEqual([port[0].p[0],port[0].p[2],port[0].s[0],port[0].s[2]],[0,0,8000,8000],'Distant sea exclusion must match the original port plane');
assert(world.landscape.filter(m=>m.backgroundWater).every(m=>m.mat===12.05));
console.log('PASS sea grid: upward triangles, 8192 fixed triangles, world-space pattern, marine clock after interior visits, boat/swim only, no collisions, port/background coverage');
