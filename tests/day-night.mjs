import './load.mjs';
import assert from 'node:assert/strict';
const near=(a,b,e=1e-8)=>assert(Math.abs(a-b)<e,`${a} != ${b}`),W=RADE.weather,w=W.create();
assert.equal(W.dayLength,1200);assert.equal(w.state.clockHours,14);
const luminance=c=>c[0]*.2126+c[1]*.7152+c[2]*.0722;
w.setHour(12);const noon=w.environment();w.setHour(0);const midnight=w.environment();
assert.equal(noon.daylight,1);assert.equal(noon.night,0);assert.equal(midnight.daylight,0);assert.equal(midnight.night,1);
assert(luminance(midnight.skyTop)<luminance(noon.skyTop)*.1);assert(luminance(midnight.ambient)<luminance(noon.ambient)*.2);
assert(midnight.sunColor.every(v=>v>0),'moonlight keeps silhouettes legible');
w.setHour(23.99);w.tick(1);near(w.state.clockHours,.01);w.tick(W.dayLength);near(w.state.clockHours,.01);
w.setHour(-2);near(w.state.clockHours,22);w.setHour(50);near(w.state.clockHours,2);assert(!w.setHour(NaN));assert(!w.setHour(Infinity));near(w.state.clockHours,2);
w.tick(-1);w.tick(NaN);near(w.state.clockHours,2);
for(const mode of Object.keys(W.presets)){
 w.force(mode);let previous=null;
 for(let minute=0;minute<=1440;minute++){
  w.setHour(minute/60);const env=w.environment();
  for(const field of ['hour','daylight','night','twilight','sunElevation','fogDensity'])assert(Number.isFinite(env[field]));
  for(const field of ['skyTop','skyBottom','fog','sunColor','ambient','sunDirection'])assert(env[field].every(Number.isFinite));
  near(Math.hypot(...env.sunDirection),1);assert(env.sunDirection[1]>0);
  if(previous)for(const field of ['daylight','night','twilight'])assert(Math.abs(env[field]-previous[field])<.05,'smooth dawn/dusk '+field);
  previous=env;
 }
}
const original=W.create();original.setHour(21.37);for(let n=0;n<121;n++)original.tick(1/120);const save=original.save(),copy=W.create(save);near(copy.state.clockHours,original.state.clockHours);assert.deepEqual(copy.environment(),original.environment());
for(let n=0;n<600;n++){original.tick(1/120);copy.tick(1/120);}near(copy.state.clockHours,original.state.clockHours);assert.deepEqual(copy.environment(),original.environment());
assert.equal(W.create({elapsed:450}).state.clockHours,14,'legacy saves start at the documented default');assert.equal(W.create({clockHours:Infinity}).state.clockHours,14);
const rain=W.create();rain.force('pluie');const ground=(x,z)=>154+x*.1+z*.05,highCamera={pos:[0,155.7,0]},highRain=rain.geometry(highCamera,{ground,roofHeight:ground}),drops=highRain.filter(m=>m.shape==='box'),splashes=highRain.filter(m=>m.shape==='ring');assert(drops.length>200&&splashes.length>10,'rain remains visible on elevated terrain');for(const m of drops){assert(m.p[1]>=highCamera.pos[1]-3&&m.p[1]<highCamera.pos[1]+17);assert(m.p[1]>=ground(m.p[0],m.p[2])+.4);}for(const m of splashes)near(m.p[1],ground(m.p[0],m.p[2])+.015);assert.equal(rain.geometry(highCamera,{ground,roofHeight:()=>200}).length,0,'high roof still shelters rain');assert(!rain.geometry(highCamera,{ground,roofHeight:(x,z)=>ground(x,z)+2}).some(m=>m.shape==='ring'),'no ground splashes under a roof');
const thunder=W.create();thunder.force('orage');assert(thunder.tick(1,{x:0,z:0}).some(e=>e.name==='lightning'));const terrain=154,lightningWorld={ground:()=>terrain,roofHeight:()=>terrain};for(const cameraY of [155.7,400]){const bolts=thunder.geometry({pos:[0,cameraY,0]},lightningWorld).filter(m=>m.shape==='cylinder');assert.equal(bolts.length,9);const top=Math.max(terrain+92,cameraY+30),bottom=terrain+3.8,segment=(top-bottom)/9;near(bolts[0].p[1],top-segment/2);near(bolts[8].p[1],bottom+segment/2);assert(bolts.every(m=>m.p[1]>terrain&&[...m.p,...m.s,...m.r].every(Number.isFinite)));}
console.log('PASS day/night: 20-minute cycle, smooth dawn/dusk, sun/moon direction, saved-clock continuity, legacy saves, elevated rain/splashes/lightning, roof shelter');
