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
        assert ev('document.title').startswith('EMPRISE');assert 'V'+json.loads((root/'VERSION.json').read_text())['version'] in ev('document.querySelector(".game-version").textContent')
        ready=time.monotonic();ev('RADE.game.testing=true;window.liveReference=RADE.game.session;window.persistBefore=localStorage.getItem("rade-solo-v2");true')
        time.sleep(4.0);assert not ev('RADE.game.demo')
        while not ev('RADE.game.demo'):
            assert time.monotonic()-ready<8;time.sleep(.05)
        delay=time.monotonic()-ready;assert 4.7<delay<6.5,delay
        first=ev('document.getElementById("attract-label").textContent');assert 'Tir et conduite' in first
        time.sleep(2);assert ev('RADE.game.session.time')>1.5;assert ev('localStorage.getItem("rade-solo-v2")===persistBefore');assert ev('RADE.game.audio.stats.voices')==0
        cmd('Input.dispatchKeyEvent',{'type':'keyDown','code':'Space','key':' '});cmd('Input.dispatchKeyEvent',{'type':'keyUp','code':'Space','key':' '});time.sleep(.15)
        assert not ev('RADE.game.demo');assert ev('RADE.game.session===liveReference');assert not ev('document.getElementById("title").hidden');assert ev('RADE.game.session.time')==0
        start=time.monotonic()
        while not ev('RADE.game.demo'):
            assert time.monotonic()-start<8;time.sleep(.05)
        second=ev('document.getElementById("attract-label").textContent');assert 'Commerce' in second
        time.sleep(7)
        (root/'docs/attract-demo.png').write_bytes(base64.b64decode(cmd('Page.captureScreenshot',{'format':'png'})['data']))
        assert ev('localStorage.getItem("rade-solo-v2")===persistBefore');assert not ev('RADE.game.errors')
        cmd('Input.dispatchMouseEvent',{'type':'mousePressed','x':720,'y':450,'button':'left','clickCount':1});cmd('Input.dispatchMouseEvent',{'type':'mouseReleased','x':720,'y':450,'button':'left','clickCount':1});time.sleep(.15)
        assert not ev('RADE.game.demo');assert ev('RADE.game.session===liveReference');assert ev('RADE.game.session.campaign.state.cash')==200;assert not ev('RADE.game.session.campaign.state.mapOwned')
        # The third recording includes an explicit saved fixture, then only genuine fire commands.
        start=time.monotonic()
        while not ev('RADE.game.demo'):
            assert time.monotonic()-start<8;time.sleep(.05)
        third=ev('document.getElementById("attract-label").textContent');assert 'Véhicule sous le feu' in third
        start=time.monotonic()
        explosionCheckpoint=ev('RADE.replays.find(t=>t.label.includes("Véhicule sous le feu")).duration-2')
        while ev('RADE.game.session.time')<explosionCheckpoint:
            assert time.monotonic()-start<60;assert ev('RADE.game.demo');assert not ev('RADE.game.errors');time.sleep(.15)
        assert ev('RADE.game.session.car.exploded');assert ev('RADE.game.session.urban.report.vehicleExplosions')==1
        assert ev('localStorage.getItem("rade-solo-v2")===persistBefore');assert ev('RADE.game.audio.stats.voices')==0
        for event in ['keyDown','keyUp']:cmd('Input.dispatchKeyEvent',{'type':event,'code':'Space','key':' '})
        time.sleep(.15);assert ev('RADE.game.session===liveReference');assert not ev('RADE.game.session.car.exploded')
        start=time.monotonic()
        while not ev('RADE.game.demo'):
            assert time.monotonic()-start<8;time.sleep(.05)
        fourth=ev('document.getElementById("attract-label").textContent');assert 'Patrouille' in fourth
        start=time.monotonic()
        while not ev('!!RADE.game.session.campaign.law.lastArrest'):
            assert time.monotonic()-start<30;assert ev('RADE.game.demo');time.sleep(.1)
        assert ev('RADE.game.session.interiors.active?.place?.kind')=='police'
        assert ev('localStorage.getItem("rade-solo-v2")===persistBefore');assert ev('RADE.game.audio.stats.voices')==0
        for event in ['keyDown','keyUp']:cmd('Input.dispatchKeyEvent',{'type':event,'code':'Space','key':' '})
        time.sleep(.15);assert ev('RADE.game.session===liveReference');assert not ev('RADE.game.session.campaign.law.lastArrest')
        # Real pointer event enters live play after returning from the demo.
        rect=ev('(()=>{const r=document.getElementById("start").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()')
        for event in ['mousePressed','mouseReleased']:cmd('Input.dispatchMouseEvent',{'type':event,**rect,'button':'left','clickCount':1})
        time.sleep(.3);assert ev('RADE.game.running');assert not ev('RADE.game.demo');assert not ev('RADE.game.errors')
        report={'delaySeconds':delay,'recordings':[first,second,third,fourth],'keysAndMouseReturnToTitle':True,'liveSessionUnchanged':True,'saveUnchanged':True,'livePlayAfterDemo':True,'explosionReplayValidated':True,'policeReplayValidated':True,'errors':ev('RADE.game.errors'),'url':a.url or 'file://dist/index.html','buildSha256':hashlib.sha256((root/'dist/index.html').read_bytes()).hexdigest()}
        (root/'docs/attract-validation.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2),flush=True)
    finally:chrome.fermer()
