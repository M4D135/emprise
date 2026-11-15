/* RADE — deterministic fronts, wet ground, gusts and lightning; saved with the solo world. */
(function(R){'use strict';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t,hash=n=>{const x=Math.sin(n*127.1+47.7)*43758.5453;return x-Math.floor(x);};
const presets={soleil:{cloud:.22,rain:0,wind:.28,storm:0},nuages:{cloud:.88,rain:0,wind:.52,storm:0},pluie:{cloud:1,rain:.72,wind:.85,storm:.35},orage:{cloud:1,rain:1,wind:1.55,storm:1},eclaircie:{cloud:.54,rain:.10,wind:.45,storm:.12}};
const dayLength=1200,initialHour=14,smooth=(a,b,v)=>{v=clamp((v-a)/(b-a));return v*v*(3-2*v);};
const fronts=[['soleil',160],['nuages',110],['pluie',140],['orage',100],['eclaircie',110],['soleil',100]],duration=fronts.reduce((a,f)=>a+f[1],0);
function create(saved){const state={elapsed:0,clockHours:initialHour,hour:initialHour,night:0,daylight:1,wet:0,cloud:.22,rain:0,wind:.28,storm:0,gust:0,flash:0,strikes:0,mode:'soleil',cloudX:0,cloudZ:0,bolt:null,thunder:0};let forced=null,nextStrike=4;
 if(Number.isFinite(saved?.clockHours))state.clockHours=((saved.clockHours%24)+24)%24;
 if(saved&&Number.isFinite(saved.elapsed)&&saved.elapsed>=0)state.elapsed=Math.min(1e9,saved.elapsed);if(saved&&Number.isFinite(saved.wet))state.wet=clamp(saved.wet);for(const k of ['cloud','rain','storm','wind'])if(Number.isFinite(saved?.[k]))state[k]=clamp(saved[k],0,k==='wind'?2:1);
 if(Number.isFinite(saved?.cloudX))state.cloudX=saved.cloudX;if(Number.isFinite(saved?.cloudZ))state.cloudZ=saved.cloudZ;
 function tick(dt,player={x:0,z:0}){dt=Number.isFinite(dt)?Math.max(0,dt):0;const events=[];state.clockHours=(state.clockHours+dt*24/dayLength)%24;solar();state.elapsed+=dt;const t=state.elapsed;let mode=forced;
  if(!mode){let at=t%duration;for(const f of fronts){if(at<f[1]){mode=f[0];break;}at-=f[1];}}
  state.mode=mode;const goal=presets[mode],ease=1-Math.exp(-dt/12);for(const key of ['cloud','rain','wind','storm'])state[key]=mix(state[key],goal[key],ease);
  state.wet=clamp(state.wet+dt*(state.rain*.035-(1-state.rain)*.004));state.gust=state.wind*(.62+.23*Math.sin(t*.61)+.15*Math.sin(t*1.47));state.cloudX+=state.gust*.006*dt;state.cloudZ+=state.gust*.0018*dt;state.flash=Math.max(0,state.flash-dt*5.5);
  if(state.bolt){state.bolt.life-=dt;if(state.bolt.life<=0)state.bolt=null;}
  if(state.thunder>0){state.thunder-=dt;if(state.thunder<=0)events.push({name:'thunder',level:.50});}
  if(state.storm>.7){nextStrike-=dt;if(nextStrike<=0){state.strikes++;const n=state.strikes+Math.floor(t/duration)*103,a=hash(n)*Math.PI*2,dist=80+hash(n+1)*90;state.bolt={x:player.x+Math.cos(a)*dist,z:player.z+Math.sin(a)*dist,life:.32,seed:n};state.flash=1;state.thunder=.35+dist/343;nextStrike=9+hash(n+2)*13;events.push({name:'lightning'});}}
  return events;
 }
 function solar(){const hour=state.clockHours,elevation=Math.sin((hour-6)*Math.PI/12),daylight=smooth(-.08,.18,elevation),night=1-smooth(-.14,.06,elevation),twilight=(1-smooth(.08,.32,Math.abs(elevation)))*(1-night*.65);Object.assign(state,{hour,daylight,night});return {hour,elevation,daylight,night,twilight};}
 function environment(){const c=state.cloud,o=state.storm,f=state.flash,{hour,elevation,daylight,night,twilight}=solar(),angle=(hour-6)*Math.PI/12,col=(a,b,k)=>a.map((v,i)=>mix(v,b[i],k)),dark=clamp(c*.48+o*.4),moon=elevation<-.08,direction=moon?[-Math.cos(angle),Math.max(.12,-elevation),-.42]:[Math.cos(angle),Math.max(.08,elevation),.42],length=Math.hypot(...direction);
  const top=col([.008,.014,.035],col([.20,.43,.67],[.045,.06,.095],dark),daylight),bottom=col([.025,.038,.066],col([.70,.77,.79],[.12,.15,.20],dark),daylight),fog=col([.025,.033,.052],col([.64,.70,.71],[.10,.13,.17],dark),daylight),warm=col([1.62,1.44,1.16],[1.90,.76,.28],twilight);
  return {hour,clockHours:hour,daylight,night,twilight,sunElevation:elevation,skyTop:top,skyBottom:col(bottom,[.57,.24,.14],twilight*(1-c*.65)*.58),fog,sunDirection:direction.map(v=>v/length),sunColor:warm.map((v,i)=>v*daylight*(1-c*.62)*(1-o*.92)+[.045,.062,.10][i]*night*(1-c*.8)+f*1.4),ambient:col([.022,.030,.050],[.20,.23,.27],daylight).map(v=>v*(1-o*.55)+f*.85),wind:state.gust,fogDensity:.00035+state.rain*.0027,biome:'ville',outdoorZones:[{x:0,z:0,w:26000,d:30000}]};
 }
 function geometry(camera,world){const out=[],t=state.elapsed,p=camera.pos,windX=state.gust*3.3,windZ=state.gust*1.2,count=Math.floor(state.rain*380);
  for(let i=0;i<count;i++){const x=p[0]+((hash(i+10)*48+state.cloudX*550)%48+48)%48-24,z=p[2]+((hash(i+400)*48+state.cloudZ*(1.2/.0018))%48+48)%48-24,y=p[1]-3+((hash(i+800)*20-t*(12+hash(i)*4))%20+20)%20;
   const ground=world.ground?.(x,z)??.08,roof=Math.max(ground,world.roofHeight(x,z));if(y<roof+.4)continue;out.push({shape:'box',p:[x,y,z],s:[.013,.62+state.rain*.45,.013],r:[-windZ*.035,0,windX*.035],fx:true,alpha:.24+state.rain*.16,color:[.56,.68,.79],emissive:.12,mat:7,outdoor:true});
   if(i%14===0&&roof<ground+.12)out.push({shape:'ring',p:[x,ground+.015,z],s:[.14+.08*Math.sin(t*7+i),.007,.14+.08*Math.sin(t*7+i)],fx:true,alpha:.16,color:[.5,.63,.7],mat:7,outdoor:true});
  }
  const bolt=state.bolt;if(bolt){const ground=world.ground?.(bolt.x,bolt.z)??.08,top=Math.max(ground+92,p[1]+30),bottom=ground+3.8;let a=[bolt.x,top,bolt.z];for(let i=1;i<=9;i++){const b=[bolt.x+(hash(bolt.seed*19+i)-.5)*9,top+(bottom-top)*i/9,bolt.z+(hash(bolt.seed*21+i)-.5)*7],d=b.map((v,k)=>v-a[k]),len=Math.hypot(...d);out.push({shape:'cylinder',p:a.map((v,k)=>(v+b[k])/2),s:[.16,len,.16],r:[Math.acos(d[1]/len),Math.atan2(d[0],d[2]),0],fx:true,alpha:clamp(bolt.life*5),color:[.66,.79,1],emissive:8,mat:7,outdoor:true});a=b;}}
  return out;
 }
 tick(0);return {state,tick,environment,geometry,setHour(hour){if(!Number.isFinite(hour))return false;state.clockHours=((hour%24)+24)%24;solar();return true;},save:()=>({clockHours:state.clockHours,elapsed:state.elapsed,wet:state.wet,cloud:state.cloud,rain:state.rain,wind:state.wind,storm:state.storm,cloudX:state.cloudX,cloudZ:state.cloudZ}),force(name){if(name!==null&&!presets[name])return false;forced=name;if(name){Object.assign(state,presets[name],{mode:name});if(name==='orage')nextStrike=1;}return true;}};
}
R.weather={create,presets,fronts,duration,dayLength,initialHour};})(globalThis.RADE);
