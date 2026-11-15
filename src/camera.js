/* EMPRISE — continuous first/third person zoom with a swept camera clearance. */
(function(R){'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
// Keep the world depth range useful at city scale. The weapon has its own
// close projection; visible geometry still limits the near plane at corners.
function nearPlane(cam,world,aspect=16/9){
 const minimum=.035,maximum=.15;if(!world?.ray)return maximum;
 const y=cam.yaw||0,p=cam.pitch||0,r=cam.roll||0,sy=Math.sin(y),cy=Math.cos(y),sp=Math.sin(p),cp=Math.cos(p),cr=Math.cos(r),sr=Math.sin(r);
 const forward=[sy*cp,sp,-cy*cp],right=[cy*cr-sy*sp*sr,cp*sr,sy*cr+cy*sp*sr],up=[-cy*sr-sy*sp*cr,cp*cr,-sy*sr+cy*sp*cr];
 const tv=Math.tan(clamp(cam.fov||75,10,110)*Math.PI/360),th=tv*clamp(aspect,.25,4);let near=maximum;
 for(const [x,z]of [[0,0],[-1,-1],[-1,1],[1,-1],[1,1]]){const v=forward.map((f,i)=>f+right[i]*x*th+up[i]*z*tv),length=Math.hypot(...v),far=maximum*length+.025,hit=world.ray(cam.pos,v.map(n=>n/length),far);if(Number.isFinite(hit)&&hit<far-1e-6)near=Math.min(near,hit/length-.025);}
 return clamp(near,minimum,maximum);
}
function create(){let distance=0,target=0,visible=false;
 function zoom(delta){if(!Number.isFinite(delta))return;target=clamp(target+delta,0,8);if(target<.65)target=0;else if(distance<.1&&target<1.2)target=1.2;}
 function toggle(){target=target>.1?0:3.8;}
 function frame(player,world,dt,motion={},aim=0){distance+=(target-distance)*(1-Math.exp(-Math.max(0,dt)*14));if(target===0&&distance<.025)distance=0;
  const yaw=player.yaw,pitch=clamp(player.pitch,-1.4,1.4),origin=[player.x,player.y+1.62,player.z],dir=[-Math.sin(yaw)*Math.cos(pitch),-Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)];
  let safe=distance;
  if(distance>.05){for(const [x,y]of [[0,0],[-.16,0],[.16,0],[0,-.16],[0,.16]]){const o=[origin[0]+Math.cos(yaw)*x,origin[1]+y,origin[2]+Math.sin(yaw)*x];safe=Math.min(safe,Math.max(0,world.ray(o,dir,distance+.18)-.18));}}
  visible=safe>.75;
  const pos=origin.map((v,k)=>v+dir[k]*safe+(k===1&&!visible?(motion.height||0):0));let viewYaw=yaw,viewPitch=pitch;
  if(visible){
   // Offset the shoulder without moving the firing ray. The crosshair looks at
   // the same physical impact point as the first-person weapon.
   const shoulder=[Math.cos(yaw)*.38,.48,Math.sin(yaw)*.38],length=Math.hypot(...shoulder),unit=shoulder.map(v=>v/length),offset=Math.max(0,Math.min(length,world.ray(pos,unit,length+.16)-.16));
   for(let i=0;i<3;i++)pos[i]+=unit[i]*offset;
   const forward=dir.map(v=>-v),range=Math.max(.2,world.ray(origin,forward,120)),target=origin.map((v,i)=>v+forward[i]*range),delta=target.map((v,i)=>v-pos[i]);viewYaw=Math.atan2(delta[0],-delta[2]);viewPitch=Math.atan2(delta[1],Math.hypot(delta[0],delta[2]));
  }
  return {pos,yaw:viewYaw,pitch:viewPitch,roll:visible?0:motion.roll||0,fov:visible?68-aim*8:74+(motion.fov||0)-aim*16,thirdPerson:visible,zoom:distance,clearance:safe};
 }
 return {zoom,toggle,frame,reset(value=0){distance=target=Number.isFinite(value)?clamp(value,0,8):0;visible=false;},get target(){return target;},get distance(){return distance;},get thirdPerson(){return visible;}};
}
R.camera={create,nearPlane};})(globalThis.RADE=globalThis.RADE||{});
