#!/usr/bin/env python3
"""Browser integration of real-place UI, hotel loot and marine controls. Positions are explicit fixtures."""
from browser_support import Browser,ROOT
import time,json,hashlib
with Browser() as b:
 b.load();ev=b.ev;ev('RADE.game.start();true');checks=[]
 def tap(code):
  b.cmd('Input.dispatchKeyEvent',{'type':'keyDown','code':code,'key':code[-1:].lower()});time.sleep(.10);b.cmd('Input.dispatchKeyEvent',{'type':'keyUp','code':code,'key':code[-1:].lower()});time.sleep(.15)
 def click_action(text):
  q=ev('(()=>{const b=[...document.querySelectorAll("#business-actions button")].find(b=>b.textContent.startsWith('+json.dumps(text)+'));if(!b)return null;const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');assert q,text
  for kind in ['mousePressed','mouseReleased']:b.cmd('Input.dispatchMouseEvent',{'type':kind,**q,'button':'left','clickCount':1})
  time.sleep(.20)
 ev('''globalThis.s=RADE.game.session;globalThis.shop=[...s.business.registry.values()].find(e=>e.place.name==='Shawarmax')||[...s.business.registry.values()].find(e=>e.place.type==='kebab');s.sim.relocate(shop.building.x,shop.building.z,0);s.interiors.enter(shop.building,shop.building.places.indexOf(shop.place));s.business.update(0);const q=s.interiors.active.services[0];s.sim.relocate(q.x,q.z,0);true''');time.sleep(.3)
 tap('KeyE');assert ev('RADE.game.panel')=='business';assert ev('document.getElementById("business-actions").children.length')>=4;b.capture('business-counter.png')
 cash=ev('s.campaign.state.cash');click_action('Acheter une provision');assert ev('s.business.inventory.provision')==1;assert ev('s.campaign.state.cash')==cash-12
 tap('KeyE');click_action('Acheter un plan');assert ev('s.campaign.state.mapOwned');assert ev('s.campaign.state.cash')==cash-72
 tap('KeyE');click_action('Proposer sa protection');assert ev('s.business.mission.stage')=='hunt';assert ev('s.sim.state.enemies[s.business.mission.enemyId].deployed');checks.append('Vrai kebab : menu E, achat, plan payé et contrat avec cible METAL')
 ev('''s.interiors.leave();globalThis.hotel=[...s.business.registry.values()].find(e=>e.place.type==='hotel'&&e.building.floors>1);s.sim.relocate(hotel.building.x,hotel.building.z,0);s.interiors.enter(hotel.building,hotel.building.places.indexOf(hotel.place));s.business.update(0);s.sim.relocate(s.interiors.active.stairs.up.x,s.interiors.active.stairs.up.z,0);s.interiors.interact(s.campaign);s.business.update(0);globalThis.bedroom=s.interiors.active.zones.find(q=>q.kind==='bedroom');s.sim.relocate(bedroom.x,bedroom.z,0);true''');time.sleep(.3)
 assert ev('s.interiors.active.floor')==1;assert ev('s.interiors.active.civil.length')>0
 tap('KeyE');assert ev('RADE.game.panel')=='business';cash=ev('s.campaign.state.cash');click_action('Fouiller le bagage');assert ev('s.campaign.state.cash')>cash;b.capture('hotel-room.png');checks.append('Hôtel réel : étage, occupants et butin via menu E')
 ev('''s.interiors.leave();globalThis.ladder=s.marine.ladders.slice().sort((a,b)=>Math.hypot(a.landX-s.player.x,a.landZ-s.player.z)-Math.hypot(b.landX-s.player.x,b.landZ-s.player.z))[0];s.sim.relocate(ladder.landX,ladder.landZ,0);s.campaign.law.heat=s.campaign.law.wanted=0;true''');time.sleep(.15)
 tap('KeyE');assert ev('s.mode')=='swim';assert ev('s.player.hp')>0;b.capture('swimming-port.png')
 for kind in ['motorboat','sailboat','jetski']:
  ev('globalThis.boat=s.marine.boats.find(q=>q.kind==='+json.dumps(kind)+');Object.assign(s.player,{x:boat.x,z:boat.z});true');tap('KeyE');assert ev('s.mode')=='boat';assert ev('s.marine.boat.kind')==kind
  b.cmd('Input.dispatchKeyEvent',{'type':'keyDown','code':'KeyW','key':'w'});time.sleep(1);b.cmd('Input.dispatchKeyEvent',{'type':'keyUp','code':'KeyW','key':'w'});assert ev('Math.abs(s.marine.boat.speed)')>.1
  b.capture('marine-'+kind+'.png');b.cmd('Input.dispatchKeyEvent',{'type':'keyDown','code':'Space','key':' '});time.sleep(1);b.cmd('Input.dispatchKeyEvent',{'type':'keyUp','code':'Space','key':' '});tap('KeyE');assert ev('s.mode')=='swim'
 checks.append('Échelle et trois embarcations : E/W/Espace réels, navigation et sortie en nage')
 ev('Object.assign(s.player,{x:ladder.x,z:ladder.z});true');tap('KeyE');assert ev('s.mode')=='foot';assert ev('s.player.hp')>0
 assert not ev('RADE.game.errors');data={'checks':checks,'fixture':'Positions de départ préparées, puis interactions clavier/souris réelles. Ce test ne représente pas un trajet complet.','errors':ev('RADE.game.errors'),'buildSha256':hashlib.sha256((ROOT/'dist/index.html').read_bytes()).hexdigest()};(ROOT/'docs/new-features-browser.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');print(json.dumps(data,ensure_ascii=False,indent=2),flush=True)
