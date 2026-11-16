import assert from 'node:assert/strict';
import fs from 'node:fs';
for(const f of ['ferro/renderer','ferro/geometry','bitume/main','bitume/voiture','ferro/vehicle-dynamics','bitume/conduite','vehicles'])await import('../src/'+f+'.js');
const geometry=new Map(),register=FRender.forme;FRender.forme=(name,triangles)=>{geometry.set(name,triangles);register(name,triangles);};await import('../src/mobility.js');FRender.forme=register;
const V=RADE.vehicles,car={model:'policebike',color:'#e6e9e8',x:0,z:0,y:.08,cap:0,distance:0,police:true,siren:true,driver:{inside:true,hp:100}},draw=(v=car,o={})=>{const out=[];V.render(v,out,{rider:true,time:0,...o});return out;};
const near=draw(),far=draw(car,{distance:100});
assert(near.length<155&&far.length<105,'bounded patrol equipment and rider budget');
for(const m of near){assert([...m.p,...m.s,...m.r].every(Number.isFinite));assert(m.s.every(v=>v>0));}
const spec=V.SPECS.policebike;assert.deepEqual([spec.length,spec.width,spec.wheelbase],[2.222,.990,1.485]);
const parked=draw(car,{rider:false}),lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
for(const m of parked){const matrix=BITUME.voiture.euler(...(m.r||[0,0,0])),verts=geometry.get(m.shape)?.flatMap(t=>t.slice(0,3))||[-.5,.5].flatMap(x=>[-.5,.5].flatMap(y=>[-.5,.5].map(z=>[x,y,z])));for(const p of verts){const v=BITUME.voiture.mul(matrix,p.map((v,k)=>v*m.s[k]));for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],v[k]+m.p[k]);hi[k]=Math.max(hi[k],v[k]+m.p[k]);}}}
assert(hi[0]-lo[0]<=spec.length+.02);assert(hi[2]-lo[2]<=spec.width+.02);assert(lo[1]>.075);assert(hi[1]<1.75);
for(const turn of [-.4,0,.4]){const c={...car,braquage:turn},m=draw(c),contacts=V.model(c.model,c.color).contacts(0,turn);for(let i=0;i<2;i++){const hand=m.find(q=>q.contact==='hand-'+i),foot=m.find(q=>q.contact==='foot-'+i);assert(Math.hypot(...hand.p.map((v,k)=>v-contacts.hands[i][k]-(k===1?.08:0)))<1e-8);assert(Math.abs(foot.p[1]-foot.s[1]/2-(.353+.025/2+.08))<1e-8,'boot sole rests on foot peg');}}
const kit=near.filter(m=>m.policeEquipment);assert(kit.length>=15);
for(const m of kit){assert(Math.abs(m.p[2])+m.s[2]/2<.50,'mounted within handlebar width, not floating car-door trim');assert(m.p[1]>.6,'cases clear wheels and road');}
assert.equal(kit.filter(m=>m.policeLight!==undefined).length,3,'two front lights and one rear beacon');
const lights=t=>draw(car,{time:t}).filter(m=>m.policeLight!==undefined).map(m=>m.emissive);
assert.notDeepEqual(lights(0),lights(.125),'alternate front flashing');
assert(draw({...car,siren:false}).filter(m=>m.policeLight!==undefined).every(m=>m.emissive===0),'siren off dims mounted lights');
assert(near.some(m=>m.policeUniform));
assert(!draw({...car,driver:{inside:false,hp:100}}).some(m=>m.policeUniform),'stealing patrol vehicle does not dress player as police');
assert(!draw(car,{rider:false}).some(m=>m.policeUniform),'empty patrol vehicle has no rider');
assert(!draw({...car,police:false}).some(m=>m.policeEquipment||m.policeUniform),'civilian scooter has no police kit');
assert(!draw({...car,exploded:true}).some(m=>m.policeEquipment),'exploded vehicle has no intact police kit');
const rotated=draw({...car,cap:.8,roulis:.2,x:11,z:7});
for(let i=0;i<near.length;i++){const expected=BITUME.voiture.mul(BITUME.voiture.attitude(.8,0,.2),[near[i].p[0],near[i].p[1]-.08,near[i].p[2]]);assert(Math.hypot(...rotated[i].p.map((v,k)=>v-expected[k]-[11,.08,7][k]))<1e-8,'equipment and rider bank with vehicle');}
const report={checks:['Patrol equipment inside two-wheeler envelope','Three mounted lights alternate and switch off','Police rider only when officer remains seated','No uniform inherited by player after theft','No intact police kit on wreck','Kit and rider follow steering body lean'],instances:{near:near.length,far:far.length},importedAssets:0};fs.writeFileSync(new URL('../docs/police-motorcycle-validation.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
