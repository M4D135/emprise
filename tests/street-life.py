#!/usr/bin/env python3
"""Actual mouse/keyboard on prepared ammunition, counter and patrol fixtures."""
from browser_support import Browser,ROOT
import json,time,hashlib
with Browser() as b:
 b.load();ev=b.ev;ev('RADE.game.start();globalThis.s=RADE.game.session;true');checks=[]
 def tap(code):
  b.cmd('Input.dispatchKeyEvent',{'type':'keyDown','code':code,'key':code[-1:].lower()});time.sleep(.08);b.cmd('Input.dispatchKeyEvent',{'type':'keyUp','code':code,'key':code[-1:].lower()});time.sleep(.18)
 def mouse(down):b.cmd('Input.dispatchMouseEvent',{'type':'mousePressed' if down else 'mouseReleased','x':720,'y':450,'button':'left','clickCount':1})
 def click_prefix(prefix):
  q=ev('(()=>{const el=[...document.querySelectorAll("#business-actions button")].find(el=>el.textContent.startsWith('+json.dumps(prefix)+'));if(!el)return null;el.scrollIntoView({block:"center"});const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');assert q,prefix
  for kind in ['mousePressed','mouseReleased']:b.cmd('Input.dispatchMouseEvent',{'type':kind,**q,'button':'left','clickCount':1})
  time.sleep(.25)
 ev('s.sim.state.enemies.forEach(e=>e.deployed=false);s.sim.state.inventory.ammo[0]=1;s.player.pitch=1;true');mouse(True);time.sleep(.07);mouse(False);time.sleep(.4)
 assert ev('s.sim.state.inventory.ammo[0]')==0;shots=ev('s.sim.state.shots');mouse(True);time.sleep(1.2);mouse(False);time.sleep(.2);assert ev('s.sim.state.shots')==shots
 assert '0 CARTOUCHES' in ev('document.getElementById("engine").textContent');assert ev('RADE.game.audio.stats.activeCues.shot||0')==0
 checks.append('Dernière cartouche consommée par clic réel ; maintien à vide sans nouveau tir ni boucle sonore')
 ev('''globalThis.shop=[...s.business.registry.values()].find(e=>e.place.type==='supermarche');s.sim.relocate(shop.building.x,shop.building.z,0);s.interiors.enter(shop.building,shop.building.places.indexOf(shop.place));s.business.update(0);const q=s.interiors.active.services[0];s.sim.relocate(q.x,q.z,0);s.business.context();s.business.records.get(shop.key).status='protected';s.campaign.state.cash=200;s.campaign.law.heat=s.campaign.law.wanted=0;true''');time.sleep(.3)
 tap('KeyE');assert ev('RADE.game.panel')=='business';b.capture('network-resupply.png');before=ev('s.campaign.state.cash');click_prefix('Réapprovisionnement du réseau');assert ev('s.sim.state.inventory.ammo[0]')==24;after=ev('s.campaign.state.cash');assert before-after>34.5 and before-after<=35
 checks.append('Réapprovisionnement au comptoir protégé via E et clic, 24 cartouches débitées35€ ; revenus simultanés pris en compte')
 ev('''s.interiors.leave();s.sim.state.enemies.forEach(e=>e.deployed=false);s.campaign.law.heat=s.campaign.law.wanted=0;
 globalThis.unit=s.police.units.find(u=>u.actor.hp>0&&u.actor.inside&&!u.car.exploded);if(!unit)throw Error('Missing patrol');globalThis.pc=unit.car;for(const c of s.traffic.cars){if(c!==pc){c.ai=false;c.v=c.u=0;}}
 pc.policeStolen=false;pc.ai=true;s.campaign.law.cooldown=0;s.campaign.crime(1);true''')
 # Respect the real dispatch delay before preparing the close encounter. Forcing
 # pursuit before dispatch raced against traffic.updateDispatch resetting patrol.
 b.wait('pc.role==="chaser"||!unit.actor.inside',12)
 ev('''if(unit.actor.inside){pc.v=pc.u=pc.w=pc.omega=0;pc.sensorAt=0;pc.routeAt=0;unit.boardAfter=0;
 let spot=null;for(let i=0;i<32&&!spot;i++){const a=i*Math.PI/16,x=pc.x+Math.cos(a)*6,z=pc.z+Math.sin(a)*6;if(!s.world.blocked(x,z,.4)){const d=Math.hypot(x-pc.x,z-pc.z);if(s.world.ray([pc.x,1.73,pc.z],[(x-pc.x)/d,0,(z-pc.z)/d],d)>=d-.05)spot=[x,z];}}
 if(!spot)throw Error('No visible patrol fixture');s.sim.relocate(spot[0],spot[1],Math.atan2(pc.x-spot[0],spot[1]-pc.z));s.campaign.crime(0);pc.lastKnown={x:s.player.x,z:s.player.z,time:s.traffic.time};}true''')
 b.wait('!unit.actor.inside',18);b.capture('police-dismount.png');start=time.monotonic();b.wait('!!s.campaign.law.lastArrest',25)
 arrest=ev('({last:s.campaign.law.lastArrest,inside:!!s.interiors.active,kind:s.interiors.active?.place?.kind,place:s.interiors.active?.place?.name,arrest:s.campaign.law.arrest,exits:s.police.metrics.exits})');assert arrest['inside'] and arrest['kind']=='police',arrest;b.capture('police-station-respawn.png')
 checks.append('Conducteur visible descendu, approche physique, interpellation puis réapparition au commissariat dans la session active')
 assert not ev('RADE.game.errors');report={'checks':checks,'arrest':arrest,'elapsedAfterDismount':time.monotonic()-start,'fixture':'Réserve, propriété du commerce et rencontre de patrouille préparées. Tir/achats par événements réels ; poursuite et arrestation par la simulation courante, après le délai réel du répartiteur, sans déplacer le policier ni déclencher respawn directement.','errors':ev('RADE.game.errors'),'buildSha256':hashlib.sha256((ROOT/'dist/index.html').read_bytes()).hexdigest()};(ROOT/'docs/street-life-browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)
