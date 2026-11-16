#!/usr/bin/env python3
"""Render real Web Audio offline: bounded horns, pan, attenuation and engine mix."""
import json
from browser_support import Browser, ROOT

with Browser() as b:
    b.ev((ROOT/'src/bitume/son.js').read_text())
    result=b.ev(r'''(async()=>{
      const Native=window.OfflineAudioContext;
      async function render({level=1,pan=0,paused=false,repeat=false,engine=null}={}){
        const ctx=new Native(2,44100,44100);ctx.resume=()=>Promise.resolve();
        window.AudioContext=function(){return ctx;};
        const sound=BITUME.son.creer();
        if(engine!==null)sound.regler({moteur:engine});
        sound.demarrer();if(!sound.stats().actif)throw Error('Audio graph did not initialize');
        if(paused)sound.suspendre();
        if(engine!==null)sound.mettreAJour({joueur:{regime:3200,gaz:.6,v:0,glisse:0}});
        else{sound.evenement('klaxon',{level,pan});if(repeat)for(let i=0;i<20;i++)sound.evenement('klaxon',{level,pan});}
        const buffer=await ctx.startRendering();
        const channels=[buffer.getChannelData(0),buffer.getChannelData(1)];
        const rms=(a,start,end)=>{let total=0;for(let i=Math.floor(start*44100);i<Math.floor(end*44100);i++)total+=a[i]*a[i];return Math.sqrt(total/((end-start)*44100));};
        return {rms:channels.map(a=>rms(a,.03,engine!==null?.9:.17)),tail:channels.map(a=>rms(a,.4,.9)),peak:Math.max(...channels.map(a=>a.reduce((m,v)=>Math.max(m,Math.abs(v)),0)))};
      }
      const near=await render(),far=await render({level:.25}),right=await render({pan:.85}),muted=await render({level:0}),paused=await render({paused:true}),flood=await render({repeat:true}),oldEngine=await render({engine:1}),quietEngine=await render({engine:.3});
      return {near,far,right,muted,paused,flood,oldEngine,quietEngine};
    })()''')

near=result['near']['rms'][0]
assert near>0.005,result
assert result['near']['peak']<0.15,result
assert max(result['near']['tail'])<1e-7,result
assert 0.24<result['far']['rms'][0]/near<0.26,result
assert result['right']['rms'][1]>result['right']['rms'][0]*3,result
assert result['muted']['peak']==0 and result['paused']['peak']==0,result
assert abs(result['flood']['rms'][0]/near-1)<1e-6,result
assert 0.27<result['quietEngine']['rms'][0]/result['oldEngine']['rms'][0]<0.33,result
report={'status':'passed','protocol':'Chrome OfflineAudioContext, real procedural graph; no physical listening test','measurements':result}
(ROOT/'docs/safari-065/traffic-horn-audio.json').write_text(json.dumps(report,indent=2)+'\n')
print('PASS procedural horn: finite tail, distance, stereo pan, pause/mute, flood limiter; engines at 30% gain')
