import './load.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const M=RADE.marine,PI=Math.PI,checks=[],measurements={};
const near=(a,b,tolerance=1e-9)=>assert(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
function fixture(cap=PI/2,weather={wind:.8,windDirection:0},deployment=1){
 const obstacles=[],world={bounds:{minX:-2000,maxX:2000,minZ:-2000,maxZ:2000},water:()=>true,ground:()=>.08,blocked:()=>false,candidates:()=>obstacles},m=M.create(world),q=m.boats.find(b=>b.kind==='sailboat');
 m.boats.forEach((b,i)=>Object.assign(b,{x:400+i*40,z:400}));
 Object.assign(q,{x:0,z:0,cap,speed:0,sailDeployment:deployment,sailTrim:deployment,engineOn:false});
 q.sailAngle=M.sailDrive(q,weather).idealAngle;
 const p={x:0,z:0,y:0,yaw:0,pitch:0,hp:100};assert(m.enterWater(p));assert(m.interact(p));
 return {world,obstacles,m,q,p,weather,t:0};
}
function run(f,seconds,input={},weather=f.weather){for(let i=0;i<Math.round(seconds*120);i++){f.m.update(1/120,input,f.p,weather);f.t+=1/120;}return {speed:f.q.speed,distance:Math.hypot(f.q.x,f.q.z),load:f.q.load,force:f.q.force,blocked:f.q.blocked};}
for(const strength of [0,.15,.28,.8,1.55]){
 const f=fixture(PI/2,{wind:strength,windDirection:0}),r=run(f,10);measurements['wind-'+strength]=r;
 if(strength===0){near(r.speed,0);near(r.distance,0);near(r.load,0);assert(f.q.luffing);assert(f.m.geometry().filter(m=>m.sail).every(m=>m.sailCatch===0&&m.shape.includes('-0-')));}
 else{assert(r.distance>1);assert(r.speed>.15);assert(r.load>0);assert(!r.blocked);}
 near(f.q.engineRpm,0);assert(!f.q.engineOn);
}
assert(measurements['wind-0.8'].speed>measurements['wind-0.28'].speed);
checks.push('Vent réel : départ moteur coupé de la brise à l’orage ; calme sans poussée ni voile gonflée');
for(const degrees of [0,30,45,60,90,135,180]){
 const cap=PI-degrees*PI/180,f=fixture(cap),r=run(f,12);measurements['point-'+degrees]=r;
 if(degrees<=30){near(r.speed,0);near(r.distance,0);near(r.load,0);}
 else{assert(r.speed>.25,`${degrees}° speed`);assert(r.distance>2,`${degrees}° travel`);}
 const mirror=fixture(PI+degrees*PI/180),r2=run(mirror,12);near(r.speed,r2.speed,1e-8);near(r.distance,r2.distance,1e-8);
}
checks.push('Allures et amures : pas de propulsion face au vent ; remontée au près par deux bords, travers et vent arrière symétriques');
{
 const q={cap:0,speed:0,sailAngle:1.35,sailDeployment:1},left=M.sailDrive(q,{wind:.8,windDirection:-1e-6}),right=M.sailDrive(q,{wind:.8,windDirection:1e-6});
 assert(left.force>1&&right.force>1);near(left.force,right.force,1e-8);near(left.load,right.load,1e-8);near(left.idealAngle,right.idealAngle);near(left.trimError,right.trimError);
 const stern=fixture(0);stern.q.sailAngle=1.35;run(stern,.01,{}, {wind:.8,windDirection:-1e-6});const cloth=stern.m.geometry().filter(m=>m.sail).map(m=>m.shape);run(stern,.01,{}, {wind:.8,windDirection:1e-6});assert.deepEqual(stern.m.geometry().filter(m=>m.sail).map(m=>m.shape),cloth);
 const a=fixture(PI/2),b=fixture(PI/2);b.q.sailAngle=-1.3;assert(run(b,10).distance<run(a,10).distance*.3);
 const flat=fixture(PI/2,undefined,0);near(run(flat,10).distance,0);near(flat.q.load,0);assert(flat.q.luffing);
 const half=fixture(PI/2,undefined,.5),full=fixture();assert(run(half,10).distance<run(full,10).distance*.85);
}
checks.push('Réglage de voile : mauvaise orientation, réduction, affalage et passage arrière +/-π cohérents');
{
 const f=fixture();run(f,2);const before={x:f.q.x,z:f.q.z};f.obstacles.push({x:f.q.x,z:f.q.z+M.kinds.sailboat.length/2+.2,a:4,b:.1,c:1,s:0,minY:M.SEA_LEVEL-1,maxY:M.SEA_LEVEL+1});run(f,1);
 assert(f.q.blocked&&f.m.sailing.blocked);assert(f.q.z-before.z<.2);assert(f.q.force>0&&f.q.load>0,'Collision must not fake a lack of wind');
 f.obstacles.length=0;run(f,2);assert(!f.q.blocked&&f.q.z>before.z+.5);
}
checks.push('Obstacle réel : poussée conservée et blocage explicitement signalé ; départ possible après dégagement');
{
 const f=fixture(PI/2,{wind:0,windDirection:0});f.q.sailDeployment=0;run(f,8);
 const first={y:f.q.y,pitch:f.q.pitch,roll:f.q.roll};run(f,2);assert(Math.abs(f.q.y-first.y)>1e-4);assert(Math.abs(f.q.pitch-first.pitch)+Math.abs(f.q.roll-first.roll)>1e-4);
 const wave=M.seaHeight(f.q.x,f.q.z,f.t,0,0);assert(Math.abs(f.q.y-wave)<.08);assert(f.q.y<-.9,'Hull must not float 1.2m above the port');
 const hull=f.m.geometry().find(m=>m.shape==='emprise-hull-sailboat');assert(hull);const bottom=hull.p[1]-hull.s[1]/2,top=hull.p[1]+hull.s[1]/2;assert(bottom<wave-.15&&top>wave+.15);
 f.q.sailDeployment=1;f.q.roll=0;f.q.rollRate=0;f.q.pitchRate=0;run(f,1,{}, {wind:.8,windDirection:0});assert(f.q.roll<-.01,'Wind from starboard heels to port');
 assert(Math.abs(f.q.roll)<.32&&Math.abs(f.q.pitch)<.22);const cam=f.m.camera(f.p);assert(cam.pos[1]>f.q.y+.9&&cam.pos[1]<f.q.y+1.6);
 const q=fixture(-PI/2);run(q,1);assert(q.q.roll>.01,'Opposite tack heels the opposite way');
 const g=q.m.geometry().filter(m=>m.sail);assert(g.every(m=>m.shape.endsWith('starboard')));
 f.m.leave();Object.assign(f.p,{x:50,z:50});assert(f.m.enterWater(f.p));run(f,.25);const sea=M.seaHeight(50,50,f.t,0,0);near(f.m.camera(f.p).pos[1],sea+.39,1e-8);near(f.p.y,sea-1.16,1e-8);
}
checks.push('Flottaison : niveau −1,25m, coque immergée, houle spatiale commune, gîte sous le vent et caméra embarquée/nage raccordées');
{
 const f=fixture();run(f,3);f.m.setControl('trim');f.q.sailDeployment=.5;f.q.sailAngle=-.4;const saved=f.m.save(),restored=M.create(f.world,{saved}),p={x:0,z:0,y:0,yaw:0,pitch:0};restored.restore(p);
 assert.equal(restored.mode,'boat');assert.equal(restored.boat.control,'trim');assert.equal(restored.boat.sailAngle,-.4);assert.equal(restored.boat.sailDeployment,.5);assert(!restored.boat.engineOn);near(restored.boat.speed,0);
 for(let i=0;i<120;i++)restored.update(1/120,{},p,f.weather);assert([...Object.values(restored.camera(p)).filter(v=>typeof v==='number'),...restored.camera(p).pos].every(Number.isFinite));
}
checks.push('Sauvegarde : poste, cap, position, voile et moteur conservés ; états transitoires de flottaison finis à la reprise');
// Regression of the actual Marseille berth: the old canot lay only 2.93m ahead.
{
 const s=RADE.session.create({pedestrians:0}),m=s.marine,q=m.boats.find(b=>b.kind==='sailboat'),p=s.player,k=M.kinds.sailboat;
 for(const b of m.boats)for(let d=0;d<=24;d+=.5)assert(m.hull(b.x+Math.cos(b.cap)*d,b.z+Math.sin(b.cap)*d,b.cap,M.kinds[b.kind],b),`${b.kind} initial departure at ${d}m`);
 const start={x:q.x,z:q.z};Object.assign(p,{x:q.x,z:q.z});assert(m.enterWater(p));assert(s.interact());assert.equal(s.mode,'boat');assert(!q.engineOn);
 for(let i=0;i<2400;i++)m.update(1/120,{},p,s.weather.state);
 const distance=Math.hypot(q.x-start.x,q.z-start.z);assert(distance>8&&q.speed>.4&&!q.blocked,JSON.stringify({distance,speed:q.speed,blocked:q.blocked}));assert(m.hull(q.x,q.z,q.cap,k,q));
 measurements.marseille={start,end:{x:q.x,z:q.z},seconds:20,distance,speed:q.speed,engineOn:q.engineOn,load:q.load,force:q.force,blocked:q.blocked,waterLevel:M.SEA_LEVEL,hullY:q.y};
}
checks.push('Vrai spawn Marseille : 24m navigables pour chaque embarcation, puis 20s de départ sous voile sans canot en travers');
const report={checks,measurements,limits:'Modèle de voile et de flottaison conçu pour le jeu ; polaire, traînée et trois composantes de houle procédurales, sans simulation hydrodynamique volumique.'};
fs.writeFileSync(new URL('../docs/sailing-physics.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
