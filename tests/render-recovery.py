#!/usr/bin/env python3
"""Real Chrome WebGPU failures and WebGL2 recovery. CDP pipe, no server/port."""
from browser_support import Browser,ROOT
import argparse,json,time
parser=argparse.ArgumentParser();parser.add_argument('--cases',nargs='+',default=['device-lost','validation-error','adapter-rejected','api-absent','installation-error']);args=parser.parse_args()
# Record the real first/live session before renderer creation. A later demo
# preparation cannot replace this sentinel. No renderer/session test doubles.
PRELUDE=r'''let recoveryNamespace;const recoveryNamespaces=new WeakSet();Object.defineProperty(globalThis,'RADE',{configurable:true,get(){return recoveryNamespace;},set(value){recoveryNamespace=value;if(recoveryNamespaces.has(value))return;recoveryNamespaces.add(value);let sessionAPI;Object.defineProperty(value,'session',{configurable:true,get(){return sessionAPI;},set(api){sessionAPI=api;const create=api.create;api.create=function(...args){const s=create.apply(this,args);if(!globalThis.__recoverySession){globalThis.__recoverySession=s;s.campaign.state.cash=4321.5;s.player.hp=73;s.sim.state.inventory.ammo.splice(0,3,71,17,6);globalThis.__recoverySnapshot=JSON.stringify({cash:s.campaign.state.cash,hp:s.player.hp,inventory:s.sim.state.inventory,weapon:s.sim.state.weapon});}return s;};}});}});'''
INJECT={
 'adapter-rejected':"Object.defineProperty(navigator.gpu,'requestAdapter',{configurable:true,value:async()=>{throw Error('Injected adapter rejection');}});",
 'api-absent':"Object.defineProperty(navigator,'gpu',{configurable:true,value:undefined});",
 'installation-error':r'''let nativeAPI;Object.defineProperty(globalThis,'FRenderWebGPU',{configurable:true,get(){return nativeAPI;},set(value){nativeAPI=value;const create=value.create;value.create=async function(...args){const r=await create.apply(this,args);r.setWorld=()=>{throw Error('Injected native installation failure');};return r;};}});'''
}
STATE=r'''(()=>{const g=RADE.game,s=g.session;return {backend:g.renderer.stats.backend,sameSession:s===__recoverySession,state:JSON.stringify({cash:s.campaign.state.cash,hp:s.player.hp,inventory:s.sim.state.inventory,weapon:s.sim.state.weapon}),before:__recoverySnapshot,errors:g.errors,events:g.backendEvents,reason:g.renderer.stats.fallbackReason,running:g.running,recovering:g.recoveringRenderer,canvasReplaced:!!globalThis.__oldCanvas&&__oldCanvas!==document.getElementById('scene'),pointerLocked:document.pointerLockElement===document.getElementById('scene'),loading:!document.getElementById('loading').hidden};})()'''
report={'description':'Actual device loss, uncaptured GPU validation, adapter/API/init failure; same live session and replaced-canvas input','cases':[]}
output=ROOT/'docs/render-recovery.json'
def input_checks(b):
 # Keep simulation state frozen while recording the real commands assembled by
 # game input. testing=false deliberately exercises normal pointerlock release.
 b.ev("window.__seen={};RADE.game.session.update=(dt,c)=>{for(const k of ['forward','moveY','interact','fire','lookX','lookY','zoomDelta'])if(c[k])__seen[k]=c[k];};RADE.game.testing=false;if(!RADE.game.running)RADE.game.start();true")
 b.cmd('Input.dispatchKeyEvent',{'type':'keyDown','key':'w','code':'KeyW','windowsVirtualKeyCode':87});b.wait('Math.abs(__seen.moveY||0)>.2',5);b.cmd('Input.dispatchKeyEvent',{'type':'keyUp','key':'w','code':'KeyW','windowsVirtualKeyCode':87})
 b.cmd('Input.dispatchKeyEvent',{'type':'keyDown','key':'e','code':'KeyE','windowsVirtualKeyCode':69});b.wait('!!__seen.interact',5);b.cmd('Input.dispatchKeyEvent',{'type':'keyUp','key':'e','code':'KeyE','windowsVirtualKeyCode':69})
 b.cmd('Input.dispatchMouseEvent',{'type':'mousePressed','x':720,'y':450,'button':'left','buttons':1,'clickCount':1});b.wait('!!__seen.fire',5)
 # movementX is explicit so the check also covers browsers denying pointer lock;
 # mousedown above is genuine CDP input and enables the documented drag fallback.
 b.ev("document.getElementById('scene').dispatchEvent(new MouseEvent('mousemove',{bubbles:true,movementX:24,movementY:-12}));true");b.wait('Math.abs(__seen.lookX||0)>.001',5)
 b.cmd('Input.dispatchMouseEvent',{'type':'mouseReleased','x':744,'y':438,'button':'left','buttons':0,'clickCount':1})
 b.ev("document.getElementById('scene').dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:120}));true");b.wait('Math.abs(__seen.zoomDelta||0)>.1',5)
 context_menu=b.ev("(()=>{const e=new MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2});document.getElementById('scene').dispatchEvent(e);return e.defaultPrevented;})()")
 assert context_menu,'Context menu no longer prevented on the replacement canvas'
 return {'commands':b.ev('__seen'),'contextMenuPrevented':context_menu,'testing':b.ev('RADE.game.testing')}
for case in args.cases:
 assert case in ['device-lost','validation-error',*INJECT],case
 print('START recovery '+case,flush=True)
 with Browser() as b:
  b.cmd('Page.addScriptToEvaluateOnNewDocument',{'source':PRELUDE+INJECT.get(case,'')})
  b.load('?test=1&renderer=webgpu')
  if case in ['device-lost','validation-error']:
   assert b.ev('RADE.game.renderer.stats.backend')=='webgpu','Native GPU required to test actual recovery'
   b.ev("RADE.game.testing=false;RADE.game.session.update=()=>{};RADE.game.start();RADE.game.audio.setMix({master:0});window.__oldCanvas=document.getElementById('scene');true")
   b.wait('RADE.game.running',5)
   # Let pending pointerlockchange from start settle before deliberately losing it.
   b.ev("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))")
   before=b.ev(STATE);assert before['state']==before['before'],before
   if case=='device-lost':b.ev('RADE.game.renderer.gpu.device.destroy();true')
   else:b.ev('RADE.game.renderer.gpu.device.createBuffer({size:4,usage:0});true')
   b.wait("RADE.game.renderer.stats.backend==='webgl2'&&!RADE.game.recoveringRenderer",45)
   b.ev("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))")
   result=b.ev(STATE);assert result['canvasReplaced'],result;assert result['running'],'Recovery was paused by its delayed pointerlockchange';assert len(result['events'])==1,result
  else:result=b.ev(STATE)
  assert result['backend']=='webgl2',result;assert result['sameSession'],result;assert result['state']==result['before'],result;assert not result['errors'],result;assert not result['loading'],result
  inputs=input_checks(b);after=b.ev(STATE);assert after['state']==after['before'],after;assert not after['errors'],after
  record={'case':case,'state':result,'input':inputs,'framesAfter':b.ev('RADE.game.drawCount')};report['cases'].append(record);output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
  if case=='device-lost':b.capture('render-recovered-webgl2.png')
  print('PASS recovery '+case,flush=True)
print('PASS '+str(output),flush=True)
