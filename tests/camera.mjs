import '../src/camera.js';import assert from 'node:assert/strict';
const p={x:0,y:.08,z:0,yaw:0,pitch:0},open={ray:(o,d,far)=>far},c=RADE.camera.create();
assert.equal(c.frame(p,open,1/60).thirdPerson,false);c.zoom(3.8);let cam;for(let i=0;i<90;i++)cam=c.frame(p,open,1/60);assert(cam.thirdPerson);assert(cam.pos[2]>3.7);assert(cam.pos[1]>2);assert(cam.pos[0]>.3);
// The offset camera and the actual weapon ray converge at the same obstacle.
const target=[0,1.7,-120],dx=target[0]-cam.pos[0],dz=target[2]-cam.pos[2];assert(Math.abs(cam.yaw-Math.atan2(dx,-dz))<1e-6);
const wall={ray:(o,d,far)=>d[2]>.1?Math.min(far,.48):far};cam=c.frame(p,wall,1/60);assert(cam.clearance<=.301);assert(!cam.thirdPerson,'Hide body when backed into a wall');assert(cam.pos[2]<=.301);
for(let i=0;i<30;i++)c.zoom(-.75);for(let i=0;i<90;i++)cam=c.frame(p,open,1/60);assert.equal(cam.thirdPerson,false);assert.equal(c.target,0);assert(Math.abs(cam.pos[2])<.03);
c.zoom(Infinity);assert.equal(c.target,0);c.toggle();assert(c.target>0);for(let i=0;i<90;i++)c.zoom(.75);assert.equal(c.target,8);console.log('Camera: zoom FPS/third person, shoulder aim, collision clearance and finite limits PASS');
// A close wall, including at a frustum corner, must precede the near plane.
const view={pos:[0,1.62,0],yaw:0,pitch:0,fov:74};assert.equal(RADE.camera.nearPlane(view,open),.15);
const frontal={ray:(o,d,far)=>d[2]<0?Math.min(far,-.1/d[2]):far};assert(Math.abs(RADE.camera.nearPlane(view,frontal)-.075)<1e-9);
const sideWall={ray:(o,d,far)=>d[0]>0?Math.min(far,.08/d[0]):far};
for(const aspect of [1,16/9,2.4]){const near=RADE.camera.nearPlane(view,sideWall,aspect);assert(near<.08/(Math.tan(74*Math.PI/360)*aspect));assert(near>=.035);}
assert.equal(RADE.camera.nearPlane(view,{ray:()=>0}),.035,'Preserve close cockpit/camera recovery');
assert.equal(RADE.camera.nearPlane(view,{ray:()=>NaN}),.15);console.log('Camera: adaptive city near plane, close wall/frustum corners and cockpit minimum PASS');
