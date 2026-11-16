
window.result={};
function run(Render,label){
 const canvas=document.createElement('canvas');canvas.width=480;canvas.height=360;canvas.style='width:480px;height:360px';document.body.append(canvas);
 const r=Render.create(canvas,{msaa:0,vignette:1}),gl=r.gl,w=canvas.width,h=canvas.height;
 const eye=[0,1.7,0],camera={pos:eye,yaw:-Math.PI/4,pitch:-Math.atan2(1.7,Math.hypot(12,12)),near:.035,far:150,fov:55,allStatic:true};
 const env={sunDirection:[.5,.8,.3],sunColor:[0,0,0],ambient:[.01,.01,.01],wind:0,fogDensity:.0001,skyTop:[.01,.01,.01],skyBottom:[.01,.01,.01],fog:[.01,.01,.01],outdoorZones:[{x:0,z:0,w:1000,d:1000}]};
 r.setWorld([{shape:'box',p:[0,-.1,0],s:[100,.2,100],mat:3,color:[.7,.7,.7],outdoor:true}],[],env);
 const lamps=Array.from({length:8},(_,i)=>({p:[-(5+i*1.2),5,-5],color:[1,.77,.44],power:64,range:19})),beacon={p:[0,1.6,-2],color:[.08,.3,1],power:0,selectionPower:45,range:10};
 const axes=Render.shared.cameraAxes(camera),tan=Math.tan(camera.fov*Math.PI/360),mask=[];let minDistance=Infinity;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const u=((x+.5)/w*2-1)*w/h*tan,v=((y+.5)/h*2-1)*tan,ray=axes.forward.map((n,i)=>n+axes.right[i]*u+axes.up[i]*v);
  if(ray[1]>=0)continue;const at=eye.map((n,i)=>n+ray[i]*(-eye[1]/ray[1]));
  const dist=Math.hypot(...at.map((n,i)=>n-beacon.p[i]));
  if(at[0]>=-14&&at[0]<=-10&&at[2]>=-14&&at[2]<=-10&&dist>beacon.range+1){mask.push((y*w+x)*4);minDistance=Math.min(minDistance,dist);}
 }
 if(mask.length<10)throw Error('Insufficient analytically selected ground pixels');
 const rows=[],images={};let baseline=null;
 for(const power of [0,5,12,22.5,35,45,35,22.5,12,5,0]){
  const lights=[...lamps,{...beacon,power}];r.draw(camera,[],{time:0,shadows:false,sunOnly:true,torch:false,bloom:false,reflections:false,msaa:false,adaptive:false,lights});
  const pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);baseline??=pixels;
  let changed=0,max=0,sum=0;for(const at of mask){let d=0;for(let c=0;c<3;c++){const delta=Math.abs(pixels[at+c]-baseline[at+c]);d=Math.max(d,delta);sum+=delta;}max=Math.max(max,d);changed+=d>1;}
  rows.push({power,changedPixels:changed,maxChannelDifference:max,meanAbsoluteDifference:sum/(mask.length*3),selectedX:Array.from(Render.shared.transientLights(lights,eye,8),l=>l.p[0]),error:gl.getError()});
  if(power===0||power===45)images[String(power)]=canvas.toDataURL('image/png');
 }
 const out={label,backend:r.stats.backend,resolution:[w,h],measuredPixels:mask.length,minBeaconDistance:minDistance,beaconRange:beacon.range,rows,images};r.dispose();canvas.remove();return out;
}
window.result.before=run(OldRender,'instantaneous-rank');window.result.after=run(NewRender,'nominal-rank');window.ready=true;
