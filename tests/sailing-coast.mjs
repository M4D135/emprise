import './load.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
const source=execFileSync('git',['show','22a330f:src/coast.js'],{encoding:'utf8'}),oldShapes=new Map(),context={RADE:{coastData:RADE.coastData},BITUME,FRender:{forme:(name,triangles)=>oldShapes.set(name,triangles)}};
vm.createContext(context);vm.runInContext(source,context);const before=context.RADE.coast.create(),after=RADE.coast.create(),sea=RADE.marine.SEA_LEVEL,checks=[];
assert.equal(after.stats.triangles,before.stats.triangles);assert.equal(after.geometry.length,before.geometry.length);assert.equal(after.stats.polygons,before.stats.polygons);assert.deepEqual(after.buoys,structuredClone(before.buoys));
let natural=0,urban=0;
for(let i=0;i<RADE.coastData.chunks.length;i++){
 const c=RADE.coastData.chunks[i],m=after.geometry.find(m=>m.shape==='emprise-coast-'+i),old=before.geometry.find(m=>m.shape==='emprise-coast-'+i);if(!m)continue;
 assert(old);assert.equal(m.p[0],old.p[0]);assert.equal(m.p[2],old.p[2]);assert.equal(m.s[0],old.s[0]);assert.equal(m.s[2],old.s[2]);
 const urbanCount=c.v.filter(([x,z])=>z<6000&&x>-1700).length;
 if(urbanCount===c.v.length){assert.equal(m.p[1],old.p[1]);assert.equal(m.s[1],old.s[1]);urban++;}
 else if(urbanCount===0){assert(Math.abs(m.p[1]-old.p[1]+1.21)<1e-10);assert(Math.abs(m.s[1]-old.s[1])<1e-10);natural++;}
}
assert(natural>20&&urban>20);
for(const [x,z]of[[-3834,1826],[1264,13446],[-3001,9540],[-8000,5000],[1000,-9000],[36.5,160]])assert.equal(after.water(x,z),before.water(x,z));
assert.equal(after.heightAt(-8000,5000),sea);assert.equal(after.heightAt(1000,-9000),.08);
checks.push('Contours OSM, nombre de triangles, dimensions horizontales et quais urbains inchangés ; relief naturel décalé exactement de−1,21m');
// Use the actual world collision/ground API and a natural OSM shore, not a
// synthetic flat-water fixture. Find an accessible bank from its real contour.
const world=RADE.world.create(),marine=RADE.marine.create(world);let bank=null,attempts=0;
outer:for(const polygon of RADE.coastData.land)for(let i=1;i<polygon.outer.length;i++){
 const a=polygon.outer[i-1],b=polygon.outer[i],x=(a[0]+b[0])/2,z=(a[1]+b[1])/2,dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(!length||x>-1700||z<0||z>6500)continue;
 for(const sign of [-1,1]){const p={x:x-dz/length*sign*.7,z:z+dx/length*sign*.7,y:sea-1.16,yaw:0,pitch:0};if(!world.water(p.x,p.z)||!marine.enterWater(p))continue;attempts++;const c=marine.context(p);if(!c?.shore)continue;
  const landing={...c.shore};assert(landing.y<=sea+.72&&landing.y>=sea-.1);assert(!world.water(landing.x,landing.z));assert(!world.blocked(landing.x,landing.z,.35,landing.y,1.8));assert(marine.interact(p));assert.equal(marine.mode,'foot');assert.equal(p.y,world.ground(p.x,p.z));bank={water:{x:x-dz/length*sign*.7,z:z+dx/length*sign*.7},landing};break outer;
 }
}
assert(bank,'A natural island bank must remain reachable from real sea level');
checks.push('Vraie rive insulaire : nage à hauteur d’eau puis sortie au sol réel, avec contrôles eau/collisions/passage conservés');
const report={checks,counts:{naturalChunks:natural,urbanChunks:urban,triangles:after.stats.triangles},bank,attempts,seaLevel:sea};fs.writeFileSync(new URL('../docs/sailing-coast.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
