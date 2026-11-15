/* Identical frozen gameplay scenes for real WebGL2/WebGPU measurements. */
(function(root){'use strict';
 const scenes=['port-day','port-night','port-rain','bonne-mere','shop'];
 const percentile=(v,q)=>{const a=v.slice().sort((x,y)=>x-y);return a.length?a[Math.min(a.length-1,Math.floor(a.length*q))]:null;};
 const describe=a=>({n:a.length,p50:percentile(a,.5),p95:percentile(a,.95),p99:percentile(a,.99),max:a.length?Math.max(...a):null});
 const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
 async function setup(name){
  if(!scenes.includes(name))throw Error('Unknown benchmark scene: '+name);
  const g=RADE.game,s=g.session,w=s.world,r=g.renderer;
  // The same versioned world seed and actors are held at exactly the same tick.
  // Simulation/AI does not advance according to the speed of either renderer.
  s.update=()=>{};g.controller=()=>({});s.weather.force(name==='port-rain'?'orage':'soleil');
  Object.assign(s.weather.state,{elapsed:90,wet:name==='port-rain'?.92:0,flash:0,bolt:null,cloudX:.42,cloudZ:.13});
  s.weather.setHour(name==='port-night'||name==='bonne-mere'?23:14);s.weather.tick(0);
  let cam={pos:[74.5,1.70,130],yaw:Math.PI/2,pitch:0,fov:74,near:.15,overlayNear:.035,far:26000,allStatic:true,chunked:true,sun:{center:[99.5,.08,130],extent:110,depth:150}};
  if(name==='bonne-mere'){
   const lm=w.landmarks,p=w.freeNear(lm.center.x+130,lm.center.z-110,.34);s.sim.relocate(...p,0);
   const pos=[lm.center.x+130,lm.groundLevel+49,lm.center.z-110],target=[lm.center.x-6,lm.groundLevel+29,lm.center.z],d=target.map((v,i)=>v-pos[i]);
   cam={...cam,pos,yaw:Math.atan2(d[0],-d[2]),pitch:Math.atan2(d[1],Math.hypot(d[0],d[2])),fov:62,sun:{center:[p[0],lm.groundLevel,p[1]],extent:110,depth:150}};
  }else if(name==='shop'){
   const e=[...s.business.registry.values()].find(e=>e.place.name==='Shawarmax')||[...s.business.registry.values()].find(e=>e.place.type==='kebab');
   if(!e)throw Error('Missing reference shop');s.sim.relocate(e.building.x,e.building.z,0);if(!s.interiors.enter(e.building,e.building.places.indexOf(e.place)))throw Error('Reference shop entry failed');s.business.update(0);
   cam={...cam,pos:[s.player.x,s.player.y+1.62,s.player.z],yaw:s.player.yaw,pitch:0};
  }
  g.camera=cam;g.start();g.audio.setMix({master:0});g.engineSound.suspendre();
  for(const id of ['hud','title','paused','attract','touch','loading'])document.getElementById(id).hidden=true;
  if(!s.interiors.active)w.cityStream?.tick(s.player.x,s.player.z);
  let deadline=performance.now()+90000;
  while(!s.interiors.active&&w.cityStream.pending){if(performance.now()>deadline)throw Error('City stream did not finish');await frame();}
  const original=r.draw.bind(r);let enabled=false,frames=[],cpu=[],gpu=[],previous=0,pending=[],disjoint=0,draws=0;
  const gl=r.gl,extension=gl?.getExtension('EXT_disjoint_timer_query_webgl2');
  function poll(){if(!extension)return;if(gl.getParameter(extension.GPU_DISJOINT_EXT)){disjoint++;pending.forEach(q=>gl.deleteQuery(q));pending=[];return;}
   for(let i=pending.length-1;i>=0;i--){const q=pending[i];if(gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)){gpu.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);pending.splice(i,1);}}
  }
  let packet=null;
  r.draw=function(camera,models,fx){packet={camera,models,fx};let query=null;
   if(enabled){const t=performance.now();if(previous)frames.push(t-previous);previous=t;poll();if(extension&&pending.length<12){query=gl.createQuery();gl.beginQuery(extension.TIME_ELAPSED_EXT,query);}}
   const start=performance.now();const result=original(camera,models,fx);
   if(enabled){cpu.push(performance.now()-start);draws++;if(query){gl.endQuery(extension.TIME_ELAPSED_EXT);pending.push(query);}}
   return result;
  };
  for(let i=0;i<90;i++)await frame();
  function signature(){let h=2166136261;const number=n=>{h=Math.imul(h^((Number(n)||0)*1e5|0),16777619)>>>0;},string=s=>{for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;};
   const meshes=arr=>{for(const m of arr){string(m.shape);string(m.mat??m.material);for(const v of [...(m.p||[]),...(m.s||[]),...(m.r||[]),...(m.color||[])])number(v);number(m.emissive);}};
   const world=s.interiors.active?.scenery||[...w.scenery,...(w.landscape||[]),...(w.cityStream?.geometry||[])];meshes(world);meshes(packet.models);
   for(const v of s.crowd.packed)number(v);for(const v of s.crowd.locomotion||[])number(v);
   return {hash:h.toString(16),staticMeshes:world.length,dynamicMeshes:packet.models.length,pedestrians:s.crowd.n,camera:packet.camera,weather:s.weather.save(),time:s.time,lights:packet.fx.lights,shadowMode:packet.fx.sunOnly?'sun-atlas':'multi-atlas'};
  }
  const identity=signature();
  if(w.cityStream.pending&&!s.interiors.active)throw Error('Streaming still active after warmup');
  async function run(count=240){const before=signature(),revision=w.cityStream?.revision;frames=[];cpu=[];gpu=[];previous=0;draws=0;disjoint=0;pending.forEach(q=>gl.deleteQuery(q));pending=[];
   g.samples.length=g.cpuSamples.length=0;
   if(r.setProfiling)await r.setProfiling(true);
   enabled=true;while(draws<count)await frame();enabled=false;const gameCPU=g.cpuSamples.slice();
   for(let i=0;i<20&&pending.length;i++){await frame();poll();}
   let native=null;if(r.setProfiling){native=await r.setProfiling(false);}
   const gpuTimes=native?.samples||r.profiling?.samples||r.stats.gpuSamples||[];
   const after=signature();if(before.hash!==identity.hash||after.hash!==identity.hash||revision!==w.cityStream?.revision)throw Error('Benchmark scene changed during measurement');
   const result={identityHash:after.hash,worldRevision:revision,streamPending:!!w.cityStream?.pending,frames:describe(frames),renderCPU:describe(cpu),gameCPU:describe(gameCPU),gpu:describe(extension?gpu:gpuTimes),gpuTimer:extension?'EXT_disjoint_timer_query_webgl2':native?.available?'timestamp-query':r.stats.gpuTimer||null,disjoint,over25:frames.filter(v=>v>25).length,over50:frames.filter(v=>v>50).length,over100:frames.filter(v=>v>100).length,resolution:[document.getElementById('scene').width,document.getElementById('scene').height],renderer:{...r.stats},errors:g.errors.slice()};
   delete result.renderer.gpuSamples;return result;
  }
  root.renderBenchmark={name,identity,run,get framePacket(){return packet;},backend:r.stats.backend,build:RADE.build,userAgent:navigator.userAgent};
  return {name,identity,backend:r.stats.backend,build:RADE.build,userAgent:navigator.userAgent};
 }
 root.prepareRenderBenchmark=setup;
})(globalThis);
