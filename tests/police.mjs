/* RADE — deterministic police acceptance: perception, search bounds, arrest contract. */
import './load.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const report={checks:[],fixtures:[]};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function makeWorld({roads='grid',size=210}={}){
 const walls=[],fleet=[];
 const world={
  fleet,walls,car:{x:-500,z:-500},weather:null,playerSeated:false,
  ground:()=>.08,
  surface:()=>({mu:1.15,type:'piste'}),
  city:{rues:{aretes:[]}},
  blocked(x,z,r=.28){
   if(Math.abs(x)>size||Math.abs(z)>size)return true;
   for(const w of walls)if(Math.abs(x-w.x)<w.hx+r&&Math.abs(z-w.z)<w.hz+r)return true;
   return false;
  },
  withoutCar(fn){return fn();},
  carContact(){return null;},
  moveVehicle(c,dx,dz,cap){
   const x=c.x+dx,z=c.z+dz;
   if(world.blocked(x,z,.18))return {nx:-Math.cos(cap),nz:-Math.sin(cap),depth:.1};
   c.x=x;c.z=z;c.cap=cap;
   return null;
  },
  pedestrians:[]
 };
 if(roads==='grid'){
  for(let x=-60;x<=60;x+=20)world.city.rues.aretes.push({sorte:'rue',largeur:6,points:[x,-60,x,60]});
  for(let z=-60;z<=60;z+=20)world.city.rues.aretes.push({sorte:'rue',largeur:6,points:[-60,z,60,z]});
 }else if(roads==='line'){
  world.city.rues.aretes.push({sorte:'rue',largeur:6,points:[-60,0,60,0]});
 }else if(roads==='disconnected'){
  for(let i=0;i<120;i++){
   const x=(i%15)*30-210,z=Math.floor(i/15)*30-120;
   world.city.rues.aretes.push({sorte:'rue',largeur:6,points:[x,z,x+14,z]});
  }
 }
 return world;
}

function addWall(world,x,z,hx=.8,hz=3){world.walls.push({x,z,hx,hz});}

function lawState(wanted=0){
 return {heat:wanted,wanted,seen:false,lastKnown:null,quiet:0,arrest:0,mode:wanted?'recherche':'calme',reportRevision:0,cooldown:0,lastArrest:null};
}
function sendReport(law,x,z,wanted=law.wanted||1){
 law.reportRevision=(law.reportRevision||0)+1;
 law.lastKnown={x,z};
 law.heat=Math.max(law.heat,wanted);
 law.wanted=Math.max(law.wanted,wanted);
}
function policeCars(t){return t.cars.filter(c=>c.police);}
function placePolice(t,index,x,z,cap=0){
 const c=policeCars(t)[index];
 Object.assign(c,{
  x,z,cap,u:0,w:0,v:0,omega:0,ai:true,state:'patrol',role:'patrol',path:[],pathGoal:null,
  pathSetAt:-99,routeAt:0,reverse:0,progressClock:0,progressMoved:0,commandMoving:false,
  searchNode:-1,searchNodeUntil:0,searchStep:0,sensorAt:0,sensorPrev:null,
  visibleAt:-999,visibleNow:false
 });
 const id=t.nearest(x,z),n=t.nodes[id];
 if(n&&n.links.length){c.node=n.links[0];c.prev=id;}
 return c;
}
function parkOthers(t,keep){
 for(const c of policeCars(t))if(c!==keep){c.ai=false;c.x=-400;c.z=-400;c.v=0;}
}
function runTraffic(t,law,player,seconds,dt=.05,checkTeleport=true){
 const start=t.time,previous=new Map();
 for(const c of t.cars)previous.set(c,{x:c.x,z:c.z});
 while(t.time-start<seconds){
  t.update(dt,law,player);
  if(checkTeleport)for(const c of t.cars){
   const q=previous.get(c),d=Math.hypot(c.x-q.x,c.z-q.z);
   assert(d<1.2,'teleport '+c.id+' '+d);
   previous.set(c,{x:c.x,z:c.z});
  }
 }
}

// 1. Real session: stable spawn counts and deterministic initial random draws.
const s1=RADE.session.create({pedestrians:0}),s2=RADE.session.create({pedestrians:0});
assert.equal(s1.traffic.cars.length,15);
assert.equal(s1.traffic.cars.filter(c=>c.police).length,3);
assert.equal(s1.traffic.cars.filter(c=>!c.police).length,12);
const snapshot=t=>t.cars.map(c=>[c.model,c.police,Math.round(c.x*1e6),Math.round(c.z*1e6),Math.round(c.cap*1e6)]);
assert.deepEqual(snapshot(s1.traffic),snapshot(s2.traffic));
assert.equal(s1.traffic.nodes.length,s2.traffic.nodes.length);
assert.equal(s1.traffic.edges.length,s2.traffic.edges.length);
report.fixtures.push({test:'12 civils + 3 policiers, graphe et tirages initiaux identiques',cars:s1.traffic.cars.length,nodes:s1.traffic.nodes.length,edges:s1.traffic.edges.length});
report.checks.push('Initialisation déterministe : 12 civils, 3 policiers, mêmes positions et même graphe');

// 2. Seeing, frozen last-known point, local search and disengagement.
{
 const world=makeWorld({roads:'grid'}),t=RADE.traffic.create(world,{count:0});
 const cop=placePolice(t,0,0,0,0);parkOthers(t,cop);
 const player={x:0,z:12};
 const law=lawState(1);sendReport(law,player.x,player.z,1);
 runTraffic(t,law,player,7.2);
 const seen=t.intel;
 assert(seen.valid&&Math.abs(seen.x-0)<.2&&Math.abs(seen.z-12)<.2,'seen point');
 assert(law.seen,'aggregate law.seen');
 assert(cop.state==='pursuit'||cop.state==='search','active officer');
 player.x=150;player.z=150;
 runTraffic(t,law,player,1);
 const frozen=t.intel;
 assert(Math.abs(frozen.x-0)<.2&&Math.abs(frozen.z-12)<.2,'last-known must stay frozen');
 assert.equal(law.seen,false,'seen clears after occlusion');
 assert(cop.state==='search','officer searches after lost line of sight');
 for(let i=0;i<320&&cop.searchNode<0;i++)t.update(.05,law,player);
 assert(cop.searchNode>=0,'deterministic road search target');
 const searchNode=t.nodes[cop.searchNode];
 assert(Math.hypot(searchNode.x-frozen.x,searchNode.z-frozen.z)<115,'search target near last-known');
 assert(Math.hypot(searchNode.x-player.x,searchNode.z-player.z)>40,'search target never uses hidden player position');
 report.fixtures.push({test:'Ligne de vue réelle, point figé puis recherche locale',lastKnown:frozen,searchNode:[searchNode.x,searchNode.z],hidden:[player.x,player.z]});
 report.checks.push('Vision réelle : point mémorisé figé hors ligne de vue, recherche routière locale, jamais la position cachée');
 runTraffic(t,law,player,27);
 assert(cop.state==='patrol'||cop.state==='disengage','search must clear in 22-32 s');
 assert.equal(t.intel.valid,false,'radio memory clears after bounded search');
 report.checks.push('Recherche bornée : mémoire et poursuite retombent après 22–32 s selon le niveau');
 sendReport(law,0,30,1);
 runTraffic(t,law,player,.4);
 assert(t.intel.valid&&Math.abs(t.intel.x)<.3&&Math.abs(t.intel.z-30)<.3,'fresh crime report reactivates');
 assert(t.cars.some(c=>c.police&&(c.state==='pursuit'||c.state==='search')),'fresh crime restarts responders');
 report.checks.push('Nouvelle infraction explicite : la mémoire et la poursuite repartent');
 const stamp=t.intel.time;
 runTraffic(t,law,player,2);
 assert.equal(t.intel.time,stamp,'radio must not renew an unseen timestamp');
 report.checks.push('Radio : un autre équipage ne rajeunit pas un point jamais revu');
 placePolice(t,0,0,30,0);player.x=0;player.z=40;
 runTraffic(t,law,player,.6);
 assert(t.intel.valid&&Math.abs(t.intel.x-0)<.2&&Math.abs(t.intel.z-40)<.2,'actual LOS reacquires');
 assert(law.seen,'reacquisition sets seen');
 report.checks.push('Réacquisition uniquement par ligne de vue réelle');
}

// 3. Wanted levels and distinct coordinated road goals.
{
 const world=makeWorld({roads:'grid'}),t=RADE.traffic.create(world,{count:0});
 const player={x:150,z:150};
 const law=lawState(1);sendReport(law,0,0,1);
 runTraffic(t,law,player,6.3);
 const count=()=>t.cars.filter(c=>c.police&&(c.state==='pursuit'||c.state==='search')).length;
 assert.equal(count(),1,'wanted 1 -> one responder');
 law.wanted=law.heat=2;runTraffic(t,law,player,.2);
 assert.equal(count(),2,'wanted 2 -> two responders');
 law.wanted=law.heat=3;runTraffic(t,law,player,.2);
 assert.equal(count(),3,'wanted 3 -> three responders');
 const interceptors=t.cars.filter(c=>c.police&&c.role==='interceptor');
 assert.equal(interceptors.length,2);
 assert.notEqual(interceptors[0].searchNode,interceptors[1].searchNode,'distinct interceptor nodes');
 assert(t.metrics.maxPathExpansions<=320,'route expansion cap');
 report.fixtures.push({test:'Niveaux de recherche et objectifs distincts',wanted:3,roles:t.cars.filter(c=>c.police).map(c=>[c.id,c.role,c.searchNode]),metrics:{...t.metrics}});
 report.checks.push('1/2/3 équipages selon la recherche ; chauffeur et intercepteurs ont des nœuds routiers distincts');
 law.wanted=law.heat=0;runTraffic(t,law,player,.2);
 assert.equal(count(),0,'wanted zero -> patrol');
 assert(t.cars.filter(c=>c.police).every(c=>c.state==='patrol'),'all patrol');
 assert.equal(t.intel.valid,false,'wanted zero clears memory');
 report.checks.push('Recherche à zéro : mémoire effacée et patrouilles normales');
}

// 4. Bounded routing on a large disconnected graph and replan cadence.
{
 const world=makeWorld({roads:'disconnected',size:260}),t=RADE.traffic.create(world,{count:0});
 const ids=t.nodes.filter(n=>n.links.length).map(n=>t.nodes.indexOf(n));
 const a=t.nodes[ids[0]],b=t.nodes[ids[ids.length-1]];
 const before={...t.metrics};
 for(let i=0;i<8;i++)assert.deepEqual(t.route(a.x,a.z,b.x,b.z),[]);
 const used=t.metrics.pathExpansions-before.pathExpansions;
 assert(t.metrics.maxPathExpansions<=320);
 assert(used<=8*320);
 report.fixtures.push({test:'Graphe large déconnecté : recherche de route plafonnée',requests:8,expansions:used,max:t.metrics.maxPathExpansions});
 report.checks.push('Route bornée : 320 expansions maximum, aucun parcours complet du graphe');

 const grid=makeWorld({roads:'grid'}),g=RADE.traffic.create(grid,{count:0});
 const law=lawState(3);sendReport(law,0,0,3);const player={x:150,z:150};
 const start={...g.metrics};
 runTraffic(g,law,player,8);
 const rate=g.metrics.pathRequests-start.pathRequests;
 assert(rate<=3*8+6,'at most one route request per car per second');
 assert(g.metrics.maxPathExpansions<=320);
 report.fixtures.push({test:'Cadence de replanification sur 8 s',requests:rate,seconds:8,max:g.metrics.maxPathExpansions});
 report.checks.push('Replanification étalée : au plus une demande de route par voiture et par seconde');
}

// 5. Recovery, brake release, intentional waiting and rear safety.
{
 const world=makeWorld({roads:'line'}),t=RADE.traffic.create(world,{count:0});
 const cop=placePolice(t,0,-20,0,0);parkOthers(t,cop);
 const player={x:150,z:150},law=lawState(1);sendReport(law,30,0,1);
 addWall(world,0,0,.9,4);
 let maxReverse=0,slow=false;
 const start=t.time;
 while(t.time-start<18){
  t.update(.05,law,player);
  maxReverse=Math.max(maxReverse,cop.reverse);
  slow||=cop.x<3&&cop.v<.8;
 }
 assert(t.metrics.recoveries>0,'blocked route triggers a bounded recovery');
 assert(maxReverse>0,'clear rear allows a short reverse');
 assert(maxReverse<=1.01,'reverse is finite');
 assert(slow,'lookahead braking stops the car before the wall');
 report.fixtures.push({test:'Route bloquée : freinage, marche arrière finie',recoveries:t.metrics.recoveries,maxReverse,cop:[cop.x,cop.z]});
 report.checks.push('Mur statique : freinage anticipé, marche arrière bornée à une seconde puis reprise');
 world.walls.length=0;
 let released=false;const releaseStart=t.time;
 while(t.time-releaseStart<6){t.update(.05,law,player);if(cop.v>1.2)released=true;}
 assert(released,'brake releases after the obstruction is removed');
 report.checks.push('Le frein se relâche dès que l’obstacle disparaît');

 const rearWorld=makeWorld({roads:'line'}),rear=RADE.traffic.create(rearWorld,{count:0});
 const blocked=placePolice(rear,0,-20,0,0);parkOthers(rear,blocked);
 const rearLaw=lawState(1);sendReport(rearLaw,30,0,1);
 addWall(rearWorld,0,0,.9,4);
 let unsafeReverse=0,rearAdded=false;
 const rearStart=rear.time;
 while(rear.time-rearStart<18){
  if(!rearAdded&&blocked.x>-3&&blocked.x<0&&blocked.v<.3){addWall(rearWorld,blocked.x-3.1,0,.8,4);rearAdded=true;}
  rear.update(.05,rearLaw,player);unsafeReverse=Math.max(unsafeReverse,blocked.reverse);
 }
 assert.equal(unsafeReverse,0,'never reverse into a blocked rear');
 report.fixtures.push({test:'Sécurité arrière : aucun recul dans un obstacle',recoveries:rear.metrics.recoveries,reverse:unsafeReverse});
 report.checks.push('Recul refusé quand l’arrière est bloqué');

 const stopWorld=makeWorld({roads:'line'}),stopT=RADE.traffic.create(stopWorld,{count:0});
 const holder=placePolice(stopT,0,0,0,0);parkOthers(stopT,holder);
 const nearPlayer={x:0,z:4},stopLaw=lawState(1);sendReport(stopLaw,nearPlayer.x,nearPlayer.z,1);
 runTraffic(stopT,stopLaw,nearPlayer,7.2,.05,false);
 const recoveryBase=stopT.metrics.recoveries;
 let waitingReverse=0;
 const waitStart=stopT.time;
 while(stopT.time-waitStart<6){stopT.update(.05,stopLaw,nearPlayer);waitingReverse=Math.max(waitingReverse,holder.reverse);}
 assert.equal(waitingReverse,0,'intentional arrest stop never reverses');
 assert.equal(stopT.metrics.recoveries,recoveryBase,'intentional stop is not a stuck recovery');
 report.checks.push('Arrêt volontaire près du joueur : aucune marche arrière ni fausse panne');
}

// 6. Arrest contract: LOS, range, speed, cooldown and fresh crime.
{
 const world=makeWorld({roads:'grid'}),t=RADE.traffic.create(world,{count:0});
 const cop=placePolice(t,0,0,0,0);parkOthers(t,cop);
 const player={x:0,z:4},law=lawState(1);sendReport(law,player.x,player.z,1);
 let status=null;
 for(let i=0;i<400&&!status?.eligible;i++){t.update(.05,law,player);status=t.arrestStatus(player,{seated:false});}
 assert(status.eligible,'arrest allowed with real LOS, range, stopped officer');
 assert.equal(status.stationId,null);
 report.fixtures.push({test:'Contrat d’interpellation',eligible:status});
 report.checks.push('Interpellation valide : agent en poursuite, ligne de vue, distance et vitesse réelles');

 player.z=9;t.update(.1,law,player);
 status=t.arrestStatus(player,{seated:false});assert(!status.eligible,'range');
 addWall(world,0,5,.3,2);player.z=4;t.update(.1,law,player);
 status=t.arrestStatus(player,{seated:false});assert(!status.eligible,'LOS');world.walls.length=0;
 player.z=4;t.update(.1,law,player);
 status=t.arrestStatus(player,{seated:true,speed:2});assert.equal(status.reason,'speed');
 status=t.arrestStatus(player,{seated:true,speed:1});assert(status.eligible);
 law.cooldown=5;status=t.arrestStatus(player,{seated:false});
 assert.equal(status.reason,'cooldown');
 sendReport(law,player.x,player.z,1);t.update(.2,law,player);
 assert.equal(t.arrestStatus(player,{seated:false}).reason,'cooldown','cooldown blocks even a fresh crime');
 law.cooldown=0;status=t.arrestStatus(player,{seated:false});
 assert(status.eligible,'fresh crime is eligible after cooldown');
 report.checks.push('Interpellation refusée hors ligne de vue, hors portée, en vitesse ou pendant le délai');
}

// 7. Campaign cooldown and bounded save/restore.
{
 const s=RADE.session.create({pedestrians:0});
 s.campaign.crime(1);
 const revision=s.campaign.law.reportRevision;
 assert(revision>=1);
 const fine=s.campaign.arrest();
 assert(fine>0);
 assert.equal(s.campaign.law.wanted,0);
 assert.equal(s.campaign.law.cooldown,10);
 assert.equal(s.campaign.law.lastArrest.fine,fine);
 s.campaign.crime(1);
 assert(s.campaign.law.wanted>0);
 assert.equal(s.campaign.arrest(),0,'arrest refused during cooldown');
 assert(s.campaign.law.wanted>0,'cooldown does not silently clear a fresh crime');
 s.campaign.tick(1,[]);
 assert(s.campaign.law.cooldown<10&&s.campaign.law.cooldown>8.9,'cooldown decreases');
 const saved=s.save();
 assert.equal(saved.law.reportRevision,s.campaign.law.reportRevision);
 const restored=RADE.session.create({pedestrians:0,saved,now:saved.savedAt});
 assert.equal(restored.campaign.law.reportRevision,saved.law.reportRevision);
 assert(Math.abs(restored.campaign.law.cooldown-saved.law.cooldown)<1e-9);
 assert.equal(restored.campaign.law.lastArrest.fine,fine);
 const corrupt=structuredClone(saved);corrupt.law.cooldown='x';corrupt.law.reportRevision='x';corrupt.law.lastArrest={fine:'x',time:null};
 assert.doesNotThrow(()=>{const q=RADE.session.create({pedestrians:0,saved:corrupt});q.update(1/120,{});assert(Number.isFinite(q.campaign.law.cooldown));assert(Number.isFinite(q.campaign.law.reportRevision));});
 report.fixtures.push({test:'Délai d’interpellation et sauvegarde bornée',fine,revision:saved.law.reportRevision,cooldown:saved.law.cooldown});
 report.checks.push('Cooldown de 10 s, infraction nouvelle pendant le délai, sauvegarde/reprise bornée');
}

// 8. Integrated real-world session: one real shot, actual pursuit and arrest < 90 s.
{
 const s=RADE.session.create({pedestrians:0});
 s.update(1/120,{fire:true});
 assert(s.campaign.law.wanted>0);
 const previous=new Map(s.traffic.cars.filter(c=>c.police).map(c=>[c,{x:c.x,z:c.z}]));
 let arrestTime=null,minDistance=Infinity,saw=false,maxJump=0,eligible=0;
 for(let i=0;i<120*90;i++){
  s.update(1/120,{});
  for(const c of s.traffic.cars.filter(c=>c.police)){
   const q=previous.get(c),jump=Math.hypot(c.x-q.x,c.z-q.z);maxJump=Math.max(maxJump,jump);
   previous.set(c,{x:c.x,z:c.z});
   minDistance=Math.min(minDistance,Math.hypot(c.x-s.player.x,c.z-s.player.z));
  }
  saw||=s.campaign.law.seen;
  const status=s.traffic.arrestStatus(s.player,{seated:s.mode==='car',speed:s.car.v});
  if(status.eligible)eligible++;
  if(s.history.some(e=>e.text.includes('Interpellé'))){arrestTime=s.time;break;}
 }
 assert(saw,'law.seen during pursuit');
 assert(arrestTime&&arrestTime<90,'arrest within 90 s');
 assert(minDistance<6,'police reaches arrest range');
 assert(minDistance>3.8,'approach brakes before reaching the player');
 assert.equal(s.campaign.law.wanted,0);
 assert.equal(s.campaign.state.cash,120);
 assert(maxJump<2,'no police teleport');
 assert(s.campaign.law.cooldown>0&&s.campaign.law.lastArrest);
 const blocked=s.traffic.arrestStatus(s.player,{seated:s.mode==='car',speed:s.car.v});
 assert.equal(blocked.reason,'cooldown');
 s.campaign.crime(1);
 assert(s.campaign.law.wanted>0);
 assert.equal(s.traffic.arrestStatus(s.player,{seated:false}).reason,'cooldown');
 report.fixtures.push({test:'Session réelle : tir, poursuite, interpellation',arrestTime,minDistance,maxJump,eligibleFrames:eligible});
 report.checks.push('Session réelle : un tir déclenche la poursuite et l’interpellation réelle en moins de 90 s');
}


// Review fixtures cover actual wall occlusion and a saturated route budget.
{
 const w=makeWorld(),t=RADE.traffic.create(w,{count:0}),c=placePolice(t,0,0,0,0);parkOthers(t,c);
 const player={x:0,z:12},law=lawState(1);sendReport(law,0,12);runTraffic(t,law,player,7.2);
 const remembered=t.intel;
 addWall(w,(c.x+player.x)/2,(c.z+player.z)/2,10,.35);
 player.x+=1;
 assert(!t.clearLine(c,player,.3),'a wall, not range, hides the nearby player');
 runTraffic(t,law,player,1);
 assert.equal(law.seen,false);assert.equal(t.intel.time,remembered.time);assert.equal(t.intel.x,remembered.x);
 w.walls.length=0;runTraffic(t,law,player,.6);assert(law.seen);assert.equal(t.intel.x,player.x);
 c.driver={hp:0};runTraffic(t,law,player,1);assert.equal(law.seen,false,'neutralized officer cannot report sightings');
 report.checks.push('Mur proche : information figée, réacquisition après retrait, équipage neutralisé sans vision');
}
{
 const w=makeWorld({roads:'none',size:310});
 for(let z=-140;z<=140;z+=7)w.city.rues.aretes.push({sorte:'rue',largeur:6,points:[-140,z,140,z]});
 for(let x=-140;x<=140;x+=35)w.city.rues.aretes.push({sorte:'rue',largeur:6,points:[x,-140,x,140]});
 w.city.rues.aretes.push({sorte:'rue',largeur:6,points:[260,260,280,260]});
 const t=RADE.traffic.create(w,{count:0}),before=t.metrics.pathExpansions;
 assert(t.nodes.length>1000);assert.deepEqual(t.route(-140,-140,280,260),[]);
 assert.equal(t.metrics.pathExpansions-before,320,'budget is saturated, not merely a tiny disconnected component');
 report.fixtures.push({test:'Budget saturé sur grand composant connecté',nodes:t.nodes.length,expansions:320});
 report.checks.push('Grand graphe connecté : cible inaccessible, arrêt exactement à320 expansions');
}
{
 const w=makeWorld({roads:'line',size:600});
 w.city.rues.aretes.push({sorte:'rue',largeur:6,points:[60,0,490,0]});
 const core=RADE.traffic.create(w,{count:0}),coreSnapshot=snapshot(core);
 const extendedWorld=makeWorld({roads:'line',size:600});extendedWorld.city=w.city;extendedWorld.bounds={minX:-550,maxX:550,minZ:-550,maxZ:550};
 const extended=RADE.traffic.create(extendedWorld,{count:0});
 assert.deepEqual(snapshot(extended),coreSnapshot,'extending roads preserves the initial random spawn sequence');
 assert(extended.nodes.some(n=>n.x>480));assert(extended.route(0,0,490,0).length>0);
 report.checks.push('Extension carte : spawns initiaux préservés, routes accessibles au-delà de320m');
 const campaign=s1.campaign,p=s1.player,original={x:p.x,z:p.z};p.x=440;p.z=440;
 const save=campaign.save();p.x=original.x;p.z=original.z;campaign.restore(save);
 assert(Math.hypot(p.x-440,p.z-440)<50,'save positions beyond the old bounds are restored');
 report.checks.push('Sauvegarde au-delà de320m restaurée selon les limites réelles de la ville');
}

fs.writeFileSync(new URL('../docs/police-acceptance.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
