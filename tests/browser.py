#!/usr/bin/env python3
"""Run the real-time WebGL2 mission with 480 civilians; CDP pipe, no server/port."""
import argparse,base64,hashlib,json,pathlib,tempfile,time
from chrome import Tube
p=argparse.ArgumentParser();p.add_argument('--chrome',default='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');p.add_argument('--url');a=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='rade-chrome-') as profile, tempfile.TemporaryFile(mode='w+') as journal:
    chrome=Tube(a.chrome,['--remote-debugging-pipe','--user-data-dir='+profile,'--window-size=1440,1000','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-extensions','--disable-sync','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--force-device-scale-factor=1','about:blank'],journal)
    try:
        target=chrome.envoyer('Target.createTarget',{'url':'about:blank'})['targetId'];sid=chrome.envoyer('Target.attachToTarget',{'targetId':target,'flatten':True})['sessionId']
        def cmd(method,params=None):return chrome.envoyer(method,params,sid)
        def ev(js):
            r=cmd('Runtime.evaluate',{'expression':js,'returnByValue':True,'awaitPromise':True,'userGesture':True})
            if r.get('exceptionDetails'):raise RuntimeError(str(r['exceptionDetails']))
            return r.get('result',{}).get('value')
        cmd('Runtime.enable');cmd('Page.enable');cmd('Emulation.setDeviceMetricsOverride',{'width':1440,'height':900,'deviceScaleFactor':1,'mobile':False});cmd('Page.navigate',{'url':a.url or (root/'dist/index.html').as_uri()});cmd('Page.bringToFront')
        start=time.monotonic()
        while not ev('!!globalThis.RADE?.game'):
            if time.monotonic()-start>30:raise RuntimeError('Initialization timeout')
            time.sleep(.1)
        rect=ev('(()=>{const r=document.getElementById("start").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()')
        for event in ['mousePressed','mouseReleased']:cmd('Input.dispatchMouseEvent',{'type':event,**rect,'button':'left','clickCount':1})
        assert ev('RADE.game.running')
        ev((root/'tests/scenario.js').read_text())
        ev('RADE.game.testing=true;window.auto=radeScenario(RADE.game.session);RADE.game.samples.length=0;RADE.game.cpuSamples.length=0;RADE.game.controller=(s,dt)=>{if(auto.finished){RADE.game.controller=null;RADE.game.pause();return {};}RADE.game.view=auto.stage==="drive"&&auto.report().waypoints<5?"cockpit":"poursuite";return auto.step(dt);};true')
        last='';start=time.monotonic()
        while not ev('auto.finished'):
            stage=ev('auto.stage')
            if stage!=last:print(stage,flush=True);last=stage
            if time.monotonic()-start>200:raise RuntimeError('Mission timeout')
            time.sleep(.3)
        report=ev('({scenario:auto.report(),metrics:RADE.game.metrics(),errors:RADE.game.errors,details:RADE.game.session.world.detailCount,clearedTrees:RADE.game.session.world.clearedTrees})')
        report['buildSha256']=hashlib.sha256((root/'dist/index.html').read_bytes()).hexdigest();report['hardware']='MacBook Air Mac17,4, Apple M5, 24 Go (machine du contrôle initial)';report['url']=a.url or 'file://dist/index.html'
        (root/'docs/browser-performance.json').write_text(json.dumps(report,indent=2)+'\n')
        assert report['scenario']['complete'];assert not report['errors']
        ev('document.getElementById("paused").hidden=true;true');time.sleep(.2)
        (root/'docs/mission-complete.png').write_bytes(base64.b64decode(cmd('Page.captureScreenshot',{'format':'png'})['data']))
        print(json.dumps({'complete':True,'frame':report['metrics']['frame'],'cpu':report['metrics']['cpu'],'sha256':report['buildSha256']},indent=2),flush=True)
    finally:chrome.fermer()
