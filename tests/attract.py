#!/usr/bin/env python3
"""Run the real-time mission with 480 civilians; CDP pipe, no server/port."""
import argparse,base64,hashlib,json,pathlib,tempfile,time,os
from chrome import Tube
p=argparse.ArgumentParser();p.add_argument('--chrome',default='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');p.add_argument('--url');a=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[1]
TITLE_PROBE=(root/'tests/title-save-probe.js').read_text()
TIMING=r'''(()=>{
 const phases=window.__attractTiming={titles:[],cycles:[]},hidden=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'hidden'),wrapped=new WeakSet();let titleAt=0,current=null,pending=null;
 Object.defineProperty(HTMLElement.prototype,'hidden',{...hidden,set(value){
  const watched=this.id==='title'||this.id==='loading'||this.id==='attract',changed=watched&&hidden.get.call(this)!==value,at=changed?performance.now():0;
  hidden.set.call(this,value);if(!changed)return;const g=globalThis.RADE?.game;
  if(this.id==='title'&&!value){titleAt=at;phases.titles.push(at);}
  if(this.id==='loading'&&!value&&g?.transition==='demo'){current={titleAt,loadingAt:at};phases.cycles.push(current);}
  if(this.id==='attract'&&value&&current)current.cancelled=true;
  if(this.id!=='attract'||value||!current||!g?.demo)return;
  const cycle=current;cycle.readyAt=at;cycle.initialTime=g.session.time;pending=cycle;
  const renderer=g.renderer;if(!wrapped.has(renderer)){wrapped.add(renderer);const draw=renderer.draw;renderer.draw=function(...args){
   const q=pending;if(!q)return draw.apply(this,args);pending=null;q.firstDrawAt=performance.now();const result=draw.apply(this,args);q.firstDrawEnd=performance.now();return result;
  };}
  setTimeout(()=>{if(cycle.cancelled)return;const live=globalThis.RADE?.game;cycle.progressAt=performance.now();cycle.progressTime=live?.demo&&live.ready&&!live.transition?live.session?.time:null;},2000);
 }});
})();'''
with tempfile.TemporaryDirectory(prefix='rade-chrome-') as profile, tempfile.TemporaryFile(mode='w+') as journal:
    chrome=Tube(a.chrome,['--remote-debugging-pipe','--user-data-dir='+profile,'--window-size=1440,1000','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-extensions','--disable-sync','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--force-device-scale-factor=1','about:blank'],journal)
    try:
        target=chrome.envoyer('Target.createTarget',{'url':'about:blank'})['targetId'];sid=chrome.envoyer('Target.attachToTarget',{'targetId':target,'flatten':True})['sessionId']
        def cmd(method,params=None):return chrome.envoyer(method,params,sid)
        def ev(js):
            r=cmd('Runtime.evaluate',{'expression':js,'returnByValue':True,'awaitPromise':True,'userGesture':True})
            if r.get('exceptionDetails'):raise RuntimeError(str(r['exceptionDetails']))
            return r.get('result',{}).get('value')
        def wait_for(js,timeout=12):
            deadline=time.monotonic()+timeout
            while not ev(js):
                assert time.monotonic()<deadline,'Timed out: '+js
                assert not ev('RADE.game.errors')
                time.sleep(.05)
        def wait_demo():
            wait_for('RADE.game.demo&&RADE.game.ready&&!RADE.game.transition&&RADE.game.running')
        def returned_title():
            wait_for('RADE.game.ready&&!RADE.game.transition&&!RADE.game.demo')
            assert ev('RADE.game.session===null&&RADE.game.crowdView===null&&(!RADE.game.renderer||RADE.game.renderer.stats.staticTotal===0)'),'Returning title releases the recording and renderer scene without constructing another city'
            assert not ev('document.getElementById("title").hidden')
            assert ev('localStorage.getItem("rade-solo-v2")===persistBefore')
        cmd('Runtime.enable');cmd('Page.enable');cmd('Page.addScriptToEvaluateOnNewDocument',{'source':TITLE_PROBE+TIMING});cmd('Emulation.setDeviceMetricsOverride',{'width':1440,'height':900,'deviceScaleFactor':1,'mobile':False});cmd('Page.navigate',{'url':a.url or (root/'dist/index.html').as_uri()+'?renderer='+os.environ.get('EMPRISE_RENDERER','auto')});cmd('Page.bringToFront')
        start=time.monotonic()
        while not ev('!!globalThis.RADE?.game'):
            if time.monotonic()-start>30:raise RuntimeError('Initialization timeout')
            time.sleep(.1)
        assert ev('document.title').startswith('EMPRISE');assert 'V'+json.loads((root/'VERSION.json').read_text())['version'] in ev('document.querySelector(".game-version").textContent')
        ready=time.monotonic();initial=ev('__titleSaveProbe.initial')
        assert initial and initial['ready'] and initial['sessionNull'] and initial['rendererNull'] and initial['crowdNull'],initial
        assert initial['created']==0 and initial['drawCount']==0,initial
        assert initial['persisted'] is None,'Fresh-profile baseline must have no save'
        ev('RADE.game.testing=true;window.persistBefore=__titleSaveProbe.initial.persisted;true')
        wait_for('__attractTiming.cycles.length>0')
        poll_start=time.monotonic();observed=ev('({at:performance.now(),cycle:__attractTiming.cycles[0]})');poll_seconds=time.monotonic()-poll_start
        cycle=observed['cycle'];delay=(cycle['loadingAt']-cycle['titleAt'])/1000;assert 4.7<delay<6.5,cycle
        # Five seconds starts the visible loading transition. A full world is
        # built only after the previous one has been released, with no play ticks.
        wait_demo();wait_for('Number.isFinite(__attractTiming.cycles[0].firstDrawEnd)')
        cycle=ev('__attractTiming.cycles[0]');first_play=(cycle['firstDrawEnd']-cycle['titleAt'])/1000;assert first_play<12,cycle
        first=ev('document.getElementById("attract-label").textContent');assert 'Tir et conduite' in first
        wait_for('Number.isFinite(__attractTiming.cycles[0].progressAt)');cycle=ev('__attractTiming.cycles[0]')
        assert 2<=(cycle['progressAt']-cycle['readyAt'])/1000<2.25,cycle
        assert cycle['progressTime']-cycle['initialTime']>1.5,cycle
        assert ev('localStorage.getItem("rade-solo-v2")===persistBefore');assert ev('RADE.game.audio.stats.voices')==0
        cmd('Input.dispatchKeyEvent',{'type':'keyDown','code':'Space','key':' '});cmd('Input.dispatchKeyEvent',{'type':'keyUp','code':'Space','key':' '});time.sleep(.15)
        returned_title()
        start=time.monotonic()
        while not ev('RADE.game.demo'):
            assert time.monotonic()-start<8;time.sleep(.05)
        wait_demo()
        second=ev('document.getElementById("attract-label").textContent');assert 'Commerce' in second
        time.sleep(7)
        (root/'docs/attract-demo.png').write_bytes(base64.b64decode(cmd('Page.captureScreenshot',{'format':'png'})['data']))
        assert ev('localStorage.getItem("rade-solo-v2")===persistBefore');assert not ev('RADE.game.errors')
        cmd('Input.dispatchMouseEvent',{'type':'mousePressed','x':720,'y':450,'button':'left','clickCount':1});cmd('Input.dispatchMouseEvent',{'type':'mouseReleased','x':720,'y':450,'button':'left','clickCount':1});time.sleep(.15)
        returned_title()
        # The third recording includes an explicit saved fixture, then only genuine fire commands.
        start=time.monotonic()
        while not ev('RADE.game.demo'):
            assert time.monotonic()-start<8;time.sleep(.05)
        wait_demo()
        third=ev('document.getElementById("attract-label").textContent');assert 'Véhicule sous le feu' in third
        start=time.monotonic()
        explosionCheckpoint=ev('RADE.replays.find(t=>t.label.includes("Véhicule sous le feu")).duration-2')
        while ev('RADE.game.session.time')<explosionCheckpoint:
            assert time.monotonic()-start<60;assert ev('RADE.game.demo');assert not ev('RADE.game.errors');time.sleep(.15)
        assert ev('RADE.game.session.car.exploded');assert ev('RADE.game.session.urban.report.vehicleExplosions')==1
        assert ev('localStorage.getItem("rade-solo-v2")===persistBefore');assert ev('RADE.game.audio.stats.voices')==0
        for event in ['keyDown','keyUp']:cmd('Input.dispatchKeyEvent',{'type':event,'code':'Space','key':' '})
        returned_title()
        start=time.monotonic()
        while not ev('RADE.game.demo'):
            assert time.monotonic()-start<8;time.sleep(.05)
        wait_demo()
        fourth=ev('document.getElementById("attract-label").textContent');assert 'Patrouille' in fourth
        start=time.monotonic()
        while not ev('!!RADE.game.session.campaign.law.lastArrest'):
            assert time.monotonic()-start<30;assert ev('RADE.game.demo');time.sleep(.1)
        assert ev('RADE.game.session.interiors.active?.place?.kind')=='police'
        assert ev('localStorage.getItem("rade-solo-v2")===persistBefore');assert ev('RADE.game.audio.stats.voices')==0
        for event in ['keyDown','keyUp']:cmd('Input.dispatchKeyEvent',{'type':event,'code':'Space','key':' '})
        returned_title()
        # Real pointer event enters live play after returning from the demo.
        rect=ev('(()=>{const r=document.getElementById("start").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()')
        ev('(()=>{const b=document.getElementById("start"),start=b.onclick;b.onclick=e=>window.playReady=Promise.resolve(start(e)).then(value=>{const s=RADE.game.session,p=__titleSaveProbe;window.playCheckpoint={exact:JSON.stringify(p.state(s))===JSON.stringify(p.liveAtFactory),state:p.state(s),arguments:p.liveArguments,carExploded:!!s.car.exploded,arrest:!!s.campaign.law.lastArrest,errors:RADE.game.errors.slice(),saved:JSON.parse(localStorage.getItem("rade-solo-v2"))};return value;});return true;})()')
        for event in ['mousePressed','mouseReleased']:cmd('Input.dispatchMouseEvent',{'type':event,**rect,'button':'left','clickCount':1})
        restored=ev('playReady.then(()=>playCheckpoint)')
        expected=ev('__titleSaveProbe.freshExpected');assert {k:restored['state'][k] for k in expected}==expected,restored
        assert restored['arguments']['saved'] is None,restored
        loaded=ev('__titleSaveProbe.loaded');assert loaded['endedAt']<=restored['arguments']['now']<=initial['at'],restored
        assert restored['saved']['cash']==expected['cash'] and restored['saved']['ammunition']['ammo']==expected['inventory']['ammo'],restored
        assert restored['exact'],restored
        assert not restored['carExploded'];assert not restored['arrest'];assert not restored['errors']
        time.sleep(.3);assert ev('RADE.game.running');assert not ev('RADE.game.demo');assert not ev('RADE.game.errors')
        backend=ev('RADE.game.renderer.stats.backend');assert backend==os.environ.get('EMPRISE_RENDERER',backend)
        report={'backend':backend,'delaySeconds':delay,'firstDemoPlayingSeconds':first_play,'pollObservedDelaySeconds':(observed['at']-cycle['titleAt'])/1000,'timingReadRoundTripSeconds':poll_seconds,'pageTiming':ev('__attractTiming'),'timingDefinition':'Page performance.now: title visibility, loading request, ready, first draw submission and 2s simulation checkpoint. CDP observation latency is reported separately; first draw submission does not prove compositor presentation.','recordings':[first,second,third,fourth],'keysAndMouseReturnToTitle':True,'singleResidentSession':True,'initialTitleWithoutWorld':initial,'freshSaveBaseline':expected,'normalizationAfterFirstPlay':True,'liveStateRestoredExactly':True,'saveUnchanged':True,'livePlayAfterDemo':True,'explosionReplayValidated':True,'policeReplayValidated':True,'errors':ev('RADE.game.errors'),'url':a.url or 'file://dist/index.html','buildSha256':hashlib.sha256((root/'dist/index.html').read_bytes()).hexdigest()}
        (root/'docs/attract-validation.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2),flush=True)
    finally:chrome.fermer()
