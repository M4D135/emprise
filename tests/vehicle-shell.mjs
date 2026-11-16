// Real procedural triangles: no renderer stub substitutes the generated geometry.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
const previous='0a68dbe2b907e6795c3c8fe2f7701fa9d59d191c';
const geometry=fs.readFileSync('src/ferro/geometry.js','utf8');
function load(source){const shapes=new Map(),c=vm.createContext({FRender:{forme:(name,faces)=>shapes.set(name,faces)}});vm.runInContext(geometry,c);vm.runInContext(source,c);return {api:c.RADE.vehicles,shapes};}
const old=load(execFileSync('git',['show',previous+':src/vehicles.js'],{encoding:'utf8'})),now=load(fs.readFileSync('src/vehicles.js','utf8'));
const plain=o=>JSON.parse(JSON.stringify(o)),sub=(a,b)=>a.map((n,k)=>n-b[k]),dot=(a,b)=>a.reduce((s,n,k)=>s+n*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function faces(loaded,model,label){const m=model.pieces.find(p=>p.shape==='rade-'+model.type+'-'+label);assert(m,label);return loaded.shapes.get(m.shape).map(t=>t.slice(0,3).map(p=>p.map((n,k)=>n*m.s[k]+m.p[k])));}
function ray(origin,dir,triangles){for(const [a,b,c] of triangles){const e1=sub(b,a),e2=sub(c,a),h=cross(dir,e2),det=dot(e1,h);if(Math.abs(det)<1e-12)continue;const s=sub(origin,a),u=dot(s,h)/det,q=cross(s,e1),v=dot(dir,q)/det,t=dot(e2,q)/det;if(u>=-1e-8&&v>=-1e-8&&u+v<=1+1e-8&&t>=0)return true;}return false;}
let rays=0,oldHoles=0,triangles=0;const summary=[];
for(const type of ['gti','r5']){
 const m=now.api.model(type),before=old.api.model(type);
 assert.deepEqual(plain(m.spec),plain(before.spec),'no mechanical retuning');assert.deepEqual(plain(m.eye),plain(before.eye));
 assert.deepEqual(plain(m.interior),plain(before.interior),'interior and controls preserved');assert.deepEqual(plain(m.gauges),plain(before.gauges));
 assert.equal(m.wr,before.wr);assert.equal(m.wb,before.wb);assert(m.pieces.length<=before.pieces.length,'no extra instances');
 for(const p of m.pieces){assert(p.p.every(Number.isFinite));assert(p.s.every(n=>Number.isFinite(n)&&n>0));assert(p.r.every(Number.isFinite));if(!now.shapes.has(p.shape))continue;for(const t of faces(now,m,p.shape.slice(('rade-'+type+'-').length))){assert(t.flat().every(Number.isFinite));assert(Math.hypot(...cross(sub(t[1],t[0]),sub(t[2],t[0])))>1e-11,'non-degenerate visible triangles');triangles++;}}
 for(const side of [-1,1]){
  const shell=faces(now,m,'side'+side),oldShell=faces(old,before,'side'+side);
  for(let i=0;i<43;i++)for(let j=0;j<9;j++){
   const x=-1.60+i*2.32/42,y=.841+j*.002,origin=[x,y,side*1.1],direction=[0,0,-side];
   assert(ray(origin,direction,shell),'no daylight under glazing: '+[type,side,x,y]);rays++;if(!ray(origin,direction,oldShell))oldHoles++;
  }
  for(let i=0;i<27;i++)for(let j=0;j<7;j++){
   const origin=[-1.60+i*2.32/26,2,side*(.703+j*.009)];assert(ray(origin,[0,-1,0],shell),'shoulder has a real horizontal skin');rays++;
  }
  const glass=faces(now,m,'quarter-glass'+side).flat(),bottom=glass.filter(v=>Math.abs(v[1]-.89)<1e-7),top=glass.filter(v=>v[1]>1.25);
  if(type==='gti')assert(Math.abs(Math.min(...bottom.map(v=>v[0]))-Math.min(...top.map(v=>v[0])))<.13,'205 quarter pane has an almost vertical rear edge, not the old long triangle');
  assert(m.pieces.filter(p=>p.shape==='rade-'+type+'-arches').length===1,'four continuous mouldings in one material batch');
  const wells=faces(now,m,'wheel-wells');for(const axle of [-m.wb,m.wb])for(let k=0;k<9;k++){const dx=-.20+k*.05,origin=[axle+dx,m.wr+Math.sqrt((type==='gti'?.35:.348)**2-dx*dx)*.94,side*1.1];assert(ray(origin,[0,0,-side],wells),'wheel wells have opaque backs');rays++;}
 }
 const roof=faces(now,m,'roof');for(let i=0;i<13;i++)for(let j=0;j<9;j++){assert(ray([-.98+i*1.18/12,2,-.59+j*1.18/8],[0,-1,0],roof),'continuous roof skin');rays++;}
 const ys=roof.flat().map(p=>p[1]);assert(Math.max(...ys)>1.352&&Math.max(...ys)<=1.361,'shallow pressed roof crown within original nominal height');
 for(const color of now.api.PALETTE){const tinted=now.api.model(type,color);assert.deepEqual(plain(tinted.pieces.map(p=>[p.shape,p.p,p.s,p.r])),plain(m.pieces.map(p=>[p.shape,p.p,p.s,p.r])),'colour does not change geometry');}
 summary.push({type,partsBefore:before.pieces.length,partsAfter:m.pieces.length,freeformTriangles:[...now.shapes].filter(([name])=>name.startsWith('rade-'+type+'-')).reduce((n,[,f])=>n+f.length,0)});
}
assert(oldHoles>1000,'the regression fixture must expose the old open shoulder');
console.log(JSON.stringify({pass:true,rays,oldHoles,triangles,models:summary},null,2));
