import '../src/ferro/backends.js';
import assert from 'node:assert/strict';

// A loss or validation error can settle in any microtask between native
// creation and the caller's await. Installation must own the renderer first.
for (const kind of ['onDeviceLost', 'onError']) {
  for (let delay = 0; delay < 12; delay++) {
    let handedOff = false;
    let deliveredBeforeHandoff = false;
    let events = 0;
    const result = await FRenderBackends.create({}, {
      [kind]() {
        events++;
        deliveredBeforeHandoff ||= !handedOff;
      }
    }, {
      supported: true,
      replaceCanvas: canvas => canvas,
      webgl2: () => ({ gl: {}, stats: { backend: 'webgl2' } }),
      webgpu: async (canvas, options) => {
        const report = n => n
          ? queueMicrotask(() => report(n - 1))
          : options[kind](kind === 'onError' ? Error('Validation failure') : { reason: 'unknown' });
        queueMicrotask(() => report(delay));
        return { stats: { backend: 'webgpu' }, dispose() {} };
      }
    });
    // Installation may itself yield; events are still buffered until activate.
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(events, 0, 'No callback before explicit activation');
    handedOff = true;
    await result.activate();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(deliveredBeforeHandoff, false,
      `${kind} at microtask ${delay} was delivered before ownership transfer`);
    assert.equal(events, result.backend === 'webgpu' ? 1 : 0,
      'Native incident is delivered once; initialization failure uses fallback');
  }
}
console.log('PASS: loss/error handoff at 24 microtask timings, including asynchronous scene installation.');
