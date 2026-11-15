#!/usr/bin/env python3
"""Actual keyboard/mouse for notebook and hand-searched combat loot; explicit combat fixture."""
from browser_support import Browser,ROOT
import time,json,hashlib
with Browser() as b:
 b.load();ev=b.ev;ev('RADE.game.start();globalThis.s=RADE.game.session;true');checks=[]
 def tap(code):
  b.cmd('Input.dispatchKeyEvent',{'type':'keyDown','code':code,'key':code[-1:].lower()});time.sleep(.08);b.cmd('Input.dispatchKeyEvent',{'type':'keyUp','code':code,'key':code[-1:].lower()});time.sleep(.15)
 def click(selector):
  q=ev('(()=>{const el=document.querySelector('+json.dumps(selector)+');el.scrollIntoView({block:"center"});const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()')
  for kind in ['mousePressed','mouseReleased']:b.cmd('Input.dispatchMouseEvent',{'type':kind,**q,'button':'left','clickCount':1})
  time.sleep(.2)
 tap('KeyJ');assert ev('RADE.game.panel')=='notebook';assert ev('document.getElementById("cityplan").hidden');assert 'adresses sous contrôle' in ev('document.getElementById("notebook-summary").textContent');b.capture('notebook-network.png');tap('KeyJ');assert ev('RADE.game.panel') is None
 ev('s.business.inventory.bandage=1;s.player.hp=50;true');tap('KeyJ');click('#notebook-inventory button');assert ev('s.business.inventory.bandage')==0;assert ev('s.player.hp')==85;assert ev('RADE.game.panel') is None;checks.append('Carnet par J, lecture sans carte, soin consommé depuis le carnet')
 # A reserve enemy and a clear shooting lane are prepared; damage comes from a real mouse click.
 ev('''globalThis.target=s.sim.state.enemies[s.business.slots[0]];const xy=s.world.freeNear(74,134,.6);Object.assign(target,{x:xy[0],z:xy[1],baseY:.08,y:1.43,hp:1,deployed:true,combatEnabled:false,injury:null,alert:0});
 let spot;for(let i=0;i<24&&!spot;i++){const a=i*Math.PI/12,q=s.world.freeNear(target.x+Math.cos(a)*3,target.z+Math.sin(a)*3,.35),dx=target.x-q[0],dz=target.z-q[1],d=Math.hypot(dx,dz);if(d>2&&d<5&&s.world.ray([q[0],1.43,q[1]],[dx/d,0,dz/d],d)>=d-.1)spot=q;}
 if(!spot)throw Error('No combat test lane');s.sim.relocate(spot[0],spot[1]);const dx=target.x-s.player.x,dz=target.z-s.player.z;s.player.yaw=Math.atan2(dx,-dz);s.player.pitch=Math.atan2(target.y-(s.player.y+1.62),Math.hypot(dx,dz));s.loot.update();true''');time.sleep(.2)
 shots=ev('s.sim.state.shots')
 for kind in ['mousePressed','mouseReleased']:b.cmd('Input.dispatchMouseEvent',{'type':kind,'x':720,'y':450,'button':'left','clickCount':1})
 b.wait('target.hp<=0',5);assert ev('s.sim.state.shots')>shots;b.wait('s.loot.bags.length>0');assert ev('s.loot.bags.length')==1
 ev('s.sim.relocate(target.x+.55,target.z,Math.PI/2);s.campaign.law.heat=s.campaign.law.wanted=0;true');time.sleep(.2);assert ev('!!s.loot.context()');cash=ev('s.campaign.state.cash');tap('KeyE');assert ev('s.loot.bags.length')==0;assert ev('s.campaign.state.cash')>cash;cash=ev('s.campaign.state.cash');tap('KeyE');assert ev('s.campaign.state.cash')==cash;checks.append('Ennemi vaincu par clic réel, sac physique puis E, aucun butin répété')
 tap('KeyJ');assert 'Sac fouillé' in ev('document.getElementById("notebook-history").textContent');b.capture('notebook-loot.png');tap('KeyJ')
 assert not ev('RADE.game.errors');data={'checks':checks,'fixture':'Placement de la cible et du joueur préparé. Ouverture, soin, tir et fouille via événements clavier/souris réels.','errors':ev('RADE.game.errors'),'buildSha256':hashlib.sha256((ROOT/'dist/index.html').read_bytes()).hexdigest()};(ROOT/'docs/immersion-browser.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');print(json.dumps(data,ensure_ascii=False,indent=2),flush=True)
