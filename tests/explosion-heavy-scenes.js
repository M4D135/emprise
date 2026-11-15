/* Reproducible simultaneous vehicle blasts + a real Marseille building.
   No graphics setting, physics budget or simulation budget override. */
function selectHeavyFacade(world,interiors,controller,observer=[61.5,6.2,211]){
 const candidates=[],seen=new Set(),sourceIndex=new Map(world.scenery.map((m,i)=>[m,i]));
 for(const box of world.boxes){const m=box.mesh;if(!m||seen.has(m)||m.shape!=='box'||box.minY>.25||box.maxY<8)continue;seen.add(m);
  const found=interiors.breachFootprint(m);if(!found)continue;
  for(const [nx,nz,width,depth] of [[box.c,box.s,box.b*2,box.a*2],[-box.c,-box.s,box.b*2,box.a*2],[-box.s,box.c,box.a*2,box.b*2],[box.s,-box.c,box.a*2,box.b*2]]){
   if(width<18||depth<3.5||width*depth<150)continue;const x=box.x+nx*depth/2,z=box.z+nz*depth/2,distance=Math.hypot(x-observer[0],z-observer[2]);
   if(distance>72||distance<15||(observer[0]-x)*nx+(observer[2]-z)*nz<2)continue;
   if(world.withoutCar(()=>world.blocked(x+nx*1.5,z+nz*1.5,.34)))continue;
   const tangent=[nz,0,-nx],separation=Math.min(5,width*.2),center=[x,box.minY+1.55,z],points=[-1,1].map(side=>center.map((v,i)=>v+tangent[i]*separation*side));
   candidates.push({sourceId:'piece-'+sourceIndex.get(m),buildingId:found.building.id,name:found.building.name,width,depth,height:box.maxY-box.minY,normal:[nx,0,nz],center,points,mesh:m,distance,score:Math.hypot(x-61.5,z-168)});
  }
 }
 candidates.sort((a,b)=>a.score-b.score||a.sourceId.localeCompare(b.sourceId)||a.normal[0]-b.normal[0]||a.normal[2]-b.normal[2]);
 for(const q of candidates){const target=[q.center[0],q.center[1]+1.8,q.center[2]],dir=target.map((v,i)=>v-observer[i]),length=Math.hypot(...dir),hit=controller.raycast(observer,dir,length+.1);if(!hit||hit.distance<length-1.5)continue;return q;}
 throw Error('No visible, deep Marseille facade suitable for deterministic blast stress');
}
async function prepareOutdoorStress(){
 const g=RADE.game,s=g.session,w=s.world,r=g.renderer,frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
 // Observe the actual game callback, not a second rAF callback whose execution
 // begins after the game. Keep the wrapper stable and leave all other callers
 // (including this fixture's waits) unchanged. No runtime source is patched.
 const nativeRaf=window.requestAnimationFrame,callbackWrappers=new WeakMap();
 let gameCallback=null,callbackCount=0,callbackStart=NaN,rafStamp=NaN,lastRafStamp=NaN,rafDelta=NaN,callbackRow=-1,callbackTicks=0,callbackWorldCost=0;
 const TRACE_FIELDS=['frame','rafTimestamp','rafInterval','callbackStart','callbackDelay','preRenderCpu','renderCpu','simulationCpu','simulationTicks','worldUpdateCpu','postRenderCpu','callbackCpu','drawSubmissionInterval','lastCompletedGpuMs','simulationTickTotal'];
 let trace=null,traceCapacity=0,traceCount=0;
 const observedRaf=function(callback){
  if(!gameCallback&&callback.name==='frame'&&String(callback).includes('session.update(1/120'))gameCallback=callback;
  if(callback!==gameCallback)return nativeRaf.call(window,callback);
  let wrapped=callbackWrappers.get(callback);if(!wrapped){wrapped=function(now){callbackCount++;callbackStart=performance.now();rafStamp=now;rafDelta=Number.isFinite(lastRafStamp)?now-lastRafStamp:NaN;lastRafStamp=now;callbackRow=-1;callbackTicks=0;callbackWorldCost=0;
   try{return callback(now);}finally{if(callbackRow>=0&&trace){const end=performance.now(),offset=callbackRow*TRACE_FIELDS.length;trace[offset+10]=end-(trace[offset+3]+trace[offset+5]+trace[offset+6]);trace[offset+11]=end-trace[offset+3];}}
  };callbackWrappers.set(callback,wrapped);}return nativeRaf.call(window,wrapped);
 };
 window.requestAnimationFrame=observedRaf;
 const update=s.update.bind(s);s.update=()=>{};g.controller=()=>({});
 s.weather.force('soleil');s.weather.setHour(14);s.weather.tick(0);
 s.sim.relocate(61.5,211,0);s.player.pitch=-.1;
 const facade=selectHeavyFacade(w,s.interiors,s.urban.controller),aim=[facade.center[0]-61.5,facade.center[1]+2.5-6.2,facade.center[2]-211];
 const facadeYaw=Math.atan2(aim[0],-aim[2]),trafficYaw=Math.atan2(4/3,48),viewYaw=Math.atan2(Math.sin(facadeYaw)+Math.sin(trafficYaw),Math.cos(facadeYaw)+Math.cos(trafficYaw));
 const cam={pos:[61.5,6.2,211],yaw:viewYaw,pitch:-.1,fov:74,near:.15,overlayNear:.035,far:26000,allStatic:true,chunked:true,sun:{center:[61.5,.08,170],extent:110,depth:150}};
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
 if(!gameCallback||!callbackCount){window.requestAnimationFrame=nativeRaf;throw Error('Game rAF callback instrumentation did not attach');}
 const original=r.draw.bind(r),samples={frame:[],render:[],simulation:[],game:[]},events=[],counts=[],hashes=[],worldUpdates=[];
 let active=false,tick=0,previous=0,realtime=false,simTicks=0,simulationCost=0,nextEvent=0;
 function advance(){
  const start=performance.now();
  if(nextEvent<3&&(realtime?simTicks>=[180,420,660][nextEvent]:tick>=[90,210,330][nextEvent])){
   if(nextEvent===0){for(const c of blastCars){s.urban.detonateVehicle(c);events.push({frame:tick,simulationTick:simTicks,kind:'vehicleExplosion',id:c.id});}}
   else{const point=facade.points[nextEvent-1],result=s.urban.damage(point,240,10,facade.normal.map(v=>-v)),projected=s.urban.breachProjections.filter(b=>b.buildingId===facade.buildingId),furnishing=projected.reduce((n,b)=>n+b.scenery.length,0);
    if(!result.changed)throw Error('Scheduled real building blast did not damage the scene');
    if(nextEvent===1&&(!projected.length||!furnishing))throw Error('First facade blast did not reveal a furnished real interior');
    events.push({frame:tick,simulationTick:simTicks,kind:'buildingExplosion',point:point.slice(),power:240,radius:10,buildingId:facade.buildingId,sourceId:facade.sourceId,sourceAlive:s.urban.controller.isAlive(facade.sourceId),projections:projected.length,furnishing,collapsed:result.collapsed||[],debris:s.urban.bodies.length});
   }nextEvent++;
  }
  s.player.hp=100;update(1/120,{});simTicks++;callbackTicks++;simulationCost+=performance.now()-start;
 }
 const updateWorld=r.updateWorld.bind(r);r.updateWorld=function(...args){const t=performance.now(),result=updateWorld(...args);if(active){const ms=performance.now()-t;callbackWorldCost+=ms;worldUpdates.push({frame:tick,ms,meshes:args[0].length,revision:s.urban.revision});}return result;};
 const digest=()=>{let h=2166136261;const n=x=>h=Math.imul(h^((Number(x)||0)*1e5|0),16777619)>>>0;
  for(const p of s.crowd.people){n(p.x);n(p.z);n(p.hp);n(p.cap);}for(const c of w.fleet){n(c.x);n(c.z);n(c.cap);n(c.v);n(c.exploded);}
  for(const q of s.urban.bodies){const b=q.engine.body(q.handle);if(b){for(const v of b.pos)n(v);for(const v of b.vel)n(v);for(const v of b.quat)n(v);for(const v of b.ang)n(v);n(b.mass);n(b.asleep);for(const v of q.mesh.s)n(v);n(q.mesh.mat);n(q.mass);}}
  n(s.urban.report.vehicleExplosions);n(s.urban.report.breaches);n(s.urban.report.crumbleVolume);n(s.urban.revision);n(w.scenery.length);n(w.boxes.length);for(const b of s.urban.breachProjections){n(b.floor);n(b.scenery.length);n(b.colliders.length);}n(s.time);return h.toString(16);
 };
 const identity={hash:digest(),pedestrians:s.crowd.n,densePedestrians:360,traffic:s.traffic.cars.length,fleet:w.fleet.length,blastVehicles:blastCars.map(c=>c.id),camera:cam,staticMeshes:w.scenery.length,facade:{sourceId:facade.sourceId,buildingId:facade.buildingId,name:facade.name,width:facade.width,depth:facade.depth,height:facade.height,normal:facade.normal,center:facade.center,points:facade.points,sourceGeometry:{p:facade.mesh.p.slice(),s:facade.mesh.s.slice(),r:(facade.mesh.r||[0,0,0]).slice()}},schedule:[{frame:90,kind:'vehicleExplosion',count:3},{frame:210,kind:'buildingExplosion',power:240,radius:10},{frame:330,kind:'buildingExplosion',power:240,radius:10}]};
 r.draw=function(camera,models,fx){const start=performance.now(),submissionInterval=active&&previous?start-previous:NaN;if(active&&previous)samples.frame.push(submissionInterval);if(active)previous=start;
  const result=original(camera,models,fx);if(active){const renderCpu=performance.now()-start;samples.render.push(renderCpu);
   if(!realtime)for(let i=0;i<2;i++)advance();samples.simulation.push(simulationCost);
   if(traceCount<traceCapacity){callbackRow=traceCount++;const offset=callbackRow*TRACE_FIELDS.length;trace[offset]=tick;trace[offset+1]=rafStamp;trace[offset+2]=rafDelta;trace[offset+3]=callbackStart;trace[offset+4]=callbackStart-rafStamp;trace[offset+5]=start-callbackStart;trace[offset+6]=renderCpu;trace[offset+7]=simulationCost;trace[offset+8]=callbackTicks;trace[offset+9]=callbackWorldCost;trace[offset+12]=submissionInterval;trace[offset+13]=r.stats.gpuTimeMs??NaN;trace[offset+14]=simTicks;}
   simulationCost=0;
   if(tick%60===0){const stateHash=digest();hashes.push({frame:tick,hash:stateHash,renderHash:[models.length,r.stats.triangles,r.stats.instances,r.stats.drawCalls,w.scenery.length,w.boxes.length].join(':')});counts.push({frame:tick,models:models.length,triangles:r.stats.triangles,instances:r.stats.instances,drawCalls:r.stats.drawCalls,pedestrians:s.crowd.n,alive:s.crowd.people.filter(p=>p.hp>0).length,within100:s.crowd.people.filter(p=>p.hp>0&&Math.hypot(p.x-cam.pos[0],p.z-cam.pos[2])<100).length,traffic:s.traffic.cars.length,debris:s.urban.bodies.length,debrisHash:stateHash,staticMeshes:w.scenery.length,staticColliders:w.boxes.length,projections:s.urban.breachProjections.length,projectedMeshes:s.urban.breachProjections.reduce((n,b)=>n+b.scenery.length,0),projectedColliders:s.urban.breachProjections.reduce((n,b)=>n+b.colliders.length,0),explosions:s.sim.state.explosions.length,fires:s.urban.fires.length,msaa:r.stats.msaa,shadows:r.stats.shadows,reflections:r.stats.reflections,bloom:r.stats.bloom,resolution:[r.stats.width,r.stats.height]});}
   tick++;
  }return result;
 };
 const describe=a=>{const v=a.slice().sort((a,b)=>a-b),at=q=>v[Math.min(v.length-1,Math.floor(v.length*q))];return {n:v.length,p50:at(.5),p95:at(.95),p99:at(.99),max:v.at(-1),over25:v.filter(x=>x>25).length,over50:v.filter(x=>x>50).length};};
 function pacingReport(rafSamples){
  const column=index=>{const values=[];for(let i=0;i<traceCount;i++){const n=trace[i*TRACE_FIELDS.length+index];if(Number.isFinite(n))values.push(n);}return values;};
  const rows=[];for(let i=0;i<traceCount;i++){const row=[];for(let k=0;k<TRACE_FIELDS.length;k++){const n=trace[i*TRACE_FIELDS.length+k];row.push(Number.isFinite(n)?n:null);}rows.push(row);}
  const slow=new Set();for(let i=0;i<traceCount;i++){const o=i*TRACE_FIELDS.length;if(trace[o+2]>25||trace[o+11]>25||trace[o+12]>25){for(let j=Math.max(0,i-1);j<=Math.min(traceCount-1,i+1);j++)slow.add(j);}}
  const tickHistogram={};for(const n of column(8))tickHistogram[n]=(tickHistogram[n]||0)+1;
  return {fields:TRACE_FIELDS,rows,slowFrameIndices:[...slow].sort((a,b)=>a-b),simulationTicksPerFrame:tickHistogram,measures:{raf:describe(rafSamples),observedRaf:describe(column(2)),drawSubmission:describe(samples.frame),callbackDelay:describe(column(4)),preRenderCpu:describe(column(5)),postRenderCpu:describe(column(10)),callbackCpu:describe(column(11))},notes:['measures.frame remains the historical interval between renderer.draw entries; drawSubmission is its explicit alias. This is neither the rAF callback cadence nor presentation timing.','raf uses game.samples (browser-supplied rAF timestamps); observedRaf contains only callbacks that submitted a measured frame. game.samples may include a boundary frame while GPU profiling starts or drains.','preRenderCpu/renderCpu/postRenderCpu are elapsed main-thread intervals within the same game rAF callback; system interruptions may be included. Fixed mode runs two simulation ticks after renderer.draw, while realtime runs them before it.','lastCompletedGpuMs is the latest asynchronously completed GPU timestamp sample, not a timestamp associated with this row. It excludes queue wait and presentation.','Both regular rAF timestamps and regular CPU submissions can coexist with irregular GPU presentation. These metrics do not claim presentation cadence.','Rows are numeric preallocated storage during measurement; row objects, summaries and slow-frame neighbourhoods are constructed only after measurement stops.']};
 }
 // Exact end-state evidence is deliberately computed after measured frames
 // stop and pause is active. No rounding, tolerance or 1e-5 quantization here.
 async function exactFinalState(){
  const mesh=m=>({shape:m.shape,p:m.p,s:m.s,r:m.r,mat:m.mat,color:m.color,material:m.material,emissive:m.emissive,alpha:m.alpha,fx:m.fx,collision:m.collision,breachShell:m.breachShell,breachInterior:m.breachInterior,sourceRoom:m.sourceRoom,destructibleId:m.destructibleId,renderRevision:m.renderRevision});
  const colliders=(list,geometry)=>{const indices=new Map(geometry.map((m,i)=>[m,i]));return list.map(q=>({x:q.x,z:q.z,a:q.a,b:q.b,c:q.c,s:q.s,cap:q.cap,minY:q.minY,maxY:q.maxY,minX:q.minX,maxX:q.maxX,minZ:q.minZ,maxZ:q.maxZ,kind:q.kind,breachInterior:q.breachInterior,destroyed:q.destroyed,mesh:indices.get(q.mesh)??null}));};
  const values={destruction:s.urban.controller.snapshot(),worldMeshes:w.scenery.map(mesh),worldColliders:colliders(w.boxes,w.scenery),urbanReport:{...s.urban.report},bodies:s.urban.bodies.map(q=>({scene:q.scene,mass:q.mass,material:q.material,mesh:mesh(q.mesh),body:q.engine.body(q.handle)})),projections:s.urban.breachProjections.map(b=>({id:b.id,buildingId:b.buildingId,floor:b.floor,sceneId:b.room.sceneId,scale:b.scale,face:b.face,void:b.void,meshes:b.scenery.map(mesh),colliders:colliders(b.colliders,b.scenery),lights:b.lights}))};
  const result={};for(const [name,value]of Object.entries(values)){const bytes=new TextEncoder().encode(JSON.stringify(value)),hash=await crypto.subtle.digest('SHA-256',bytes);result[name]=Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');}
  return result;
 }
 return {identity,async run(frames=600,realTime=false){realtime=realTime;traceCapacity=frames;trace=new Float64Array(traceCapacity*TRACE_FIELDS.length);trace.fill(NaN);g.samples.length=g.cpuSamples.length=0;if(r.setProfiling)await r.setProfiling(true);if(realtime)s.update=()=>{if(active)advance();};active=true;while(tick<frames&&!g.errors.length)await frame();active=false;
  const gpu=r.setProfiling?await r.setProfiling(false):null;samples.game=g.cpuSamples.slice();const rafSamples=g.samples.slice();g.pause();window.requestAnimationFrame=nativeRaf;const pacing=pacingReport(rafSamples),rendererStats={...r.stats},finalStateHashes=await exactFinalState();
  return {identity,hashes,counts,events,worldUpdates,realtime,finalStateHashes,pacing,protocol:'960 pedestrians, same legal quay placement and civilian/police traffic as outdoor stress. Three actual vehicle detonations in one simulation tick at frame90; real Marseille facade blasts power240/radius10 at frames210/330, revealing physical furnishing. Fixed camera. '+(realtime?'Unmodified wall-clock accumulator.':'Two 1/120 simulation ticks per rendered frame.')+' Graphics unchanged; simulation/debris and render counts sampled every60frames. Historical frame measures renderer.draw submission intervals; raf reports browser rAF timestamps separately. Neither measures actual presentation.',measures:{...Object.fromEntries(Object.entries(samples).map(([k,v])=>[k,describe(v)])),...pacing.measures},gpu:gpu?{available:gpu.available,dropped:gpu.dropped,...describe(gpu.samples)}:null,renderer:rendererStats,errors:g.errors.slice(),backendEvents:g.backendEvents,simulationTicks:simTicks,build:RADE.build};
 }};
}
