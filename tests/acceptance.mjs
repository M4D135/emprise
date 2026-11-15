import assert from 'node:assert/strict';
import fs from 'node:fs';
for(const f of ['metal/fmath','metal/physics','metal/simulation','pdr/villes/marseille','pdr/ville-reelle','pdr/sim/nav','pdr/sim/regles','bitume/carene','bitume/conduite','vehicles','mobility','details','architecture','clearance','world','people','crowd','session'])await import('../src/'+f+'.js');
await import('./scenario.js');
const s=RADE.session.create(),auto=radeScenario(s);
let prev='';while(!auto.finished){s.update(1/120,auto.step());if(prev!==auto.stage){prev=auto.stage;console.log(prev,s.player.x.toFixed(1),s.player.z.toFixed(1),s.player.hp,s.phase);}}
const report=auto.report();console.log(JSON.stringify(report,null,2));fs.writeFileSync(new URL('../docs/acceptance.json',import.meta.url),JSON.stringify(report,null,2)+'\n');assert(report.complete,'Full mission loop must complete');
const checks=[];
for(let i=0;i<180;i++)s.update(1/120,{brake:true});
const saved=s.car,enemyHP=s.sim.state.enemies.map(e=>e.hp),people=s.crowd.people;
for(let i=0;i<10;i++){assert(s.interact(),'Exit #'+i);assert.equal(s.mode,'foot');assert(!s.world.blocked(s.player.x,s.player.z,.28));assert(s.interact(),'Enter #'+i);assert.equal(s.car,saved);assert.equal(s.crowd.people,people);assert.deepEqual(s.sim.state.enemies.map(e=>e.hp),enemyHP);}
checks.push('10 entrées/sorties, même voiture, même foule, combat conservé');
const wallSession=RADE.session.create({pedestrians:12}),w=wallSession.world;
assert(wallSession.interact());const exits=wallSession.exitCandidates();
const cover=q=>w.addMesh({shape:'box',p:[q.x,1,q.z],s:[.7,2,.7],mat:0});
cover(exits[0]);assert(wallSession.interact());assert(Math.hypot(wallSession.player.x-exits[1].x,wallSession.player.z-exits[1].z)<.01);assert(wallSession.interact());cover(exits[1]);assert(!wallSession.interact());assert.equal(wallSession.mode,'car');assert.match(wallSession.message,/deux côtés/);checks.push('sortie côté libre, deux côtés bloqués et explication');
// A real building from the shared urban geometry, not a test-only wall.
const q=s.world.boxes.find(q=>q.minY<.2&&q.maxY>6&&q.a>3&&q.b>3&&Math.abs(q.x)<250&&Math.abs(q.z)<250&&s.world.withoutCar(()=>!s.world.blocked(q.x+(q.a+4)*q.c,q.z+(q.a+4)*q.s,1)));
assert(q,'Building with accessible outer face');const c=s.car;
Object.assign(c,{x:q.x+(q.a+3)*q.c,z:q.z+(q.a+3)*q.s,cap:q.cap+Math.PI,u:5,v:5});
assert(s.world.moveVehicle(c,-q.c*12,-q.s*12,c.cap));assert(!s.world.carContact(c),'Vehicle stops before façade');
const eye=[q.x+(q.a+3)*q.c,1.7,q.z+(q.a+3)*q.s],dir=[-q.c,0,-q.s],distance=s.world.ray(eye,dir,30);
assert(distance<3.1&&distance>2.5);checks.push('balayage véhicule contre un bâtiment réel, rayon arrêté à sa façade');
const combat=FSimulation.create({...s.world.combatWorld,spawn:{x:eye[0],z:eye[2],yaw:Math.atan2(dir[0],-dir[2])},enemies:[{x:q.x,z:q.z,type:0,y:.08,yaw:0}]});
const hp=combat.state.enemies[0].hp;for(let i=0;i<240;i++)combat.step(1/120,{fire:true});assert.equal(combat.state.enemies[0].hp,hp);checks.push('tirs METAL arrêtés par la façade : aucune perte de PV derrière');
// Wheel vehicles are independently usable and collide with the same world.
for(const type of ['tmax','scooter','bike']){const spec=RADE.vehicles.SPECS[type],v=BITUME.conduite.creer();Object.assign(v,{model:type,moteur:true,y:.08});const flat={ground:()=>.08,moveVehicle:(v,dx,dz,a)=>{v.x+=dx;v.z+=dz;v.cap=a;return null;}};for(let i=0;i<2400;i++)RADE.vehicles.step(v,{gaz:1,volant:0},flat,1/120);assert(v.v>3&&v.v<=spec.top);for(let i=0;i<1200;i++)RADE.vehicles.step(v,{frein:1},flat,1/120);assert(v.v<.1);}
checks.push('TMAX, trottinette et vélo : accélération, limite de vitesse et freinage');
for(const m of s.world.scenery)if(m.shape==='cylinder'&&m.mat===10)assert(!s.world.city.surChaussee(m.p[0],m.p[2]),'Tree on roadway');checks.push('aucun tronc de la végétation RTS sur la chaussée');
report.checks=checks;fs.writeFileSync(new URL('../docs/acceptance.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(checks);
