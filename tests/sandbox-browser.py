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
        def key(code):
            for event in ['keyDown','keyUp']:cmd('Input.dispatchKeyEvent',{'type':event,'code':code,'key':code[3:].lower() if code.startswith('Key') else code})
        def click(id):
            rect=ev('(()=>{const r=document.getElementById('+json.dumps(id)+').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()')
            for event in ['mousePressed','mouseReleased']:cmd('Input.dispatchMouseEvent',{'type':event,**rect,'button':'left','clickCount':1})
        ev('RADE.game.testing=true;true');click('start');time.sleep(.15)
        key('KeyM');time.sleep(.2);assert ev('RADE.game.panel') is None;assert 'Pas de plan' in ev('RADE.game.session.message')
        # Start a fresh simulation for the recorded run; retain no pre-record commands.
        cmd('Page.navigate',{'url':a.url or (root/'dist/index.html').as_uri()});time.sleep(.8)
        while not ev('!!globalThis.RADE?.game'):time.sleep(.1)
        ev('RADE.game.testing=true;RADE.game.recorder.start("Commerce contesté · session de test validée");true')
        click('start');ev((root/'tests/sandbox-scenario.js').read_text())
        ev('window.auto=radeSandboxScenario(RADE.game.session);RADE.game.controller=(s,dt)=>{if(auto.finished){RADE.game.controller=null;RADE.game.pause();return {};}return auto.step(dt);};true')
        last='';start=time.monotonic()
        while not ev('auto.finished'):
            stage=ev('auto.stage')
            if stage!=last:print(stage,flush=True);last=stage
            if time.monotonic()-start>120:raise RuntimeError('Sandbox timeout')
            assert not ev('RADE.game.errors')
            time.sleep(.2)
        time.sleep(.1);tape=ev('RADE.game.recorder.stop()');tape['source']='tests/sandbox-browser.py / tests/sandbox-scenario.js';tape['expected']=ev('({shots:RADE.game.session.sim.state.shots,mode:RADE.game.session.mode,player:[RADE.game.session.player.x,RADE.game.session.player.z],car:[RADE.game.session.car.x,RADE.game.session.car.z],cash:RADE.game.session.campaign.state.cash,owner:RADE.game.session.campaign.sites[0].gang,mapOwned:RADE.game.session.campaign.state.mapOwned})')
        (root/'docs/sandbox-recording.json').write_text(json.dumps(tape,separators=(',',':'))+'\n')
        report=ev('({scenario:auto.report(),metrics:RADE.game.metrics(),architecture:{facades:RADE.game.session.world.architecture.facades,windows:RADE.game.session.world.architecture.windows,pieces:RADE.game.session.world.architecture.pieces},errors:RADE.game.errors})');assert report['scenario']['complete'],report
        ev('document.getElementById("paused").hidden=true;true');time.sleep(.1)
        (root/'docs/sandbox-capture.png').write_bytes(base64.b64decode(cmd('Page.captureScreenshot',{'format':'png'})['data']))
        ev('document.getElementById("paused").hidden=false;true');click('resume');key('KeyM');time.sleep(.2)
        assert ev('RADE.game.panel')=='map';before=ev('RADE.game.session.time');time.sleep(.5);assert ev('RADE.game.session.time')>before+.3
        assert ev('document.querySelectorAll("#mapbox,#map").length')==0
        (root/'docs/paper-map.png').write_bytes(base64.b64decode(cmd('Page.captureScreenshot',{'format':'png'})['data']))
        key('KeyM');time.sleep(.1);assert ev('RADE.game.panel') is None
        # Walk to a real city-plan board using the same foot commands.
        ev('window.reached=false;RADE.game.controller=s=>{const b=s.world.boards[0];if(Math.hypot(b.x-s.player.x,b.z-s.player.z)<1.8){window.reached=true;return {};}return auto.walk(b.x,b.z);};true')
        start=time.monotonic()
        while not ev('reached'):
            assert time.monotonic()-start<25;time.sleep(.1)
        ev('RADE.game.controller=null;true');key('KeyE');time.sleep(.2);assert ev('RADE.game.panel')=='board';assert ev('document.getElementById("map-origin").textContent')=='PANNEAU PUBLIC'
        key('KeyE');key('KeyP');before=ev('RADE.game.session.campaign.save()');assert ev('RADE.storage.load().mapOwned')
        cmd('Page.navigate',{'url':a.url or (root/'dist/index.html').as_uri()});time.sleep(.8)
        while not ev('!!globalThis.RADE?.game'):time.sleep(.1)
        after=ev('RADE.game.session.campaign.save()');assert after['mapOwned'];assert after['sites'][0]['gang']==0;assert after['cash']>=before['cash'];assert after['cash']-before['cash']<5
        report['ui']={'mapRequiresPurchase':True,'paperMapWithM':True,'noMinimap':True,'worldRunsWhileReading':True,'cityPlanBoard':True,'persistenceOnReload':True,'cashBefore':before['cash'],'cashAfter':after['cash']}
        report['buildSha256']=hashlib.sha256((root/'dist/index.html').read_bytes()).hexdigest();report['hardware']='MacBook Air Mac17,4, Apple M5, 24 Go';report['url']=a.url or 'file://dist/index.html'
        (root/'docs/sandbox-browser.json').write_text(json.dumps(report,indent=2)+'\n')
        print(json.dumps(report,indent=2),flush=True)
    finally:chrome.fermer()
