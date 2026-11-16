// Procedural C-pillar trim must sit outside its supporting face, not cross glass.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const shapes=new Map(),context=vm.createContext({FRender:{forme:(name,faces)=>shapes.set(name,faces)}});
for(const file of ['src/ferro/geometry.js','src/vehicles.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
const model=context.RADE.vehicles.model('gti'),sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const cross2=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function vertices(shape){const m=model.pieces.find(p=>p.shape===shape);assert(m,shape);return shapes.get(shape).map(tri=>tri.slice(0,3).map(v=>v.map((n,i)=>n*m.s[i]+m.p[i])));}
let checked=0;
for(const side of [-1,1]){
 const pillar=vertices('rade-gti-c-pillar'+side).filter((_,i)=>i%2===0).map(face=>{let normal=cross(sub(face[1],face[0]),sub(face[2],face[0]));const length=Math.hypot(...normal),sign=side*Math.sign(normal[2]);normal=normal.map(v=>v*sign/length);return {face,normal};});
 for(const [label,relief] of [['quarter-trim',.003],['quarter-badge-GTI',.006],['quarter-badge-1.9',.006]]){
  for(const triangle of vertices('rade-gti-'+label+side)){
   assert(triangle.flat().every(Number.isFinite));
   assert(Math.hypot(...cross(sub(triangle[1],triangle[0]),sub(triangle[2],triangle[0])))>1e-12,'non-degenerate trim triangles');
   const support=pillar.find(({face,normal})=>triangle.every(p=>Math.abs(dot(sub(p,face[0]),normal)-relief)<1e-8));
   assert(support,label+' must follow one actual C-pillar face at the specified physical clearance');
   for(const p of triangle){const q=p.map((v,i)=>v-support.normal[i]*relief),[a,b,c]=support.face,den=cross2(a,b,c),wb=cross2(a,q,c)/den,wc=cross2(a,b,q)/den;
    assert(wb>=-1e-8&&wc>=-1e-8&&wb+wc<=1+1e-8,label+' must stay inside the supporting metal panel, away from the rear glass');
   }checked++;
  }
 }
}
// Both shells are now deliberately revised; the dedicated vehicle-shell test
// covers their closure, proportions and unchanged mechanical/cockpit contract.
console.log('PASS: '+checked+' trim/badge triangles attached to real C-pillar faces.');
