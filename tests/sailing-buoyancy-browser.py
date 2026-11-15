"""Native sea, hull and cloth rendering in both production backends."""
from browser_support import Browser,ROOT
import json,hashlib,time
reports=[]
for backend in ['webgpu','webgl2']:
 with Browser() as b:
  b.load('?test=1&renderer='+backend)
  b.ev('RADE.game.start();RADE.game.pause();document.getElementById("paused").hidden=true;true')
  setup=b.ev('''(()=>{const g=RADE.game,s=g.session,m=s.marine,q=m.boats.find(b=>b.kind==='sailboat');globalThis.sailTest={s,m,q,start:{x:q.x,z:q.z}};Object.assign(s.player,{x:q.x,z:q.z});m.enterWater(s.player);if(!s.interact())throw Error('Boarding failed');for(let i=0;i<2400;i++)m.update(1/120,{},s.player,s.weather.state);return {distance:Math.hypot(q.x-sailTest.start.x,q.z-sailTest.start.z),speed:q.speed,blocked:q.blocked,engineOn:q.engineOn,load:q.load,sea:RADE.marineWater.state(s),marineTime:m.time,sessionTime:s.time};})()''')
  assert setup['distance']>8 and setup['speed']>.4 and not setup['blocked'] and not setup['engineOn'],setup
  assert setup['sea']['motion'][0]==setup['marineTime'] and setup['marineTime']>setup['sessionTime']+19,setup
  def settle():b.ev('(async()=>{for(let i=0;i<16;i++)await new Promise(requestAnimationFrame);return true;})()')
  def side():
   b.ev('''(()=>{const q=sailTest.q,pos=[q.x+10,q.y+4,q.z-8],dx=q.x-pos[0],dz=q.z-pos[2],dy=q.y+2.5-pos[1];RADE.game.camera={pos,yaw:Math.atan2(dx,-dz),pitch:Math.atan2(dy,Math.hypot(dx,dz)),fov:64,near:.05,far:26000,allStatic:true,chunked:true};return true;})()''')
  side();settle();b.capture('sailing-'+backend+'-side.png')
  b.ev('RADE.game.camera=null;true');settle();b.capture('sailing-'+backend+'-helm.png')
  b.ev('''(()=>{const {s,m,q}=sailTest;Object.assign(s.weather.state,{wind:1.55,windDirection:0});q.sailAngle=RADE.marine.sailDrive(q,s.weather.state).idealAngle;for(let i=0;i<240;i++)m.update(1/120,{},s.player,s.weather.state);return true;})()''');side();settle();b.capture('sailing-'+backend+'-waves.png')
  waves=b.ev('''(()=>{const {s,m,q}=sailTest,w=RADE.marine.seaHeight(q.x,q.z,m.time,s.weather.state.wind,RADE.marine.windDirection(s.weather.state));return {level:w,hull:q.y,roll:q.roll,pitch:q.pitch,load:q.load,force:q.force,errors:RADE.game.errors,backendEvents:RADE.game.backendEvents,renderer:RADE.game.renderer.stats.backend};})()''')
  assert abs(waves['level']-waves['hull'])<.18 and abs(waves['roll'])<.35 and waves['load']>.1,waves
  assert not waves['errors'] and not waves['backendEvents'] and waves['renderer']==backend,waves
  reports.append({'backend':backend,'departure':setup,'waves':waves})
result={'test':'PASS native sailing, departure and waves','buildSha256':hashlib.sha256((ROOT/'dist/index.html').read_bytes()).hexdigest(),'runs':reports,'limits':'Simulation stepped at 120Hz for reproducible capture; this test is not a frame pacing benchmark or physical phone test.'}
(ROOT/'docs/sailing-buoyancy-browser.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False,indent=2))
