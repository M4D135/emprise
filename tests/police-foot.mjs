import './load.mjs';import assert from 'node:assert/strict';await import('../src/police.js');
const checks=[];
function fixture({saved=null,playerX=12,playerZ=-1.4,count=1}={}){
 const walls=[],cars=Array.from({length:count},(_,i)=>({id:20+i,x:-i*5,z:0,cap:0,model:'gti',v:0,u:0,w:0,omega:0,ai:true,police:true,state:'pursuit',driver:{id:14020+i,x:-i*5,z:0,hp:100,inside:true}}));let ignore=false;
 const carBox=c=>({minX:c.x-1.8525,maxX:c.x+1.8525,minZ:c.z-.7945,maxZ:c.z+.7945,minY:.08,maxY:1.44});
 const solid=()=>[...walls,...(ignore?[]:cars.map(carBox))];
 const blocked=(x,z,r=.3)=>Math.abs(x)+r>=40||Math.abs(z)+r>=40||solid().some(q=>(x-Math.max(q.minX,Math.min(q.maxX,x)))**2+(z-Math.max(q.minZ,Math.min(q.maxZ,z)))**2<r*r);
 const ray=(o,d,far)=>{let hit=far;for(const q of solid()){let lo=0,hi=hit;for(let k=0;k<3;k++){const min=[q.minX,q.minY,q.minZ][k],max=[q.maxX,q.maxY,q.maxZ][k];if(Math.abs(d[k])<1e-9){if(o[k]<min||o[k]>max){hi=-1;break;}}else{let a=(min-o[k])/d[k],b=(max-o[k])/d[k];if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);}}if(hi>=lo&&lo>=0)hit=Math.min(hit,lo);}return hit;};
 const world={bounds:{minX:-40,maxX:40,minZ:-40,maxZ:40},ground:()=>.08,water:()=>false,blocked,ray,withoutCar(fn){ignore=true;try{return fn();}finally{ignore=false;}},fleet:cars,pedestrians:[],car:null,playerSeated:false};
 const sim={state:{player:{x:playerX,z:playerZ,y:.08,hp:100},enemies:[]}},law={wanted:1,cooldown:0,reportRevision:0},campaign={law},traffic={cars,time:0,intel:{valid:false}};
 const police=RADE.police.create(world,sim,{traffic,campaign,saved});let maxStep=0;
 function tick(seconds,options={}){for(let i=0;i<Math.ceil(seconds*60);i++){const old=police.actors.map(e=>({x:e.x,z:e.z,inside:e.inside}));traffic.time+=1/60;police.update(1/60,options);police.actors.forEach((e,j)=>{assert([e.x,e.z,e.hp].every(Number.isFinite));if(!e.inside&&e.hp>0)assert(!blocked(e.x,e.z,.29),'officer crosses an actual wall/car');if(!old[j].inside&&!e.inside){const step=Math.hypot(e.x-old[j].x,e.z-old[j].z);maxStep=Math.max(maxStep,step);assert(step<=2.65/60+1e-7,'no teleportation between foot steps');}});}}
 return {world,sim,law,traffic,police,c:cars[0],e:cars[0].driver,u:police.units[0],p:sim.state.player,walls,tick,get maxStep(){return maxStep;}};
}
const wall=(x0,x1,z0,z1)=>({minX:x0,maxX:x1,minZ:z0,maxZ:z1,minY:0,maxY:4});
{
 const f=fixture();const driver=f.c.driver;f.tick(.7);assert.equal(f.police.actors[0],driver);assert(!driver.inside);assert.equal(f.c.ai,false);assert.equal(f.c.v,0);assert.equal(f.police.actors.length,1);assert(f.police.geometry().length>0);f.tick(7);assert(f.police.arrestStatus().eligible);assert(f.police.seen);
 f.law.wanted=0;f.tick(16);assert(f.e.inside);assert(f.c.ai);assert.equal(f.police.metrics.boarded,1);assert.equal(f.police.geometry().length,0);
 checks.push('Le pilote réel sort par une porte libre, approche, interpelle à portée et réembarque après disparition de la recherche');
}
{
 const f=fixture();f.tick(.6);f.walls.push(wall(4,4.3,-5,2));f.tick(10);assert(f.police.metrics.pathRequests>0);assert(f.e.x>4.6,'walks around wall instead of becoming trapped');assert(f.police.arrestStatus().eligible);assert(f.police.metrics.maxPathExpansions<=384);
 checks.push('Contournement d’un vrai mur : A* local borné puis reprise visible de l’interpellation');
}
{
 const f=fixture();f.tick(.6);const last={x:f.u.last.x,z:f.u.last.z};f.walls.push(wall(4,4.3,-35,35));f.p.x=16;f.p.z=20;f.tick(3);assert.deepEqual({x:f.u.last.x,z:f.u.last.z},last);assert(!f.police.seen);assert(!f.police.arrestStatus().eligible);f.tick(20);assert.equal(f.u.last,null);assert(['return','ride','stranded'].includes(f.u.state));assert(f.police.metrics.maxPathExpansions<=384);
 checks.push('Occultation : dernier point observé conservé, joueur caché non suivi, mémoire expirée et retour');
}
{
 const f=fixture();f.walls.push(wall(-3,3,1,1.8),wall(-3,3,-1.8,-1));f.tick(3);assert(f.e.inside);assert.equal(f.police.metrics.exits,0);assert(f.police.metrics.blockedExits>0);
 const fast=fixture();fast.tick(1,{seated:true,speed:8});assert(fast.e.inside);fast.c.v=3;fast.tick(1);assert(fast.e.inside);fast.c.v=0;fast.tick(1,{hidden:true});assert(fast.e.inside);
 checks.push('Deux portes bloquées, voiture rapide ou cible intérieure : aucune sortie ni apparition artificielle');
}
{
 const f=fixture();f.tick(8);assert(f.police.arrestStatus().eligible);assert(!f.police.arrestStatus(f.p,{hidden:true}).eligible);assert(!f.police.arrestStatus(f.p,{seated:true,speed:3}).eligible);
 const mx=(f.e.x+f.p.x)/2;f.walls.push(wall(mx-.04,mx+.04,-20,20));assert(!f.police.arrestStatus().eligible);f.walls.length=0;
 f.e.injury={leg:true};assert(!f.police.arrestStatus().eligible);const pos={x:f.e.x,z:f.e.z};f.p.x+=3;f.tick(1);assert(Math.hypot(f.e.x-pos.x,f.e.z-pos.z)<.34);f.e.hp=0;f.tick(1);assert.equal(f.u.state,'dead');assert(!f.police.arrestStatus().eligible);assert(f.police.geometry().length>0);
 checks.push('Arrestation annulée par mur, intérieur, vitesse, jambe neutralisée ou décès ; corps toujours rendu');
}
{
 const f=fixture();f.tick(4);f.c.policeStolen=true;f.e.injury={arm:true};f.e.hp=68;f.law.wanted=0;f.tick(2);assert.equal(f.u.state,'stranded');assert(!f.e.inside);const save=f.police.save();
 const g=fixture({saved:save});assert.equal(g.e.hp,68);assert(g.e.injury.arm);assert(!g.e.inside);assert(g.c.policeStolen);g.law.wanted=0;g.tick(10);assert(!g.e.inside);assert(!g.c.ai);
 for(const bad of [{version:1,clock:NaN,units:[]},{...save,units:[null,{...save.units[0],actor:{x:NaN,z:0,hp:100,inside:false}}]},{...save,units:[{...save.units[0],actor:{...save.units[0].actor,x:1e6}}]}]){const q=fixture({saved:bad});q.tick(.2);assert(q.police.actors.every(e=>[e.x,e.z,e.hp].every(Number.isFinite)));}
 checks.push('Sauvegarde : identité, position, blessure et santé conservées ; voiture volée jamais reprise ; données invalides rejetées');
}
{
 const f=fixture({count:3});f.law.wanted=3;f.tick(.7);f.walls.push(wall(4,4.3,-35,35));f.p.x=16;f.p.z=15;f.tick(8);assert.equal(f.police.actors.length,3);assert(f.police.metrics.pathRequests<=30);assert(f.police.metrics.maxPathExpansions<=384);assert(f.police.metrics.pathExpansions<=f.police.metrics.pathRequests*384);
 const one=fixture({count:3});one.tick(1);assert.equal(one.police.actors.filter(e=>!e.inside).length,1);
 checks.push('Trois policiers maximum ; routes espacées par agent et globalement, 384 expansions maximum par requête');
}
{
 const f=fixture(),vehicle={id:99,model:'gti',x:f.p.x,z:f.p.z,cap:0,v:0};f.world.fleet.push(vehicle);f.world.playerSeated=true;f.world.car=vehicle;
 f.tick(10,{seated:true,vehicle,speed:0});assert(!f.e.inside);assert(f.police.arrestStatus(f.p,{seated:true,vehicle,speed:0}).eligible,'stopped vehicle is arrested by an officer standing at an actual door');
 assert(!f.police.arrestStatus(f.p,{seated:true,vehicle,speed:4}).eligible);
 checks.push('Véhicule arrêté : policier réellement descendu à sa porte, jamais une interpellation depuis un habitacle distant');
 const a=fixture(),b=fixture();for(const q of [a,b]){q.tick(.6);q.walls.push(wall(4,4.3,-5,2));q.tick(7);}assert.deepEqual(a.police.save(),b.police.save());
 checks.push('Deux simulations aux commandes identiques produisent exactement le même état sauvegardé');
}
// Real city, real existing driver, procedural body and shared injuries trace.
{
 const s=RADE.session.create({pedestrians:0}),c=s.traffic.cars.find(c=>c.police),police=s.police||RADE.police.create(s.world,s.sim,{traffic:s.traffic,campaign:s.campaign});
 c.v=c.u=c.w=c.omega=0;c.state='pursuit';s.campaign.law.wanted=1;s.campaign.law.heat=1;
 let spot=null;for(let r=5;r<=12&&!spot;r++)for(let j=0;j<24;j++){const x=c.x+Math.cos(j*Math.PI/12)*r,z=c.z+Math.sin(j*Math.PI/12)*r,dx=x-c.x,dz=z-c.z,d=Math.hypot(dx,dz);if(!s.world.blocked(x,z,.35)&&s.world.ray([c.x,1.73,c.z],[dx/d,0,dz/d],d)>=d-.05){spot={x,z};break;}}
 assert(spot);s.sim.relocate(spot.x,spot.z);police.update(.1,{});assert(!c.driver.inside,'real city door allows dismount');assert(police.geometry(0).length>0);assert(!s.world.blocked(c.driver.x,c.driver.z,.29));
 s.injuries.hurtCivil(c.driver,1,'head');police.update(.1,{});assert.equal(c.driver.hp,0);assert(!police.arrestStatus().eligible);assert(police.geometry(1).length>0);
 checks.push('Vraie ville : sortie effective du pilote existant, corps procédural visible, blessure à la tête via injuries, aucune interpellation post mortem');
}
console.log(JSON.stringify({checks},null,2));
