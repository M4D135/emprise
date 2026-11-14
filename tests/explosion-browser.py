#!/usr/bin/env python3
"""Record a destructive vehicle fixture with real simulation commands and WebGL2."""
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
        cmd('Runtime.enable');cmd('Page.enable');cmd('Emulation.setDeviceMetricsOverride',{'width':1440,'height':900,'deviceScaleFactor':1,'mobile':False});cmd('Page.navigate',{'url':a.url or (root/'dist/index.html').as_uri()+'?test=1'});cmd('Page.bringToFront')
        start=time.monotonic()
        while not ev('!!globalThis.RADE?.game'):
            if time.monotonic()-start>30:raise RuntimeError('Initialization timeout')
            time.sleep(.1)
        ev("RADE.game.testing=true;window.s=RADE.game.session;Object.assign(s.car,{x:61.5,z:181,cap:0});s.sim.relocate(61.5,189,0);window.initial=s.save();window.ended=false;window.afterBlast=0;RADE.game.recorder.start('Véhicule sous le feu · test de destruction');RADE.game.controller=(s,dt)=>{if(s.car.exploded){afterBlast+=dt;if(afterBlast>3){ended=true;RADE.game.pause();}return {};}return {weapon:0,fire:true,lookY:Math.atan2(.8-(s.player.y+1.62),8)-s.player.pitch};};RADE.game.start();true")
        start=time.monotonic();captured=False;burnCaptured=False;smokeCaptured=False
        while not ev('ended'):
            assert time.monotonic()-start<95,ev('({running:RADE.game.running,hp:s.player.hp,shots:s.sim.state.shots,condition:s.car.condition})')
            assert not ev('RADE.game.errors')
            if not smokeCaptured and ev('s.car.condition?.body<.55&&!s.car.burning'):
                smokeCaptured=True
                (root/'docs/vehicle-damaged.png').write_bytes(base64.b64decode(cmd('Page.captureScreenshot',{'format':'png'})['data']))
            if not burnCaptured and ev('s.car.burning&&s.car.fireAge>4'):
                burnCaptured=True
                (root/'docs/vehicle-burning.png').write_bytes(base64.b64decode(cmd('Page.captureScreenshot',{'format':'png'})['data']))
            if not captured and ev('s.car.exploded'):
                captured=True
                (root/'docs/vehicle-explosion.png').write_bytes(base64.b64decode(cmd('Page.captureScreenshot',{'format':'png'})['data']))
            time.sleep(.08)
        assert smokeCaptured and burnCaptured and captured
        ev('document.getElementById("paused").hidden=true;true');time.sleep(.1)
        (root/'docs/vehicle-wreck.png').write_bytes(base64.b64decode(cmd('Page.captureScreenshot',{'format':'png'})['data']))
        tape=ev('RADE.game.recorder.stop()');tape['initial']=ev('initial');tape['source']='tests/explosion-browser.py (fixture préparée, puis tirs simulés réels)'
        tape['expected']=ev('({shots:s.sim.state.shots,mode:s.mode,player:[s.player.x,s.player.z],car:[s.car.x,s.car.z],cash:s.campaign.state.cash,exploded:s.car.exploded,explosions:s.urban.report.vehicleExplosions})')
        assert tape['expected']['exploded'];assert tape['expected']['explosions']==1
        (root/'docs/explosion-recording.json').write_text(json.dumps(tape,separators=(',',':'))+'\n')
        report=ev('({shots:s.sim.state.shots,explosions:s.urban.report.vehicleExplosions,condition:s.car.condition,physics:s.urban.bodies.length,errors:RADE.game.errors,audio:RADE.game.audio.stats,metrics:RADE.game.metrics()})');report['duration']=tape['duration'];report['buildSha256']=hashlib.sha256((root/'dist/index.html').read_bytes()).hexdigest()
        assert report['audio']['voices']==0;assert report['errors']==[]
        (root/'docs/explosion-browser.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2),flush=True)
    finally:chrome.fermer()
