/* EMPRISE — one bounded procedural sea grid, displaced by FERRO on the GPU.
   The CPU buoyancy sampler and the shader use the same travelling wave field. */
(function(R){'use strict';
const SIZE=128,STEPS=64,shape='emprise-sea-surface',triangles=[],normal=[0,1,0];
for(let z=0;z<STEPS;z++)for(let x=0;x<STEPS;x++){
 const a=[x/STEPS-.5,0,z/STEPS-.5],b=[(x+1)/STEPS-.5,0,z/STEPS-.5],c=[(x+1)/STEPS-.5,0,(z+1)/STEPS-.5],d=[x/STEPS-.5,0,(z+1)/STEPS-.5];
 triangles.push([a,c,b,normal,normal,normal],[a,d,c,normal,normal,normal]);
}
FRender.forme(shape,triangles);
function state(session){
 if(!['boat','swim'].includes(session.mode)||session.interiors?.active)return null;
 const p=session.mode==='boat'?session.marine.boat:session.player,w=session.weather?.state||{};
 return {origin:[Math.round(p.x/8)*8,Math.round(p.z/8)*8,SIZE/2,w.wind??.28],motion:[session.marine.time,R.marine.windDirection(w),R.marine.SEA_LEVEL??-1.25,1]};
}
function mesh(q){return {shape,p:[q.origin[0],q.motion[2],q.origin[1]],s:[SIZE,1,SIZE],mat:12.25,surface:'architecture',collision:false,marineSurface:true,outdoor:true};}
R.marineWater={state,mesh,size:SIZE,steps:STEPS};
})(globalThis.RADE);
