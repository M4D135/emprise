"""Run the actual four host pages using native Chrome, with no HTTP service."""
import argparse,base64,json,time,hashlib
from browser_support import Browser,ROOT
p=argparse.ArgumentParser();p.add_argument('games',nargs='*',default=['metal','bitume','pdr']);args=p.parse_args()
out=ROOT/'work/reference-audit';out.mkdir(parents=True,exist_ok=True)
pages={'metal':ROOT.parent/'ferro-reference-metal/dist/index.html','bitume':ROOT.parent/'ferro-reference-bitume/dist/bitume.html','pdr':ROOT.parent/'ferro-reference-pdr/Jeu/dist/point-de-rupture.html'}
prelude=r'''
globalThis.hostErrors=[];globalThis.hostFrames=0;
addEventListener('error',e=>hostErrors.push(e.message));addEventListener('unhandledrejection',e=>hostErrors.push(String(e.reason)));
let renderAPI;const wrapped=new WeakSet();Object.defineProperty(globalThis,'FRender',{configurable:true,get(){return renderAPI;},set(api){renderAPI=api;if(wrapped.has(api))return;wrapped.add(api);const create=api.create;api.create=function(...args){const r=create(...args);globalThis.hostRenderer=r;const draw=r.draw;r.draw=function(...values){const result=draw(...values);hostFrames++;if(r.gl){const error=r.gl.getError();if(error&&!hostErrors.length)hostErrors.push('GL '+error+' frame '+hostFrames);}return result;};return r;};}});
'''
for game in args.games:
 with Browser() as b:
  b.cmd('Page.addScriptToEvaluateOnNewDocument',{'source':prelude});b.cmd('Log.enable')
  b.cmd('Page.navigate',{'url':pages[game].as_uri()});b.cmd('Page.bringToFront')
  b.wait('globalThis.hostErrors?.length || globalThis.hostFrames>3',90)
  if game=='pdr':b.wait("globalThis.hostErrors?.length || globalThis.PDR?.page?.ui?.ecran==='titre'",90)
  early=b.ev('({errors:hostErrors,frames:hostFrames,version:globalThis.FERRO?.version})')
  early['glWarnings']=[e.get('params',{}).get('entry',{}).get('text') for e in b.c.evenements if e.get('method')=='Log.entryAdded']
  (out/(game+'-boot.json')).write_text(json.dumps(early,indent=2))
  assert not early['errors'],early
  if game=='metal':
   b.ev("document.getElementById('start').click();true")
   b.wait("hostErrors.length || document.getElementById('intro').hidden",90)
   # Actual keyboard input, with pointer lock requested by the game's start gesture.
   b.cmd('Input.dispatchKeyEvent',{'type':'keyDown','key':'w','code':'KeyW','windowsVirtualKeyCode':87})
  elif game=='bitume':b.ev('BITUME_JEU.demo(0);true')
  else:
   b.ev("document.getElementById('titre-jouer').click();true")
   b.wait("PDR.page.ui.ecran==='preparation'")
   b.ev("document.getElementById('prep-lancer').click();true")
   b.wait("hostErrors.length || PDR.page.ui.ecran==='partie'",90)
  first=b.ev('hostFrames');b.wait('hostErrors.length || hostFrames>'+str(first+90),90)
  if game=='metal':b.cmd('Input.dispatchKeyEvent',{'type':'keyUp','key':'w','code':'KeyW','windowsVirtualKeyCode':87})
  state=b.ev("({errors:hostErrors,frames:hostFrames,stats:hostRenderer.stats,version:FERRO.version,screen:globalThis.PDR?.page?.ui?.ecran||globalThis.BITUME_JEU?.ecran,body:document.body.innerText.slice(0,1800)})")
  state['sha256']=hashlib.sha256(pages[game].read_bytes()).hexdigest()
  state['glWarnings']=[e.get('params',{}).get('entry',{}).get('text') for e in b.c.evenements if e.get('method')=='Log.entryAdded'];state['browserErrors']=[e for e in b.c.evenements if e.get('method')=='Runtime.exceptionThrown']
  (out/(game+'-browser.json')).write_text(json.dumps(state,indent=2,ensure_ascii=False)+'\n')
  (out/(game+'-browser.png')).write_bytes(base64.b64decode(b.cmd('Page.captureScreenshot',{'format':'png'})['data']))
  assert not state['errors'] and not state['browserErrors'],state
  assert state['stats']['backend']=='webgl2' and state['stats']['drawCalls']>0,state
  print(game+': native game page PASS',flush=True)
