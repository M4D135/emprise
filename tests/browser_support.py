"""Shared Chrome CDP pipe harness. No HTTP service or listening port."""
import tempfile,time,pathlib,base64,os
from urllib.parse import parse_qs
from chrome import Tube
ROOT=pathlib.Path(__file__).resolve().parents[1]
class Browser:
 def __enter__(self):
  self.profile=tempfile.TemporaryDirectory(prefix='emprise-test-');self.log=tempfile.TemporaryFile(mode='w+')
  self.c=Tube('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--remote-debugging-pipe','--user-data-dir='+self.profile.name,'--no-first-run','--disable-background-networking','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--window-size=1440,1000','about:blank'],self.log)
  tid=self.c.envoyer('Target.createTarget',{'url':'about:blank'})['targetId'];self.sid=self.c.envoyer('Target.attachToTarget',{'targetId':tid,'flatten':True})['sessionId']
  self.cmd('Runtime.enable');self.cmd('Page.enable');self.cmd('Emulation.setDeviceMetricsOverride',{'width':1440,'height':900,'deviceScaleFactor':1,'mobile':False});return self
 def cmd(self,m,p=None):return self.c.envoyer(m,p,self.sid)
 def ev(self,s):
  r=self.cmd('Runtime.evaluate',{'expression':s,'returnByValue':True,'awaitPromise':True,'userGesture':True});assert not r.get('exceptionDetails'),r;return r.get('result',{}).get('value')
 def wait(self,s,seconds=45):
  end=time.monotonic()+seconds
  while not self.ev(s):
   assert time.monotonic()<end,'Timeout: '+s;time.sleep(.05)
 def load(self,query='?test=1'):
  backend=os.environ.get('EMPRISE_RENDERER')
  if backend and 'renderer=' not in query:query+=('&' if '?' in query else '?')+'renderer='+backend
  self.cmd('Page.navigate',{'url':(ROOT/'dist/index.html').as_uri()+query});self.cmd('Page.bringToFront');self.wait('globalThis.RADE?.game?.drawCount>2');self.ev('RADE.game.testing=true;true')
  expected=parse_qs(query.lstrip('?')).get('renderer',['auto'])[0]
  if backend and expected in ['webgpu','webgl2']:assert self.ev('RADE.game.renderer.stats.backend')==expected
 def capture(self,name): (ROOT/'docs'/name).write_bytes(base64.b64decode(self.cmd('Page.captureScreenshot',{'format':'png'})['data']))
 def __exit__(self,*a):self.c.fermer();self.profile.cleanup();self.log.close()
