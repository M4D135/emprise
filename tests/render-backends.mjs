import '../src/ferro/backends.js';
import assert from 'node:assert/strict';
const factory=FRenderBackends.create;
const canvas={id:'original'},fresh={id:'replacement'};
let disposed=0,replacements=0,calls=0;
const gl=c=>({gl:{},canvas:c,stats:{backend:'webgl2'},dispose(){disposed++;}});
const native=()=>({gpu:{},stats:{backend:'webgpu'},dispose(){disposed++;}});
const replace=c=>{assert.equal(c,canvas);replacements++;return fresh;};
const nextTask=()=>new Promise(resolve=>setImmediate(resolve));
let r=await factory(canvas,{}, {supported:false,webgl2:gl,replaceCanvas:replace});assert.equal(r.canvas,canvas);assert.equal(r.backend,'webgl2');assert(r.fallbackReason);assert.equal(replacements,0);assert.equal(r.activate(),undefined);
r=await factory(canvas,{backend:'webgl2'},{supported:true,webgl2:gl,webgpu:()=>{throw Error('Must not request GPU');},replaceCanvas:replace});assert.equal(r.fallbackReason,null);
r=await factory(canvas,{backend:'webgpu'},{supported:true,webgl2:gl,webgpu:async()=>{throw Error('Adapter refused');},replaceCanvas:replace});assert.equal(r.canvas,fresh);assert.equal(r.renderer.canvas,fresh);assert.match(r.fallbackReason,/Adapter refused/);assert.equal(replacements,1);

// Loss between create() and scene installation is buffered until ownership is
// transferred. Activation returns the recovery promise and cannot duplicate it.
let lost,error;const events=[],recovered=Promise.resolve('recovered');
r=await factory(canvas,{onDeviceLost:info=>{events.push(['lost',info]);return recovered;},onError:info=>events.push(['error',info])},{supported:true,webgl2:gl,webgpu:async(c,o)=>{lost=o.onDeviceLost;error=o.onError;return native();}});
assert.equal(r.backend,'webgpu');lost({reason:'unknown'});error(Error('secondary error'));assert.equal(events.length,0);assert.equal(r.activate(),recovered);assert.equal(await r.activate(),'recovered');assert.equal(events.length,1);assert.equal(events[0][0],'lost');lost({reason:'duplicate'});assert.equal(events.length,1);

// Errors are also buffered and runtime errors use the same one-shot delivery.
for(const beforeActivation of [true,false]){
 const events=[];let report;
 r=await factory(canvas,{onError:info=>events.push(info)},{supported:true,webgl2:gl,webgpu:async(c,o)=>{report=o.onError;return native();}});
 if(!beforeActivation)r.activate();report(Error('Invalid bind group'));
 assert.equal(events.length,beforeActivation?0:1);r.activate();report(Error('duplicate'));assert.equal(events.length,1);assert.match(events[0].message,/bind group/);
}

// Incidents known before creation completes go directly to GL, without asking
// the not-yet-installed game to recover and without leaving native resources.
for(const kind of ['onDeviceLost','onError']){
 const before=disposed;
 r=await factory(canvas,{onDeviceLost:()=>calls++,onError:()=>calls++},{supported:true,webgl2:gl,replaceCanvas:replace,webgpu:async(c,o)=>{o[kind](kind==='onError'?Error('Pipeline invalid'):{reason:'unknown'});return native();}});
 assert.equal(r.backend,'webgl2');assert.equal(calls,0);assert.equal(disposed,before+1);assert.equal(r.activate(),undefined);
 if(kind==='onError')assert.match(r.fallbackReason,/Pipeline invalid/);
}

let finish,lateLost;const beforeTimeout=disposed;
r=await factory(canvas,{initTimeoutMs:5,onDeviceLost:()=>calls++},{supported:true,webgl2:gl,replaceCanvas:replace,webgpu:(c,o)=>{lateLost=o.onDeviceLost;return new Promise(resolve=>finish=resolve);}});assert.equal(r.backend,'webgl2');finish(native());await nextTask();lateLost({reason:'unknown'});assert.equal(calls,0);assert.equal(disposed,beforeTimeout+1,'A late GPU must release its resources without replacing GL');

// Cleanup failure must not turn a successful fallback into an unhandled
// rejection, including a renderer arriving after the initialization timeout.
const unhandled=[];const onUnhandled=e=>unhandled.push(e);process.on('unhandledRejection',onUnhandled);
r=await factory(canvas,{initTimeoutMs:5},{supported:true,webgl2:gl,replaceCanvas:replace,webgpu:()=>new Promise(resolve=>finish=resolve)});finish({stats:{backend:'webgpu'},dispose(){throw Error('Cleanup failed');}});await nextTask();await nextTask();process.off('unhandledRejection',onUnhandled);assert.equal(r.backend,'webgl2');assert.deepEqual(unhandled,[]);
await assert.rejects(factory(canvas,{backend:'webgl2'},{webgl2:()=>({stats:{backend:'canvas2d'},dispose(){}})}),/WebGPU ou WebGL2/);
assert.equal(FRenderBackends.preference('invalid'),'auto');
console.log('PASS: native selection, explicit GL, initialization failures, activation handoff, one-shot recovery and late cleanup.');
