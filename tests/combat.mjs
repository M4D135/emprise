import './load.mjs';import assert from 'node:assert/strict';import fs from 'node:fs';
const checks=[],report={checks};
function fixture({walls=[],enemies=[{x:0,z:-10,type:0,gang:1,yaw:Math.PI}],spawn={x:0,z:10,yaw:0},size=35,cell=1}={}){
 const box=q=>({...q,x:(q.minX+q.maxX)/2,z:(q.minZ+q.maxZ)/2,a:(q.maxX-q.minX)/2,b:(q.maxZ-q.minZ)/2,c:1,s:0});
 const blocked=(x,z,r=.28,y=0,h=1.8)=>Math.abs(x)+r>size||Math.abs(z)+r>size||walls.some(q=>q.maxY>y+.05&&q.minY<y+h&&(x-Math.max(q.minX,Math.min(q.maxX,x)))**2+(z-Math.max(q.minZ,Math.min(q.maxZ,z)))**2<r*r);
 const ray=(o,d,far)=>{let hit=far;for(const q of walls){let lo=0,hi=hit;for(let k=0;k<3;k++){const min=[q.minX,q.minY,q.minZ][k],max=[q.maxX,q.maxY,q.maxZ][k];if(Math.abs(d[k])<1e-9){if(o[k]<min||o[k]>max){hi=-1;break;}}else{let a=(min-o[k])/d[k],b=(max-o[k])/d[k];if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);}}if(hi>=lo&&lo>=0)hit=Math.min(hit,lo);}return hit;};
 const world={seed:135,stage:0,generation:6,combat:true,navCell:cell,bounds:{minX:-size,maxX:size,minZ:-size,maxZ:size},spawn,enemies:enemies.map(q=>({y:0,...q})),colliders:[],cores:[],pickups:[],exit:{x:size-1,z:size-1},spatial:{ground:()=>0,blocked,ray,coverBoxes:()=>new Set(walls.map(box))}};
 const sim=FSimulation.create(world),events=[],bounds={expansions:0,requests:0,cover:0};
 function tick(seconds,input={}){for(let i=0;i<Math.ceil(seconds*120);i++){sim.step(1/120,input);events.push(...sim.state.events.splice(0));const s=sim.state.aiStats;bounds.expansions=Math.max(bounds.expansions,s.pathExpansions);bounds.requests=Math.max(bounds.requests,s.pathSearches);bounds.cover=Math.max(bounds.cover,s.coverChecks);assert(s.pathExpansions<=1536);assert(s.pathSearches<=2);assert(s.coverChecks<=24);for(const e of sim.state.enemies)if(e.hp>0)assert(!blocked(e.x,e.z,.35),'actor must not cross a real spatial wall');}}
 return {sim,world,walls,events,tick,bounds,p:sim.state.player,e:sim.state.enemies[0]};
}
const wall=(x0,x1,z0,z1,h=3)=>({minX:x0,maxX:x1,minZ:z0,maxZ:z1,minY:0,maxY:h});
// These solids exist only in spatial callbacks, exactly like the real city.
{
 const f=fixture({walls:[wall(-4,4,-.25,.25)]});
 assert.equal(f.sim.nav.canTraverse(0,-10,0,10,.38),false);
 f.tick(2,{fire:true});assert.equal(f.e.hp,f.e.maxHp);assert(!f.e.seen);assert(!f.events.some(e=>e.name==='enemyShot'));
 // A witnessed location is enough to navigate around the obstacle, never through it.
 Object.assign(f.e,{hasMemory:true,lastSeenX:0,lastSeenY:1.45,lastSeenZ:10,memory:8,awareness:'search',thinkWait:0});
 f.p.hp=100;f.tick(10);assert(f.e.seen,'guard finds a legal route around a wall and reacquires');assert(f.events.some(e=>e.name==='enemyShot'));
 report.routing=f.bounds;checks.push('Collisions spatiales réelles : tir bloqué puis route autour du mur, réacquisition et riposte');
}
{
 const f=fixture();let told=false;
 for(let i=0;i<360&&!told;i++){f.tick(1/120);told=f.e.attackState==='aim';}
 assert(told);assert(f.e.windup>.4,'attack is telegraphed');f.walls.push(wall(-20,20,-.25,.25));
 const shots=f.events.filter(e=>e.name==='enemyShot').length;f.tick(1);
 assert.equal(f.events.filter(e=>e.name==='enemyShot').length,shots);assert(f.sim.state.aiStats.shotBlocked>0);
 const memory=[f.e.lastSeenX,f.e.lastSeenZ];f.p.x=15;f.tick(.6);assert.deepEqual([f.e.lastSeenX,f.e.lastSeenZ],memory);
 f.p.x=0;f.walls.length=0;f.tick(4);assert(f.events.filter(e=>e.name==='enemyShot').length>shots);
 checks.push('Visée télégraphiée : mur ajouté avant le tir annule le départ ; mémoire figée puis reprise visible');
}
{
 const f=fixture({enemies:[{x:0,z:-10,type:2,gang:1,yaw:Math.PI}]});
 for(let i=0;i<600&&!f.e.burstLeft;i++)f.tick(1/120);
 assert(f.e.burstLeft>0);const shots=f.events.filter(e=>e.name==='enemyShot').length;f.walls.push(wall(-20,20,-.25,.25));f.tick(.5);
 assert.equal(f.events.filter(e=>e.name==='enemyShot').length,shots);assert.equal(f.e.burstLeft,0);
 checks.push('Rafale : chaque balle revérifie le mur et interrompt la rafale obstruée');
}
{
 const f=fixture({walls:[wall(2,3.4,-2,2)],enemies:[{x:0,z:0,type:0,gang:1,yaw:Math.PI}],spawn:{x:0,z:12,yaw:0}});
 f.tick(.3);assert(f.e.seen);let pressure=0,cover=false;
 for(let n=0;n<75;n++){
  const dx=f.e.x+.9-f.p.x,dz=f.e.z-f.p.z;f.p.yaw=Math.atan2(dx,-dz);f.tick(1/120,{fire:n%22===0});
  pressure=Math.max(pressure,f.e.suppression);cover||=f.e.tactic==='cover';
 }
 assert(pressure>.6,'visible near miss causes pressure');assert(cover,'pressure makes a guard use real spatial cover: '+JSON.stringify({e:f.e,stats:f.sim.state.aiStats}));
 assert(!f.sim.sight(f.p.x,f.p.z,f.e.goalX,f.e.goalZ,1.45,1.35),'chosen cover actually occludes the threat');
 checks.push('Tir proche visible : pression, choix d’un couvert réel et maintien derrière le couvert');
 // Pressure and injury state survive a tactical checkpoint, including long injured-arm tells.
 f.e.injury={arm:true};f.e.suppression=.75;f.e.windup=f.e.windupMax=1.44;
 const snap=f.sim.snapshot();assert.equal(snap.aiVersion,4);assert(f.sim.restore(snap));assert.equal(f.sim.state.enemies[0].suppression,.75);assert(f.sim.state.enemies[0].injury.arm);
 const a=fixture({walls:[wall(2,3.4,-2,2)],enemies:[{x:0,z:0,type:0,gang:1,yaw:Math.PI}],spawn:{x:0,z:12,yaw:0}});assert(a.sim.restore(snap));
 for(let i=0;i<120;i++){f.sim.step(1/120,{});a.sim.step(1/120,{});}assert.deepEqual(f.sim.snapshot(),a.sim.snapshot());
 const legacy=structuredClone(snap);legacy.aiVersion=3;for(const e of legacy.state.enemies){delete e.suppression;delete e.injury;e.windup=e.windupMax=.5;}
 assert(a.sim.restore(legacy));assert.equal(a.sim.state.enemies[0].suppression,0);
 checks.push('Checkpoint v4 : suppression/blessures conservées, continuation identique, reprise v3 acceptée');
}
{
 const low=[wall(-8,8,-3,-2.7,1.1)],standing=fixture({walls:low}),prone=fixture({walls:low});prone.e.injury={leg:true};
 standing.tick(.2);prone.tick(.2);assert(standing.e.seen);assert(!prone.e.seen,'prone eye cannot see above low cover');
 const f=fixture();f.e.injury={leg:true};Object.assign(f.e,{rushTime:.4,dodgeTime:.3,dodgeDelay:0,cooldown:20});const old={x:f.e.x,z:f.e.z};f.tick(2);
 assert.equal(f.e.rushTime,0);assert.equal(f.e.dodgeTime,0);assert(f.e.stuck<.2,'slow crawling is not counted as stuck');assert(Math.hypot(f.e.x-old.x,f.e.z-old.z)<1);
 assert.equal(f.e.y,.4);const snap=f.sim.snapshot();assert(f.sim.restore(snap));assert(f.sim.state.enemies[0].injury.leg);assert.equal(f.sim.state.enemies[0].y,.4);
 checks.push('Jambe blessée : yeux bas, déplacement rampant, ni charge ni esquive ni faux blocage');
}
{
 const f=fixture({walls:[wall(-.2,.2,-34,34)],enemies:Array.from({length:16},(_,i)=>({x:-12-i%4*2,z:-12+Math.floor(i/4)*4,type:0,gang:1,yaw:Math.PI})),spawn:{x:12,z:10,yaw:0}});
 for(const e of f.sim.state.enemies)Object.assign(e,{hasMemory:true,lastSeenX:12,lastSeenY:1.45,lastSeenZ:10,memory:8,awareness:'search',thinkWait:0});
 const start=performance.now();f.tick(3);report.stress={...f.bounds,milliseconds:Math.round(performance.now()-start),actors:16,seconds:3};
 assert(f.bounds.expansions>0);assert(f.bounds.expansions<=1536);assert(f.sim.state.aiStats.maxPathExpansions<=768);
 checks.push('16 adversaires et mur long : maximum 2 routes / 1536 expansions et 24 candidats de couvert par tick');
}
{
 const f=fixture({walls:[wall(-34,34,-.25,.25)]});
 Object.assign(f.e,{hasMemory:true,lastSeenX:0,lastSeenY:1.45,lastSeenZ:10,memory:8,awareness:'search',thinkWait:0});
 f.p.x=15;f.tick(9.5);assert(!f.e.hasMemory);assert.equal(f.e.awareness,'patrol');assert(!f.e.seen);
 checks.push('Mémoire expirée après occultation prolongée : retour à la patrouille sans suivre le joueur caché');
}
fs.writeFileSync(new URL('../docs/combat-acceptance.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
