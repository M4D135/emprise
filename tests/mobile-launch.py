#!/usr/bin/env python3
"""Production launch cycle with CDP touch; Chromium emulation, not physical iOS."""
import argparse
import base64
import hashlib
import json
import time
from pathlib import Path
from browser_support import Browser, ROOT

UA = ('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) '
      'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')
TITLE_PROBE = (ROOT/'tests/title-save-probe.js').read_text()
PROBE = r'''(()=>{
 const clone=v=>JSON.parse(JSON.stringify(v));
 const p=window.__mobileLaunch={id:Date.now()+':'+Math.random(),titles:[],demos:[],errors:[]};
 p.state=()=>{return __titleSaveProbe.state(globalThis.RADE?.game?.session);};
 addEventListener('error',e=>p.errors.push(e.message));
 addEventListener('unhandledrejection',e=>p.errors.push(String(e.reason?.message||e.reason)));
 const hidden=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'hidden');
 Object.defineProperty(HTMLElement.prototype,'hidden',{...hidden,set(value){
  const changed=['title','loading','attract'].includes(this.id)&&hidden.get.call(this)!==value;
  hidden.set.call(this,value);if(!changed)return;
  const g=globalThis.RADE?.game,at=performance.now();
  if(this.id==='title'&&!value){p.titles.push(at);if(!p.initial){p.initial=clone(__titleSaveProbe.initial);p.persisted=p.initial.persisted;}}
  if(this.id==='loading'&&!value&&g?.transition==='demo')p.demos.push({loadingAt:at,titleAt:p.titles.at(-1)});
  if(this.id==='attract'&&!value&&g?.demo)p.demos.at(-1).readyAt=at;
 }});
 addEventListener('DOMContentLoaded',()=>{
  const button=document.getElementById('start'),start=button.onclick;
  button.onclick=function(event){const result=start.call(this,event);p.startAt=performance.now();return Promise.resolve(result).then(value=>{p.restored=p.state();p.playAt=performance.now();return value;});};
 });
})();'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--html', type=Path, default=ROOT/'dist/index.html')
    parser.add_argument('--report', type=Path, default=ROOT/'docs/safari-065/mobile-launch.json')
    args = parser.parse_args()
    args.report.parent.mkdir(parents=True, exist_ok=True)
    report = {
        'status': 'running', 'html': str(args.html.resolve()),
        'htmlSha256': hashlib.sha256(args.html.read_bytes()).hexdigest(),
        'protocol': {'viewport': [430, 932], 'deviceScaleFactor': 3, 'touchPoints': 5,
                     'requestedBackend': 'auto', 'userAgent': UA, 'emulatedIOSVersion': '18.0',
                     'freshProfile': True, 'testMode': False, 'controllerOverride': False,
                     'qualityOverrides': False},
        'limitations': [
            'Chromium on this Mac with an iPhone Safari user-agent and mobile viewport; not Safari/WebKit or a physical iPhone 15 Pro Max.',
            'The iOS 18.0 user-agent is an explicit representative fixture, not the version installed on the reported device.',
            'CDP heap/DOM samples exclude GPU/driver memory, process RSS and iOS memory limits; no forced garbage collection.',
            'The ordinary renderer may cap its internal pixel ratio below emulated DPR 3; actual dimensions are reported without a test quality override.',
            'This short launch/input regression does not establish sustained physical-device performance or exclude an iOS memory termination.'
        ],
        'checks': [], 'memory': [], 'quality': [], 'screenshots': []}
    try:
        with Browser() as b:
            def ev(source):
                # Observation must not manufacture a user activation for audio.
                data = b.cmd('Runtime.evaluate', {'expression': source, 'returnByValue': True,
                                                  'awaitPromise': True, 'userGesture': False})
                assert not data.get('exceptionDetails'), data.get('exceptionDetails')
                return data.get('result', {}).get('value')

            def wait(source, seconds=45):
                deadline = time.monotonic()+seconds
                while not ev(source):
                    error = ev('({errors:globalThis.__mobileLaunch?.errors||[],game:globalThis.RADE?.game?.errors||[],fatal:document.getElementById("recovery")?.hidden===false})')
                    assert not error['errors'] and not error['game'] and not error['fatal'], error
                    assert time.monotonic() < deadline, 'Timeout: '+source
                    time.sleep(.05)

            def center(selector):
                return ev('(()=>{const e=document.querySelector('+json.dumps(selector)+');'
                          'const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()')

            def touch(kind, points=None):
                b.cmd('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': points or []})

            def tap(selector):
                touch('touchStart', [{**center(selector), 'id': 1}]);time.sleep(.07);touch('touchEnd')

            def screenshot(label):
                path=args.report.with_name(args.report.stem+'-'+label+'.png')
                path.write_bytes(base64.b64decode(b.cmd('Page.captureScreenshot', {'format': 'png'})['data']))
                report['screenshots'].append(str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path))

            def checkpoint(label):
                assert ev('__mobileLaunch.id') == report['documentId'], 'Unexpected document reload'
                report['memory'].append({'phase': label, 'heap': b.cmd('Runtime.getHeapUsage'),
                                         'dom': b.cmd('Memory.getDOMCounters')})
                report['quality'].append({'phase': label, **ev('({graphics:RADE.game.graphics,renderer:RADE.game.renderer?.stats,css:[innerWidth,innerHeight],dpr:devicePixelRatio,canvas:[document.getElementById("scene").width,document.getElementById("scene").height]})')})

            def input_state():
                return ev('(()=>{const g=RADE.game,s=g.session;return {running:g.running,mode:s.mode,time:s.time,x:s.player.x,z:s.player.z,shots:s.sim.state.shots,ammo:s.sim.state.inventory.ammo,pointers:g.mobile.count,command:g.lastCommand,errors:g.errors};})()')

            report['browser'] = b.cmd('Browser.getVersion')
            b.cmd('Emulation.setUserAgentOverride', {'userAgent': UA, 'platform': 'iPhone', 'acceptLanguage': 'fr-FR'})
            b.cmd('Emulation.setDeviceMetricsOverride', {'width': 430, 'height': 932, 'deviceScaleFactor': 3, 'mobile': True})
            b.cmd('Emulation.setTouchEmulationEnabled', {'enabled': True, 'maxTouchPoints': 5})
            b.cmd('Page.addScriptToEvaluateOnNewDocument', {'source': TITLE_PROBE+PROBE})
            b.cmd('Page.navigate', {'url': args.html.resolve().as_uri()+'?renderer=auto'})
            b.cmd('Page.bringToFront')
            wait('globalThis.__mobileLaunch?.initial&&globalThis.RADE?.game?.ready', 120)
            report['documentId'] = ev('__mobileLaunch.id')
            report['build'] = ev('RADE.build')
            report['versionLabel'] = ev('document.querySelector(".game-version").textContent')
            initial=ev('__titleSaveProbe.initial')
            assert initial['ready'] and initial['sessionNull'] and initial['rendererNull'] and initial['crowdNull'],initial
            assert initial['created']==0 and initial['drawCount']==0,initial
            assert initial['persisted'] is None,'Fresh-profile baseline must have no save'
            report['initialTitle']=initial
            assert ev('document.body.classList.contains("touch")&&matchMedia("(pointer:coarse)").matches')
            report['checks'].append('Production title is usable with zero sessions, crowds, renderers and draws; touch UI at 430×932, DPR 3')
            checkpoint('initial-title');screenshot('title')

            wait('RADE.game.demo&&RADE.game.ready&&!RADE.game.transition&&RADE.game.running', 60)
            wait('RADE.game.session.time>.3')
            assert ev('RADE.game.renderer.stats.backend') == 'webgl2'
            assert ev('RADE.game.renderer.stats.requestedBackend') == 'auto'
            cycle = ev('__mobileLaunch.demos[0]')
            delay=(cycle['loadingAt']-cycle['titleAt'])/1000
            assert 4.7 <= delay <= 6.5, cycle
            assert ev('localStorage.getItem("rade-solo-v2")===__mobileLaunch.persisted')
            report['demo'] = {'timing': cycle, 'loadingDelaySeconds': delay, 'label': ev('document.getElementById("attract-label").textContent')}
            checkpoint('automatic-demo')
            touch('touchStart', [{'x': 215, 'y': 410, 'id': 1}]);time.sleep(.07);touch('touchEnd')
            wait('RADE.game.ready&&!RADE.game.transition&&!RADE.game.demo&&!document.getElementById("title").hidden')
            assert ev('RADE.game.session===null&&RADE.game.crowdView===null&&(!RADE.game.renderer||RADE.game.renderer.stats.staticTotal===0)')
            report['emptyTitle'] = ev('({sessionReleased:RADE.game.session===null,crowdReleased:RADE.game.crowdView===null,rendererReleased:RADE.game.renderer===null,staticTotal:RADE.game.renderer?.stats.staticTotal??null})')
            assert ev('localStorage.getItem("rade-solo-v2")===__mobileLaunch.persisted')
            checkpoint('returned-empty-title')
            report['checks'].append('Automatic demo begins after five seconds; a real touch returns to a title without a resident session or retained world, preserving storage')

            tap('#start')
            wait('__mobileLaunch.restored&&RADE.game.ready&&!RADE.game.transition&&RADE.game.running&&!RADE.game.demo', 120)
            assert ev('JSON.stringify(__titleSaveProbe.liveAtFactory)===JSON.stringify(__mobileLaunch.restored)'), ev('({factory:__titleSaveProbe.liveAtFactory,restored:__mobileLaunch.restored})')
            expected=ev('__titleSaveProbe.freshExpected');restored=ev('__mobileLaunch.restored')
            assert {k:restored[k] for k in expected}==expected,restored
            arguments=ev('__titleSaveProbe.liveArguments');loaded=ev('__titleSaveProbe.loaded')
            assert arguments['saved'] is None and loaded['endedAt']<=arguments['now']<=initial['at'],arguments
            saved=ev('JSON.parse(localStorage.getItem("rade-solo-v2"))')
            assert saved['cash']==expected['cash'] and saved['ammunition']['ammo']==expected['inventory']['ammo'],saved
            report['restoration'] = ev('({factory:__titleSaveProbe.liveAtFactory,restored:__mobileLaunch.restored,startAt:__mobileLaunch.startAt,playAt:__mobileLaunch.playAt})')
            report['freshSaveBaseline']=expected
            wait('!document.getElementById("touch").hidden&&RADE.game.session.time>.05')
            checkpoint('live-play');screenshot('live')
            quality=report['quality'][-1]
            assert quality['graphics']['shadows'] and quality['graphics']['reflections']
            assert quality['renderer']['shadows'] and quality['renderer']['bloom'] and quality['renderer']['reflections']
            assert quality['renderer']['msaa'] == 4 and quality['renderer']['renderScale'] == 1, quality
            report['checks'].append('Touching Jouer loads the explicit fresh-save baseline, preserves all factory-normalized state before the first play tick, and writes its first real save; normal effects and MSAA remain enabled')

            before=input_state();move={**center('#touch-stick'), 'id': 11};fire={**center('#touch-fire'), 'id': 12}
            touch('touchStart', [move, fire])
            touch('touchMove', [{**move, 'y': move['y']-62}, fire])
            wait('RADE.game.mobile.count===2&&RADE.game.session.sim.state.shots>'+str(before['shots'])+'&&Math.hypot(RADE.game.session.player.x-('+str(before['x'])+'),RADE.game.session.player.z-('+str(before['z'])+'))>.12', 4)
            during=input_state();touch('touchEnd')
            wait('RADE.game.mobile.count===0&&!RADE.game.lastCommand.fire&&Math.abs(RADE.game.lastCommand.moveY||0)<.001')
            time.sleep(.25);released=input_state();time.sleep(.35);settled=input_state()
            assert settled['shots'] == released['shots'] and settled['pointers'] == 0, settled
            assert settled['running'] and settled['time'] > released['time']+.1, settled
            report['input']={'before': before, 'twoFingers': during, 'released': released, 'settled': settled}
            report['checks'].append('Two real CDP fingers move and fire concurrently; releasing both stops fire/movement ownership while simulation continues')

            tap('#pause');wait('!RADE.game.running&&!document.getElementById("paused").hidden')
            saved=ev('(()=>{const s=RADE.game.session,v=JSON.parse(localStorage.getItem("rade-solo-v2"));return {valid:v?.version===2,cashExact:v?.cash===s.campaign.state.cash,ammoExact:JSON.stringify(v?.ammunition.ammo)===JSON.stringify(s.sim.state.inventory.ammo),playerExact:v?.player.x===s.player.x&&v?.player.z===s.player.z,bytes:localStorage.getItem("rade-solo-v2").length};})()')
            assert saved['valid'] and saved['cashExact'] and saved['ammoExact'] and saved['playerExact'], saved
            report['savedAfterPause']=saved
            tap('#resume');wait('RADE.game.running&&RADE.game.ready')
            checkpoint('resumed-after-input');screenshot('resumed')
            report['checks'].append('Touch pause saves the current money, ammunition and position; touch resume remains playable')
            report['errors']=ev('({page:__mobileLaunch.errors,game:RADE.game.errors,backendEvents:RADE.game.backendEvents})')
            assert not report['errors']['page'] and not report['errors']['game'] and not report['errors']['backendEvents'], report['errors']
            report['status']='passed'
    except Exception as error:
        report['status']='failed';report['failure']=str(error)
        raise
    finally:
        args.report.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
        print(json.dumps({'status':report['status'],'report':str(args.report),'checks':len(report['checks'])}),flush=True)


if __name__ == '__main__':
    main()
