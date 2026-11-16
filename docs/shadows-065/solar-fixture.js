
const canvas=document.querySelector('canvas'),r=FRender.create(canvas,{msaa:0,vignette:1}),gl=r.gl,w=canvas.width,h=canvas.height,weather=RADE.weather.create();
weather.force('soleil');
const floor={shape:'box',p:[0,-.1,0],s:[100,.2,100],mat:0,color:[.55,.55,.55],outdoor:true};
const fixtures={wall:{meshes:[{shape:'box',p:[0,10,0],s:[40,30,.2],mat:0,color:[.65,.6,.52],outdoor:true}],camera:{pos:[0,10,18],yaw:0,pitch:0}},floor:{meshes:[floor],camera:{pos:[0,6,12],yaw:0,pitch:-Math.atan2(6,12)}},occluder:{meshes:[floor,{shape:'box',p:[0,2,0],s:[3,4,3],mat:0,color:[.6,.5,.4],outdoor:true}],camera:{pos:[10,10,15],yaw:Math.atan2(-10,15),pitch:-Math.atan2(10,Math.hypot(10,15))}}};
function env(hour){weather.setHour(hour);return {...weather.environment(),wind:0,fogDensity:.0001};}
function image(){const a=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;}
window.runTemporal=(name,hour,mode)=>{const f=fixtures[name],base={...f.camera,near:.035,far:500,fov:60,allStatic:true,sun:{center:[0,5,0],extent:110,depth:150}},rows=[];let previous=null;r.setWorld(f.meshes,[],env(hour));
 for(let frame=0;frame<=30;frame++){
  const sec=frame/60,angle=mode==='sun'?hour+sec*.02:hour;
  r.setEnvironment(env(angle));const shift=mode==='center'?frame*.003:0,cam={...base,sun:{...base.sun,center:[shift,5,0]}};
  const fx={time:0,sunOnly:true,torch:false,bloom:false,reflections:false,msaa:false,adaptive:false};
  r.draw(cam,[],{...fx,shadows:false});const off=image();r.draw(cam,[],{...fx,shadows:true});const on=image();
  let dark=0,max=0,total=0,changed=0,maskDelta=0;const mask=new Float32Array(w*h);
  const box=name==='occluder'?[0,w,0,h]:[Math.floor(w*.3),Math.floor(w*.7),Math.floor(h*.35),Math.floor(h*.65)];
  for(let y=box[2];y<box[3];y++)for(let x=box[0];x<box[1];x++){const at=(y*w+x)*4;let d=0;for(let c=0;c<3;c++)d=Math.max(d,off[at+c]-on[at+c]);mask[y*w+x]=d;dark+=d>2;max=Math.max(max,d);total+=d;if(previous){const delta=Math.abs(d-previous[y*w+x]);changed+=delta>2;maskDelta=Math.max(maskDelta,delta);}}
  rows.push({frame,hour:angle,darkPixels:dark,maxDark:max,totalDark:total,changedShadowPixels:changed,maxShadowDelta:maskDelta,error:gl.getError()});previous=mask;
 }
 return {name,hour,mode,rows,quality:{...r.stats},resolution:[w,h]};
};
window.ready=true;
