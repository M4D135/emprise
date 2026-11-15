#!/usr/bin/env python3
"""Public deployment, real browser input with native and fallback rendering."""
from browser_support import Browser,ROOT
import argparse,hashlib,json,time,urllib.request
p=argparse.ArgumentParser();p.add_argument('--url',default='https://gta.estrasse.fr/');a=p.parse_args()
size=json.loads((ROOT/'SIZE.json').read_text())
with urllib.request.urlopen(a.url,timeout=30) as r:served=r.read()
assert hashlib.sha256(served).hexdigest()==size['sha256'],'Public build differs'
report={'url':a.url,'version':size['version'],'build':size['build'],'sha256':size['sha256'],'cases':[]}
for requested,expected in [('auto','webgpu'),('webgl2','webgl2')]:
 with Browser() as b:
  b.cmd('Page.navigate',{'url':a.url+'?test=1&renderer='+requested});b.cmd('Page.bringToFront');b.wait('globalThis.RADE?.game?.drawCount>2',90)
  assert b.ev('RADE.build.id')==size['build'];assert b.ev('RADE.game.renderer.stats.backend')==expected
  assert expected.lower() in b.ev('document.querySelector(".game-version").textContent').lower()
  if requested=='auto':
   from base64 import b64decode
   (ROOT.parent/'EMPRISE-public.png').write_bytes(b64decode(b.cmd('Page.captureScreenshot',{'format':'png'})['data']))
  b.ev('RADE.game.testing=true;true')
  rect=b.ev('(()=>{const r=document.getElementById("start").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()')
  for event in ['mousePressed','mouseReleased']:b.cmd('Input.dispatchMouseEvent',{'type':event,**rect,'button':'left','clickCount':1})
  time.sleep(.2)
  def hold(code,key,seconds):
   b.cmd('Input.dispatchKeyEvent',{'type':'keyDown','code':code,'key':key});time.sleep(seconds);b.cmd('Input.dispatchKeyEvent',{'type':'keyUp','code':code,'key':key})
  hold('KeyW','w',.3);time.sleep(.15);hold('KeyE','e',.08);time.sleep(.25);hold('KeyW','w',.7)
  result=b.ev('({backend:RADE.game.renderer.stats.backend,build:RADE.build.id,running:RADE.game.running,mode:RADE.game.session.mode,engine:RADE.game.session.car.moteur,speed:RADE.game.session.car.v,errors:RADE.game.errors,gpuErrors:RADE.game.renderer.stats.errorEvents||[],fallback:RADE.game.backendEvents})')
  assert result['backend']==expected and result['running'] and result['mode']=='car' and result['engine'] and result['speed']>1,result
  assert not result['errors'] and not result['gpuErrors'] and not result['fallback'],result
  report['cases'].append({'requested':requested,**result});b.ev('RADE.game.pause();true');print('PASS public '+expected,flush=True)
(ROOT.parent/'deployment.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
