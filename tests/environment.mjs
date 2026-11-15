import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
await import('./load.mjs');
const geometry=new Map(),register=FRender.forme;
FRender.forme=(name,triangles)=>{geometry.set(name,triangles);return register(name,triangles);};
const world=RADE.world.create();
FRender.forme=register;
const trees=world.scenery.filter(m=>m.vegetationPart==='trunk'),canopies=world.scenery.filter(m=>m.vegetationPart==='canopy');
assert(trees.length>500&&trees.length<700,'source tree density remains bounded');
assert.equal(trees.length,canopies.length,'one replacement crown per trunk');
assert.equal(world.vegetation.trees,trees.length);
assert(world.vegetation.removed>=148,'all original road obstructions still removed');
for(const mesh of world.scenery){assert([...mesh.p,...mesh.s,...(mesh.r||[])].every(Number.isFinite));assert(mesh.s.every(n=>n>0));}
const roads=world.city.surChaussee;
for(const trunk of trees){
 assert.equal(world.boxes.filter(q=>q.mesh?.treeId===trunk.treeId).length,1,'only the trunk is a collider');
 assert(world.boxes.some(q=>q.mesh===trunk),'visible trunk and collider use the same dimensions');
 for(let j=0;j<24;j++)assert(!roads(trunk.p[0]+Math.cos(j*Math.PI/12)*.70,trunk.p[2]+Math.sin(j*Math.PI/12)*.70),'trunk clearance off roadway');
}
let canopyVertices=0;
for(const canopy of canopies){
 const cap=-canopy.r[1],c=Math.cos(cap),s=Math.sin(cap),triangles=geometry.get(canopy.shape);
 assert(triangles?.length>0);
 for(const triangle of triangles)for(const vertex of triangle.slice(0,3)){
  const u=vertex[0]*canopy.s[0],v=vertex[2]*canopy.s[2];
  assert(!roads(canopy.p[0]+u*c-v*s,canopy.p[2]+u*s+v*c),'canopy vertex projects onto roadway');canopyVertices++;
 }
 assert(!world.boxes.some(q=>q.mesh===canopy),'canopy does not become a solid bounding box');
}
for(const [name,triangles] of geometry){
 assert(triangles.flat(2).every(Number.isFinite),name+' finite geometry');
 for(const triangle of triangles)for(const n of triangle.slice(3))assert(Math.abs(Math.hypot(...n)-1)<1e-5,name+' unit normals');
 if(name.startsWith('emprise-tree-')){
  const volume=triangles.reduce((sum,triangle)=>{const [a,b,c]=triangle;return sum+(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;},0);
  assert(volume>0,name+' outward winding (visible with back-face culling)');
 }
}
for(const window of world.architecture.windowBounds)assert(Math.abs(window.u)+window.extent<=window.width/2-.25,'frame, shutters and balcony remain inside facade corners');
assert.equal(world.architecture.arcades,8,'Pouillon profile remains confined to verified facades');
assert(world.architecture.closedShutters>500&&world.architecture.angledShutters>2000&&world.architecture.curtains>100);
assert(world.architecture.pieces<65000,'facade instance budget');
assert(world.detailCount.meshes<13000&&world.detailCount.storefronts<=260,'street dressing budget');
assert(world.scenery.length<140000,'total static instance budget');
assert(world.scenery.filter(m=>m.vegetationPart==='branches').every(m=>m.detail===1));
// Regression: acceptance.mjs creates the physical world without loading FRender.
const headless=spawnSync(process.execPath,['--input-type=module','-e',`for(const f of ['metal/fmath','metal/physics','metal/simulation','pdr/villes/marseille','pdr/ville-reelle','pdr/sim/nav','pdr/sim/regles','bitume/carene','bitume/conduite','vehicles','mobility','details','architecture','world'])await import('./src/'+f+'.js');const w=RADE.world.create();console.log(JSON.stringify({trees:w.vegetation.trees,removed:w.vegetation.removed,trunks:w.scenery.filter(m=>m.vegetationPart==='trunk').map(m=>m.p)}));`],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
assert.equal(headless.status,0,headless.stderr);
const physical=JSON.parse(headless.stdout);
assert.equal(physical.trees,world.vegetation.trees);assert.equal(physical.removed,world.vegetation.removed);assert.deepEqual(physical.trunks,trees.map(m=>m.p),'headless and graphical preparation share identical tree placement');
const report={provenance:'original-procedural-runtime',trees:trees.length,removedTrees:world.vegetation.removed,canopyVerticesChecked:canopyVertices,roadwayIntersections:0,staticMeshes:world.scenery.length,previousStaticMeshes:173118,architectureMeshes:world.architecture.pieces,previousArchitectureMeshes:98471,windows:world.architecture.windows,closedShutters:world.architecture.closedShutters,angledShutters:world.architecture.angledShutters,curtains:world.architecture.curtains,streetDressing:world.detailCount,headlessMatchesGraphical:true,treeShapeTriangles:world.vegetation.shapeTriangles,checks:['Entire source trees replaced before collisions','Trunks and canopy geometry off roadway','Only tree trunks collide','Outward procedural triangle winding','Frames and shutters clear facade corners','Near detail and static instance budgets','Renderer-independent physical preparation']};
fs.writeFileSync(new URL('../docs/environment-acceptance.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
