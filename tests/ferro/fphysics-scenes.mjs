// FPhysics test helpers: loaders, deterministic inputs and scenes (lot 17, module side; not bundled in the game).
// Box scenes of the prototype (docs/chantier-moteur/bancs/phys/scenes.mjs, same draws in the same order): stack10 and
// pyramid55 (module step 2a), rubble300 and blast200 (step 2b); mix comes with step 10 of the module brief.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const SOURCE = new URL('../../src/ferro/physics.js', import.meta.url);
let text = null;

// Text of src/physics.js, read once.
export function source() {
  if (text === null) text = readFileSync(SOURCE, 'utf8');
  return text;
}

// Main realm, like a classic script in the page: `window` is a fresh object that receives FPhysics.
export function load() {
  const w = {};
  new Function('window', source())(w);
  return w.FPhysics;
}

// Separate vm realm (diagnostic only: 4.5 to 9 times slower, never used for timings).
export function loadVm() {
  const ctx = {window: {}};
  vm.runInNewContext(source(), ctx, {filename: 'physics.js'});
  return ctx.window.FPhysics;
}

// Integer LCG of docs/chantier-moteur/bancs/phys/scenes.mjs: same sequence for the same seed.
export function lcg(seed) {
  let n = seed >>> 0 || 1;
  return () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; };
}

export const B64 = Object.freeze({minX: -64, maxX: 64, minZ: -64, maxZ: 64});
export const NOSLEEP = Object.freeze({sleepTime: 1e9, fallbackTime: 1e9});

// Crate of the brief (§7): box of 0.8 m, mass 30, friction 0.6, restitution 0.1.
export function crate(w, x, y, z) {
  return w.addBody({size: [0.8, 0.8, 0.8], pos: [x, y, z], mass: 30, friction: 0.6, restitution: 0.1});
}

// Static boxes of the prototype: addStatic(x0, y0, z0, x1, y1, z1) becomes {minX: x0, ..., maxZ: z1}.
const box = (minX, minY, minZ, maxX, maxY, maxZ) => Object.freeze({minX, maxX, minY, maxY, minZ, maxZ});
// walls() of the prototype: three walls and a low kerb around a 7 x 7 m yard, and a block in its middle.
export const YARD = Object.freeze([box(-4, 0, -4, -3.5, 4, 4), box(3.5, 0, -4, 4, 4, 4), box(-4, 0, -4, 4, 4, -3.5),
  box(-4, 0, 3.5, 4, 0.5, 4), box(-1, 0, -1, 1, 0.6, 1)]);
// The four 30 m walls of blast200 (inner faces at |x| = 12.5 and |z| = 12.5).
export const WALLS30 = Object.freeze([box(-13, 0, -13, -12.5, 30, 13), box(12.5, 0, -13, 13, 30, 13),
  box(-13, 0, -13, 13, 30, -12.5), box(-13, 0, 12.5, 13, 30, 13)]);
export function yard(w) { return w.setStatics(YARD, []); }

// Scenes (brief §8.1): (F, opts) -> {w, ids, ideal?, tick?, statics?}. tick(i, world = w), when present, runs before
// sub-step i (the world argument lets P45 replay the same calls on a restored twin); statics = the boxes given to
// setStatics, for twin().
export const SCENES = Object.freeze({
  // 10 crates in a column on the ground slab (prototype stack).
  stack10(F, opts = {}) {
    const w = F.create({bounds: B64, ground: 0, capacity: 64, ...opts}), ids = [], ideal = [];
    for (let i = 0; i < 10; i++) { const p = [0, 0.4 + 0.8 * i, 0]; ids.push(crate(w, ...p)); ideal.push(p); }
    return {w, ids, ideal};
  },
  // 55 crates in rows of 10 down to 1 (prototype pyramid): x = (k - (10 - row - 1)/2)*0.82.
  pyramid55(F, opts = {}) {
    const w = F.create({bounds: B64, ground: 0, capacity: 128, ...opts}), ids = [], ideal = [];
    for (let row = 0; row < 10; row++) for (let k = 0; k < 10 - row; k++) {
      const p = [(k - (10 - row - 1) / 2) * 0.82, 0.4 + row * 0.8, 0];
      ids.push(crate(w, ...p)); ideal.push(p);
    }
    return {w, ids, ideal};
  },
  // 300 pieces of rubble in 9 layers of 6 x 6 over the yard, lcg(20261112): slab = r < 0.3, then hx, hy, hz, the
  // jitter of x and z, then the 4 quaternion components (prototype order); mass = max(0.5, min(160, density x volume)),
  // material i % 5 (friction and restitution of MATERIALS).
  rubble300(F, opts = {}) {
    const w = F.create({bounds: B64, ground: 0, capacity: 512, ...opts}), ids = [], r = lcg(20261112);
    yard(w);
    for (let i = 0; i < 300; i++) {
      const d = F.MATERIALS[i % 5].density, slab = r() < 0.3, hx = 0.06 + r() * (slab ? 0.5 : 0.25), hy = slab ? 0.04 + r() * 0.06 : 0.06 + r() * 0.25, hz = 0.06 + r() * (slab ? 0.4 : 0.25);
      const col = i % 36, layer = (i / 36) | 0, x = -2.6 + (col % 6) * 1.04 + (r() - 0.5) * 0.1, z = -2.6 + ((col / 6) | 0) * 1.04 + (r() - 0.5) * 0.1, y = 1.2 + layer * 1.1;
      let qx = r() - 0.5, qy = r() - 0.5, qz = r() - 0.5, qw = r() - 0.5;
      const l = Math.sqrt(qx * qx + qy * qy + qz * qz + qw * qw) || 1; qx /= l; qy /= l; qz /= l; qw /= l;
      const mass = Math.max(0.5, Math.min(160, 8 * hx * hy * hz * d));
      ids.push(w.addBody({size: [2 * hx, 2 * hy, 2 * hz], pos: [x, y, z], quat: [qx, qy, qz, qw], mass, material: i % 5}));
    }
    return {w, ids, statics: YARD};
  },
  // 200 objects on a 10 x 10 grid inside four 30 m walls, lcg(77): a barrel (0.6 x 0.9 x 0.6, 25 kg) where
  // (gx + gz) % 3 === 0, otherwise a pile of 3 cubes (r() drawn for their size only there); blast at sub-step blastAt.
  blast200(F, opts = {}) {
    const w = F.create({bounds: B64, ground: 0, capacity: 256, ...opts}), ids = [], r = lcg(77), blastAt = opts.blastAt ?? 240;
    w.setStatics(WALLS30, []);
    let placed = 0;
    for (let gz = 0; gz < 10 && placed < 200; gz++) for (let gx = 0; gx < 10 && placed < 200; gx++) {
      const x = -10.8 + gx * 2.4 + (r() - 0.5) * 0.3, z = -10.8 + gz * 2.4 + (r() - 0.5) * 0.3, barrel = (gx + gz) % 3 === 0;
      const hx = barrel ? 0.3 : 0.3 + r() * 0.2, hy = barrel ? 0.45 : hx, hz = hx, pile = barrel ? 1 : 3;
      for (let k = 0; k < pile && placed < 200; k++) {
        ids.push(w.addBody({size: [2 * hx, 2 * hy, 2 * hz], pos: [x, hy + k * 2 * hy + 0.001 * k, z], mass: barrel ? 25 : Math.max(4, 8 * hx * hy * hz * 60),
          friction: barrel ? 0.45 : 0.6, restitution: barrel ? 0.24 : 0.2}));
        placed++;
      }
    }
    return {w, ids, statics: WALLS30, tick(i, world = w) { if (i === blastAt) world.blast(0, 0.5, 0, 14, 900); }};
  },
});

// Empty twin of a scene world (P45): same create options, same statics, no body.
export function twin(F, scene) {
  const w = F.create(scene.w.config);
  if (scene.statics) w.setStatics(scene.statics, []);
  return w;
}

// Chain 'cccccccc/hhhhhhhh' (brief §8.1): FNV-1a over the characters of w.hash() every 50 sub-steps, then the last hash.
export function runChain(F, name, steps, opts) {
  const {w, tick} = SCENES[name](F, opts);
  let c = 2166136261;
  for (let i = 0; i < steps; i++) {
    if (tick) tick(i);
    w.step(1 / 120);
    if (i % 50 === 49) for (const ch of w.hash()) c = Math.imul(c ^ ch.charCodeAt(0), 16777619);
  }
  return (c >>> 0).toString(16).padStart(8, '0') + '/' + w.hash();
}

// Scenes of hashes() and P41 (mix comes with module step 10); their chains blast blast200 at sub-step 60.
export const HASH_SCENES = Object.freeze(['stack10', 'pyramid55', 'rubble300', 'blast200']);
export const chain = (F, name, steps) => runChain(F, name, steps, name === 'blast200' ? {blastAt: 60} : undefined);
// {stack10, pyramid55, rubble300, blast200}: the chain of each scene after `steps` sub-steps.
export function hashes(F, steps = 600) {
  const out = {};
  for (const name of HASH_SCENES) out[name] = chain(F, name, steps);
  return out;
}

// Horizontal drift: max of sqrt((x - x0)^2 + (z - z0)^2) against the ideal poses (bancs/phys/drift.mjs).
export function drift(w, ids, ideal) {
  let m = 0;
  ids.forEach((h, k) => { const p = w.body(h).pos; m = Math.max(m, Math.hypot(p[0] - ideal[k][0], p[2] - ideal[k][2])); });
  return m;
}

// Lowest vertex: min of the y of the 8 corners of the collision boxes (matrix row 1 = Y components of the local axes).
export function lowest(w, ids) {
  let m = Infinity;
  const r = new Array(9);
  for (const h of ids) {
    const b = w.body(h), e = b.size.map(s => s / 2);
    w.matrix(h, r);
    for (let k = 0; k < 8; k++) {
      const y = b.pos[1] + r[3] * (k & 1 ? e[0] : -e[0]) + r[4] * (k & 2 ? e[1] : -e[1]) + r[5] * (k & 4 ? e[2] : -e[2]);
      if (y < m) m = y;
    }
  }
  return m;
}
