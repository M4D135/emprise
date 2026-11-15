#!/usr/bin/env python3
"""Prepared actors; actual mouse trigger and keyboard theft, normal AI thereafter."""
from browser_support import Browser,ROOT
import time,json,hashlib
with Browser() as b:
 b.load();ev=b.ev;ev('RADE.game.start();globalThis.s=RADE.game.session;true');checks=[]
 ev('''s.crowd.people.forEach(p=>p.hp=0);s.sim.state.enemies.forEach(e=>e.deployed=false);s.world.fleet.forEach(c=>{c.x=450;c.z=-450;c.ai=false;c.v=c.u=c.w=0;});
 globalThis.c=s.traffic.cars.find(c=>!c.police&&c.model==='gti');Object.assign(c,{x:61.5,z:181,cap:0,y:.08,ai:false,moteur:false,v:0,u:0,w:0});Object.assign(c.driver,{inside:true,hp:100,injury:null,temperament:'civil'});
 s.sim.relocate(61.16,175.66,Math.PI);s.player.pitch=Math.atan2(1.18-(s.player.y+1.62),5);true''');time.sleep(.25);b.capture('driver-headshot-before.png')
 for kind in ['mousePressed','mouseReleased']:b.cmd('Input.dispatchMouseEvent',{'type':kind,'x':720,'y':450,'button':'left','clickCount':1})
 b.wait('c.driver.hp<=0',5);assert ev('!c.ai&&!c.moteur&&c.glassBroken');checks.append('Clic réel : headshot du conducteur à travers vitre latérale ; moteur coupé et vitre brisée')
 # Fresh load keeps the theft test isolated from the preceding crime and injury.
 b.load();ev('RADE.game.start();globalThis.s=RADE.game.session;true')
 ev('''s.crowd.people.forEach(p=>p.hp=0);s.sim.state.enemies.forEach(e=>e.deployed=false);globalThis.c=s.traffic.cars.find(c=>!c.police&&c.model==='gti');s.world.fleet.forEach(v=>{v.x=450;v.z=-450;v.ai=false;v.v=v.u=v.w=0;});Object.assign(c,{x:61.5,z:181,cap:0,y:.08,ai:false,moteur:false,v:0,u:0,w:0});c.driver.temperament='civil';s.sim.relocate(61.5,179.55,0);true''')
 b.cmd('Input.dispatchKeyEvent',{'type':'keyDown','code':'KeyE','key':'e'});time.sleep(.08);b.cmd('Input.dispatchKeyEvent',{'type':'keyUp','code':'KeyE','key':'e'});time.sleep(.2)
 assert ev('s.mode==="car"&&!c.driver.inside&&c.driver.grievance>0');b.wait('s.mode==="foot"&&c.driver.inside',12);b.capture('owner-reclaims-vehicle.png');checks.append('Vol par E ; propriétaire rejoint physiquement la portière et récupère le véhicule arrêté')
 # Fearless aggressor is a separate behaviour fixture, no visual/ethnic criterion.
 b.load();ev('RADE.game.start();globalThis.s=RADE.game.session;true')
 ev('''s.sim.state.enemies.forEach(e=>e.deployed=false);s.world.fleet.forEach(v=>{v.x=450;v.z=-450;v.ai=false;});s.crowd.people.forEach(p=>p.hp=0);globalThis.a=s.crowd.people[0];Object.assign(a,{hp:100,temperament:'provocateur',provocationCooldown:0,aggression:0,fear:0,injury:null,x:61.5,z:180,cap:0});s.sim.relocate(61.5,177,Math.PI);true''')
 b.wait('s.player.hp<100',10);b.capture('provocateur-attack.png');assert ev('a.fear===0&&a.aggression>0');checks.append('Profil provocateur : approche et agression non provoquée, dégâts réels, animation de coup, peur nulle')
 assert not ev('RADE.game.errors');data={'checks':checks,'fixture':'Positions et tempéraments préparés ; clic de tir et touche E réels, décisions de récupération et agression exécutées par la simulation. Pas de téléportation de PNJ pour déclencher le résultat.','errors':ev('RADE.game.errors'),'buildSha256':hashlib.sha256((ROOT/'dist/index.html').read_bytes()).hexdigest()};(ROOT/'docs/drivers-browser.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');print(json.dumps(data,ensure_ascii=False,indent=2),flush=True)
