#!/usr/bin/env python3
"""Phone UI, native input routes, camera clearance and day/night visual fixtures.

Run only after build.py and after the coordinating agent releases Chrome.
Uses a virtual standard pad through navigator.getGamepads; no physical hardware
is claimed. Time, position and scenic camera fixtures are recorded in the report.
No quest, message, payment, wanted level, enemy state or light is fabricated.
"""
from browser_support import Browser,ROOT
import hashlib,json,math,time

with Browser() as b:
 b.cmd('Page.addScriptToEvaluateOnNewDocument',{'source':'''window.virtualPad={id:'Xbox 360 Controller (STANDARD GAMEPAD)',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({value:0,pressed:false}))};Object.defineProperty(navigator,'getGamepads',{value:()=>virtualPad.connected?[virtualPad]:[]});'''})
 b.load();ev=b.ev;checks=[];captures=[];fixtures=[]
 def key(code,down=True):b.cmd('Input.dispatchKeyEvent',{'type':'keyDown' if down else 'keyUp','code':code,'key':code[3:].lower() if code.startswith('Key') else code})
 def tap(code):key(code);time.sleep(.08);key(code,False);time.sleep(.13)
 def pad(index):
  ev(f'virtualPad.buttons[{index}]={{value:1,pressed:true}};true');time.sleep(.12)
  ev(f'virtualPad.buttons[{index}]={{value:0,pressed:false}};true');time.sleep(.18)
 def capture(name):time.sleep(.22);b.capture(name);captures.append(name)
 def click(selector):
  q=ev('(()=>{const e=document.querySelector('+json.dumps(selector)+');if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');assert q,selector
  b.cmd('Input.dispatchMouseEvent',{'type':'mousePressed','button':'left','clickCount':1,**q});b.cmd('Input.dispatchMouseEvent',{'type':'mouseReleased','button':'left','clickCount':1,**q});time.sleep(.18)
 def wheel(delta):b.cmd('Input.dispatchMouseEvent',{'type':'mouseWheel','x':720,'y':450,'deltaX':0,'deltaY':delta});time.sleep(.20)
 def scenic(pos,target,fov=60):
  d=[target[i]-pos[i] for i in range(3)];cam={'pos':pos,'yaw':math.atan2(d[0],-d[2]),'pitch':math.atan2(d[1],math.hypot(d[0],d[2])),'roll':0,'fov':fov,'near':.035,'far':26000,'allStatic':True,'chunked':True}
  ev('RADE.game.camera='+json.dumps(cam)+';true');fixtures.append({'camera':cam})
 def place(x,z):
  count=ev('RADE.game.drawCount');ev(f's.sim.relocate({x},{z},0);true');fixtures.append({'position':[x,z]})
  b.wait('RADE.game.drawCount>'+str(count+3),15)
  b.wait('!w.cityStream.pending&&w.cityStream.stats.residentChunks>0',60)
 def hour(h):ev(f's.weather.setHour({h});s.weather.force("soleil");true');fixtures.append({'clockHour':h,'weather':'soleil'})
 # Start by the actual browser Gamepad API navigation route, then wait for the
 # original 15-second SMS timer. The test never calls phone.offer/update/respond.
 pad(0);b.wait('RADE.game.running',10);ev('globalThis.s=RADE.game.session;globalThis.w=s.world;true')
 started=ev('s.time');b.wait('s.phone.messages.some(m=>m.status==="offered")',75)
 offered=ev('s.phone.messages.find(m=>m.status==="offered")');assert offered['createdAt']>=14.99,offered
 contract=offered['contract'];assert contract and contract['sourceAddress'] and contract['targetAddress']
 assert not any(s in (contract['sourceAddress']+' '+contract['targetAddress']).lower() for s in ['non renseign','inconnue','sans adresse']),contract
 tap('KeyO');b.wait('RADE.game.panel==="phone"');capture('experience-phone-list.png')
 click('.phone-thread');b.wait('document.querySelector(".sms-actions button")!==null');assert ev('document.getElementById("phone-content").innerText.includes('+json.dumps(contract['sourceAddress'])+')')
 capture('experience-phone-contract.png');click('.sms-actions button');b.wait('s.phone.active!==null');assert ev('s.phone.active.messageId')==offered['id'];b.wait('document.getElementById("phone-contract").hidden===false');capture('experience-phone-accepted.png')
 tap('KeyO');b.wait('RADE.game.panel===null');pad(12);b.wait('RADE.game.panel==="phone"');assert ev('document.body.classList.contains("pad")');pad(1);b.wait('RADE.game.panel===null')
 checks.append('SMS offered after natural 15-second game timer, known addresses, keyboard O, pointer accept, accepted contract, D-pad up and B through Gamepad API')
 layout=ev('(()=>{const r=id=>{const q=document.getElementById(id).getBoundingClientRect();return {x:q.x,y:q.y,width:q.width,height:q.height};};return {pause:r("pause"),cash:r("cash"),wanted:r("wanted"),width:innerWidth};})()')
 assert layout['pause']['x']<layout['width']/3 and layout['cash']['x']>layout['width']*2/3 and layout['wanted']['x']>layout['width']*2/3,layout
 tap('KeyP');b.wait('!RADE.game.running');capture('experience-pause-layout.png');tap('KeyP');b.wait('RADE.game.running');checks.append('Pause button at left, money/wanted at right, keyboard pause/resume')
 # A fixture chooses an actual clear patch, and genuine mouse wheel events
 # change first/third-person distance. The camera algorithm is not overridden.
 point=ev('(()=>{for(let z=85;z<190;z+=3)for(let x=50;x<150;x+=3){const y=w.ground(x,z);if(w.blocked(x,z,.35,y,1.8))continue;if(w.ray([x,y+1.62,z],[0,0,1],9)>8)return {x,z};}return null;})()');assert point
 place(point['x'],point['z']);assert ev('RADE.game.followCamera.target')==0
 for _ in range(5):wheel(120)
 b.wait('RADE.game.followCamera.thirdPerson',6);capture('experience-third-person.png');zoom=ev('RADE.game.followCamera.target');assert zoom>=3
 for _ in range(14):wheel(-120)
 b.wait('RADE.game.followCamera.distance===0',6);assert not ev('RADE.game.followCamera.thirdPerson');capture('experience-first-person.png')
 # Find a real solid wall and place the player 42cm outside its actual OBB.
 # No collision proxy or world.ray replacement is introduced by this fixture.
 wall=ev('''(()=>{for(const q of w.boxes){if(q.kind!=='urban'||q.a<3||q.b<3||q.minY>.1||q.maxY<3||Math.hypot(q.x,q.z)>400)continue;for(const sign of [-1,1]){const nx=sign*q.c,nz=sign*q.s,x=q.x+nx*(q.a+.42),z=q.z+nz*(q.a+.42),y=w.ground(x,z);if(w.blocked(x,z,.30,y,1.8))continue;const ray=w.ray([x,y+1.62,z],[-nx,0,-nz],8);if(ray>.30&&ray<.60)return {x,z,yaw:Math.atan2(nx,-nz),ray};}}return null;})()''');assert wall,'No suitable existing wall found'
 ev(f's.sim.relocate({wall["x"]},{wall["z"]},{wall["yaw"]});true');fixtures.append({'wallPlayer':wall})
 for _ in range(5):wheel(120)
 b.wait('RADE.game.followCamera.target>=3&&RADE.game.followCamera.distance>2',6)
 wall_camera=ev('RADE.game.followCamera.frame(s.player,w,0)');assert wall_camera['clearance']<.5 and not wall_camera['thirdPerson'],wall_camera;capture('experience-camera-wall.png')
 checks.append('Native mouse wheel moves FPS/third person; actual wall retracts camera and hides close body without ray or collision substitution')
 # Visual fixtures deliberately pause gameplay. Hours and views are controlled;
 # all illumination, streamed geometry and terrain remain normal game code.
 tap('KeyP');b.wait('!RADE.game.running');ev('document.getElementById("paused").hidden=true;true')
 # Read-only instrumentation observes the actual light list passed to WebGL.
 # It forwards the original render call unchanged; no light is injected.
 ev('''globalThis.actualLighting=null;const draw=RADE.game.renderer.draw;RADE.game.renderer.draw=function(camera,models,fx){actualLighting={night:s.weather.environment().night,lights:(fx.lights||[]).map(l=>({p:l.p.slice(),power:l.power,range:l.range}))};return draw.call(this,camera,models,fx);};true''')
 landmark=ev('({center:w.landmarks.center,statue:w.landmarks.statue,ground:w.landmarks.groundLevel})');cx=landmark['center']['x'];cz=landmark['center']['z'];base=landmark['ground']
 for h in [23,17,12]:
  hour(h);place(100,130);scenic([-300,8,0],[cx-15,base+34,cz],60);capture('experience-bonne-mere-port-'+str(h)+'.png')
  place(cx+130,cz-110);scenic([cx+130,base+49,cz-110],[cx-6,base+29,cz],62);capture('experience-bonne-mere-near-'+str(h)+'.png')
  env=ev('s.weather.environment()');assert abs(env['hour']-h)<.001;assert (env['night']>.99 if h==23 else env['daylight']>.99),env
 # Ground/physics are checked numerically in the same built browser session.
 terrain=ev('({actual:w.ground(w.landmarks.center.x,w.landmarks.center.z),expected:w.landmarks.groundHeight(w.landmarks.center.x,w.landmarks.center.z),meshes:w.landmarks.geometry.length,nightShells:w.landmarks.nightGeometry(1).length})');assert abs(terrain['actual']-terrain['expected'])<1e-6
 hour(23);place(100,130);lamp=ev('w.streetLights.filter(l=>!s.urban?.controller||s.urban.controller.isAlive(l.id)).sort((a,b)=>Math.hypot(a.m.p[0]-100,a.m.p[2]-130)-Math.hypot(b.m.p[0]-100,b.m.p[2]-130))[0]?.m.p');assert lamp
 scenic([lamp[0]+8,2.5,lamp[2]+9],[lamp[0],4,lamp[2]],65);capture('experience-night-streetlamp.png')
 lamp_match=f'actualLighting.lights.some(l=>Math.hypot(l.p[0]-({lamp[0]}),l.p[2]-({lamp[2]}))<.7)'
 b.wait(lamp_match);core_night=ev('actualLighting');hour(12);b.wait('!('+lamp_match+')');capture('experience-day-streetlamp.png');core_day=ev('actualLighting')
 close_windows=ev('''(()=>{for(const v of [...w.architecture.views].sort((a,b)=>Math.hypot(a.x-100,a.z-130)-Math.hypot(b.x-100,b.z-130))){const x=v.x+v.nx*12,z=v.z+v.nz*12;if(w.blocked(x,z,.3,w.ground(x,z),1.8))continue;const target=[v.x+v.nx*.35,7,v.z+v.nz*.35],eye=[x,5,z],d=target.map((n,i)=>n-eye[i]),len=Math.hypot(...d);if(w.ray(eye,d.map(n=>n/len),len)>len-.6)return {eye,target,profile:v.profile};}return null;})()''');assert close_windows
 place(close_windows['eye'][0],close_windows['eye'][2]);scenic(close_windows['eye'],close_windows['target'],66)
 hour(23);capture('experience-close-windows-night.png');hour(12);capture('experience-close-windows-day.png')
 # The same urban-light check runs well outside the historical 550m core.
 place(-1280,1280);assert ev('typeof w.cityStream.streetLights==="function"')
 street=ev('''(()=>{const lamps=w.cityStream.streetLights(s.player.x,s.player.z,110);for(const l of lamps)for(let i=0;i<16;i++){const a=i*Math.PI/8,x=l.x+Math.cos(a)*11,z=l.z+Math.sin(a)*11,y=w.ground(x,z)+1.7;if(w.blocked(x,z,.3,y-1.7,1.8))continue;const d=[l.x-x,l.y-y,l.z-z],n=Math.hypot(...d);if(w.ray([x,y,z],d.map(v=>v/n),n)>n-.8)return {lamp:{id:l.id,x:l.x,y:l.y,z:l.z,power:l.power},eye:[x,y,z]};}return null;})()''');assert street,'No unobstructed streamed streetlamp view in prepared neighbourhood'
 sl=street['lamp'];place(street['eye'][0],street['eye'][2]);scenic(street['eye'],[sl['x'],sl['y']-1,sl['z']],70)
 shader_walls=ev('w.cityStream.geometry.filter(m=>m.wall&&m.mat>12.5&&m.mat<13.5).length');assert shader_walls>100
 outer_match=f'actualLighting.lights.some(l=>Math.hypot(l.p[0]-({sl["x"]}),l.p[2]-({sl["z"]}))<.7)'
 hour(23);b.wait(outer_match);capture('experience-streamed-street-night.png');outer_night=ev('actualLighting')
 hour(12);b.wait('!('+outer_match+')');capture('experience-streamed-street-day.png');outer_day=ev('actualLighting')
 checks.append('Paused, disclosed 23h/17h/12h time fixtures show Bonne-Mère from harbour and close approach, actual hill ground height, then a surviving night streetlamp')
 checks.append('Actual renderer light list contains core and streamed streetlamp at 23h and excludes it at 12h; paired facade/window screenshots require visual review')
 errors=ev('RADE.game.errors');assert not errors,errors
 report={'checks':checks,'hardware':'Virtual standard Gamepad API in Chrome; no physical gamepad claim','initialGameTime':started,'offered':offered,'accepted':ev('s.phone.active'),'layout':layout,'cameraWall':wall_camera,'terrain':terrain,'streetLighting':{'core':{'night':core_night,'day':core_day,'closeWindowFixture':close_windows},'streamed':{'fixture':street,'facadeShaderWalls':shader_walls,'night':outer_night,'day':outer_day}},'fixtures':fixtures,'captures':captures,'errors':errors,'buildSha256':hashlib.sha256((ROOT/'dist/index.html').read_bytes()).hexdigest(),'limits':'Scenic position/time/camera fixtures do not prove natural travel. Images require visual review; no automatic claim of architectural or terrain survey fidelity.'}
 (ROOT/'docs/experience-browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)
