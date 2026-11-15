/* Reproducible active outdoor load. No graphics setting or simulation budget override. */
async function prepareOutdoorStress(){
 const g=RADE.game,s=g.session,w=s.world,r=g.renderer,frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
 const update=s.update.bind(s);s.update=()=>{};g.controller=()=>({});
 s.weather.force('soleil');s.weather.setHour(14);s.weather.tick(0);
 s.sim.relocate(61.5,211,0);s.player.pitch=-.1;
 const cam={pos:[61.5,4.5,210],yaw:0,pitch:-.1,fov:74,near:.15,overlayNear:.035,far:26000,allStatic:true,chunked:true,sun:{center:[61.5,.08,170],extent:110,depth:150}};
 g.camera=cam;g.start();g.audio.setMix({master:0});g.engineSound.suspendre();
 for(const id of ['hud','title','paused','attract','touch','loading'])document.getElementById(id).hidden=true;
 const nav=s.crowd.nav,cells=[];
 for(let i=0;i<nav.n;i++)if(nav.libre[i]){const x=nav.centreX(i)/1000,z=nav.centreZ(i)/1000;if(x>40&&x<85&&z>105&&z<195&&!w.blocked(x,z,.24))cells.push([x,z]);}
 if(cells.length<80)throw Error('Insufficient legal crowd cells');
 for(let i=0;i<Math.min(360,s.crowd.n);i++){const p=s.crowd.people[i],q=cells[i*17%cells.length];p.x=q[0];p.z=q[1];}
 s.crowd.update(0);
 const blastCars=w.fleet.filter(c=>c!==s.car&&!c.police&&!RADE.vehicles.SPECS[c.model].two).slice(0,3);
 if(blastCars.length!==3)throw Error('Missing stress vehicles');
 blastCars.forEach((c,i)=>Object.assign(c,{x:61.5+(i%2)*4,z:181-i*18,cap:0,y:w.ground(61.5,181-i*18),ai:false,u:0,w:0,v:0,moteur:false}));
 w.cityStream.tick(s.player.x,s.player.z);while(w.cityStream.pending)await frame();
 for(let i=0;i<90;i++)await frame();
 const original=r.draw.bind(r),samples={frame:[],render:[],simulation:[],game:[]},events=[],counts=[],hashes=[],worldUpdates=[];
 let active=false,tick=0,previous=0,realtime=false,simTicks=0,simulationCost=0,nextBlast=0;
 function advance(){
  const start=performance.now();
  if(nextBlast<3&&(realtime?simTicks>=180+nextBlast*240:tick>=90+nextBlast*120)){const c=blastCars[nextBlast++];s.urban.detonateVehicle(c);events.push({frame:tick,simulationTick:simTicks,kind:'vehicleExplosion',id:c.id});}
  s.player.hp=100;update(1/120,{});simTicks++;simulationCost+=performance.now()-start;
 }
 const updateWorld=r.updateWorld.bind(r);r.updateWorld=function(...args){const t=performance.now(),result=updateWorld(...args);if(active)worldUpdates.push({frame:tick,ms:performance.now()-t,meshes:args[0].length,revision:s.urban.revision});return result;};
 const digest=()=>{let h=2166136261;const n=x=>h=Math.imul(h^((Number(x)||0)*1e5|0),16777619)>>>0;
  for(const p of s.crowd.people){n(p.x);n(p.z);n(p.hp);n(p.cap);}for(const c of w.fleet){n(c.x);n(c.z);n(c.cap);n(c.v);n(c.exploded);}
  for(const q of s.urban.bodies){const b=q.engine.body(q.handle);if(b){for(const v of b.pos)n(v);for(const v of b.vel)n(v);}}
  n(s.urban.report.vehicleExplosions);n(s.time);return h.toString(16);
 };
 const identity={hash:digest(),pedestrians:s.crowd.n,densePedestrians:360,traffic:s.traffic.cars.length,fleet:w.fleet.length,blastVehicles:blastCars.map(c=>c.id),camera:cam,staticMeshes:w.scenery.length};
 r.draw=function(camera,models,fx){const start=performance.now();if(active&&previous)samples.frame.push(start-previous);if(active)previous=start;
  const result=original(camera,models,fx);if(active){samples.render.push(performance.now()-start);
   if(!realtime)for(let i=0;i<2;i++)advance();samples.simulation.push(simulationCost);simulationCost=0;
   if(tick%60===0){hashes.push({frame:tick,hash:digest()});counts.push({frame:tick,models:models.length,triangles:r.stats.triangles,instances:r.stats.instances,drawCalls:r.stats.drawCalls,pedestrians:s.crowd.n,alive:s.crowd.people.filter(p=>p.hp>0).length,within100:s.crowd.people.filter(p=>p.hp>0&&Math.hypot(p.x-cam.pos[0],p.z-cam.pos[2])<100).length,traffic:s.traffic.cars.length,debris:s.urban.bodies.length,explosions:s.sim.state.explosions.length,fires:s.urban.fires.length,msaa:r.stats.msaa,shadows:r.stats.shadows,reflections:r.stats.reflections,bloom:r.stats.bloom,resolution:[r.stats.width,r.stats.height]});}
   tick++;
  }return result;
 };
 const describe=a=>{const v=a.slice().sort((a,b)=>a-b),at=q=>v[Math.min(v.length-1,Math.floor(v.length*q))];return {n:v.length,p50:at(.5),p95:at(.95),p99:at(.99),max:v.at(-1),over25:v.filter(x=>x>25).length,over50:v.filter(x=>x>50).length};};
 return {identity,async run(frames=600,realTime=false){realtime=realTime;g.samples.length=g.cpuSamples.length=0;if(r.setProfiling)await r.setProfiling(true);if(realtime)s.update=()=>{if(active)advance();};active=true;while(tick<frames&&!g.errors.length)await frame();active=false;
  const gpu=r.setProfiling?await r.setProfiling(false):null;samples.game=g.cpuSamples.slice();g.pause();
  return {identity,hashes,counts,events,worldUpdates,realtime,measures:Object.fromEntries(Object.entries(samples).map(([k,v])=>[k,describe(v)])),gpu:gpu?{available:gpu.available,dropped:gpu.dropped,...describe(gpu.samples)}:null,renderer:{...r.stats},errors:g.errors.slice(),backendEvents:g.backendEvents,simulationTicks:simTicks,build:RADE.build};
 }};
}
