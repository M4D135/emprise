#!/usr/bin/env python3
"""Real rockets open a mapped core building; real W crosses into its shared room.

Run only after the coordinating agent releases Chrome and builds the game.
The only gameplay fixture is the initial position/aim at a real clear facade.
No damage, projectile, inventory, enemy, health or entry state is injected.
"""
from browser_support import Browser,ROOT
import hashlib,json,math,time

with Browser() as b:
 b.load();ev=b.ev;ev('RADE.game.start();globalThis.s=RADE.game.session;globalThis.w=s.world;true')
 def key(code,down=True):b.cmd('Input.dispatchKeyEvent',{'type':'keyDown' if down else 'keyUp','code':code,'key':code[3:].lower() if code.startswith('Key') else code})
 def tap(code):key(code);time.sleep(.08);key(code,False);time.sleep(.15)
 # This previews the same existing procedural room without registering a breach
 # or changing collision. The source facade must be physically intact here.
 fixture=ev('''(()=>{
 const candidates=w.boxes.filter(q=>q.mesh?.shape==='box'&&q.minY<.13&&q.minY>-.13&&q.maxY>6&&q.a>4&&q.b>4&&q.a<35&&q.b<35&&Math.hypot(q.x,q.z)<400).sort((a,b)=>Math.hypot(a.x-s.player.x,a.z-s.player.z)-Math.hypot(b.x-s.player.x,b.z-s.player.z));
 for(const box of candidates){const found=s.interiors.breachFootprint(box.mesh);if(!found)continue;const b=found.building,q=found.q,c=Math.cos(-q.lacet),sn=Math.sin(-q.lacet),faces=[{nx:-sn,nz:c,width:q.lx,depth:q.lz},{nx:sn,nz:-c,width:q.lx,depth:q.lz},{nx:c,nz:sn,width:q.lz,depth:q.lx},{nx:-c,nz:-sn,width:q.lz,depth:q.lx}].sort((a,d)=>d.nx*b.nx+d.nz*b.nz-a.nx*b.nx-a.nz*b.nz);
  for(const f of faces.slice(0,1))for(const offset of [0,-1.5,1.5,-3,3]){if(Math.abs(offset)>f.width/2-2.9)continue;const x=q.x+f.nx*f.depth/2+f.nz*offset,z=q.z+f.nz*f.depth/2-f.nx*offset,origin=[x+f.nx*9.5,.08,z+f.nz*9.5],point=[x,1.25,z],direction=[-f.nx,0,-f.nz];let clear=true;
   for(let d=.65;d<=9.6;d+=.35)if(w.blocked(x+f.nx*d,z+f.nz*d,.31,.08,1.8)){clear=false;break;}if(!clear)continue;
   const fireOrigin=[origin[0],1.70,origin[2]],delta=point.map((v,i)=>v-fireOrigin[i]),length=Math.hypot(...delta),ray=w.ray(fireOrigin,delta.map(v=>v/length),length+.2);if(ray<length-.65||ray>length+.1)continue;
   const bridge=s.interiors.breachProjection({mesh:box.mesh,point,normal:[f.nx,0,f.nz],floor:0});if(!bridge)continue;
   for(const d of [.8,1.3,1.8]){const local=bridge.toRoom([x-f.nx*d,.08,z-f.nz*d]);if(bridge.room.blocked(local[0],local[2],.29,.08,1.8)){clear=false;break;}}if(!clear)continue;
   globalThis.targetBuilding=b.id;globalThis.targetPoint=point;globalThis.outward=[f.nx,0,f.nz];globalThis.entryFixture={buildingId:b.id,name:bridge.room.place?.name||b.name,address:bridge.room.place?.address||b.address,point,origin,yaw:Math.atan2(-f.nx,f.nz),pitch:Math.atan2(point[1]-fireOrigin[1],9.5),normal:[f.nx,0,f.nz],roomScene:bridge.room.sceneId,rayBefore:ray};return entryFixture;
  }
 }return null;
})()''');assert fixture,'No intact mapped facade with clear outside approach and inside corridor found'
 assert ev('s.urban.breachProjections.length')==0,'Preview must not open a facade'
 ev('s.sim.relocate(entryFixture.origin[0],entryFixture.origin[2],entryFixture.yaw);s.player.pitch=entryFixture.pitch;true');tap('Digit3');b.wait('s.sim.state.weapon===2',5)
 initial=ev('({shots:s.sim.state.shots,ammo:s.sim.state.inventory.ammo[2],player:[s.player.x,s.player.y,s.player.z],hp:s.player.hp,time:s.time})');assert initial['ammo']>=1
 b.capture('core-breach-before.png');shots=[]
 def status():return ev('''(()=>{const bridge=s.urban.breachProjections.find(b=>b.buildingId===targetBuilding&&b.floor===0);return {shots:s.sim.state.shots,ammo:s.sim.state.inventory.ammo[2],hp:s.player.hp,dead:s.sim.state.dead,time:s.time,projectiles:s.sim.state.projectiles.filter(q=>q.kind==='rocket'&&q.owner==='player').length,bridge:bridge?{id:bridge.id,buildingId:bridge.buildingId,floor:bridge.floor,room:bridge.room.sceneId,scenery:bridge.scenery.length,visibleInWorld:w.scenery.filter(m=>m.breachInterior&&m.sourceRoom===bridge.room.sceneId).length}:null,openRay:w.ray([entryFixture.point[0]+outward[0]*3,1.25,entryFixture.point[2]+outward[2]*3],outward.map(n=>-n),12)};})()''')
 for attempt in range(min(6,initial['ammo'])):
  before=ev('s.sim.state.shots');b.cmd('Input.dispatchMouseEvent',{'type':'mousePressed','x':720,'y':450,'button':'left','clickCount':1});time.sleep(.08);b.cmd('Input.dispatchMouseEvent',{'type':'mouseReleased','x':720,'y':450,'button':'left','clickCount':1})
  b.wait('s.sim.state.shots>'+str(before),5);b.wait('!s.sim.state.projectiles.some(q=>q.kind==="rocket"&&q.owner==="player")',8);time.sleep(.35);q=status();shots.append(q);assert not q['dead'],q
  if q['bridge'] and q['openRay']>3.6:break
  time.sleep(.70)
 assert shots[-1]['bridge'] and shots[-1]['bridge']['visibleInWorld']>20,shots
 assert shots[-1]['openRay']>3.6,shots
 assert initial['ammo']-shots[-1]['ammo']==shots[-1]['shots']-initial['shots'],'Each real rocket consumed the existing finite reserve'
 time.sleep(3.7);exposed=status();b.capture('core-breach-visible-interior.png');assert not ev('s.interiors.active'),'No entry merely by breaking or viewing the facade'
 ev('globalThis.exposedBridge=s.urban.breachProjections.find(b=>b.buildingId===targetBuilding&&b.floor===0);true')
 # Physical walking is the only operation allowed after this point. A short
 # strafe may clear loose debris; no position, collision or entry API is used.
 trace=[];inputs=[]
 for attempt in range(3):
  key('KeyW');inputs.append({'key':'W','down':True,'time':ev('s.time')});deadline=time.monotonic()+5
  while time.monotonic()<deadline:
   q=ev('({x:s.player.x,y:s.player.y,z:s.player.z,hp:s.player.hp,time:s.time,active:s.interiors.active?.building.id||null})');trace.append(q)
   if q['active'] or q['hp']<=0:break
   time.sleep(.08)
  key('KeyW',False);inputs.append({'key':'W','down':False,'time':ev('s.time')})
  if trace[-1]['active'] or trace[-1]['hp']<=0:break
  if attempt<2:
   code='KeyA' if attempt==0 else 'KeyD';key(code);time.sleep(.28 if attempt==0 else .56);key(code,False);inputs.append({'key':code,'seconds':.28 if attempt==0 else .56})
 entered=ev('({active:s.interiors.active?{buildingId:s.interiors.active.building.id,scene:s.interiors.active.sceneId,floor:s.interiors.active.floor,sameRoom:s.interiors.active===exposedBridge.room,name:s.interiors.active.place?.name||s.interiors.active.building.name}:null,player:[s.player.x,s.player.y,s.player.z],outside:s.interiors.outside,saved:s.interiors.save().active,hp:s.player.hp})')
 assert entered['active'] and entered['active']['buildingId']==fixture['buildingId'] and entered['active']['floor']==0,{'entered':entered,'trace':trace[-25:],'shots':shots}
 assert entered['active']['sameRoom'],'Crossing must reuse the exposed room instance';assert entered['outside']['breach'] and entered['saved']['outside']['breach'];assert abs(entered['player'][0]-1000)<40 and abs(entered['player'][2]-1000)<40
 outdoor=[q for q in trace if not q['active']];assert len(outdoor)>3;assert math.hypot(outdoor[-1]['x']-initial['player'][0],outdoor[-1]['z']-initial['player'][2])>5
 b.capture('core-breach-entered.png');errors=ev('RADE.game.errors');assert not errors,errors
 report={'checks':['Real source facade mapped to the existing ground-floor room','Digit3 and genuine mouse clicks fire finite-reserve rockets','Broken facade exposes projected room furnishing in the street','No proximity entry before walking','W movement crosses the physical threshold into the same room instance','Breach return point survives interior save'],'fixture':fixture,'initial':initial,'shots':shots,'exposed':exposed,'inputs':inputs,'trace':trace,'entered':entered,'errors':errors,'buildSha256':hashlib.sha256((ROOT/'dist/index.html').read_bytes()).hexdigest(),'limits':'Initial position/aim are prepared. No damage, projectile, ammunition, enemies, health or entry state is injected. Furnishing is an original procedural interpretation, not an architectural survey. Screenshots require visual inspection.'}
 (ROOT/'docs/core-breach-browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)
