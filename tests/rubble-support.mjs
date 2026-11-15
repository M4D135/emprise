import './load.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const checks=[],volume=m=>m.s.reduce((a,b)=>a*b,1);
// Direct physical bodies: exact rotated surfaces, no broad-box support or moving platforms.
const player={x:100,y:.08,z:100,hp:100,yaw:0,pitch:0},world={scenery:[],boxes:[],fleet:[],room:null,combatWorld:{spatial:{}},ground:()=>.08,candidates:()=>[],replaceScenery(){},dynamicBodies:[]},urban=RADE.urban.create(world,{state:{player},hurt(){}});
const piece=(x,y,size,rotation=[0,0,0],velocity=[0,0,0],spin=[0,0,0])=>urban.spawnBody({shape:'box',p:[x,y,0],s:size,r:rotation,mat:3,material:'stone',structural:true},velocity,spin,volume({s:size})*2200);
piece(0,.23,[1,.3,1]);piece(3,.33,[1,.5,1]);piece(6,.23,[1,.3,1],[0,0,0],[0,-3,0]);piece(9,.23,[1,.3,1],[0,0,0],[0,0,0],[0,2,0]);piece(12,.23,[2,.3,.2],[0,Math.PI/4,0]);urban.update(0);
const support=(x,z=0)=>world.combatWorld.spatial.support(x,z,.08,.28,.08,.42);
assert(Math.abs(support(0)-.38)<1e-8);assert.equal(support(3),.08,'A 50cm step cannot be climbed');assert.equal(support(6),.08,'Falling body cannot provide a foot support');assert.equal(support(9),.08,'Spinning body cannot provide a foot support');assert.equal(support(12.6,.6),.08,'Empty corner of rotated broad box is not a surface');assert.equal(support(1.5),.08,'Leaving a block returns terrain support');
checks.push('Stable actual OBB supports feet; >42cm, falling/spinning and empty AABB corners rejected');
// Exact observed b640 rocket fixture. Neither damage nor player trajectory is mocked.
const s=RADE.session.create({pedestrians:0});s.sim.state.enemies.forEach(e=>e.deployed=false);
const damage=s.world.cityStream.damage;let originalVolume=0;
s.world.cityStream.damage=(...args)=>{const result=damage(...args);originalVolume+=result.debris.filter(q=>q.structural&&q.sourceId?.startsWith('city:')).reduce((v,q)=>v+q.volume,0);return result;};
s.sim.relocate(-1267.7049191191688,1308.7105367620727,2.6175204708148416);s.player.pitch=Math.atan2(1.25-1.62,12);s.sim.selectWeapon(2);s.sim.fire();let born=null,maxHeight=.08,moved=0;
for(let i=0;i<1000;i++){const age=born===null?-1:i-born,walking=age>168&&age<672;if(age>168)s.player.pitch=0;s.update(1/120,{moveY:walking?1:0});if(walking)moved++;if(s.urban.bodies.length&&born===null)born=i;maxHeight=Math.max(maxHeight,s.player.y);if(age===700)break;}
const progress=(s.player.x+1261.7)*.5004099265974136+(s.player.z-1319.1)*.8657886031605934;
assert(born!==null);assert(progress>.3,JSON.stringify({progress,player:s.player}));assert(s.player.hp>0);assert(!s.world.blocked(s.player.x,s.player.z,.28,s.player.y));assert(maxHeight>.3,'Feet actually climbed settled debris');assert(Math.abs(s.player.y-s.world.ground(s.player.x,s.player.z))<.02,'Feet returned to terrain after rubble');assert(s.urban.bodies.length<=48);
const retained=s.urban.bodies.reduce((v,q)=>v+volume(q.mesh),0),crumble=s.urban.report.crumbleVolume;
assert(Math.abs(retained+crumble-originalVolume)<1e-7,'Retained rubble plus pulverised material accounts for removed wall');for(const q of s.urban.bodies){assert(Math.abs(q.mass-volume(q.mesh)*2200)<1e-6);assert(Math.max(...q.mesh.s)<=.5);assert(!q.engine.body(q.handle).lost);}
checks.push('Actual rocket + 1.4s settling + 4.2s W crosses b640; solid rubble, exact mass/volume and bounded dust');
// Save while standing on a real stable block; restore through the actual campaign/urban order.
const [x,z]=s.world.freeNear(65,189,4),base=s.world.ground(x,z);s.sim.relocate(x,z);const block=s.urban.spawnBody({shape:'box',p:[x,base+.15,z],s:[1.2,.3,1.2],r:[0,0,0],mat:3,material:'stone',structural:true},[0,0,0],[0,0,0],950.4);s.urban.update(0);s.player.y=base+.3;s.player.hp=77;s.campaign.state.cash=321;const saved=s.save(),restored=RADE.session.create({pedestrians:0,saved,now:saved.savedAt});assert.equal(restored.campaign.state.cash,321);assert.equal(restored.player.hp,77);assert(Math.hypot(restored.player.x-x,restored.player.z-z)<.05);assert(Math.abs(restored.player.y-(base+.3))<.01);assert(!restored.world.blocked(x,z,.28,restored.player.y));restored.sim.dispose();
checks.push('Save on rubble restores same validated support, health and economy');
// The step never bypasses a ceiling or a jamb: the normal capsule test still runs.
s.world.addBox({x,z,a:1.1,b:1.1,minY:base+1.95,maxY:base+2.2,cap:0});s.sim.relocate(x-1.2,z,Math.PI/2);for(let i=0;i<12;i++)s.sim.move(s.player,.1,0);assert(s.player.x<x-.65);assert(s.player.y<base+.03);assert(!s.world.blocked(s.player.x,s.player.z,.28,s.player.y));
checks.push('Low ceiling prevents climbing block; capsule cannot cross overhead solid');s.sim.dispose();
const report={checks,progress,maxHeight,walkingSeconds:moved/120,fragments:s.urban.bodies.length-1,removedVolume:originalVolume,retainedVolume:retained,pulverisedVolume:crumble,maxStep:.42};fs.writeFileSync(new URL('../docs/rubble-support-validation.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
