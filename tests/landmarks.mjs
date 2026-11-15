import './load.mjs';
import assert from 'node:assert/strict';
const registered=new Map(),original=FRender.forme;FRender.forme=(name,triangles)=>{registered.set(name,triangles);original(name,triangles);};
await import('../src/landmarks.js');
const a=RADE.landmarks.create();FRender.forme=original;
const near=(x,y,e=1e-7)=>assert(Math.abs(x-y)<e,`${x} != ${y}`);
assert.equal(RADE.landmarks.create(),a,'one cached monument');assert.equal(a.provenance.importedAssets,0);assert(a.geometry.length<1000);assert.equal(a.terrain.length,3);assert.equal(registered.size,4,'three hill patches and original statue robe');
for(const m of a.geometry){assert(m.p.every(Number.isFinite));assert(m.s.every(v=>Number.isFinite(v)&&v>0));assert(m.color.every(v=>Number.isFinite(v)&&v>=0&&v<=1));assert(!m.r||m.r.every(Number.isFinite));}
let terrainTriangles=0,terrainSamples=0;
for(const m of a.terrain){
 assert(m.terrain&&m.collision===false);const triangles=registered.get(m.shape);assert(triangles.length>0);terrainTriangles+=triangles.length;
 for(const t of triangles){
  assert(t.flat().every(Number.isFinite));const world=t.slice(0,3).map(p=>p.map((v,i)=>v*m.s[i]+m.p[i]));
  const u=world[1].map((v,i)=>v-world[0][i]),v=world[2].map((v,i)=>v-world[0][i]);assert(u[2]*v[0]-u[0]*v[2]>0,'hill normals and face winding point upwards');
  for(const weights of [[1/3,1/3,1/3],[.12,.31,.57]]){
   const p=[0,1,2].map(k=>world.reduce((n,q,i)=>n+q[k]*weights[i],0)),height=a.groundHeight(p[0],p[2]);if(height===null)continue;
   near(height,p[1],.0001);terrainSamples++;
  }
 }
}
assert(terrainTriangles<10000&&terrainSamples>12000,'bounded triangulation with many physics/render height agreements');near(a.groundHeight(a.center.x,a.center.z),154);assert.equal(a.groundHeight(a.center.x+331,a.center.z),null);assert.equal(a.groundHeight(NaN,0),null);
for(let i=0;i<360;i++){const angle=i*Math.PI/180,x=a.center.x+Math.cos(angle)*329.999,z=a.center.z+Math.sin(angle)*389.999;assert(a.groundHeight(x,z)<.20,'outer hill joins flat city without a step');}
assert(a.excludes({bounds:[a.center.x-10,a.center.z-7,a.center.x+10,a.center.z+7]}));assert(a.excludes({points:[[a.center.x-10,a.center.z-7],[a.center.x+10,a.center.z+7],[a.center.x-10,a.center.z+7]]}));assert(!a.excludes({bounds:[a.center.x+80,a.center.z,a.center.x+90,a.center.z+10]}));assert(!a.excludes({}));
const cos=Math.cos(a.footprint.angle),sin=Math.sin(a.footprint.angle),worldRing=ring=>ring.map(([x,z])=>[a.center.x+x*cos-z*sin,a.center.z+x*sin+z*cos]),rectangle=(x0,z0,x1,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
assert(a.excludes({points:worldRing(rectangle(31,18,39,25))}),'corner overlap with centroid outside is excluded');assert(a.excludes({points:worldRing(rectangle(-45,18.5,45,22))}),'crossing strip is excluded even with all vertices outside');assert(a.excludes({points:worldRing(rectangle(-40,-30,40,30))}),'surrounding footprint includes the core');assert(!a.excludes({points:worldRing(rectangle(32,19,42,29))}),'touching one corner without area leaves neighbour intact');assert(!a.excludes({points:worldRing(rectangle(-40,-30,40,30)),holes:[worldRing(rectangle(-33,-20,33,20))]}),'a courtyard surrounding the monument is not an overlapping building');
const sourceBuildings=RADE.cityData.decode('-1,2').buildings,source=id=>sourceBuildings.find(b=>b.id===id);for(const id of ['b1182','b7099','b280287','b184160','b184162','b184171'])assert(a.excludes(source(id)),'actual intersecting Notre-Dame source '+id);for(const id of ['b184159','b184164','b184168'])assert(!a.excludes(source(id)),'actual neighbouring footprint preserved '+id);
// WGS84 projection used by the city, independently checked against the OSM statue node.
const phi=43.2962*Math.PI/180,e2=6.69437999014e-3,N=6378137/Math.sqrt(1-e2*Math.sin(phi)**2),M=6378137*(1-e2)/(1-e2*Math.sin(phi)**2)**1.5;
near(a.statue.position[0],(5.3710240-5.3734)*Math.PI/180*N*Math.cos(phi),.01);near(a.statue.position[2],(43.2962-43.2840884)*Math.PI/180*M,.01);near(a.statue.position[1],154+64.7);
assert.equal(a.lights({night:0}).length,0);const lights=a.lights({night:1}),power=lights.map(l=>l.power);assert.equal(lights.length,8);assert(lights.every(l=>l.range>0&&l.p.every(Number.isFinite)));assert.equal(a.lights({night:.5}),lights);lights.forEach((l,i)=>near(l.power,power[i]/2));assert.equal(a.lights({night:1}),lights);lights.forEach((l,i)=>near(l.power,power[i]));
assert.equal(a.nightGeometry(0).length,0);const glow=a.nightGeometry(1);assert(glow.length>30&&glow.length<120);assert(glow.every(m=>m.collision===false&&m.emissive===.42));assert.equal(a.nightGeometry(.5),glow);assert(glow.every(m=>m.emissive===.21));
for(const shell of glow){const source=shell.nightSource;assert(shell.nightOffset>=.015&&shell.nightOffset<=.04,'centimetre separation, bounded on fine statue details');for(let i=0;i<3;i++){near((shell.s[i]-source.s[i])/2,shell.nightOffset);near(shell.p[i],source.p[i]);}assert(source.s.every(v=>v>0),'original collision dimensions remain untouched');}
const originalCount=glow.length,removed=glow[0].nightSource,survivors=a.geometry.filter(m=>m!==removed),afterDamage=a.nightGeometry(1,survivors);assert.equal(afterDamage.length,originalCount-1,'destroyed original does not reappear as a night facade');assert.equal(a.nightGeometry(1,survivors),afterDamage,'unchanged scenery reuses filtered night array');assert.equal(a.nightGeometry(1,[]).length,0);assert.equal(a.nightGeometry(1,a.geometry).length,originalCount);
console.log(JSON.stringify({pass:true,meshes:a.geometry.length,terrainTriangles,terrainSamples,nightShells:glow.length,lights:lights.length,terrain:'procedural approximation; physics and mesh match',importedAssets:0}));
