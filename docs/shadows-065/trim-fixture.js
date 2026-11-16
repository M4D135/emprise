
const canvas=document.querySelector('canvas'),r=FRender.create(canvas,{msaa:4,vignette:1}),gl=r.gl,w=canvas.width,h=canvas.height;
const env={sunDirection:[.45,.75,.5],sunColor:[1.5,1.43,1.32],ambient:[.32,.34,.37],skyTop:[.26,.39,.52],skyBottom:[.68,.73,.77],fog:[.68,.73,.77],fogDensity:0,wind:0};
r.setWorld([{shape:'box',p:[0,-.065,0],s:[30,.13,30],color:[.39,.40,.41],mat:0}],[],env,{revisionedMeshes:true});
const meshes=[];RADE.vehicles.render({model:'gti',color:'#bb2729',x:0,y:0,z:0,cap:0,volant:0,moteur:false,distance:0},meshes,{});
const pos=[0,1.02,6.5],target=[0,.70,0],d=target.map((n,i)=>n-pos[i]);
const camera={pos,yaw:Math.atan2(d[0],-d[2]),pitch:Math.atan2(d[1],Math.hypot(d[0],d[2])),fov:42,near:.035,far:100,allStatic:true,chunked:true,sun:{center:[0,.6,0],extent:7,depth:20}};
function read(){const a=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;}
function draw(on,step,mode){r.setEnvironment({...env,sunDirection:mode==='sun'?[.45+step*.000087,.75,.5]:env.sunDirection});camera.sun.center=[mode==='center'?step*.001:0,.6,0];r.draw(camera,meshes,{time:0,shadows:on,sunOnly:true,torch:false,bloom:false,reflections:false,msaa:true,adaptive:false});return read();}
window.probe=()=>{const results={};for(const mode of ['fixed','center','sun']){let first=null,previous=null;const rows=[];for(let step=0;step<=12;step++){
 const off=draw(false,step,mode),on=draw(true,step,mode),mask=[];let total=0,max=0,changed=0,sumDelta=0,maxDelta=0;const cols=[];
 for(let x=Math.floor(w*550/1440);x<w*885/1440;x++){let col=0,n=0;for(let y=Math.floor(h*(1-496/900));y<h*(1-478/900);y++){const at=(y*w+x)*4;let v=0;for(let c=0;c<3;c++)v=Math.max(v,off[at+c]-on[at+c]);mask.push(v);total+=v;col+=v;n++;max=Math.max(max,v);if(previous){const delta=Math.abs(v-previous[mask.length-1]);maxDelta=Math.max(maxDelta,delta);sumDelta+=delta;changed+=delta>2;}}cols.push(col/n);}
 let curvature=0;for(let i=1;i<cols.length-1;i++)curvature+=Math.abs(cols[i-1]-2*cols[i]+cols[i+1]);
 rows.push({step,meanDark:total/mask.length,maxDark:max,meanColumnCurvature:curvature/(cols.length-2),changedPixels:changed,meanTemporalDelta:sumDelta/mask.length,maxTemporalDelta:maxDelta,error:gl.getError()});first??=mask;previous=mask;
 if(mode==='fixed'&&step===0)results.image=canvas.toDataURL('image/png');
 }results[mode]=rows;}return results;};window.ready=true;
