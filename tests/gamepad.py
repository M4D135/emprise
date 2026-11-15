#!/usr/bin/env python3
"""Virtual standard pad through navigator.getGamepads in real WebGL2 Chrome, not game.controller."""
from browser_support import Browser,ROOT
import time,json
with Browser() as b:
 b.cmd('Page.addScriptToEvaluateOnNewDocument',{'source':'''window.rumbles=[];window.virtualPad={id:'Xbox 360 Controller (STANDARD GAMEPAD)',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({value:0,pressed:false})),vibrationActuator:{playEffect:(t,o)=>{rumbles.push(o);return Promise.resolve('complete')},reset:()=>{rumbles.push({reset:true});return Promise.resolve()}}};Object.defineProperty(navigator,'getGamepads',{value:()=>virtualPad.connected?[virtualPad]:[]});'''})
 b.load();ev=b.ev
 def button(i,value=1):ev(f'virtualPad.buttons[{i}].value={value};virtualPad.buttons[{i}].pressed={str(value>.5).lower()};true')
 def tap(i):button(i);time.sleep(.10);button(i,0);time.sleep(.12)
 def axis(i,value):ev(f'virtualPad.axes[{i}]={value};true')
 def neutral():ev('virtualPad.axes.fill(0);virtualPad.buttons.forEach(b=>{b.value=0;b.pressed=false});true');time.sleep(.12)
 checks=[]
 tap(0);b.wait('RADE.game.running');assert ev('document.pointerLockElement===null');checks.append('Titre : A démarre sans capture souris')
 ev('RADE.game.recorder.start("Manette · marche, tir et conduite");true')
 before=ev('({x:RADE.game.session.player.x,z:RADE.game.session.player.z})');axis(1,-.7);time.sleep(.35);axis(1,0);time.sleep(.15);after=ev('({x:RADE.game.session.player.x,z:RADE.game.session.player.z,cmd:RADE.game.lastCommand,gate:RADE.game.pad.blocked,errors:RADE.game.errors})');assert abs(after['z']-before['z'])+abs(after['x']-before['x'])>.1,(before,after)
 yaw=ev('RADE.game.session.player.yaw');axis(2,.6);time.sleep(.2);axis(2,0);time.sleep(.1);assert abs(ev('RADE.game.session.player.yaw')-yaw)>.05
 idle=ev('RADE.game.session.player.yaw');axis(2,.05);time.sleep(.15);assert abs(ev('RADE.game.session.player.yaw')-idle)<.001;neutral()
 tap(2);time.sleep(.2);assert ev('RADE.game.session.mode')=='car';assert ev('RADE.game.session.car.moteur')
 button(7,.55);time.sleep(.7);assert .3<ev('RADE.game.lastCommand.forward')<.7;drive=ev('({v:RADE.game.session.car.v,u:RADE.game.session.car.u,engine:RADE.game.session.car.moteur,condition:RADE.game.session.car.condition,cmd:RADE.game.lastCommand,errors:RADE.game.errors})');assert drive['v']>1,drive
 neutral();tap(3);assert ev('RADE.game.view')=='cockpit'
 button(1);b.wait('RADE.game.session.car.v<.2',5);neutral();assert ev('RADE.game.session.car.v')<.2
 button(6,.65);time.sleep(.6);neutral();assert ev('RADE.game.session.car.u')<-.5
 button(1);b.wait('RADE.game.session.car.v<.2',5);neutral();tap(2);time.sleep(.15);assert ev('RADE.game.session.mode')=='foot';checks.append('X entrée/sortie · RT analogique · LT frein/recul · B frein à main · Y vue')
 axis(3,-.7);time.sleep(.6);neutral()
 button(7);time.sleep(.07);button(7,0);time.sleep(1);shots=ev('RADE.game.session.sim.state.shots');assert shots==1,shots
 button(7);time.sleep(.8);button(7,0);time.sleep(1.2);shots=ev('RADE.game.session.sim.state.shots');time.sleep(.3);assert ev('RADE.game.session.sim.state.shots')==shots;assert ev('RADE.game.audio.stats.activeCues.shot||0')==0
 checks.append('Déplacement, visée, zone morte, tir unique, rafale et silence au relâchement')
 tap(3);assert ev('RADE.game.session.sim.state.weapon')==1
 tap(14);assert ev('RADE.game.session.sim.state.weapon')==0
 tape=ev('RADE.game.recorder.stop()');tape['source']='tests/gamepad.py / Gamepad API virtuelle dans Chromium';tape['expected']=ev('({shots:RADE.game.session.sim.state.shots,mode:RADE.game.session.mode,player:[RADE.game.session.player.x,RADE.game.session.player.z],car:[RADE.game.session.car.x,RADE.game.session.car.z],cash:RADE.game.session.campaign.state.cash})');(ROOT/'docs/gamepad-recording.json').write_text(json.dumps(tape,separators=(',',':'))+'\n')
 button(7);time.sleep(.08);tap(9);assert not ev('RADE.game.running');button(9);time.sleep(.1);button(9,0);time.sleep(.1);assert not ev('RADE.game.running'),'held RT must gate resume';neutral();tap(9);assert ev('RADE.game.running');time.sleep(.2);n=ev('RADE.game.session.sim.state.shots');time.sleep(.3);assert ev('RADE.game.session.sim.state.shots')==n
 ev('virtualPad.connected=false;true');time.sleep(.2);assert not ev('RADE.game.running');ev('virtualPad.connected=true;true');neutral();tap(9);assert ev('RADE.game.running');checks.append('Pause au débranchement et barrière de relâchement (aucun tir bloqué)')
 tap(4);assert ev('RADE.game.panel')=='actions';tap(13);tap(0);assert ev('RADE.game.panel') is None;assert ev('RADE.game.session.sim.state.weapon')==1;checks.append('Menu des actions, navigation et choix d’arme')
 tap(4);tap(13);tap(13);tap(13);tap(0);assert ev('RADE.game.panel')=='notebook';assert ev('document.getElementById("cityplan").hidden');tap(1);assert ev('RADE.game.panel') is None;checks.append('Carnet via LB, navigation et A ; retour B sans carte permanente')
 tap(9);assert not ev('RADE.game.running');ev('document.getElementById("pause-controls").focus();true');tap(0);assert ev('RADE.game.panel')=='controls'
 ev('document.getElementById("pad-sensitivity").focus();true');old=ev('RADE.game.pad.settings.sensitivity');tap(15);assert ev('RADE.game.pad.settings.sensitivity')>old
 tap(1);assert ev('RADE.game.panel') is None
 ev('document.getElementById("restart").focus();true');tap(0);assert ev('RADE.game.panel')=='reset-confirm';tap(1);assert ev('RADE.game.panel') is None
 assert ev('rumbles.some(r=>r.strongMagnitude>0)');assert ev('rumbles.some(r=>r.reset)');assert not ev('RADE.game.errors')
 b.capture('gamepad-menu.png');saved=ev('RADE.game.pad.settings.sensitivity');b.load();assert ev('RADE.game.pad.settings.sensitivity')==saved;checks.append('Réglages persistants, vibrations finies, annulation de remise à zéro')
 b.load('');b.wait('RADE.game.demo',9);button(0);time.sleep(.2);assert not ev('RADE.game.demo');assert not ev('RADE.game.running');time.sleep(.4);assert not ev('RADE.game.running');neutral();tap(0);assert ev('RADE.game.running');assert not ev('RADE.game.errors');checks.append('Démo après 5 s, retour au titre sans validation parasite puis reprise')
 report={'checks':checks,'hardware':'Gamepad API virtuelle Xbox standard, aucune manette physique branchée pour ce test','errors':ev('RADE.game.errors')};(ROOT/'docs/gamepad-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)
