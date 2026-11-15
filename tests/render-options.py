#!/usr/bin/env python3
"""Native in-game options, resize and bounded-resource regression test.

The real game prepares all meshes and crowd state. Only the public quality/size
controls and fx options passed to renderer.draw are changed by this fixture.
Pause freezes gameplay; no fake GPU device or replacement rendering is involved.
"""
from browser_support import Browser, ROOT
import hashlib
import json

fixture = r'''
(async()=>{
 const g=RADE.game,r=g.renderer,device=r.gpu?.device;
 const check=(ok,message)=>{if(!ok)throw Error(message);};
 check(r.stats.backend==='webgpu'&&device,'Native WebGPU required');
 g.start();g.pause();g.audio.setMix({master:0});g.engineSound.suspendre();
 for(const id of ['hud','title','paused','attract','touch','loading'])document.getElementById(id).hidden=true;
 const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
 const stream=g.session.world.cityStream;
 if(stream){stream.tick(g.session.player.x,g.session.player.z);let limit=performance.now()+90000;while(stream.pending){check(performance.now()<limit,'City stream did not settle');await frame();}}
 let overrides={},packet=null;
 const draw=r.draw.bind(r);
 r.draw=function(camera,models,fx){const applied={...fx,...overrides};packet={camera,models,fx:applied};return draw(camera,models,applied);};
 const errors=[],allocations={pipelines:0,buffers:0,textures:0,bindGroups:0},live={buffers:new Set(),textures:new Set()};
 device.addEventListener('uncapturederror',event=>errors.push(event.error?.message||String(event.error)));
 for(const [method,key] of [['createRenderPipeline','pipelines'],['createBuffer','buffers'],['createTexture','textures'],['createBindGroup','bindGroups']]){
  const original=device[method].bind(device);
  device[method]=function(...args){const value=original(...args);allocations[key]++;if(live[key]){live[key].add(value);const destroy=value.destroy.bind(value);value.destroy=function(){live[key].delete(value);return destroy();};}return value;};
 }
 let crowdColor=0,crowdShadow=0;
 const crowd=g.crowdView;
 check(typeof crowd.fx.gpuColor==='function','Native crowd hook missing');
 for(const [name,increment] of [['gpuColor',()=>crowdColor++],['gpuShadow',()=>crowdShadow++]]){const original=crowd.fx[name].bind(crowd.fx);crowd.fx[name]=function(...args){increment();return original(...args);};}
 async function settle(){for(let i=0;i<8;i++)await frame();await device.queue.onSubmittedWorkDone();for(let i=0;i<2;i++)await frame();check(g.renderer===r&&!g.recoveringRenderer,'Unexpected renderer replacement/recovery');check(r.stats.backend==='webgpu'&&!r.stats.contextLost&&!r.stats.deviceLost,'WebGPU lost');check(!g.errors.length&&!r.stats.errorEvents.length&&!errors.length,JSON.stringify([...g.errors,...r.stats.errorEvents,...errors]));check(!g.backendEvents.length,'Unexpected backend fallback');}
 async function apply(config){overrides={...config.fx};r.resize(config.quality);const before={color:crowdColor,shadow:crowdShadow};await settle();
  const stats={...r.stats};check(stats.msaa===config.expected.msaa,'Incorrect MSAA '+JSON.stringify(stats));for(const key of ['bloom','shadows','reflections'])check(stats[key]===config.expected[key],'Incorrect '+key+' state');
  check(stats.width===config.expected.width&&stats.height===config.expected.height,'Incorrect render dimensions');check(packet.fx.foule===crowd.fx,'Real game crowd was not submitted');check(crowd.mesure.n>0&&crowd.mesure.proches>0,'No detailed crowd rendered');check(crowdColor>before.color,'Crowd color pass not executed');check(config.expected.shadows?crowdShadow>before.shadow:crowdShadow===before.shadow,'Crowd shadow pass does not follow options');
  return {name:config.name,quality:config.quality,fx:{...overrides},resolution:[stats.width,stats.height],msaa:stats.msaa,bloom:stats.bloom,shadows:stats.shadows,reflections:stats.reflections,drawCalls:stats.drawCalls,triangles:stats.triangles,crowd:{...crowd.mesure},worldRevision:stats.worldRevision,staticTotal:stats.staticTotal,resources:{buffers:stats.gpuBuffers,textures:stats.gpuTextures,pipelines:stats.pipelineCount,uniformSlots:stats.uniformSlots,trackedLiveBuffers:live.buffers.size,trackedLiveTextures:live.textures.size},allocations:{...allocations},hooks:{color:crowdColor-before.color,shadow:crowdShadow-before.shadow},errors:[...errors]};
 }
 await settle();
 globalThis.renderOptionsTest={apply,get packet(){return packet;},status(){return {backend:r.stats.backend,errors:[...errors,...r.stats.errorEvents,...g.errors],backendEvents:g.backendEvents,adapter:{vendor:r.gpu.adapter.info?.vendor,architecture:r.gpu.adapter.info?.architecture},simulationTime:g.session.time,drawCount:g.drawCount};}};
 return renderOptionsTest.status();
})();
'''


def config(name, quality='high', viewport=(1440, 900), **fx):
    options = dict(msaa=True, bloom=True, shadows=True, reflections=True)
    options.update(fx)
    bloom = quality != 'low' and options['bloom']
    return dict(name=name, quality=quality, viewport=list(viewport), fx=options,
                expected=dict(msaa=4 if quality != 'low' and options['msaa'] and options['bloom'] else 1,
                              width=round(viewport[0] * (.8 if quality == 'low' else 1)),
                              height=round(viewport[1] * (.8 if quality == 'low' else 1)),
                              bloom=bloom, shadows=quality != 'low' and options['shadows'],
                              reflections=bloom and options['reflections']))


cases = [config('high-full'), config('high-msaa-off', msaa=False),
         config('high-reflections-off', reflections=False), config('high-bloom-off', bloom=False),
         config('high-shadows-off', shadows=False), config('low', quality='low'),
         config('wide-resize', viewport=(960, 540)), config('portrait-resize', viewport=(900, 1100)),
         config('high-restored')]
report = {'backendRequested': 'webgpu',
          'buildSha256': hashlib.sha256((ROOT / 'dist/index.html').read_bytes()).hexdigest(),
          'fixtureSha256': hashlib.sha256(fixture.encode()).hexdigest(),
          'scope': 'Real paused gameplay, procedural crowd, native GPU; fx options/public quality/viewport only.',
          'cycles': []}

with Browser() as browser:
    browser.load('?test=1&renderer=webgpu')
    report['initial'] = browser.ev(fixture)
    references = {}
    for cycle in range(3):
        entries = []
        for case in cases:
            width, height = case['viewport']
            browser.cmd('Emulation.setDeviceMetricsOverride', dict(width=width, height=height, deviceScaleFactor=1, mobile=False))
            result = browser.ev('renderOptionsTest.apply(' + json.dumps(case) + ')')
            entries.append(result)
            print(json.dumps({'cycle': cycle, 'case': case['name'], 'msaa': result['msaa'], 'resources': result['resources']}), flush=True)
            if cycle == 1:
                references[case['name']] = result
            elif cycle == 2:
                reference = references[case['name']]
                assert result['resources'] == reference['resources'], ('Unbounded retained resources', reference, result)
                for key in ('buffers', 'pipelines'):
                    assert result['allocations'][key] == reference['allocations'][key], ('Unexpected allocation after warmup', key, reference, result)
                assert result['staticTotal'] == reference['staticTotal'], ('Scene changed', reference, result)
        report['cycles'].append(entries)
        if cycle == 0:
            browser.capture('render-options-before.png')
    browser.capture('render-options-after.png')
    report['final'] = browser.ev('renderOptionsTest.status()')
    assert report['initial']['simulationTime'] == report['final']['simulationTime'], 'Paused simulation advanced'
    assert report['initial']['backend'] == report['final']['backend'] == 'webgpu'
    assert not report['final']['errors'] and not report['final']['backendEvents']
    report['sameRestoredImage'] = (ROOT / 'docs/render-options-before.png').read_bytes() == (ROOT / 'docs/render-options-after.png').read_bytes()
    report['checks'] = ['Real native crowd receives color and shadow passes', 'MSAA4 to MSAA1 and back',
                        'SSR, bloom and shadow toggles', 'Low/high quality and wide/portrait resize',
                        'Stable retained resource counts and no new pipelines/buffers after warmup',
                        'No GPU error, device loss or WebGL2 fallback', 'Gameplay stays paused']
    (ROOT / 'docs/render-options.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print('PASS native rendering options and bounded resources', flush=True)
