import assert from 'node:assert/strict';
import fs from 'node:fs';
for(const f of ['ferro/renderer','ferro/geometry','bitume/main','bitume/voiture','bitume/conduite','vehicles'])await import('../src/'+f+'.js');
const geometry=new Map(),register=FRender.forme;
FRender.forme=(name,triangles)=>{geometry.set(name,triangles);return register(name,triangles);};
await import('../src/mobility.js');
FRender.forme=register;
const V=RADE.vehicles,B=BITUME.voiture,primitiveTriangles={box:12,bevel:44,sphere:288,cylinder:64,ring:288};
const expected={tmax:[2.195,.78,1.47,1.575,219,43,5.4,[-.20,1.49,0]],scooter:[1.144,.48,1.178,.91,17.2,6.94,1.8,[-.12,1.73,0]],bike:[1.82,.62,1.10,1.10,14,11,1.25,[-.20,1.62,0]]};
const previous={tmax:{fixed:31,renderedWithRider:62,trianglesWithRider:5588},scooter:{fixed:15,renderedWithRider:46,trianglesWithRider:3432},bike:{fixed:23,renderedWithRider:76,trianglesWithRider:4308}};
for(const [name,triangles] of geometry){
 assert(triangles.length>0&&triangles.flat(2).every(Number.isFinite),name+' finite generated geometry');
 for(const t of triangles){assert.equal(t.length,6);for(const n of t.slice(3))assert(Math.abs(Math.hypot(...n)-1)<1e-5,name+' unit normals');}
 if(/tyre|rim-|front-apron|boomerang|fender/.test(name)){
  const volume=triangles.reduce((sum,[a,b,c])=>sum+(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6,0);
  assert(volume>1e-7,name+' outward closed winding');
 }
}
const corners=m=>geometry.get(m.shape)?.flatMap(t=>t.slice(0,3))||[-1,1].flatMap(x=>[-1,1].flatMap(y=>[-1,1].map(z=>[x/2,y/2,z/2])));
function bounds(meshes){const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const m of meshes){const matrix=B.euler(...(m.r||[0,0,0]));for(const v of corners(m)){const p=B.mul(matrix,v.map((n,k)=>n*m.s[k])).map((n,k)=>n+m.p[k]);for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],p[k]);hi[k]=Math.max(hi[k],p[k]);}}}return {lo,hi};}
const models={};
for(const type of ['tmax','scooter','bike']){
 const mod=V.model(type),s=mod.spec;
 assert.deepEqual([s.length,s.width,s.height,s.wheelbase,s.mass,s.top,s.acc,s.eye],expected[type],'physical contract unchanged');
 assert(mod.front.length>8&&mod.front.every(p=>p.group==='steering'),'fork and controls share steering assembly');
 const base=mod.pieces.map(p=>({shape:p.shape,p:p.p.slice(),s:p.s.slice()}));V.model(type,'#bb2729');V.model(type,'#e7e7db');assert.deepEqual(mod.pieces.map(p=>({shape:p.shape,p:p.p,s:p.s})),base,'paint variants do not mutate shared geometry transforms');
 const lods=[];
 for(const distance of [0,40,100]){
  const meshes=[];V.render({model:type,color:'#18252f',x:0,z:0,y:.08,cap:0,distance:2.3,braquage:0},meshes,{distance,rider:true});
  for(const m of meshes){assert([...m.p,...m.s,...m.r].every(Number.isFinite));assert(m.s.every(v=>v>0));}
  lods.push({distance,instances:meshes.length,triangles:meshes.reduce((n,m)=>n+(geometry.get(m.shape)?.length||primitiveTriangles[m.shape]||0),0)});
 }
 assert(lods[0].instances<110&&lods[0].triangles<16000,'close mesh budget');assert(lods[2].instances<60&&lods[2].triangles<10500,'far silhouette budget');assert(lods[2].triangles<lods[1].triangles&&lods[1].triangles<lods[0].triangles);
 const empty=[];V.render({model:type,color:'#18252f',x:0,z:0,y:.08,cap:0,distance:0},empty,{});const ext=bounds(empty);
 assert(ext.lo[0]>=-s.length/2-.04&&ext.hi[0]<=s.length/2+.04,type+' longitudinal silhouette stays in physical envelope '+JSON.stringify(ext));
 assert(ext.lo[2]>=-s.width/2-.015&&ext.hi[2]<=s.width/2+.015,type+' mirrors and handlebars respect width '+JSON.stringify(ext));
 assert(ext.lo[1]>=.075&&ext.hi[1]<=s.height+.08+.035,type+' ground contact and upper envelope '+JSON.stringify(ext));
 for(const turn of [-.5,0,.5])for(const travel of [0,.7,2.1]){
  const meshes=[],c={model:type,color:'#18252f',x:0,z:0,y:.08,cap:0,distance:travel,braquage:turn};V.render(c,meshes,{rider:true});const contacts=mod.contacts(travel,turn);
  const frontTyre=meshes.find(m=>m.wheel==='front'&&m.tag==='tyre');assert(frontTyre);assert(Math.hypot(frontTyre.p[0]-mod.wb,frontTyre.p[1]-(mod.wr+.08),frontTyre.p[2])<1e-8,'steering preserves wheel axle center');
  const frontSpokes=meshes.find(m=>m.wheel==='front'&&m.tag==='spokes');if(frontSpokes){const axle=q=>B.mul(B.euler(...q.r),[0,0,1]),a=axle(frontTyre),b=axle(frontSpokes);assert(Math.abs(a.reduce((n,v,k)=>n+v*b[k],0)-1)<1e-8,'spokes rotate in steered wheel plane');}
  for(let i=0;i<2;i++)for(const [label,key] of [['hand','hands'],['foot','feet']]){const p=meshes.find(m=>m.contact===label+'-'+i);assert(p);assert(Math.hypot(...p.p.map((v,k)=>v-contacts[key][i][k]-(k===1?.08:0)))<1e-8,'rider contact follows animated assembly');}
  if(type==='bike')for(let i=0;i<2;i++){const shoe=meshes.find(m=>m.contact==='foot-'+i),pedal=meshes.find(m=>m.contact==='pedal-'+i);assert(Math.abs(shoe.p[1]-shoe.s[1]/2-(pedal.p[1]+pedal.s[1]/2))<1e-8,'sole rests on moving pedal');}
 }
 const neutral=mod.contacts(0,0),turned=mod.contacts(0,.45);assert(Math.hypot(...neutral.hands[0].map((v,k)=>v-turned.hands[0][k]))>.03,'hands actually turn with handlebars');
 if(type==='bike')assert(Math.abs(mod.contacts(0,0).feet[0][1]-mod.contacts(.6,0).feet[0][1])>.1,'feet actually pedal');
 models[type]={previous:previous[type],fixedInstances:mod.pieces.length,lods,bounds:ext,contactChecks:true};
}
const report={provenance:'original-procedural-runtime',importedAssets:0,models,lodDistances:[28,75],maxRenderDistanceSuggested:190,checks:['Physical dimensions, mass, camera and driving constants preserved','Finite vertices, positive scales and unit normals','Closed tyre/rim/fairing winding','Paint variants do not move cached parts','Specific silhouettes and bounded LOD counts','Steered spokes remain in wheel plane','Rider hands follow grips and feet follow pedals']};
fs.writeFileSync(new URL('../docs/mobility-models-acceptance.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
