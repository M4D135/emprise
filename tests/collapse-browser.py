#!/usr/bin/env python3
"""Falling-body recovery with real movement keys, then rockets against a real façade."""
from browser_support import Browser,ROOT
import time,json,hashlib
with Browser() as b:
 b.load();ev=b.ev;ev('RADE.game.start();globalThis.s=RADE.game.session;s.sim.state.enemies.forEach(e=>e.deployed=false);true');checks=[]
 ev('''const q=s.world.freeNear(61.5,189,2);s.sim.relocate(q[0],q[1],0);globalThis.origin=[s.player.x,s.player.z];globalThis.fallen=s.urban.spawnBody({shape:'box',p:[s.player.x,3.5,s.player.z],s:[2.4,.45,2.4],r:[0,.3,.15],mat:3,material:'stone'},[0,0,0],[0,0,0],1600);true''');time.sleep(5)
 recovery=ev('({x:s.player.x,z:s.player.z,origin,blocked:s.world.blocked(s.player.x,s.player.z,.28,s.player.y),hp:s.player.hp})');assert not recovery['blocked'];assert abs(recovery['x']-recovery['origin'][0])+abs(recovery['z']-recovery['origin'][1])>.5
 b.cmd('Input.dispatchKeyEvent',{'type':'keyDown','code':'KeyW','key':'w'});time.sleep(.7);b.cmd('Input.dispatchKeyEvent',{'type':'keyUp','code':'KeyW','key':'w'});time.sleep(.2)
 pos=ev('[s.player.x,s.player.z]');assert abs(pos[0]-recovery['x'])+abs(pos[1]-recovery['z'])>1;b.capture('collapse-recovery.png');checks.append('Plaque1600kg tombée sur la capsule : dégagement progressif puis marche W réelle opérationnelle')
 ev('''s.traffic.cars.forEach(c=>c.ai=false);s.campaign.law.heat=s.campaign.law.wanted=0;
 globalThis.wall=s.world.boxes.find(q=>q.mesh&&q.minY<.2&&q.maxY>6&&q.a>3&&q.b>3&&Math.abs(q.x)<260&&Math.abs(q.z)<260&&s.world.withoutCar(()=>!s.world.blocked(q.x+(q.a+8)*q.c,q.z+(q.a+8)*q.s,.5)));
 globalThis.point=[wall.x+wall.a*wall.c,1.4,wall.z+wall.a*wall.s];globalThis.eye=[point[0]+wall.c*8,1.4,point[2]+wall.s*8];globalThis.dir=[-wall.c,0,-wall.s];globalThis.rayBefore=s.world.ray(eye,dir,20);s.sim.relocate(eye[0],eye[2],Math.atan2(dir[0],-dir[2]));s.player.pitch=Math.atan2(point[1]-(s.player.y+1.62),8);s.sim.selectWeapon(2);s.sim.state.inventory.ammo[2]=12;RADE.game.samples.length=0;true''')
 shots=[]
 for i in range(5):
  b.cmd('Input.dispatchMouseEvent',{'type':'mousePressed','x':720,'y':450,'button':'left','clickCount':1});time.sleep(.08);b.cmd('Input.dispatchMouseEvent',{'type':'mouseReleased','x':720,'y':450,'button':'left','clickCount':1})
  time.sleep(2)
  shot=ev('({shots:s.sim.state.shots,hp:s.player.hp,dead:s.sim.state.dead,heat:s.player.heat,staticAfter:s.world.boxes.reduce((d,q)=>Math.min(d,s.world.rayBox(q,eye,dir,d)),20)})');shots.append(shot)
  if shot['staticAfter']>ev('rayBefore')+.5:break
  assert not shot['dead'],shots
 time.sleep(3)
 state=ev('({shots:s.sim.state.shots,rayBefore,rayAfter:s.world.ray(eye,dir,20),bodies:s.urban.bodies.length,report:s.urban.report,staticAfter:s.world.boxes.reduce((d,q)=>Math.min(d,s.world.rayBox(q,eye,dir,d)),20),hp:s.player.hp,frames:RADE.game.samples.slice(),errors:RADE.game.errors})');assert 1<=state['shots']<=5,shots;assert state['staticAfter']>state['rayBefore']+.5,{k:v for k,v in state.items() if k!='frames'};assert state['bodies']>0;assert not state['errors'];b.capture('building-breach.png');checks.append('Tirs lance-roquettes par clics réels jusqu’à la brèche : collision statique retirée et débris physiques')
 frames=state.pop('frames');ordered=sorted(frames);state['pacing']={'frames':len(frames),'p95':ordered[int(len(ordered)*.95)],'max':max(frames),'over50':sum(x>50 for x in frames),'over100':sum(x>100 for x in frames)}
 data={'checks':checks,'recovery':recovery,'demolition':state,'shots':shots,'fixture':'Départ joueur et plaque préparés ; puis marche clavier réelle. Façade réelle choisie et joueur placé devant, tirs par clics réels. Pas de parcours complet ni reproduction de la sauvegarde exacte de David.','buildSha256':hashlib.sha256((ROOT/'dist/index.html').read_bytes()).hexdigest()};(ROOT/'docs/collapse-browser.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');print(json.dumps(data,ensure_ascii=False,indent=2),flush=True)
