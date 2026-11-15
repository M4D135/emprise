await import('./load.mjs');for(const f of ['human-data','body-data','human','pdr/foule'])await import('../src/'+f+'.js');import assert from 'node:assert/strict';import fs from 'node:fs';
for(const mesh of [RADE.human.head,RADE.human.body,RADE.human.scarf,RADE.human.scarfDrape,...RADE.human.heads.map(v=>v.head)]){assert(mesh.indices.every(i=>Number.isInteger(i)&&i>=0&&i<mesh.positions.length));assert(mesh.positions.flat().every(Number.isFinite));assert(mesh.normals.flat().every(Number.isFinite));for(const n of mesh.normals)assert(Math.hypot(...n)>.8&&Math.hypot(...n)<1.2);}
for(const b of RADE.human.body.bones)assert(b.every(Number.isFinite)&&b[2]>=0&&b[2]<=1);
const crowd=PDR.foule.construireMaillages();assert(crowd.indices instanceof Uint32Array);assert(crowd.indices.every(i=>i<crowd.nombre));assert(new Float32Array(crowd.sommets).every(Number.isFinite));
for(const id of [1,10000,10002,10005,10007,10008])for(const pose of [{},{seated:true},{injury:{leg:true}},{hp:0,renderBody:true}]){const meshes=RADE.people.build({id,x:0,z:0,hp:100,yaw:0,baseY:.08,moveSpeed:1.5,...pose},{time:1,distance:3});assert(meshes.length>15);for(const m of meshes)assert([...m.p,...m.s,...m.r].every(Number.isFinite));}
// Clothing envelopes and both rendering paths must keep the continuous rig.
const human=RADE.human,body=human.body;assert.equal(RADE.proceduralHuman.provenance,'original-parametric-runtime');assert.equal(RADE.bodyData.provenance,'original-parametric-runtime');
assert(body.bones.filter(([a,b,w])=>a!==b&&w>.01&&w<.99).length>100,'continuous two-joint weights');
const sleeveDiameters=[];
for(const code of [18,19]){
 const points=body.positions.filter((p,i)=>((body.bones[i][0]===code&&body.bones[i][2]<.5)||(body.bones[i][1]===code&&body.bones[i][2]>.5))&&body.materials[i]===1&&p[1]>1.04&&p[1]<1.14);
 assert(points.length>20);const diameter=Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0]));
 assert(diameter>.085&&diameter<.18,'adult sleeve diameter '+diameter);sleeveDiameters.push(diameter);
}
const upperShirt=body.positions.filter((p,i)=>body.materials[i]===1&&p[1]>1.43),shoulderExtent=Math.max(...upperShirt.map(p=>Math.abs(p[0])));assert(shoulderExtent>.22&&shoulderExtent<.27,'upper sleeve edge drops into rounded shoulder');
const frontCollar=upperShirt.filter(p=>Math.abs(p[0])<.07&&p[2]>.055),backCollar=upperShirt.filter(p=>Math.abs(p[0])<.07&&p[2]<-.055);assert(Math.max(...backCollar.map(p=>p[1]))>1.525&&Math.max(...frontCollar.map(p=>p[1]))<1.52,'raised neckline opens lower in front');
for(const face of human.heads){const tip=Math.max(...face.head.positions.filter(p=>p[1]>1.64&&p[1]<1.70).map(p=>p[2]));assert(tip>.104&&tip<.12,'bounded rounded nose projection');}
const shoulderFit=human.fit([.20,1.40,.08],[1,0,0],true);assert(shoulderFit.p[0]>=.194&&shoulderFit.p[0]<=.21,'subtle garment fit');
const rest=Float32Array.from(human.poseBody({phase:0,walk:0,feminine:true}));
const moving=Float32Array.from(human.poseBody({phase:1.2,walk:1,feminine:true}));
assert(rest.every(Number.isFinite)&&moving.every(Number.isFinite));assert(moving.filter((n,i)=>Math.abs(n-rest[i])>.001).length>500,'skinned pose changes shared vertices');
const uploads=[];human.beginFrame({updateShape(name,values){assert(values.every(Number.isFinite));uploads.push(name);}});
const close=RADE.people.build({id:10005,x:0,z:0,hp:100,yaw:0,civil:true,moveSpeed:1.5},{time:.8,distance:3});
assert(uploads.length>0&&close.some(m=>m.shape.startsWith('rade-skinned-')),'close actor uses CPU skinning');
assert(close.some(m=>m.shape===human.scarfShape.shape)&&close.some(m=>m.shape===human.scarfDrapeShape.shape),'shared hood and shoulder drape');
const top=mesh=>Math.max(...mesh.positions.map(p=>p[1]));assert(top(human.scarf)>top(human.head)+.02,'hood clears crown');
let fits=0;const originalFit=human.fit;human.fit=(...args)=>{fits++;return originalFit(...args);};PDR.foule.construireMaillages();human.fit=originalFit;assert(fits>body.positions.length,'GPU crowd uses same garment fit');
// Contact and articulation are numeric constraints, independent of screenshots.
assert(body.feet&&body.bones.some(([a])=>a===20)&&body.bones.some(([a])=>a===21),'integrated ankle bones');
let maxSoleError=0,maxStepJump=0;
for(const amount of [0,.2,.65,1,1.2])for(let frame=0;frame<240;frame++){
 const phase=frame/240*2*Math.PI,pose=human.motion({phase,walk:amount}),next=human.motion({phase:phase+.00001,walk:amount});
 for(const [code,leg] of [[20,pose.left],[21,pose.right]]){
  const p=human.transformPoint([code===20?-.105:.105,.005,0],code,pose),q=human.transformPoint([code===20?-.105:.105,.005,0],code,next);
  maxSoleError=Math.max(maxSoleError,Math.abs(p[1]+pose.bodyY-(.005+leg.lift)));
  maxStepJump=Math.max(maxStepJump,Math.hypot(q[1]+next.bodyY-p[1]-pose.bodyY,q[2]-p[2]));
  assert(Math.abs(human.boneMatrix(code,pose)[4])<1e-8,'level planted sole');
 }
}
assert(maxSoleError<.0001,'shoe sole follows ground or swing lift, error '+maxSoleError);
assert(maxStepJump<.0001,'gait remains continuous across contact transitions');
const aiming=human.motion({aim:true});assert(human.transformPoint([.26,.87,.012],19,aiming)[2]>.4,'aimed wrist points toward face front');
assert(body.indices.length/3<10500&&human.head.indices.length/3<4000,'bounded geometry budget');
const cacheUploads=[],renderer={updateShape(n){cacheUploads.push(n);}},fixedPose={phase:.5,walk:1,feminine:false};human.beginFrame(renderer);human.skin(fixedPose);const firstUploads=cacheUploads.length;human.beginFrame(renderer);human.skin(fixedPose);assert.equal(cacheUploads.length,firstUploads,'same pose reuses uploaded buffers');human.beginFrame({updateShape(n){cacheUploads.push(n);}});human.skin(fixedPose);assert.equal(cacheUploads.length,firstUploads*2,'new renderer receives cached pose');
assert.equal(new Set(human.heads.map(h=>JSON.stringify(h.head.positions))).size,3,'three distinct original faces');
const wardrobe=Array.from({length:480},(_,id)=>RADE.human.appearance(id));
for(const look of wardrobe){assert(look.heightScale>=.94&&look.heightScale<=1.06);assert(look.widthScale>=.92&&look.widthScale<=1.075);assert.equal(look.face,look.type%3);}assert(new Set(wardrobe.map(a=>a.shirt)).size===16,'civilian wardrobe variants');
const report={gait:{maxSoleError,maxStepJump,integratedShoes:true,sharedCPUAndGPU:true},faceVariants:3,provenance:'original-parametric-runtime',importedVisualAssets:0,wardrobe:{people:480,darkerToOlive:wardrobe.filter(a=>RADE.human.skinPalette.indexOf(a.skin)<6).length,headscarves:wardrobe.filter(a=>a.veil).length,capsAndCrossbodyBags:wardrobe.filter(a=>a.streetwear).length,independentFromGang:true},headVertices:RADE.human.head.positions.length,headTriangles:RADE.human.head.indices.length/3,bodyVertices:RADE.human.body.positions.length,bodyTriangles:RADE.human.body.indices.length/3,crowdAtlasVertices:crowd.nombre,indices32bit:true,sleeveDiameters,continuousSkinning:true,sharedGarmentFit:true,poses:['marche','assis','rampement','au sol'],checks:['Indices et normales valides','Influences articulaires bornées','Aucun nombre invalide dans les quatre poses','Manches amples et coupe cohérente CPU/GPU','Déformation CPU à deux influences effectivement utilisée','Coiffe et drapé partagés, couronne couverte','Semelles au sol pendant appui, levée contrôlée, cycle continu','Cache de poses réutilisé et réinitialisé par renderer','Trois visages et seize teintes de vêtements bornés']};fs.writeFileSync(new URL('../docs/models-acceptance.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(report);
