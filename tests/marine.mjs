import './load.mjs';import assert from 'node:assert/strict';import fs from 'node:fs';
const s=RADE.session.create({pedestrians:10}),m=s.marine,p=s.player,w=s.world,checks=[];
assert.equal(m.boats.length,3);assert(m.ladders.length>0);for(const q of m.boats)assert(m.hull(q.x,q.z,q.cap,RADE.marine.kinds[q.kind],q));
const ladder=m.ladders.slice().sort((a,b)=>Math.hypot(a.landX-p.x,a.landZ-p.z)-Math.hypot(b.landX-p.x,b.landZ-p.z))[0];Object.assign(p,{x:ladder.landX,z:ladder.landZ});assert(s.interact());assert.equal(s.mode,'swim');const initial={x:p.x,z:p.z};for(let i=0;i<120;i++)s.update(1/120,{moveY:1,lookX:.001});assert(Math.hypot(p.x-initial.x,p.z-initial.z)>.1);assert(w.water(p.x,p.z));assert.equal(p.y,-1.2);assert.equal(p.hp,100);
Object.assign(p,{x:ladder.x,z:ladder.z});assert(s.interact());assert.equal(s.mode,'foot');assert(!w.blocked(p.x,p.z,.28));checks.push('Échelle, nage avec visée, retour sur quai libre');
for(const q of m.boats){Object.assign(p,{x:q.x,z:q.z});assert(m.enterWater(p));assert(s.interact());assert.equal(s.mode,'boat');assert.equal(m.boat,q);const a={x:q.x,z:q.z};for(let i=0;i<180;i++)s.update(1/120,{forward:1});assert(q.speed>.3,[q.kind,q.speed]);assert(Math.hypot(q.x-a.x,q.z-a.z)>.1);for(let i=0;i<240;i++)s.update(1/120,{brake:true});assert(s.interact());assert.equal(s.mode,'swim');assert(w.water(p.x,p.z));}
checks.push('Trois embarcations : monter, accélérer, arrêter, descendre');
const q=m.boats.find(q=>q.kind==='sailboat');let pool=null;for(let x=-220;x<-30&&!pool;x+=10)for(let z=80;z<240;z+=10)if([0,Math.PI/2,Math.PI,Math.PI*1.5].every(a=>m.hull(x,z,a,RADE.marine.kinds.sailboat,q))){pool={x,z};break;}assert(pool);Object.assign(q,pool);Object.assign(p,{x:q.x,z:q.z});m.enterWater(p);s.interact();q.cap=Math.atan2(.0018,.006)+Math.PI;q.speed=0;for(let i=0;i<300;i++)s.update(1/120,{});assert.equal(q.speed,0,'Voilier face au vent ne propulse pas');q.cap+=Math.PI/2;for(let i=0;i<240;i++)s.update(1/120,{forward:1});assert(q.speed>.3);checks.push('Voile : arrêt face au vent, relance au travers');
// Long forward run reaches a visible port boundary/shore and remains in water.
for(let i=0;i<12000;i++)m.update(1/120,{forward:1},p,{wind:1,gust:.5});assert(w.water(q.x,q.z));assert([p.x,p.z,q.speed,q.y,q.roll,q.pitch].every(Number.isFinite));
const save=s.save();const resumed=RADE.session.create({pedestrians:2,saved:save,now:save.savedAt});assert.equal(resumed.mode,'boat');assert.equal(resumed.marine.boat.id,q.id);assert.equal(resumed.marine.boat.speed,0);assert(Math.hypot(resumed.player.x-p.x,resumed.player.z-p.z)<.01);checks.push('Berges infranchissables en bateau, état fini et reprise embarquée');
const bad=structuredClone(save);bad.marine.boats[0].x=Infinity;bad.marine.player={x:1000,z:1000};bad.marine.mode='swim';const safe=RADE.session.create({pedestrians:0,saved:bad,now:save.savedAt});assert.equal(safe.mode,'foot');assert(safe.marine.boats.every(q=>Number.isFinite(q.x)&&w.water(q.x,q.z)));checks.push('Sauvegarde invalide rejetée sans apparition hors zone');
// Complete hull collision: a pile between the old six samples, and lengthwise boat overlap.
const makePool=()=>{const obstacles=[];return {obstacles,bounds:{minX:-100,maxX:100,minZ:-100,maxZ:100},water:()=>true,blocked:()=>false,ground:()=>.08,candidates:()=>obstacles};};
const poolWorld=makePool(),poolMarine=RADE.marine.create(poolWorld),K=RADE.marine.kinds;
poolMarine.boats.length=0;
poolWorld.obstacles.push({x:51,z:50,a:.08,b:.08,c:1,s:0,minY:-1,maxY:3});
assert(!poolMarine.hull(50,50,0,K.motorboat),'A solid pile inside the hull must collide');
assert(!poolMarine.hull(50,50,Math.PI/4,K.motorboat),'A rotated hull must collide with its interior pile');
poolWorld.obstacles.length=0;
poolMarine.boats.push({id:'obstacle-boat',kind:'motorboat',x:54,z:50,cap:0});
assert(!poolMarine.hull(50,50,0,K.motorboat),'Length matters for boat-to-boat collision');
assert(poolMarine.hull(44,50,0,K.motorboat),'Separated boats must remain navigable');
const launch=RADE.marine.create(w);for(const q of launch.boats)assert(launch.hull(q.x,q.z,q.cap,K[q.kind],q),'Initial fleet overlaps');
checks.push('Coques orientées : poteau intérieur, rotation, collision par longueur et flotte initiale sans chevauchement');
// Every generated ladder has a valid wet endpoint and dry landing; bad transitions do not move the player.
for(const l of launch.ladders){assert(w.water(l.x,l.z),l.id+' water endpoint');assert(!w.water(l.landX,l.landZ));assert(!w.blocked(l.landX,l.landZ,.4));}
const broken=launch.ladders.find(l=>launch.boats.every(q=>Math.hypot(l.landX-q.x,l.landZ-q.z)>10));assert(broken);
const dryPlayer={x:broken.landX,z:broken.landZ,y:.08,yaw:0,pitch:0},beforeDry={...dryPlayer};broken.x=broken.landX;broken.z=broken.landZ;
assert.equal(launch.context(dryPlayer),null,'Do not offer a ladder whose water end is dry');assert.equal(launch.interact(dryPlayer),false);assert.deepEqual(dryPlayer,beforeDry);
checks.push('Toutes les échelles dans l’eau ; extrémité invalide refusée sans déplacer le joueur');
// Boarding cannot teleport across an opaque wall.
const wallWorld=makePool(),wallMarine=RADE.marine.create(wallWorld),target=wallMarine.boats[0];Object.assign(target,{x:20,z:20,cap:0});
const swimmer={x:16.5,z:20,y:.08,yaw:0,pitch:0};assert(wallMarine.enterWater(swimmer));
wallWorld.obstacles.push({x:18.3,z:20,a:.12,b:3,c:1,s:0,minY:0,maxY:3});const beforeSwimmer={...swimmer};
assert.equal(wallMarine.context(swimmer),null);assert.equal(wallMarine.interact(swimmer),false);assert.deepEqual(swimmer,beforeSwimmer);
wallWorld.obstacles.length=0;assert.equal(wallMarine.context(swimmer)?.boat,target);assert(wallMarine.interact(swimmer));
checks.push('Embarquement bloqué par un mur, autorisé après dégagement');
// Corrupt containers and entries are ignored, and a whole valid saved fleet can exchange positions atomically.
for(const boats of [{},'corrupt',[null,17,false], [{id:'boat-0',kind:'motorboat',x:Infinity,z:0,cap:0}]]){
 const a=RADE.marine.create(makePool(),{saved:{version:1,mode:'swim',boats,player:{x:Infinity,z:NaN}}}),p={x:0,z:0,y:.08,yaw:0,pitch:0};assert.doesNotThrow(()=>a.restore(p));assert.equal(a.mode,'foot');assert(a.boats.every(q=>[q.x,q.z,q.cap].every(Number.isFinite)));
}
const restoreWorld=makePool(),original=RADE.marine.create(restoreWorld),records=original.save().boats;
const swap=records.map(q=>({...q}));Object.assign(swap[0],{x:records[1].x,z:records[1].z,cap:records[1].cap});Object.assign(swap[1],{x:records[0].x,z:records[0].z,cap:records[0].cap});Object.assign(swap[2],{x:50,z:50});
const exchanged=RADE.marine.create(restoreWorld,{saved:{version:1,mode:'foot',boats:swap}});exchanged.restore({x:0,z:0,y:.08,yaw:0,pitch:0});
for(const expected of swap){const actual=exchanged.boats.find(q=>q.id===expected.id);assert.equal(actual.x,expected.x);assert.equal(actual.z,expected.z);assert.equal(actual.speed,0);}
for(const mesh of exchanged.geometry())assert([...mesh.p,...mesh.s,...(mesh.r||[0,0,0])].every(Number.isFinite));
checks.push('Conteneurs de sauvegarde malformés ignorés ; échange simultané de positions restauré sans NaN');

const report={boats:m.boats.map(q=>q.kind),ladders:m.ladders.length,checks};fs.writeFileSync(new URL('../docs/marine-acceptance.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(report);
