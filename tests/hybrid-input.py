#!/usr/bin/env python3
"""Actual touch events and a frame-observed standard pad in native Chrome."""
from browser_support import Browser,ROOT
import json,time,hashlib

report={'checks':[],'buildSha256':hashlib.sha256((ROOT/'dist/index.html').read_bytes()).hexdigest(),'hardware':'Chrome touch emulation and virtual standard Gamepad API; no physical phone/controller.'}
with Browser() as b:
 b.cmd('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':1,'mobile':True})
 b.cmd('Emulation.setTouchEmulationEnabled',{'enabled':True,'maxTouchPoints':5})
 b.cmd('Page.addScriptToEvaluateOnNewDocument',{'source':"window.virtualPadReads=0;window.virtualPad={id:'Xbox standard',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({value:0,pressed:false}))};Object.defineProperty(navigator,'getGamepads',{value:()=>{virtualPadReads++;return [virtualPad];}});"})
 b.load()
 def press(i,v=1):
  n=b.ev(f'virtualPad.buttons[{i}].value={v};virtualPad.buttons[{i}].pressed={str(bool(v)).lower()};virtualPadReads');b.wait(f'virtualPadReads>{n}',5)
 def tap(i):
  reads=b.ev('virtualPadReads');b.wait(f'virtualPadReads>{reads}',5)
  press(i);press(i,0)
 def touch(kind,points=[]):b.cmd('Input.dispatchTouchEvent',{'type':kind,'touchPoints':points})
 def point(selector):return b.ev('(()=>{const r=document.querySelector('+json.dumps(selector)+').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,id:1};})()')
 assert b.ev('document.body.classList.contains("touch")')
 tap(0);b.wait('RADE.game.running');assert b.ev('document.body.classList.contains("pad")&&!document.body.classList.contains("touch")&&document.pointerLockElement===null')
 report['checks'].append('A starts the title on a coarse-pointer device without pointer lock, switching touch UI to pad')
 touch('touchStart',[{'x':260,'y':300,'id':1}]);touch('touchEnd');b.wait('document.body.classList.contains("touch")&&!document.body.classList.contains("pad")')
 touch('touchStart',[point('#touch-fire')]);b.wait('RADE.game.lastCommand.fire&&RADE.game.mobile.count===1')
 press(0);b.wait('document.body.classList.contains("pad")&&RADE.game.mobile.count===0&&!RADE.game.lastCommand.fire');press(0,0);touch('touchEnd');time.sleep(.3)
 assert b.ev('RADE.game.mobile.count===0&&!RADE.game.lastCommand.fire');report['checks'].append('Pad takeover cancels held touch fire and the late touch release cannot reactivate it')
 touch('touchStart',[{'x':260,'y':300,'id':2}]);touch('touchEnd');b.wait('document.body.classList.contains("touch")')
 b.cmd('Input.dispatchKeyEvent',{'type':'keyDown','key':'p','code':'KeyP','windowsVirtualKeyCode':80});b.cmd('Input.dispatchKeyEvent',{'type':'keyUp','key':'p','code':'KeyP','windowsVirtualKeyCode':80});b.wait('!RADE.game.running')
 assert b.ev('!document.body.classList.contains("touch")&&!document.body.classList.contains("pad")&&RADE.game.mobile.count===0')
 tap(9);b.wait('RADE.game.running');assert b.ev('document.body.classList.contains("pad")');report['checks'].append('Touch to keyboard pause clears touch, then Start resumes with pad')
 report['backend']=b.ev('RADE.game.renderer.stats.backend');report['errors']=b.ev('RADE.game.errors');assert not report['errors']
(ROOT/'docs/hybrid-input-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)
