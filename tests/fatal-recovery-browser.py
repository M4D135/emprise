#!/usr/bin/env python3
"""Native recovery controls and real saved-water restoration, CDP pipe only."""
from browser_support import Browser,ROOT
from pathlib import Path
import argparse,json,hashlib,tempfile,time
p=argparse.ArgumentParser();p.add_argument('--html',type=Path,default=ROOT/'dist/index.html');p.add_argument('--label',default='fatal-recovery');args=p.parse_args()
html=args.html.read_text();marker="(function(R){'use strict';\nlet canvas=document.getElementById('scene');"
assert html.count(marker)==1
# This sole injected failure occurs before renderer/simulation creation. Saved
# marine recovery below uses the untouched real session implementation.
hook="\nif(new URLSearchParams(location.search).has('fault')&&localStorage.getItem('rade-solo-v2')){RADE.session.create=()=>{throw Error('Aucun point libre près de 9.89877439307345,176.93137656723448');};}\n"
save={'version':2,'savedAt':1794747600000,'cash':871,'xp':42,'sites':[],'player':{'x':9.89877439307345,'z':176.93137656723448,'hp':56,'yaw':.7}}
settings={'sensitivity':1.6,'deadzone':.2,'invert':True,'vibration':.3}
seed="if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');localStorage.setItem('rade-solo-v2',"+json.dumps(json.dumps(save))+");localStorage.setItem('emprise-pad-v1',"+json.dumps(json.dumps(settings))+");localStorage.setItem('unrelated','preserved');}"
pad="globalThis.virtualPad={id:'Xbox standard test',index:0,connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({value:0,pressed:false}))};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[virtualPad]});"
report={'sourceHtmlSha256':hashlib.sha256(html.encode()).hexdigest(),'checks':[],'controller':'Gamepad API virtuelle standard, aucune manette physique','screenshots':[]}
def state(b):return b.ev("({save:JSON.parse(localStorage.getItem('rade-solo-v2')),settings:JSON.parse(localStorage.getItem('emprise-pad-v1')),other:localStorage.getItem('unrelated'),fatal:!document.getElementById('recovery').hidden,confirm:!document.getElementById('reset-confirm').hidden,focus:document.activeElement.id,ready:!!RADE.game,errors:RADE.game?.errors||[]})")
def key(b,k,code):
 b.cmd('Input.dispatchKeyEvent',{'type':'keyDown','key':k,'code':code});b.cmd('Input.dispatchKeyEvent',{'type':'keyUp','key':k,'code':code})
def tap(b,i):
 b.ev(f'virtualPad.buttons[{i}].value=1;virtualPad.buttons[{i}].pressed=true;true');time.sleep(.075);b.ev(f'virtualPad.buttons[{i}].value=0;virtualPad.buttons[{i}].pressed=false;true');time.sleep(.075)
def capture(b,suffix):
 name=args.label+'-'+suffix+'.png';b.capture(name);report['screenshots'].append(name)
with tempfile.TemporaryDirectory(prefix='emprise-recovery-') as folder:
 target=Path(folder)/'index.html';target.write_text(html.replace(marker,hook+marker))
 with Browser() as b:
  b.cmd('Page.addScriptToEvaluateOnNewDocument',{'source':seed+pad});b.cmd('Page.navigate',{'url':target.as_uri()+'?fault=1&renderer=webgpu'});b.cmd('Page.bringToFront');b.wait("globalThis.RADE&&document.getElementById('recovery')&&!document.getElementById('recovery').hidden")
  before=state(b);assert before['save']==save and not before['ready'];assert before['focus']=='fatal-reload';capture(b,'fatal')
  b.ev('document.getElementById("fatal-reset").focus();document.getElementById("fatal-reset").click();true');b.wait("!document.getElementById('reset-confirm').hidden");assert state(b)['focus']=='cancel-reset';key(b,'Escape','Escape');assert not state(b)['confirm'];assert state(b)['save']==save
  b.ev('document.getElementById("fatal-reload").click();true');b.wait("globalThis.RADE&&document.getElementById('recovery')&&!document.getElementById('recovery').hidden");assert state(b)['save']==save;report['checks'].append('Fatal avant première frame, détail replié, rechargement et annulation clavier sans effacement')
  b.ev('document.getElementById("fatal-reset").focus();true');tap(b,0);assert state(b)['confirm'];tap(b,1);assert not state(b)['confirm'];assert state(b)['save']==save;tap(b,0);assert state(b)['confirm'];tap(b,13);assert state(b)['focus']=='confirm-reset';capture(b,'confirmation');tap(b,0)
  b.wait('globalThis.RADE?.game?.drawCount>2',90);b.ev('RADE.game.testing=true;true');fresh=state(b);assert not fresh['fatal'];assert fresh['save']['cash']==200;assert fresh['settings']==settings;assert fresh['other']=='preserved';assert not fresh['errors'];report['checks'].append('Manette : annulation B, double choix explicite A, nouvelle partie réelle à 200 €, réglages conservés')
  # Reset once from an initialized live session: reload fires real pagehide.
  b.ev('RADE.game.session.campaign.state.cash=9876;RADE.game.save();document.getElementById("title-reset").click();true');assert state(b)['save']['cash']==9876;b.ev('document.getElementById("confirm-reset").click();true');b.wait('globalThis.RADE?.game?.drawCount>2',90);b.ev('RADE.game.testing=true;true');assert state(b)['save']['cash']==200;assert state(b)['settings']==settings;capture(b,'new-game');report['checks'].append('Réinitialisation depuis le titre : pagehide ne ressuscite pas la progression effacée')
 # New profile + a genuine marine save at the exact reported coordinates.
 marine={**save,'marine':{'version':2,'mode':'swim','player':{**save['player'],'pitch':.2},'boats':[]}}
 marine_seed="localStorage.setItem('rade-solo-v2',"+json.dumps(json.dumps(marine))+");"
 with Browser() as b:
  b.cmd('Page.addScriptToEvaluateOnNewDocument',{'source':marine_seed});b.cmd('Page.navigate',{'url':target.as_uri()+'?renderer=webgpu'});b.cmd('Page.bringToFront');b.wait('globalThis.RADE?.game?.drawCount>2',90);b.ev('RADE.game.testing=true;true')
  result=b.ev('({mode:RADE.game.session.mode,player:RADE.game.session.player,cash:RADE.game.session.campaign.state.cash,water:RADE.game.session.world.water(RADE.game.session.player.x,RADE.game.session.player.z),errors:RADE.game.errors,backend:RADE.game.renderer.stats.backend})');assert result['mode']=='swim' and result['water'];assert abs(result['player']['x']-save['player']['x'])<1e-8;assert abs(result['player']['z']-save['player']['z'])<1e-8;assert result['player']['hp']==56 and result['cash']==871 and not result['errors'];report['marine']=result
  b.ev('RADE.game.start();RADE.game.audio.setMix({master:0});true');capture(b,'marine');report['checks'].append('Vraie ville et vraie session : reprise nage aux coordonnées du crash, santé et argent conservés')
output=ROOT/'docs'/(args.label+'.json');output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)
