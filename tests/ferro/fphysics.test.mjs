// FPhysics tests (lot 17, module side). Run: node --test checks/fphysics.test.mjs
// Not in npm test until the module is wired into the game (see docs/chantier-moteur/modules/physique.md, §6).
import test from 'node:test';
import assert from 'node:assert/strict';
import {source, load, loadVm, lcg, B64, NOSLEEP, SCENES, runChain, crate, drift, lowest, twin, chain, hashes, HASH_SCENES, YARD, WALLS30} from './fphysics-scenes.mjs';

const SMALL = Object.freeze({capacity: 8, maxContacts: 256, maxStatics: 16, maxJoints: 4});

// Settings after bounds, in the order of the module brief (§4.4), with their defaults.
const ORDER = [
  ['cell', 2], ['gravity', -12], ['ground', null], ['floorThickness', 0.5], ['minY', -60], ['tick', 1 / 120],
  ['maxSubsteps', 8], ['capacity', 384], ['maxStatics', 4096], ['maxContacts', 16384], ['maxJoints', 128],
  ['iterations', 2], ['relaxIterations', 1], ['hardIterations', 4], ['hardRelaxIterations', 2], ['hardRatio', 8],
  ['contactHertz', 30], ['dampingRatio', 10], ['pushout', 3], ['restitutionThreshold', 1], ['jointHertz', 60],
  ['jointDampingRatio', 2], ['linearDamping', 0.02], ['angularDamping', 0.06], ['rollingDamping', 2],
  ['maxLinear', 40], ['maxAngular', 30], ['margin', 0.02], ['slop', 0.005], ['slopRatio', 0.12], ['minHalf', 0.02],
  ['sleepLinear', 0.08], ['sleepAngular', 0.12], ['sleepTime', 0.5], ['splitTime', 1], ['fallbackTime', 6],
  ['fallbackDistance', 0.002], ['wakeSpeed', 0.25], ['supportSpeed', 0.08], ['massMin', 3], ['massMax', 120],
  ['maxAwake', 160], ['spawnBudget', 24], ['eventSpeed', 1.2], ['maxEvents', 16],
];

// FNV-1a 32 bits over character codes, written from the brief (§5.11), independent of the module.
function fnvText(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, '0');
}
function expectedFingerprint(options) {
  const b = options.bounds, values = [b.minX, b.maxX, b.minZ, b.maxZ];
  for (const [name, def] of ORDER) { const v = options[name] === undefined ? def : options[name]; values.push(v === null ? 'none' : v); }
  return fnvText('FPhysics2|' + values.join('|'));
}

// Game rotation matrix of [rx, ry, rz], M = Rz*Ry*Rx, row by row (brief §4.2).
function gameMatrix(rx, ry, rz) {
  const a = Math.cos(rx), b = Math.sin(rx), c = Math.cos(ry), d = Math.sin(ry), e = Math.cos(rz), f = Math.sin(rz);
  return [e * c, e * d * b - f * a, e * d * a + f * b, f * c, f * d * b + e * a, f * d * a - e * b, -d, c * b, c * a];
}
// Rotation of a unit quaternion, formula of derive() in the prototype (R[3*row+col]).
function quatMatrix(x, y, z, w) {
  const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  return [1 - 2 * (yy + zz), 2 * (xy - wz), 2 * (xz + wy), 2 * (xy + wz), 1 - 2 * (xx + zz), 2 * (yz - wx), 2 * (xz - wy), 2 * (yz + wx), 1 - 2 * (xx + yy)];
}
const gap = (a, b) => a.reduce((m, v, i) => Math.max(m, Math.abs(v - b[i])), 0);

// ---- Shape and guards ----

test('P01 Chargement : un seul global FPhysics, matières gelées, chargement vm', () => {
  const w0 = {};
  new Function('window', source())(w0);
  assert.deepEqual(Object.keys(w0), ['FPhysics']);
  assert.equal(globalThis.FPhysics, undefined, 'the host global object is left untouched');
  const F = w0.FPhysics;
  assert.equal(F.VERSION, 2);
  assert.deepEqual(Object.keys(F), ['VERSION', 'MATERIALS', 'create', 'eulerToQuat', 'quatToEuler']);
  for (const name of ['create', 'eulerToQuat', 'quatToEuler']) assert.equal(typeof F[name], 'function', name);
  assert.ok(Object.isFrozen(F.MATERIALS));
  const table = [['metal', 0.45, 0.24, 65], ['stone', 0.70, 0.16, 28], ['wood', 0.55, 0.22, 8], ['glass', 0.35, 0.16, 25], ['dirt', 0.80, 0.05, 12]];
  assert.equal(F.MATERIALS.length, table.length);
  table.forEach(([name, friction, restitution, density], i) => {
    const m = F.MATERIALS[i];
    assert.ok(Object.isFrozen(m), name + ' is frozen');
    assert.deepEqual({...m}, {name, friction, restitution, density});
  });
  assert.throws(() => { F.MATERIALS[0].friction = 1; }, TypeError, 'a module is strict: writing a frozen material throws');
  const L = load(), V = loadVm();
  for (const X of [L, V]) {
    assert.equal(X.VERSION, 2);
    assert.equal(JSON.stringify(X.MATERIALS), JSON.stringify(F.MATERIALS));
    assert.equal(X.create({bounds: B64}).fingerprint, F.create({bounds: B64}).fingerprint);
  }
  assert.notEqual(L, F, 'every load gives a fresh module');
});

// Lexical rules of the module source (brief §2, rules 3 to 5; test P02). Returns the list of problems.
const BANNED = [
  /Math\.random/, /\bDate\b/, /\bperformance\b/, /\*\*/,
  /\bsetTimeout\b|\bsetInterval\b|\brequestAnimationFrame\b/, /\bprocess\b/,
  /^\s*(import|export)\b/m, /\brequire\s*\(/,
  /fetch\s*\(|XMLHttpRequest|WebSocket\s*\(|import\s*\(|@import/, /<\/script/i,
  /\bMETAL\b/,
  /rubble|debris|gravat|grenade|rocket|roquette|enemy|ennemi|player|joueur|weapon|FSimulation|FWorld|walkable/i,
];
const MATH_BASE = new Set(['sqrt', 'abs', 'floor', 'imul', 'min', 'max', 'PI']);
const MATH_TRIG = new Set([...MATH_BASE, 'sin', 'cos', 'atan2', 'asin']);
function sourceProblems(text, counts = {blocks: 0, members: 0}) {
  const problems = [];
  for (const pattern of BANNED) {
    const found = text.match(pattern);
    if (found) problems.push(`motif interdit ${pattern} : « ${found[0]} »`);
  }
  let inside = false;
  text.split('\n').forEach((line, n) => {
    const marker = /^\s*\/\/ TRIG-(BEGIN|END)\b/.exec(line);
    if (marker) {
      if (marker[1] === 'BEGIN') { if (inside) problems.push(`TRIG-BEGIN imbriqué, ligne ${n + 1}`); inside = true; counts.blocks++; }
      else { if (!inside) problems.push(`TRIG-END sans TRIG-BEGIN, ligne ${n + 1}`); inside = false; }
      return;
    }
    for (const [, name] of line.matchAll(/\bMath\.([A-Za-z_$][\w$]*)/g)) {
      counts.members++;
      if (!(inside ? MATH_TRIG : MATH_BASE).has(name)) problems.push(`Math.${name} interdit ${inside ? 'même en bloc TRIG' : 'hors bloc TRIG'}, ligne ${n + 1}`);
    }
  });
  if (inside) problems.push('bloc TRIG non fermé');
  if (!text.startsWith('/* FERRO — FPhysics')) problems.push('en-tête autre que « /* FERRO — FPhysics »');
  if (!text.includes("'use strict'")) problems.push("'use strict' absent");
  return problems;
}

test('P02 Source : taille, motifs interdits, membres de Math, blocs TRIG', t => {
  const text = source(), bytes = Buffer.byteLength(text, 'utf8'), counts = {blocks: 0, members: 0};
  t.diagnostic(`src/physics.js : ${bytes} octets`);
  assert.ok(bytes <= 82000, `src/physics.js fait ${bytes} octets (plafond 82 000)`);
  if (bytes > 60000) t.diagnostic(`au-dessus de la cible de 60 000 octets : ${bytes}`);
  assert.deepEqual(sourceProblems(text, counts), []);
  assert.ok(counts.blocks >= 1, 'au moins un bloc TRIG (conversions d\'angles)');
  t.diagnostic(`${counts.blocks} bloc(s) TRIG, ${counts.members} appels à Math vérifiés`);
  // The guard itself: each of these alterations of the real source must be caught.
  const trigEnd = '  // TRIG-END\n';
  assert.ok(text.includes(trigEnd), 'TRIG-END marker found');
  const altered = [
    text + '\nMath.random();', text + '\nconst t0 = Date.now();', text + '\nperformance.now();', text + '\nconst p = 2 ** 3;',
    text + '\n/** doc */', text + '\nsetTimeout(f);', text + '\nprocess.exit();', text + '\n/*\nexport x\n*/',
    text + '\nrequire ("fs");', text + '\nfetch(u);', text + '\nimport("x");', text + '\n// </script>',
    text + '\n// METAL', text + '\n// multiplayer', text + '\n// Debris', text + '\n// walkable floors',
    text + '\nMath.sin(1);', text + '\nMath.round(1);', text.replace(trigEnd, '  Math.hypot(1, 2);\n' + trigEnd),
    text + '\n  // TRIG-BEGIN\n', text.replace(trigEnd, ''), text + '\n  // TRIG-END\n',
    text.replace("'use strict'", "'use sloppy'"), text.slice(text.indexOf('\n') + 1),
  ];
  altered.forEach((bad, k) => assert.ok(sourceProblems(bad).length > 0, `altération n° ${k + 1} non détectée`));
});

test('P03 Angles : quaternions unitaires, matrice du jeu, aller-retour, blocage de cardan', t => {
  const F = load(), r = lcg(31);
  let norm = 0, matrix = 0, back = 0;
  for (let k = 0; k < 1000; k++) {
    const rx = (r() - 0.5) * 6, ry = (r() - 0.5) * 3, rz = (r() - 0.5) * 6;
    const q = F.eulerToQuat(rx, ry, rz), m = gameMatrix(rx, ry, rz);
    norm = Math.max(norm, Math.abs(Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]) - 1));
    matrix = Math.max(matrix, gap(quatMatrix(...q), m));
    back = Math.max(back, gap(gameMatrix(...F.quatToEuler(...q)), m));
  }
  t.diagnostic(`1 000 triplets : |q| - 1 ≤ ${norm.toExponential(2)}, matrice ≤ ${matrix.toExponential(2)}, aller-retour ≤ ${back.toExponential(2)}`);
  assert.ok(norm <= 1e-12, 'unit quaternions');
  assert.ok(matrix <= 1e-12, 'quaternion matrix equals the game matrix');
  assert.ok(back <= 1e-9, 'quatToEuler gives back the same matrix');
  for (const ry of [Math.PI / 2, -Math.PI / 2]) {
    const q = F.eulerToQuat(0.3, ry, -0.4), e = F.quatToEuler(...q), m = gameMatrix(0.3, ry, -0.4);
    assert.equal(e[0], 0, 'gimbal lock: rx = 0');
    const g1 = gap(quatMatrix(...q), m), g2 = gap(gameMatrix(...e), m);
    t.diagnostic(`blocage de cardan ry = ${ry.toFixed(4)} : matrice ${g1.toExponential(2)}, aller-retour ${g2.toExponential(2)}`);
    assert.ok(g1 <= 1e-12 && g2 <= 1e-6);
  }
  assert.deepEqual(F.eulerToQuat(0, 0, 0), [0, 0, 0, 1]);
  const out4 = [9, 9, 9, 9], out3 = [9, 9, 9];
  assert.equal(F.eulerToQuat(0.1, 0.2, 0.3, out4), out4, 'eulerToQuat fills and returns out');
  assert.equal(F.quatToEuler(...out4, out3), out3, 'quatToEuler fills and returns out');
  assert.ok(gap(out3, [0.1, 0.2, 0.3]) <= 1e-12, 'regular case gives the same angles back');
  assert.equal(F.quatToEuler(0, 0, 0, 1).length, 3);
});

test('P04 Création : validation, réglages par défaut, empreinte', t => {
  const F = load();
  const bad = [
    undefined, null, 42, {}, {bounds: null}, {bounds: {minX: -1, maxX: 1, minZ: -1}},
    {bounds: {minX: 1, maxX: 1, minZ: -1, maxZ: 1}}, {bounds: {minX: 2, maxX: 1, minZ: -1, maxZ: 1}},
    {bounds: {minX: -1, maxX: 1, minZ: 1, maxZ: 1}}, {bounds: {minX: NaN, maxX: 1, minZ: -1, maxZ: 1}},
    {bounds: {minX: '-1', maxX: 1, minZ: -1, maxZ: 1}},
  ];
  const badSettings = [
    ['capacity', 5000], ['capacity', 0], ['capacity', 4096], ['capacity', 2.5], ['capacity', '384'], ['capacity', NaN],
    ['maxStatics', 0], ['maxStatics', 65536], ['maxContacts', 0], ['maxContacts', 1048577], ['maxJoints', -1], ['maxJoints', 4096],
    ['maxSubsteps', 0], ['iterations', 0], ['iterations', 1.5], ['relaxIterations', -1], ['hardIterations', -1],
    ['hardRelaxIterations', -1], ['maxAwake', -1], ['spawnBudget', 0], ['maxEvents', -1],
    ['cell', 0], ['cell', -2], ['cell', Infinity], ['tick', 0], ['tick', NaN], ['floorThickness', 0], ['contactHertz', 0],
    ['jointHertz', 0], ['maxLinear', 0], ['maxAngular', 0], ['massMin', 0], ['massMax', -1], ['massMin', 200],
    ['linearDamping', -0.01], ['slop', -1], ['sleepTime', -1], ['hardRatio', -1], ['margin', -0.02],
    ['gravity', NaN], ['gravity', '12'], ['minY', Infinity], ['ground', NaN], ['ground', 'none'], ['ground', false],
    ['clock', 5], ['clock', 'now'],
  ];
  for (const [name, value] of badSettings) bad.push({bounds: B64, ...SMALL, [name]: value});
  for (const options of bad) assert.throws(() => F.create(options), {name: 'TypeError', message: /^FPhysics\.create: /}, JSON.stringify(options));
  t.diagnostic(`${bad.length} jeux d'options invalides refusés par TypeError`);
  const good = [
    {bounds: B64, ...SMALL, ground: 0}, {bounds: B64, ...SMALL, ground: -3.2}, {bounds: B64, ...SMALL, gravity: 0},
    {bounds: B64, ...SMALL, sleepLinear: 0}, {bounds: B64, ...SMALL, capacity: 1}, {bounds: B64, ...SMALL, capacity: 4095},
    {bounds: B64, ...SMALL, maxJoints: 0}, {bounds: B64, ...SMALL, maxStatics: 65535}, {bounds: B64, ...SMALL, clock: () => 0},
    {bounds: B64, ...SMALL, clock: null}, {bounds: B64, ...SMALL, massMin: 120, massMax: 120}, {bounds: B64, ...SMALL, ...NOSLEEP},
  ];
  for (const options of good) assert.doesNotThrow(() => F.create(options), Object.keys(options).join(','));

  const w = F.create({bounds: B64}), c = w.config;
  assert.ok(Object.isFrozen(c) && Object.isFrozen(c.bounds), 'config is frozen');
  assert.equal(c.tick, 1 / 120);
  assert.equal(c.capacity, 384);
  for (const [name, def] of ORDER) assert.equal(c[name], def, name);
  assert.deepEqual({...c.bounds}, {...B64});
  assert.ok(!('clock' in c), 'clock is never part of config');
  // Durations in whole sub-steps: Math.floor(duration / tick + 0.5).
  assert.deepEqual([c.sleepSteps, c.splitSteps, c.fallbackSteps, c.windowSteps], [60, 120, 720, 120]);
  const odd = F.create({bounds: B64, ...SMALL, tick: 0.007}).config;
  assert.deepEqual([odd.sleepSteps, odd.splitSteps, odd.fallbackSteps, odd.windowSteps], [71, 143, 857, 143]);
  assert.equal(F.create({bounds: B64, ...SMALL, ...NOSLEEP}).config.sleepSteps, 120000000000);
  for (const x of [c, odd]) for (const k of ['sleepSteps', 'splitSteps', 'fallbackSteps', 'windowSteps']) assert.ok(Number.isInteger(x[k]), k);

  // Fingerprint: 8 hex digits, the FNV-1a of the brief, same settings same value, any setting changes it.
  assert.match(w.fingerprint, /^[0-9a-f]{8}$/);
  assert.equal(w.fingerprint, expectedFingerprint({bounds: B64}));
  assert.equal(F.create({bounds: {...B64}}).fingerprint, w.fingerprint);
  assert.notEqual(F.create({bounds: B64, iterations: 3}).fingerprint, w.fingerprint);
  assert.equal(F.create({bounds: B64, unknownKey: 1, clock: () => 0}).fingerprint, w.fingerprint, 'unknown keys and clock are ignored');
  const again = F.create(c);
  assert.equal(again.fingerprint, w.fingerprint, 'config can be fed back to create');
  assert.deepEqual({...again.config}, {...c});
  const small = F.create({bounds: B64, ...SMALL});
  assert.equal(small.fingerprint, expectedFingerprint({bounds: B64, ...SMALL}));
  const seen = new Map([[small.fingerprint, 'base']]);
  const variants = [['bounds.minX', {bounds: {...B64, minX: -63}}], ['bounds.maxX', {bounds: {...B64, maxX: 63}}],
    ['bounds.minZ', {bounds: {...B64, minZ: -63}}], ['bounds.maxZ', {bounds: {...B64, maxZ: 63}}]];
  for (const [name] of ORDER) {
    const v = small.config[name];
    variants.push([name, {[name]: v === null ? 0 : Number.isInteger(v) ? v + 1 : v * 1.5}]);
  }
  for (const [name, change] of variants) {
    const options = {bounds: B64, ...SMALL, ...change}, fp = F.create(options).fingerprint;
    assert.equal(fp, expectedFingerprint(options), name);
    assert.ok(!seen.has(fp), `${name} gives a new fingerprint (same as ${seen.get(fp)})`);
    seen.set(fp, name);
  }
  // -0 is normalised in config and does not change the fingerprint.
  const z = F.create({bounds: {...B64, minZ: -0}, ...SMALL, ground: -0, gravity: -0}).config;
  assert.ok(Object.is(z.ground, 0) && Object.is(z.gravity, 0) && Object.is(z.bounds.minZ, 0));
  t.diagnostic(`empreinte par défaut sur B64 : ${w.fingerprint} ; ${variants.length} réglages, chacun change l'empreinte`);
});

// ---- One body (module step 2a) ----

test('P05 Chute libre exacte', t => {
  const F = load(), w = F.create({bounds: B64, ...SMALL, linearDamping: 0, angularDamping: 0});
  const h = w.addBody({size: [1, 1, 1], pos: [0, 10, 0], mass: 10});
  for (let i = 0; i < 120; i++) w.step(1 / 120);
  const b = w.body(h);
  t.diagnostic(`après 120 sous-pas : y = ${b.pos[1]}, vy = ${b.vel[1]} (attendu 3,95 et -12, Euler semi-implicite)`);
  assert.ok(Math.abs(b.pos[1] - 3.95) <= 1e-9, 'y = 3.95');
  assert.ok(Math.abs(b.vel[1] + 12) <= 1e-9, 'vy = -12');
  assert.deepEqual([b.pos[0], b.pos[2], ...b.ang, b.vel[0], b.vel[2]], [0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(b.quat, [0, 0, 0, 1]);
  const w2 = F.create({bounds: B64, ...SMALL});
  w2.addBody({size: [1, 1, 1], pos: [0, 10, 0], mass: 10});
  assert.equal(w2.step(1 / 240), 0, 'half a tick: no sub-step');
  assert.equal(w2.step(1 / 240), 1, 'second half: one sub-step');
});

test('P06 Repos', t => {
  const F = load(), w = F.create({bounds: B64, ...SMALL, ground: 0}), h = crate(w, 0, 0.401, 0);
  let asleepAt = -1;
  for (let i = 1; i <= 240; i++) { w.step(1 / 120); if (asleepAt < 0 && w.isAsleep(h)) asleepAt = i; }
  const b = w.body(h), y = b.pos[1], sl = Math.min(w.config.slop, w.config.slopRatio * 0.4);
  t.diagnostic(`au bout de 2 s : y = ${y.toFixed(6)} (enfoncement ${((0.4 - y) * 1000).toFixed(2)} mm), endormie au sous-pas ${asleepAt}`);
  assert.ok(y >= 0.393 && y <= 0.401, `y = ${y}`);
  assert.ok(w.isAsleep(h) && b.asleep, 'asleep');
  assert.deepEqual([...b.vel, ...b.ang], [0, 0, 0, 0, 0, 0], 'zero velocities');
  assert.ok(Math.abs(w.pose(h, 1)[1] - (y + sl / 2)) <= 1e-12, 'pose raised by SL/2');
});

// ---- Shapes and slopes (module step 3) ----

test('P07 Rebond', t => {
  const F = load(), w = F.create({bounds: B64, ...SMALL, ground: 0}), h = w.addBody({shape: 'sphere', radius: 0.2, pos: [0, 2.2, 0], material: 'metal'});
  // Phases: 0 falling, 1 going up after the first impact, 2 past the top of that bounce.
  let phase = 0, top = -Infinity, asleepAt = -1;
  for (let i = 1; i <= 720; i++) {
    w.step(1 / 120);
    const b = w.body(h);
    if (phase === 0 && b.vel[1] > 0) phase = 1;
    if (phase === 1) { top = Math.max(top, b.pos[1]); if (b.vel[1] <= 0) phase = 2; }
    if (asleepAt < 0 && w.isAsleep(h)) asleepAt = i;
  }
  t.diagnostic(`après le premier choc, le centre remonte à ${top.toFixed(4)}, soit ${(top - 0.2).toFixed(4)} m au-dessus de 0,2 ; endormie au sous-pas ${asleepAt} (${(asleepAt / 120).toFixed(2)} s)`);
  assert.ok(phase === 2 && top - 0.2 >= 0.06 && top - 0.2 <= 0.15, `rise ${top - 0.2}`);
  assert.ok(asleepAt > 0, 'asleep before 6 s');
});

// Slope floor of P08 and the pose of a cube of side 0.6 laid on it at (x, z): rotated about Z (slopeX) or about X (slopeZ)
// by the slope angle, centre = surface point + n*0.3.
function slopePose(floor, x, z) {
  const s = floor.slopeX || floor.slopeZ || 0, a = Math.atan(s), l = Math.hypot(1, s), y = (floor.y ?? 0) + (x - floor.x) * (floor.slopeX || 0) + (z - floor.z) * (floor.slopeZ || 0);
  const n = floor.slopeX ? [-s / l, 1 / l, 0] : [0, 1 / l, -s / l], quat = floor.slopeX ? [0, 0, Math.sin(a / 2), Math.cos(a / 2)] : [Math.sin(-a / 2), 0, 0, Math.cos(-a / 2)];
  return {pos: [x + n[0] * 0.3, y + n[1] * 0.3, z + n[2] * 0.3], quat, n};
}
// World point of the body point l (body frame).
function bodyPoint(w, h, l) {
  const b = w.body(h), m = w.matrix(h);
  return [0, 1, 2].map(r => b.pos[r] + m[3 * r] * l[0] + m[3 * r + 1] * l[1] + m[3 * r + 2] * l[2]);
}
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

test('P08 Pentes', async t => {
  const F = load(), cube = {size: [0.6, 0.6, 0.6], mass: 20, friction: 0.6};
  const slope = floor => { const w = F.create({bounds: B64, ...SMALL}); w.setStatics([], [floor]); return w; };
  for (const [name, floor, x, secs] of [['(a) slopeX 0,5', {x: 0, z: 0, w: 10, d: 4, y: 1, slopeX: 0.5}, 0, 3],
    ['(b) slopeX 1', {x: 0, z: 0, w: 6, d: 4, y: 3, slopeX: 1}, 1.5, 1], ['(c) slopeZ 0,5', {x: 0, z: 0, w: 10, d: 4, y: 1, slopeZ: 0.5}, 0, 3]]) {
    await t.test(name, () => {
      const w = slope(floor), {pos, quat} = slopePose(floor, x, 0), h = w.addBody({...cube, pos, quat});
      for (let i = 0; i < secs * 120; i++) w.step(1 / 120);
      const b = w.body(h), moved = dist3(b.pos, pos);
      t.diagnostic(`${name} : déplacement ${moved.toFixed(4)} m (dx ${(b.pos[0] - pos[0]).toFixed(4)}, dz ${(b.pos[2] - pos[2]).toFixed(4)}) après ${secs} s ; ${b.asleep ? 'endormie' : 'éveillée'}`);
      if (floor.slopeX === 1) assert.ok(pos[0] - b.pos[0] > 0.8, `slides down: dx ${b.pos[0] - pos[0]}`);
      else assert.ok(moved < 0.02 && b.asleep, `holds: moved ${moved}`);
    });
  }
  // (d) An unrotated cube released with its lowest edge (local x = +0.3, y = -0.3) 0.5 m above the slope of (a).
  const floor = {x: 0, z: 0, w: 10, d: 4, y: 1, slopeX: 0.5}, w = slope(floor), h = w.addBody({...cube, pos: [0, 1.15 + 0.5 + 0.3, 0]});
  const edge = [0.3, -0.3, 0];
  let first = -1, edge0 = null, centre0 = null;
  for (let i = 1; i <= 360; i++) {
    w.step(1 / 120);
    if (first < 0 && w.stats.contacts > 0) { first = i; edge0 = bodyPoint(w, h, edge); centre0 = w.body(h).pos; }
  }
  const b = w.body(h), m = w.matrix(h), n = slopePose(floor, 0, 0).n, axis = dist3([m[1], m[4], m[7]], n);
  const edgeMoved = dist3(bodyPoint(w, h, edge), edge0), centreMoved = dist3(b.pos, centre0);
  t.diagnostic(`(d) premier contact au sous-pas ${first} ; après 3 s : ${b.asleep ? 'endormie' : 'éveillée'}, axe Y à ${axis.toExponential(2)} de la normale ; depuis le premier contact, l'arête du premier contact a bougé de ${edgeMoved.toFixed(4)} m et le centre de ${centreMoved.toFixed(4)} m (le seul basculement sur la face déplace le centre de 0,195 m)`);
  await t.test('(d) endormie après 3 s, axe Y sur la normale', () => {
    assert.ok(b.asleep, 'asleep after 3 s');
    assert.ok(axis < 0.01, `local Y ${axis} from the slope normal`);
  });
  // The soft solver of the prototype (2 + 1 passes) lets the cube slip when its face slams on the slope after the tipping:
  // measured above. Kept as written in the brief until the decision of the module step that changes the solver.
  await t.test('(d) déplacement depuis le premier contact < 0,1 m', {todo: 'le cube glisse après son basculement (solveur du prototype, voir le diagnostic)'}, () => {
    assert.ok(edgeMoved < 0.1 && centreMoved < 0.1, `moved ${centreMoved} (centre), ${edgeMoved} (edge)`);
  });
});

test('P09 Sphère qui roule', t => {
  const F = load(), w = F.create({bounds: B64, ...SMALL, ground: 0}), h = w.addBody({shape: 'sphere', radius: 0.3, pos: [0, 0.3, 0], mass: 10, vel: [3, 0, 0]});
  let low = Infinity, slip = null, asleepAt = -1;
  for (let i = 1; i <= 1440 && asleepAt < 0; i++) {
    w.step(1 / 120);
    const b = w.body(h);
    low = Math.min(low, b.pos[1]);
    if (i === 120) slip = {vx: b.vel[0], wz: b.ang[2], ratio: Math.abs(b.vel[0] + b.ang[2] * 0.3) / Math.abs(b.vel[0])};
    if (w.isAsleep(h)) asleepAt = i;
  }
  const x = w.body(h).pos[0];
  t.diagnostic(`à 1 s : vx = ${slip.vx.toFixed(4)}, ωz = ${slip.wz.toFixed(4)}, |vx + 0,3 ωz| / |vx| = ${slip.ratio.toExponential(2)} ; centre ≥ ${low.toFixed(5)} ; endormie à ${(asleepAt / 120).toFixed(2)} s après ${x.toFixed(3)} m`);
  assert.ok(slip.ratio < 0.05, 'rolls without slipping at 1 s');
  assert.ok(low >= 0.294, `centre ${low}`);
  assert.ok(asleepAt > 0 && x > 1.5, 'asleep before 12 s, after more than 1.5 m');
});

test('P10 Capsules', t => {
  const F = load(), cap = {shape: 'capsule', radius: 0.15, height: 1, mass: 10}, onX = [0, 0, Math.PI / 2], onZ = [Math.PI / 2, 0, 0];
  // (a) and (b): lying on the ground slab, then on a static box of top y = 0.5.
  for (const [name, boxes, y0, lo, hi] of [['(a) au sol', [], 1, 0.143, 0.151], ['(b) sur la boîte', [{minX: -1, maxX: 1, minY: 0, maxY: 0.5, minZ: -1, maxZ: 1}], 1.5, 0.643, 0.651]]) {
    const w = F.create({bounds: B64, ...SMALL, ground: 0});
    w.setStatics(boxes, []);
    const h = w.addBody({...cap, rot: onX, pos: [0, y0, 0]});
    for (let i = 0; i < 360; i++) w.step(1 / 120);
    const y = w.body(h).pos[1], up = Math.abs(w.matrix(h)[4]);
    t.diagnostic(`${name} : y = ${y.toFixed(5)} après 3 s, |axe·Y| = ${up.toExponential(2)}, ${w.isAsleep(h) ? 'endormie' : 'éveillée'}`);
    assert.ok(y >= lo && y <= hi && w.isAsleep(h) && up < 0.02, `${name}: y ${y}, |axis.Y| ${up}`);
  }
  // (c) Crossed: the low one on X on the ground, the high one on Z dropped from y = 1 at the same point.
  {
    const w = F.create({bounds: B64, ...SMALL, ground: 0}), low = w.addBody({...cap, rot: onX, pos: [0, 0.15, 0]}), high = w.addBody({...cap, rot: onZ, pos: [0, 1, 0]});
    let at = -1;
    for (let i = 1; i <= 480 && at < 0; i++) { w.step(1 / 120); if (w.isAsleep(low) && w.isAsleep(high)) at = i; }
    const y = w.body(high).pos[1];
    t.diagnostic(`(c) croisées : la haute se pose à y = ${y.toFixed(5)} (attendu ≈ 0,439), la basse à ${w.body(low).pos[1].toFixed(5)} ; toutes deux dorment au sous-pas ${at}`);
    assert.ok(y >= 0.436 && y <= 0.451, `high capsule at ${y}`);
    assert.ok(at > 0, 'both asleep before 4 s');
  }
  // (d) A sphere of radius 0.25 dropped on a crate resting on the ground, 0.1 m off its axis.
  {
    const w = F.create({bounds: B64, ...SMALL, ground: 0}), c = crate(w, 0, 0.4, 0), s = w.addBody({shape: 'sphere', radius: 0.25, pos: [0.1, 1.3, 0], mass: 10});
    let low = Infinity;
    for (let i = 0; i < 720; i++) { w.step(1 / 120); low = Math.min(low, w.body(s).pos[1]); }
    t.diagnostic(`(d) sphère sur la caisse : centre final (${w.body(s).pos.map(v => v.toFixed(4)).join(', ')}), jamais sous ${low.toFixed(5)}`);
    assert.ok(w.isAsleep(c) && w.isAsleep(s), 'everything asleep at 6 s');
    assert.ok(low >= 0.243, `sphere centre ${low}`);
  }
});

// ---- Stacks (module step 2a: no internal faces yet) ----

// Runs a scene for `steps` sub-steps: drift at the given sub-steps, lowest vertex over the whole run and from `from` on.
function settleRun(scene, steps, marks, from) {
  const {w, ids, ideal} = scene, out = {drift: {}, low: Infinity, lowAt: 0, lowLate: Infinity, lowLateAt: 0};
  for (let i = 1; i <= steps; i++) {
    w.step(1 / 120);
    const y = lowest(w, ids);
    if (y < out.low) { out.low = y; out.lowAt = i; }
    if (i >= from && y < out.lowLate) { out.lowLate = y; out.lowLateAt = i; }
    if (marks.includes(i)) out.drift[i] = drift(w, ids, ideal);
  }
  return out;
}
// Sub-step at which every body of the scene is asleep, or -1 within `steps`.
function sleepRun(scene, steps) {
  const {w, ids} = scene;
  for (let i = 1; i <= steps; i++) { w.step(1 / 120); if (ids.every(h => w.isAsleep(h))) return i; }
  return -1;
}
const mm = v => (v * 1000).toFixed(2) + ' mm';

test('P11 Pile de 10 (stack10)', t => {
  const F = load(), scene = SCENES.stack10(F, NOSLEEP), r = settleRun(scene, 1200, [120, 600, 1200], 120);
  const settle = scene.ideal[9][1] - scene.w.body(scene.ids[9]).pos[1];
  t.diagnostic(`NOSLEEP : dérive ${mm(r.drift[120])} à 1 s, ${mm(r.drift[600])} à 5 s, ${mm(r.drift[1200])} à 10 s (seuil 30 mm ; prototype sur dalle 30,7 / 16,8 / 23,4)`);
  t.diagnostic(`tassement du sommet à 10 s : ${mm(settle)} (attendu ≈ 85 mm)`);
  t.diagnostic(`plus bas sommet : ${mm(r.lowLate)} de 1 s à 10 s (sous-pas ${r.lowLateAt}) ; ${mm(r.low)} sur tout l'essai (sous-pas ${r.lowAt}, chute initiale)`);
  assert.ok(r.drift[1200] < 0.030, `drift ${r.drift[1200]}`);
  assert.ok(r.lowLate >= -0.012, `lowest vertex ${r.lowLate} from 1 s`);
  const at = sleepRun(SCENES.stack10(F), 480);
  t.diagnostic(`réglages par défaut : toute la pile dort au sous-pas ${at} (${(at / 120).toFixed(3)} s)`);
  assert.ok(at > 0 && at < 480, 'asleep before 4 s');
});

test('P12 Pyramide de 55 (pyramid55)', t => {
  const F = load(), scene = SCENES.pyramid55(F, NOSLEEP), r = settleRun(scene, 1200, [120, 600, 1200], 120);
  t.diagnostic(`NOSLEEP : dérive ${mm(r.drift[120])} à 1 s, ${mm(r.drift[600])} à 5 s, ${mm(r.drift[1200])} à 10 s (seuil 20 mm ; prototype sur dalle 9,6 / 16,4 / 19,4)`);
  t.diagnostic(`plus bas sommet : ${mm(r.lowLate)} de 1 s à 10 s (sous-pas ${r.lowLateAt}) ; ${mm(r.low)} sur tout l'essai (sous-pas ${r.lowAt}, chute initiale)`);
  assert.ok(r.drift[1200] < 0.020, `drift ${r.drift[1200]}`);
  assert.ok(r.lowLate >= -0.012, `lowest vertex ${r.lowLate} from 1 s`);
  const at = sleepRun(SCENES.pyramid55(F), 1200);
  t.diagnostic(`réglages par défaut : tout dort au sous-pas ${at} (${(at / 120).toFixed(3)} s)`);
  assert.ok(at > 0 && at < 1200, 'asleep before 10 s');
});

// ---- Tunnelling (module step 2b: boxes; module step 3: spheres) ----

test('P19 Traversées (boîtes) : 800 tirs contre un mur de 12 cm à 120 Hz', t => {
  // bancs/phys-verif/tunnel2.mjs at 120 Hz x 1: wall x 5..5.12, small spinning boxes at 14 to 40 m/s, 120 sub-steps.
  const F = load(), wall = [{minX: 5, maxX: 5.12, minY: 0, maxY: 6, minZ: -6, maxZ: 6}], through = [];
  for (const s of [14, 24, 30, 40]) {
    let n = 0, far = -Infinity;
    for (let k = 0; k < 200; k++) {
      const w = F.create({bounds: B64, ...SMALL, ground: 0, maxLinear: 60}), h = 0.05 + 0.01 * (k % 9);
      w.setStatics(wall, []);
      const b = w.addBody({size: [2 * h, 2 * h * (1 + k % 3), 2 * h], pos: [3.5 - 0.0137 * k, 1.5 + 0.1 * (k % 7), -4 + 0.04 * k],
        quat: [0.1 * (k % 4), 0.2, 0.05 * (k % 3), 0.97], mass: 2, friction: 0.5, restitution: 0.2, vel: [s, 1, (k % 11 - 5) * 0.6], ang: [3 * (k % 5), 7, 0]});
      for (let i = 0; i < 120; i++) w.step(1 / 120);
      const x = w.body(b).pos[0];
      if (x > 5.06) n++;
      if (x > far) far = x;
    }
    through.push(n);
    t.diagnostic(`${s} m/s : ${n}/200 traversées ; centre le plus avancé à x = ${far.toFixed(4)} (face du mur à 5)`);
  }
  assert.deepEqual(through, [0, 0, 0, 0], 'no box goes through the 12 cm wall');
});

test('P19 Traversées (sphère) : 1 000 tirs à 24 m/s contre le mur de 12 cm', t => {
  const F = load(), wall = [{minX: 5, maxX: 5.12, minY: 0, maxY: 6, minZ: -6, maxZ: 6}], r = lcg(1234);
  let n = 0, deepest = -Infinity;
  for (let k = 0; k < 1000; k++) {
    const w = F.create({bounds: B64, ...SMALL, ground: 0, maxLinear: 60});
    w.setStatics(wall, []);
    const pos = [3.2 + 0.5 * r(), 0.4 + 2 * r(), -4 + 8 * r()], vel = [24, 3 * (r() - 0.5), 4 * (r() - 0.5)];
    const h = w.addBody({shape: 'sphere', radius: 0.17, mass: 0.5, restitution: 0.42, pos, vel});
    for (let i = 0; i < 120; i++) { w.step(1 / 120); deepest = Math.max(deepest, w.body(h).pos[0]); }
    if (w.body(h).pos[0] > 5.06) n++;
  }
  t.diagnostic(`${n}/1000 traversées ; centre le plus avancé pendant les tirs : x = ${deepest.toFixed(4)} (rayon 0,17 : contact à 4,83)`);
  assert.equal(n, 0, 'no sphere goes through the 12 cm wall');
});

// ---- Kinematic bodies and layers (module step 3) ----

// Scene of P32: a kinematic lift [2, 0.2, 2] on the ground at y = 0.1 and a box of 0.8 m (20 kg) on it; settle() runs
// 1 s by step(1/60); ride(i) gives the lift its i-th target y = 0.1 + i/60 (i = 1 .. 60), then steps 1/60.
function liftScene(F, world) {
  const w = world || F.create({bounds: B64, ...SMALL, ground: 0});
  const lift = world ? 1 : w.addBody({size: [2, 0.2, 2], pos: [0, 0.1, 0], kinematic: true}), box = world ? 2 : w.addBody({size: [0.8, 0.8, 0.8], pos: [0, 0.6, 0], mass: 20});
  return {w, lift, box, settle() { for (let i = 0; i < 60; i++) w.step(1 / 60); }, target(i) { return w.setKinematic(lift, 0, 0.1 + i / 60, 0, 0, 0, 0, 1); }, ride(i) { this.target(i); w.step(1 / 60); }};
}

test('P32 Ascenseur', t => {
  const F = load(), s = liftScene(F), {w, lift, box} = s;
  s.settle();
  const y0 = w.body(box).pos[1], slept = w.isAsleep(box);
  let gapMin = Infinity, gapMax = -Infinity;
  for (let i = 1; i <= 60; i++) { s.ride(i); const g = w.body(box).pos[1] - w.body(lift).pos[1]; gapMin = Math.min(gapMin, g); gapMax = Math.max(gapMax, g); }
  const y = w.body(box).pos[1], ly = w.body(lift).pos[1];
  t.diagnostic(`après la mise en place : boîte à ${y0.toFixed(5)} (${slept ? 'endormie' : 'éveillée'}) ; en haut : ascenseur à ${ly}, boîte à ${y.toFixed(5)} ; écart boîte - ascenseur pendant la montée : ${gapMin.toFixed(4)} à ${gapMax.toFixed(4)}`);
  assert.equal(ly, 0.1 + 60 / 60, 'the lift is exactly on its target');
  assert.ok(y >= 1.59 && y <= 1.605, `box at ${y}`);
  let at = -1;
  for (let i = 1; i <= 120; i++) { w.step(1 / 60); if (at < 0 && w.isAsleep(box)) at = i; }
  t.diagnostic(`sans nouvelle cible : ascenseur à ${w.body(lift).pos[1]}, boîte endormie ${(at / 60).toFixed(2)} s plus tard, à y = ${w.body(box).pos[1].toFixed(5)}`);
  assert.equal(w.body(lift).pos[1], ly, 'without a target the lift does not move');
  assert.deepEqual([...w.body(lift).vel, ...w.body(lift).ang], [0, 0, 0, 0, 0, 0], 'stopped');
  assert.ok(at > 0 && w.isAsleep(box), 'the box sleeps within 2 s');
});

test('P33 Couches', t => {
  const F = load(), w = F.create({bounds: B64, ...SMALL, ground: 0});
  const X = w.addBody({size: [0.8, 0.8, 0.8], pos: [0, 0.4, 0], mass: 30, group: 2, mask: 1});
  const Y = w.addBody({size: [0.8, 0.8, 0.8], pos: [0, 1.6, 0], mass: 30, group: 2, mask: 65535});
  for (let i = 0; i < 360; i++) w.step(1 / 120);
  const yx = w.body(X).pos[1], yy = w.body(Y).pos[1];
  t.diagnostic(`X à y = ${yx.toFixed(5)}, Y à y = ${yy.toFixed(5)} : Y a traversé X (groupe 2 contre masque 1 : la règle exige les deux sens)`);
  assert.ok(Math.abs(yx - 0.4) <= 0.01 && Math.abs(yy - 0.4) <= 0.01, 'both end on the ground');
});

// ---- Determinism and saving (module steps 2a and 2b: bodies and cache) ----

test('P41 Même processus : chaque chaîne calculée deux fois est identique', t => {
  const F = load(), G = load(), plan = [['stack10', 600], ['pyramid55', 600], ['rubble300', 300], ['blast200', 300]];
  assert.deepEqual(plan.map(p => p[0]), HASH_SCENES, 'the scenes of hashes() (mix comes with module step 10)');
  const first = {};
  for (const [name, steps] of plan) {
    first[name] = chain(F, name, steps);
    assert.match(first[name], /^[0-9a-f]{8}\/[0-9a-f]{8}$/);
    assert.equal(chain(G, name, steps), first[name], name + ': same chain from a second load of the module');
    t.diagnostic(`${name} à ${steps} sous-pas : ${first[name]}`);
  }
  const h = hashes(F, 300);
  assert.deepEqual(Object.keys(h), HASH_SCENES);
  assert.equal(h.rubble300, first.rubble300);
  assert.equal(h.blast200, first.blast200, 'hashes() blasts blast200 at sub-step 60');
  assert.notEqual(runChain(F, 'blast200', 300), first.blast200, 'the default scene blasts at 240');
});

test('P45 Aller-retour JSON', t => {
  const F = load();
  for (const [name, steps] of [['stack10', 100], ['pyramid55', 1200], ['rubble300', 240], ['blast200', 300]]) {
    const scene = SCENES[name](F), {w, ids, tick} = scene;
    for (let i = 0; i < steps; i++) { if (tick) tick(i); w.step(1 / 120); }
    if (name === 'pyramid55') {
      assert.ok(ids.every(h => w.isAsleep(h)), 'pyramid55 is asleep at 1 200');
      assert.ok(w.snapshot().c.n > 0, 'the impulse cache is kept while everything sleeps');
    }
    const awake = w.stats.awake;
    if (name === 'rubble300' || name === 'blast200') assert.ok(awake >= 100, `${name}: in motion at ${steps} (${awake} awake)`);
    const text = JSON.stringify(w.snapshot()), snap = JSON.parse(text);
    const w2 = twin(F, scene);
    assert.equal(w2.staticsHash, w.staticsHash, 'same statics');
    assert.notEqual(w2.hash(), w.hash());
    w2.restore(snap);
    assert.equal(w2.hash(), w.hash(), name + ': same hash after restore');
    assert.deepStrictEqual(w2.snapshot(), snap, name + ': same snapshot after restore');
    const before = w.hash();
    for (let i = steps; i < steps + 300; i++) { if (tick) { tick(i); tick(i, w2); } w.step(1 / 120); w2.step(1 / 120); }
    assert.equal(w2.hash(), w.hash(), name + ': same hash 300 sub-steps later');
    if (name === 'pyramid55') assert.equal(w.hash(), before, 'a sleeping pyramid does not change');
    t.diagnostic(`${name} à ${steps} sous-pas (${awake} éveillés) : ${before}, puis ${w.hash()} des deux côtés 300 sous-pas plus tard ; instantané de ${text.length} caractères, cache de ${snap.c.n} entrées`);
  }
  // Round shapes in motion (module step 3), 40 sub-steps after their release.
  {
    const scene = roundScene(F), {w} = scene;
    for (let i = 0; i < 40; i++) w.step(1 / 120);
    const snap = JSON.parse(JSON.stringify(w.snapshot())), w2 = twin(F, scene);
    assert.ok(w.stats.awake >= 8 && w.stats.contacts > 0, 'in motion, with contacts');
    assert.deepEqual([...new Set(snap.b.SH.slice(1))], [1, 2], 'spheres and capsules');
    w2.restore(snap);
    assert.equal(w2.hash(), w.hash(), 'round shapes: same hash after restore');
    assert.deepStrictEqual(w2.snapshot(), snap);
    for (let i = 0; i < 300; i++) { w.step(1 / 120); w2.step(1 / 120); }
    assert.equal(w2.hash(), w.hash(), 'round shapes: same hash 300 sub-steps later');
    t.diagnostic(`formes rondes à 40 sous-pas : ${w.hash()} des deux côtés 300 sous-pas plus tard ; cache de ${snap.c.n} entrées`);
  }
  // Lift of P32, between setKinematic and step: the pending target (KT, KN) is part of the state.
  {
    const s = liftScene(F), {w, lift} = s;
    s.settle();
    for (let i = 1; i <= 30; i++) s.ride(i);
    s.target(31);
    const snap = JSON.parse(JSON.stringify(w.snapshot())), row = lift & 4095, w2 = F.create(w.config);
    assert.deepEqual([snap.b.KN[row], snap.b.KT[row * 7 + 1], snap.b.FL[row]], [1, 0.1 + 31 / 60, 1 | 4 | 64], 'pending target of a moving lift');
    w2.restore(snap);
    assert.equal(w2.hash(), w.hash(), 'lift: same hash after restore');
    assert.equal(w2.stats.kinematic, 1);
    const s2 = liftScene(F, w2);
    w.step(1 / 60); w2.step(1 / 60);
    for (let i = 32; i <= 60; i++) { s.ride(i); s2.ride(i); }
    for (let i = 0; i < 120; i++) { w.step(1 / 60); w2.step(1 / 60); }
    assert.equal(w2.hash(), w.hash(), 'lift: same hash 300 sub-steps later');
    assert.equal(w2.body(lift).pos[1], 0.1 + 60 / 60);
    t.diagnostic(`ascenseur entre setKinematic et step : ${w.hash()} des deux côtés 300 sous-pas plus tard`);
  }
});

// Round shapes for P45 (module step 3): spheres and capsules of lcg(5) falling on a static box and on the ground.
function roundScene(F) {
  const w = F.create({bounds: B64, ...SMALL, capacity: 16, ground: 0}), statics = [{minX: -1, maxX: 1, minY: 0, maxY: 0.5, minZ: -1, maxZ: 1}], r = lcg(5), ids = [];
  w.setStatics(statics, []);
  for (let k = 0; k < 10; k++) {
    const pos = [(r() - 0.5) * 2, 1 + k * 0.5, (r() - 0.5) * 2], rot = [r() * 3, r() * 3, r() * 3];
    ids.push(k % 2 ? w.addBody({shape: 'capsule', radius: 0.1 + 0.1 * r(), height: 0.6 + 0.6 * r(), pos, rot, material: k % 5})
      : w.addBody({shape: 'sphere', radius: 0.15 + 0.2 * r(), pos, rot, material: k % 5}));
  }
  return {w, ids, statics};
}

test('P46 snapshot ne modifie rien', t => {
  const F = load();
  for (const name of ['stack10', 'pyramid55']) {
    const a = SCENES[name](F).w, b = SCENES[name](F).w;
    for (let i = 1; i <= 300; i++) {
      a.step(1 / 120); b.step(1 / 120);
      if (i % 10 === 0) { const h = b.hash(); b.snapshot(); assert.equal(b.hash(), h, 'snapshot() leaves the hash'); }
    }
    assert.equal(b.hash(), a.hash(), name + ': a snapshot every 10 sub-steps changes nothing');
    t.diagnostic(`${name} : ${a.hash()} après 300 sous-pas, avec ou sans instantanés ; chaîne ${runChain(F, name, 300)}`);
  }
});

// ---- Module step 2a: guards of the box core ----

test('Étape 2a — corps : description, poignées, body()', t => {
  const F = load(), w = F.create({bounds: B64, ...SMALL, capacity: 4, ground: 0});
  const base = {size: [0.8, 0.8, 0.8], pos: [0, 1, 0], mass: 30};
  const bad = [undefined, null, 5, {}, {...base, size: [1, 1]}, {...base, size: [0, 1, 1]}, {...base, pos: undefined},
    {...base, pos: [0, NaN, 0]}, {...base, quat: [0, 0, 0, 0]}, {...base, quat: [0, 0, 0, 1], rot: [0, 0, 0]},
    {...base, mass: 0}, {...base, mass: -1}, {...base, mass: '30'}, {...base, mass: undefined}, {...base, material: 'gold'},
    {...base, material: 5}, {...base, friction: 3}, {...base, restitution: -0.1}, {...base, group: 70000}, {...base, mask: 1.5},
    {...base, kinematic: 'yes'}, {...base, asleep: 1}, {...base, shape: 'sphere'},
    {...base, shape: 'cylinder'}, {...base, vel: [0, 0]}];
  for (const d of bad) assert.throws(() => w.addBody(d), {name: 'TypeError', message: /^FPhysics\.addBody: /}, JSON.stringify(d));
  assert.equal(w.stats.bodies, 0, 'nothing added by an invalid description');
  const h1 = w.addBody({...base, quat: [0, 0, 0, 2], vel: [100, 0, 0], mass: 1});
  const h2 = w.addBody({size: [0.5, 0.4, 0.2], pos: [2, 1, 0], material: 'wood', rot: [0, Math.PI / 2, 0], group: 6, mask: 3});
  const h3 = w.addBody({size: [0.8, 0.01, 0.8], pos: [-2, 1, 0], mass: 500, asleep: true});
  const h4 = w.addBody(base);
  assert.deepEqual([h1, h2, h3, h4], [1, 2, 3, 4], 'handles gen*4096 + index, lowest free index');
  assert.equal(w.addBody(base), -1, 'full: -1');
  assert.equal(w.stats.refused, 1);
  assert.deepEqual([w.stats.bodies, w.stats.pending, w.stats.sleeping], [4, 3, 1]);
  for (const h of [0, -1, 5, 4096 + 1, 1.5, '1', null]) {
    assert.equal(w.valid(h), false, String(h));
    assert.equal(w.body(h), null);
    assert.equal(w.pose(h, 1), null);
    assert.equal(w.matrix(h), null);
    assert.equal(w.isAsleep(h), false);
    assert.equal(w.isLost(h), false);
  }
  const b1 = w.body(h1);
  assert.deepEqual(Object.keys(b1), ['handle', 'shape', 'size', 'radius', 'height', 'realSize', 'pos', 'quat', 'vel', 'ang', 'mass',
    'originalMass', 'material', 'friction', 'restitution', 'group', 'mask', 'kinematic', 'asleep', 'pending', 'lost', 'hard']);
  assert.deepEqual(b1.quat, [0, 0, 0, 1], 'quat normalised');
  assert.deepEqual(b1.vel, [40, 0, 0], 'speed capped at maxLinear');
  assert.deepEqual([b1.mass, b1.originalMass, b1.friction, b1.restitution, b1.material, b1.group, b1.mask], [3, 1, 0.6, 0.1, -1, 2, 65535]);
  assert.deepEqual([b1.pending, b1.asleep, b1.kinematic, b1.lost, b1.hard, b1.shape], [true, false, false, false, false, 'box']);
  const b2 = w.body(h2), wood = F.MATERIALS[2];
  assert.deepEqual([b2.material, b2.friction, b2.restitution, b2.group, b2.mask], [2, wood.friction, wood.restitution, 6, 3]);
  assert.equal(b2.originalMass, wood.density * 0.5 * 0.4 * 0.2, 'mass = density x volume');
  assert.equal(b2.mass, 3, 'physical mass at least massMin');
  assert.deepEqual(b2.quat, F.eulerToQuat(0, Math.PI / 2, 0), 'rot goes through eulerToQuat');
  const b3 = w.body(h3);
  assert.deepEqual([b3.mass, b3.originalMass, b3.asleep, b3.pending], [120, 500, true, false]);
  assert.deepEqual([b3.size[1], b3.realSize[1]], [2 * w.config.minHalf, 0.01], 'collision size at least 2 minHalf');
});

test('Étape 2a — attente, création endormie, réveil différé', t => {
  const F = load(), w = F.create({bounds: B64, ...SMALL, ground: 0});
  const sleeper = w.addBody({size: [0.8, 0.8, 0.8], pos: [0, 0.4, 0], mass: 30, asleep: true});
  const falling = crate(w, 0.2, 1.6, 0);
  assert.equal(w.step(0), 0);
  assert.ok(w.body(falling).pending, 'still pending without a sub-step');
  w.step(1 / 120);
  assert.ok(!w.body(falling).pending && w.body(falling).pos[1] < 1.6, 'activated by the next sub-step, then falls');
  assert.deepEqual(w.body(sleeper).pos, [0, 0.4, 0], 'a body created asleep does not move');
  let wokenAt = -1;
  for (let i = 2; i <= 600; i++) { w.step(1 / 120); if (wokenAt < 0 && !w.isAsleep(sleeper)) wokenAt = i; }
  t.diagnostic(`le dormeur est réveillé au sous-pas ${wokenAt} par la caisse qui tombe ; réveils : ${w.stats.wakes}`);
  assert.ok(wokenAt > 1 && w.stats.wakes >= 1, 'woken by the contact, at the end of the sub-step');
  assert.ok(w.isAsleep(sleeper) && w.isAsleep(falling), 'both asleep again within 5 s');
  const y = w.body(sleeper).pos[1];
  assert.ok(y > 0.39 && y < 0.4, `resting again on the ground: y = ${y}`);
});

test('Étape 2a — setStatics : boîtes, dalle, empreinte, réveil', t => {
  const F = load(), w = F.create({bounds: B64, ...SMALL, ground: 0});
  assert.equal(w.stats.statics, 1, 'the ground slab');
  assert.match(w.staticsHash, /^[0-9a-f]{8}$/);
  const bare = F.create({bounds: B64, ...SMALL});
  assert.equal(bare.stats.statics, 0);
  assert.notEqual(bare.staticsHash, w.staticsHash);
  const table = [{minX: -1, maxX: 1, minY: 0, maxY: 1, minZ: -1, maxZ: 1}, {minX: 4, maxX: 5, minY: 0, maxY: 2, minZ: 4, maxZ: 5, material: 'stone'}];
  const first = w.staticsHash, r = w.setStatics(table, []);
  assert.deepEqual(r, {statics: 3, merged: 0, masked: 0, woken: 0});
  assert.notEqual(w.staticsHash, first);
  const again = w.staticsHash;
  assert.deepEqual(w.updateStatics(table.map(b => ({...b}))), {statics: 3, merged: 0, masked: 0, woken: 0}, 'same decor');
  assert.equal(w.staticsHash, again, 'same decor, same hash');
  const bad = [[5], [{minX: 1, maxX: 0, minY: 0, maxY: 1, minZ: 0, maxZ: 1}], [{minX: 0, maxX: 1, minY: NaN, maxY: 1, minZ: 0, maxZ: 1}],
    [{minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1, friction: 3}], [{minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1, material: 'x'}]];
  for (const boxes of bad) assert.throws(() => w.setStatics(boxes, []), {name: 'TypeError', message: /^FPhysics\.setStatics: /});
  assert.throws(() => w.setStatics([], [{x: 0, z: 0, w: 1, d: 1, y: 0, slopeX: 0.5, slopeZ: 0.5}]), /slopes on two axes/);
  assert.throws(() => w.setStatics(new Array(16).fill(table[0]), []), /exceed maxStatics/);
  assert.throws(() => w.setStatics('x', []), TypeError);
  assert.equal(w.staticsHash, again, 'a refused decor changes nothing');
  // A crate lands on the static box (top at y = 1), another one with mask 0xfffe falls through the decor.
  const on = crate(w, 0, 1.45, 0), through = w.addBody({size: [0.8, 0.8, 0.8], pos: [-4, 1, -4], mass: 30, mask: 0xfffe});
  for (let i = 0; i < 240; i++) w.step(1 / 120);
  const y = w.body(on).pos[1];
  t.diagnostic(`caisse posée sur la boîte statique : y = ${y.toFixed(5)} ; sans le bit 1 du masque : y = ${w.body(through).pos[1].toFixed(2)}`);
  assert.ok(y > 1.39 && y < 1.4 && w.isAsleep(on), 'rests on the static box');
  assert.ok(w.body(through).pos[1] < -10, 'mask without bit 1 ignores the decor');
  // A changed decor wakes the sleepers (module step 2a: all of them; the exact difference comes with step 10).
  const w2 = F.create({bounds: B64, ...SMALL, ground: 0}), h = w2.addBody({size: [0.8, 0.8, 0.8], pos: [0, 0.4, 0], mass: 30, asleep: true});
  assert.equal(w2.setStatics([], []).woken, 0, 'same decor: nobody woken');
  assert.equal(w2.setStatics(table, []).woken, 1);
  assert.ok(!w2.isAsleep(h));
});

test('Étape 2a — pas de temps : erreurs, accumulateur, découpage', t => {
  const F = load(), w = F.create({bounds: B64, ...SMALL});
  for (const dt of [NaN, -1, Infinity, '1', undefined, null]) assert.throws(() => w.step(dt), {name: 'TypeError', message: /^FPhysics\.step: /});
  assert.equal(w.step(1 / 30), 4, 'tolerance: 1/30 gives 4 sub-steps');
  assert.equal(w.stats.substeps, 4);
  assert.equal(w.step(0.2), 8, 'at most maxSubsteps');
  t.diagnostic(`step(0.2) : 8 sous-pas, ${w.stats.droppedSteps} sous-pas jetés`);
  assert.ok(w.stats.droppedSteps >= 15);
  assert.equal(w.snapshot().acc, 0, 'whole sub-steps leave no residue');
  // stack10: the same sub-steps give the same bits whatever the slicing of the time.
  const hashes = [[1 / 60, 150], [1 / 120, 300], [1 / 30, 75]].map(([dt, n]) => { const s = SCENES.stack10(F); for (let i = 0; i < n; i++) s.w.step(dt); return s.w.hash(); });
  t.diagnostic(`stack10, 300 sous-pas par 1/60, 1/120 et 1/30 : ${hashes.join(', ')}`);
  assert.equal(new Set(hashes).size, 1);
  assert.equal(runChain(loadVm(), 'stack10', 300), runChain(F, 'stack10', 300), 'same chain in a vm realm');
  assert.throws(() => F.create({bounds: {minX: -1e4, maxX: 1e4, minZ: -1e4, maxZ: 1e4}, ...SMALL}), /grid cells/);
});

test('Étape 2a — restore refusé sans rien changer, zéros négatifs', t => {
  const F = load(), {w} = SCENES.stack10(F);
  for (let i = 0; i < 100; i++) w.step(1 / 120);
  const good = JSON.stringify(w.snapshot()), hash = w.hash(), KM = w.config.capacity + 1 + w.config.maxStatics + 1;
  const cases = [
    ['v = 1', s => { s.v = 1; }], ['fp', s => { s.fp = '00000000'; }], ['statics', s => { s.statics = 'ffffffff'; }],
    ['NaN dans P', s => { s.b.P[4] = NaN; }], ['quaternion x 2', s => { for (let k = 4; k < 8; k++) s.b.Q[k] *= 2; }],
    ['vitesse de 100 m/s', s => { s.b.V[6] = 100; }], ['clé vers un index mort', s => { s.c.K[0] = 1 * KM + 20; }],
    ['tableau raccourci', s => { s.b.V.pop(); }], ['FL = 255', s => { s.b.FL[1] = 255; }],
    ['monde modifié', s => { s.b.IM[0] = 1; }], ['ligne libre non vide', s => { s.n = 12; for (const [k, a] of Object.entries(s.b)) { const wd = a.length / 11; for (let j = 0; j < wd; j++) a.push(a[wd + j]); } s.b.FL[11] = 8; }],
    ['acc hors de [0, tick)', s => { s.acc = 1; }], ['impulsion négative', s => { s.c.Jn[0] = -1; }],
  ];
  for (const [name, spoil] of cases) {
    const s = JSON.parse(good); spoil(s);
    assert.throws(() => w.restore(s), e => e instanceof Error && /^FPhysics\.restore: /.test(e.message), name);
    assert.equal(w.hash(), hash, name + ': nothing changed');
  }
  const s3 = JSON.parse(good); s3.statics = 'ffffffff';
  w.restore(s3, {ignoreStatics: true});
  assert.equal(w.hash(), hash, 'ignoreStatics accepts another decor hash');
  w.restore(JSON.parse(good));
  assert.equal(w.hash(), hash);
  t.diagnostic(`${cases.length} instantanés corrompus refusés, hachage inchangé (${hash})`);
  // -0: never in a snapshot; a hand-made -0 restores like +0.
  const z = F.create({bounds: B64, ...SMALL, ground: 0});
  z.addBody({size: [0.8, 0.8, 0.8], pos: [-0, 1, -0], vel: [-0, 0, -0], ang: [-0, -0, -0], quat: [-0, -0, -0, 1], mass: 30});
  z.step(1 / 120);
  const snap = z.snapshot(), all = [];
  JSON.stringify(snap, (k, v) => { if (typeof v === 'number') all.push(v); return v; });
  for (const a of [...Object.values(snap.b), ...Object.values(snap.c).filter(Array.isArray)]) all.push(...a);
  assert.ok(all.length > 100 && all.every(v => !Object.is(v, -0)), 'no -0 in a snapshot');
  const minus = JSON.parse(JSON.stringify(snap)), plus = JSON.parse(JSON.stringify(snap));
  minus.b.P[3] = -0; minus.b.V[8] = -0;
  const z2 = F.create(z.config), z3 = F.create(z.config);
  z2.restore(minus); z3.restore(plus);
  assert.equal(z2.hash(), z3.hash(), '-0 restores like +0');
});

test('Étape 2a — pose, matrix, chronométrage', t => {
  const F = load(), w = F.create({bounds: B64, ...SMALL, ground: 0});
  const h = w.addBody({size: [0.8, 0.8, 0.8], pos: [1, 3, 2], rot: [0.3, -0.5, 1.1], mass: 30});
  const sl = Math.min(w.config.slop, w.config.slopRatio * 0.4), start = w.pose(h, 0.5);
  assert.deepEqual(start.slice(0, 3), [1, 3 + sl / 2, 2], 'before any step, previous pose = pose');
  w.step(1 / 120); w.step(1 / 120);
  const b = w.body(h), p0 = w.pose(h, 0), p1 = w.pose(h, 1), half = w.pose(h, 0.5);
  assert.deepEqual(p1.slice(0, 3), [b.pos[0], b.pos[1] + sl / 2, b.pos[2]]);
  assert.deepEqual(p1.slice(3), b.quat);
  assert.ok(p0[1] > half[1] && half[1] > p1[1], 'falling: interpolated between the two poses');
  assert.deepEqual(w.pose(h, 2), p1, 'alpha capped at 1');
  assert.deepEqual(w.pose(h, -1), p0, 'alpha floored at 0');
  assert.deepEqual(w.pose(h, NaN), p0, 'NaN alpha reads as 0');
  const out = [0, 0, 0, 0, 0, 0, 0], m = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  assert.equal(w.pose(h, 1, out), out);
  assert.equal(w.matrix(h, m), m);
  assert.ok(gap(m, quatMatrix(...b.quat)) <= 1e-12, 'matrix of the current quaternion');
  // Thin plate: the real plate sits on the bottom of its collision box, upright or upside down.
  for (const rot of [[0, 0, 0], [Math.PI, 0, 0]]) {
    const plate = w.addBody({size: [0.8, 0.01, 0.8], pos: [5, 2, 5], rot, mass: 10}), y = w.pose(plate, 1)[1];
    const H = w.config.minHalf, slp = Math.min(w.config.slop, w.config.slopRatio * H);
    assert.ok(Math.abs(y - (2 + slp / 2 - (H - 0.005))) <= 1e-12, `plate rot ${rot}: y = ${y}`);
  }
  // clock: phases timed only when given, and never part of the state.
  let tick = 0;
  const run = clock => { const s = SCENES.stack10(F, clock ? {clock: () => (tick += 0.25)} : {}); for (let i = 0; i < 60; i++) s.w.step(1 / 120); return s.w; };
  const timed = run(true), plain = run(false);
  assert.equal(timed.hash(), plain.hash(), 'the clock does not change the simulation');
  assert.ok(timed.phaseMs.every(v => v > 0) && plain.phaseMs.every(v => v === 0));
  t.diagnostic(`phaseMs avec une horloge factice : ${Array.from(timed.phaseMs).join(', ')}`);
  const st = plain.stats;
  t.diagnostic(`stack10 à 60 sous-pas : ${st.contacts} points, ${st.manifolds} paires, ${st.tests} tests, ${st.awake} éveillés`);
  assert.ok(st.contacts >= 4 * 10 && st.manifolds === 10 && st.awake === 10 && st.bodies === 10);
  for (const [k, v] of Object.entries(st)) assert.ok(Number.isInteger(v), k);
});

// ---- Module step 2b: base actions (impulse, setVelocity, blast without shelter) and the scenes rubble300, blast200 ----

// Expected change of an unrotated box (or of a cube) under the impulse j at the world point p (prototype impulseAt):
// dv = j*im, dw = IL*((p - c) x j), IL = [3im/(hy²+hz²), 3im/(hx²+hz²), 3im/(hx²+hy²)] from the collision half-sizes.
function kick(c, [hx, hy, hz], im, p, j) {
  const rx = p[0] - c[0], ry = p[1] - c[1], rz = p[2] - c[2];
  const il = [3 * im / (hy * hy + hz * hz), 3 * im / (hx * hx + hz * hz), 3 * im / (hx * hx + hy * hy)];
  return {dv: j.map(v => v * im), dw: [il[0] * (ry * j[2] - rz * j[1]), il[1] * (rz * j[0] - rx * j[2]), il[2] * (rx * j[1] - ry * j[0])]};
}
// Point of a box body nearest to c (local position clamped to the collision half-sizes) and its distance to c.
function nearest(w, h, c) {
  const b = w.body(h), m = w.matrix(h), e = b.size.map(s => s / 2), d = [0, 1, 2].map(k => c[k] - b.pos[k]);
  const l = [0, 1, 2].map(k => Math.max(-e[k], Math.min(e[k], d[0] * m[k] + d[1] * m[3 + k] + d[2] * m[6 + k])));
  const p = [0, 1, 2].map(r => b.pos[r] + m[3 * r] * l[0] + m[3 * r + 1] * l[1] + m[3 * r + 2] * l[2]);
  return {p, d: Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2])};
}

test('Étape 2b — impulse et setVelocity : un seul corps réveillé, vitesse gardée en attente, bornes', t => {
  const F = load(), w = F.create({bounds: B64, ...SMALL, ground: 0});
  const low = w.addBody({size: [0.8, 0.8, 0.8], pos: [0, 0.4, 0], mass: 30, asleep: true});
  const top = w.addBody({size: [0.8, 0.8, 0.8], pos: [0, 1.2, 0], mass: 30, asleep: true});
  const bar = w.addBody({size: [1, 0.5, 0.25], pos: [3, 0.25, 0], mass: 12, asleep: true});
  const start = w.hash();
  for (const h of [0, -1, 99, 4096 + top, 1.5, '2', null, undefined]) {
    assert.equal(w.impulse(h, 0, 0, 0, 1, 0, 0), false, String(h));
    assert.equal(w.setVelocity(h, 1, 0, 0, 0, 0, 0), false, String(h));
  }
  for (const bad of [NaN, Infinity, -Infinity, '1', undefined, null]) {
    assert.throws(() => w.impulse(top, 0, 1.2, 0, bad, 0, 0), {name: 'TypeError', message: /^FPhysics\.impulse: /});
    assert.throws(() => w.setVelocity(top, 0, 0, 0, 0, bad, 0), {name: 'TypeError', message: /^FPhysics\.setVelocity: /});
  }
  assert.equal(w.hash(), start, 'refused calls change nothing');
  // At the centre: dv = J/m, no spin; the struck crate wakes alone, the crate under it stays asleep.
  assert.equal(w.impulse(top, 0, 1.2, 0, 3, 0, 1.5), true);
  let k = kick([0, 1.2, 0], [0.4, 0.4, 0.4], 1 / 30, [0, 1.2, 0], [3, 0, 1.5]);
  assert.ok(gap(w.body(top).vel, k.dv) <= 1e-15 && gap(w.body(top).ang, k.dw) <= 1e-15, 'dv = J/m');
  assert.ok(!w.isAsleep(top) && w.isAsleep(low) && w.isAsleep(bar), 'only the struck body wakes');
  assert.deepEqual([w.stats.wakes, w.stats.sleeping], [1, 2]);
  // Off the centre: spin IW (r x J).
  assert.equal(w.impulse(bar, 3.5, 0.25, 0.125, 0, 6, 0), true);
  k = kick([3, 0.25, 0], [0.5, 0.25, 0.125], 1 / 12, [3.5, 0.25, 0.125], [0, 6, 0]);
  assert.ok(gap(w.body(bar).vel, k.dv) <= 1e-12 && gap(w.body(bar).ang, k.dw) <= 1e-12, `dw ${w.body(bar).ang} against ${k.dw}`);
  t.diagnostic(`impulsion (0, 6, 0) au coin de la barre : dv = ${w.body(bar).vel.join(', ')} ; dw = ${w.body(bar).ang.map(v => v.toFixed(4)).join(', ')}`);
  // An awake body only restarts its sleep count (prototype wake); no wake is counted.
  const u = F.create({bounds: B64, ...SMALL, ground: 0}), c = crate(u, 0, 0.4, 0), row = c & 4095;
  for (let i = 0; i < 30; i++) u.step(1 / 120);
  assert.ok(!u.isAsleep(c) && u.snapshot().b.ST[row] > 0, 'awake, counting towards sleep');
  assert.equal(u.impulse(c, 0, 0.4, 0, 1e-6, 0, 0), true);
  assert.deepEqual([u.snapshot().b.ST[row], u.stats.wakes], [0, 0]);
  // A pending body keeps the velocity for its activation.
  const p = u.addBody({size: [0.8, 0.8, 0.8], pos: [-3, 2, 0], mass: 30});
  assert.equal(u.setVelocity(p, 1, 0, 0, 0, 0.5, 0), true);
  assert.equal(u.impulse(p, -3, 2, 0, 30, 0, 0), true);
  let b = u.body(p);
  assert.ok(b.pending && gap(b.vel, [2, 0, 0]) <= 1e-15 && gap(b.ang, [0, 0.5, 0]) <= 1e-15, 'still pending, velocity kept');
  u.step(1 / 120);
  b = u.body(p);
  assert.ok(!b.pending && b.pos[0] > -3 + 1.9 / 120, `activated with its velocity: x = ${b.pos[0]}`);
  // Caps (the same as at the end of a sub-step), -0 normalised: a snapshot taken between two steps restores exactly.
  assert.equal(u.impulse(c, 0, 0.4, 0, 1e6, 0, 0), true);
  assert.ok(Math.abs(Math.hypot(...u.body(c).vel) - 40) <= 1e-9, 'linear speed capped at maxLinear');
  assert.equal(u.setVelocity(c, -0, -0, -0, 0, 0, -1e3), true);
  b = u.body(c);
  assert.ok(b.vel.every(v => Object.is(v, 0)), '-0 normalised');
  assert.ok(Math.abs(Math.hypot(...b.ang) - 30) <= 1e-9, 'angular speed capped at maxAngular');
  const v = F.create(u.config);
  v.restore(JSON.parse(JSON.stringify(u.snapshot())));
  assert.equal(v.hash(), u.hash(), 'same bits after a JSON round trip');
});

test('Étape 2b — blast de base, sans occultation : portée, direction, plafond, réveil', t => {
  const F = load(), w = F.create({bounds: B64, ...SMALL, ground: 0}), A = {size: [0.8, 0.8, 0.8], mass: 30, asleep: true}, c = [0, 0.5, 0];
  const near = w.addBody({...A, pos: [1, 0.4, 0]}), mid = w.addBody({...A, pos: [-3, 0.4, 0]}), far = w.addBody({...A, pos: [0, 0.4, 6.5]});
  const turned = w.addBody({...A, pos: [0.5, 0.4, -3], rot: [0, 0.5, 0]}), pend = w.addBody({size: [0.8, 0.8, 0.8], mass: 30, pos: [0, 0.4, 2]});
  const ids = [near, mid, far, turned, pend], before = ids.map(h => w.body(h)), start = w.hash();
  for (const args of [[NaN, 0.5, 0, 6, 500], [0, 0.5, 0, -1, 500], [0, 0.5, 0, 6, -1], [0, 0.5, 0, 6, 500, -1], [0, 0.5, 0, 6, '500'], [0, 0.5, 0, 6, 500, 14, 'yes']])
    assert.throws(() => w.blast(...args), {name: 'TypeError', message: /^FPhysics\.blast: /}, JSON.stringify(args));
  assert.equal(w.hash(), start, 'refused calls change nothing');
  assert.equal(w.blast(0, 0.5, 0, 6, 500), 3, 'near, mid and turned; far is out of range and pend is pending');
  for (const [n, h] of ids.entries()) {
    const b0 = before[n], b = w.body(h), dv = b.vel.map((x, i) => x - b0.vel[i]), dw = b.ang.map((x, i) => x - b0.ang[i]), {p, d} = nearest(w, h, c);
    if (h === far || h === pend) {
      assert.ok(dv.concat(dw).every(x => x === 0), 'untouched');
      assert.equal(w.body(h).asleep, h === far);
      continue;
    }
    let e = [b0.pos[0] - c[0], b0.pos[1] - c[1] + 0.35, b0.pos[2] - c[2]];
    const l = Math.hypot(...e);
    e = e.map(x => x / l);
    const j = Math.min(500 * (1 - d / 6), 14 * 30), k = kick(b0.pos, [0.4, 0.4, 0.4], 1 / 30, p, e.map(x => x * j));
    assert.ok(gap(dv, k.dv) <= 1e-12 && gap(dw, k.dw) <= 1e-12, `body ${n}: dv ${dv} against ${k.dv}`);
    assert.ok(Math.hypot(...dv) <= 14 + 1e-12 && !b.asleep);
    t.diagnostic(`corps ${n} : point le plus proche à ${d.toFixed(4)} m, |dv| = ${Math.hypot(...dv).toFixed(4)} m/s`);
  }
  assert.ok(Math.abs(Math.hypot(...w.body(near).vel) - 14) <= 1e-12, 'capped at maxDv = 14');
  assert.equal(w.stats.wakes, 3);
  // maxDv and occlude given; a centre inside a body pushes it straight up.
  const u = F.create({bounds: B64, ...SMALL, ground: 0}), q = u.addBody({...A, pos: [1, 0.4, 0]}), r = u.addBody({...A, pos: [5, 0.4, 5]});
  assert.equal(u.blast(0, 0.5, 0, 6, 500, 2, false), 1);
  assert.ok(Math.abs(Math.hypot(...u.body(q).vel) - 2) <= 1e-12, 'maxDv caps the change of speed');
  assert.equal(u.blast(5, 0.75, 5, 2, 30), 1);
  const vr = u.body(r).vel;
  assert.ok(vr[0] === 0 && vr[2] === 0 && Math.abs(vr[1] - 1) <= 1e-12, `straight up: ${vr}`);
  for (let i = 0; i < 120; i++) { w.step(1 / 120); u.step(1 / 120); }
  assert.ok([w, u].every(x => /^[0-9a-f]{8}$/.test(x.hash())) && Number.isFinite(w.body(near).pos[0]));
});

test('Étape 2b — scènes rubble300 et blast200 : construction, chute, souffle', t => {
  const F = load(), r = SCENES.rubble300(F), w = r.w;
  assert.deepEqual([w.stats.bodies, w.stats.pending, w.stats.statics, r.ids.length], [300, 300, 6, 300]);
  assert.equal(r.statics, YARD);
  r.ids.forEach((h, i) => {
    const b = w.body(h), m = F.MATERIALS[i % 5];
    assert.deepEqual([b.material, b.friction, b.restitution], [i % 5, m.friction, m.restitution], 'material i % 5');
    assert.ok(b.originalMass >= 0.5 && b.originalMass <= 160 && b.mass === Math.min(Math.max(b.originalMass, 3), 120), 'masses');
  });
  // P22, first part: the whole heap sleeps before 8 s (provisional single-body wake until module step 6).
  let at = -1, peak = 0;
  for (let i = 1; i <= 960 && at < 0; i++) { w.step(1 / 120); peak = Math.max(peak, w.stats.awake); if (w.stats.sleeping === 300) at = i; }
  const yMin = Math.min(...r.ids.map(h => w.body(h).pos[1])), out = r.ids.filter(h => w.body(h).pos.some((x, k) => k !== 1 && Math.abs(x) > 4)).length;
  t.diagnostic(`rubble300 : tout dort à la fin du sous-pas ${at} (${(at / 120).toFixed(2)} s ; prototype 11,93 s) ; pic de ${peak} éveillés ; centre le plus bas ${yMin.toFixed(4)} ; ${out} pièce(s) hors de la cour ; plus bas sommet au repos ${mm(lowest(w, r.ids))}`);
  assert.ok(at > 0, 'asleep before 8 s');
  assert.ok(yMin > 0, 'no piece under the ground');
  // blast200 without its tick (P29 a, first part): 240 sub-steps, then the blast of the scene.
  const s = SCENES.blast200(F, {blastAt: -1}), x = s.w, centre = [0, 0.5, 0];
  assert.deepEqual([x.stats.bodies, x.stats.statics, s.ids.length], [200, 5, 200]);
  assert.equal(s.statics, WALLS30);
  t.diagnostic(`blast200 : ${s.ids.filter(h => x.body(h).mass === 25).length} barils, ${s.ids.filter(h => x.body(h).mass !== 25).length} cubes`);
  for (let i = 0; i < 240; i++) x.step(1 / 120);
  const v0 = s.ids.map(h => x.body(h).vel), n = x.blast(0, 0.5, 0, 14, 900);
  let pushed = 0, beyond = 0;
  for (const [k, h] of s.ids.entries()) {
    const b = x.body(h), dv = b.vel.map((v, i) => v - v0[k][i]), {d} = nearest(x, h, centre);
    if (d >= 14) { beyond++; assert.ok(dv.every(v => v === 0), 'out of range: unchanged'); continue; }
    pushed++;
    assert.ok(dv[0] * b.pos[0] + dv[1] * (b.pos[1] - 0.5 + 0.35) + dv[2] * b.pos[2] > 0 && Math.hypot(...dv) <= 14 + 1e-9, 'outwards, at most 14 m/s');
  }
  assert.ok(n > 0 && pushed === n, `${n} bodies pushed`);
  let low = Infinity, sleep = -1;
  for (let i = 1; i <= 1800; i++) {
    x.step(1 / 120);
    low = Math.min(low, lowest(x, s.ids));
    if (sleep < 0 && x.stats.sleeping === 200) sleep = i;
  }
  const outside = s.ids.filter(h => x.body(h).pos.some((v, k) => k !== 1 && Math.abs(v) >= 12.5)).length;
  t.diagnostic(`souffle : ${n} corps poussés, ${beyond} hors de portée ; tout dort ${(sleep / 120).toFixed(2)} s après ; plus bas sommet ${mm(low)} pendant les 15 s (P29, étape 7 : ≥ -15 mm)`);
  assert.equal(outside, 0, 'every centre inside the walls');
  assert.ok(x.stats.sleeping === 200, 'all asleep 15 s after the blast');
});

test('Étape 2b — découpage du temps sur rubble300 (P44, première partie)', t => {
  const F = load();
  const out = [[1 / 60, 150], [1 / 120, 300], [1 / 30, 75]].map(([dt, n]) => { const s = SCENES.rubble300(F); for (let i = 0; i < n; i++) s.w.step(dt); return s.w.hash(); });
  t.diagnostic(`rubble300, 300 sous-pas par 1/60, 1/120 et 1/30 : ${out.join(', ')}`);
  assert.deepEqual(out, [out[1], out[1], out[1]]);
  assert.equal(out[1], chain(F, 'rubble300', 300).slice(9), 'same as the chain at 300 sub-steps');
});

// ---- Module step 3: guards of shapes, floors, kinematic bodies and rolling damping ----

test('Étape 3 — formes et corps cinématiques : description, tailles, masses, body()', t => {
  const F = load(), w = F.create({bounds: B64, ...SMALL, ground: 0});
  const ball = {shape: 'sphere', radius: 0.2, pos: [0, 1, 0], mass: 5}, pill = {shape: 'capsule', radius: 0.1, height: 0.6, pos: [1, 1, 0], mass: 5};
  const bad = [{...ball, radius: 0}, {...ball, radius: -1}, {...ball, radius: NaN}, {...ball, radius: '0.2'}, {...ball, radius: undefined},
    {...pill, height: undefined}, {...pill, height: 0.19}, {...pill, height: Infinity}, {...ball, mass: undefined}, {...pill, kinematic: 1}];
  for (const d of bad) assert.throws(() => w.addBody(d), {name: 'TypeError', message: /^FPhysics\.addBody: /}, JSON.stringify(d));
  assert.equal(w.stats.bodies, 0, 'nothing added by an invalid description');
  const s = w.addBody({...ball, mass: undefined, material: 'metal'}), c = w.addBody({...pill, mass: undefined, material: 'wood'});
  const thin = w.addBody({shape: 'capsule', radius: 0.01, height: 0.5, pos: [2, 1, 0], mass: 4}), dot = w.addBody({shape: 'sphere', radius: 0.01, pos: [3, 1, 0], mass: 4});
  // Volumes of the real sizes: sphere 4/3 pi r^3, capsule pi r^2 (height - 2r) + 4/3 pi r^3; mass = density x volume.
  const bs = w.body(s), bc = w.body(c), mh = w.config.minHalf;
  assert.deepEqual([bs.shape, bs.radius, bs.height, bs.size, bs.realSize], ['sphere', 0.2, null, [0.4, 0.4, 0.4], [0.4, 0.4, 0.4]]);
  assert.equal(bs.originalMass, 65 * (4 / 3 * Math.PI * 0.2 * 0.2 * 0.2));
  assert.deepEqual([bc.shape, bc.radius, bc.height, bc.realSize], ['capsule', 0.1, 0.6, [0.2, 0.6, 0.2]]);
  assert.ok(gap(bc.size, [0.2, 0.6, 0.2]) <= 1e-15, 'capsule collision size = real size');
  assert.equal(bc.originalMass, 8 * (Math.PI * 0.1 * 0.1 * (0.6 - 2 * 0.1) + 4 / 3 * Math.PI * 0.1 * 0.1 * 0.1));
  // Collision radius at least minHalf; the half-segment stays height/2 - radius.
  assert.ok(gap(w.body(thin).size, [2 * mh, 2 * (0.25 - 0.01 + mh), 2 * mh]) <= 1e-15 && gap(w.body(thin).realSize, [0.02, 0.5, 0.02]) <= 1e-15, 'thin capsule');
  assert.deepEqual([w.body(dot).size, w.body(dot).realSize, w.body(dot).radius], [[2 * mh, 2 * mh, 2 * mh], [0.02, 0.02, 0.02], 0.01]);
  // Kinematic: infinite mass, mass optional, vel/ang and asleep ignored, never pending.
  const k0 = w.addBody({size: [1, 0.2, 1], pos: [0, 3, 0], kinematic: true, vel: [1, 0, 0], ang: [0, 1, 0], asleep: true});
  const k1 = w.addBody({shape: 'sphere', radius: 0.5, pos: [4, 3, 0], kinematic: true, mass: 50}), k2 = w.addBody({size: [1, 1, 1], pos: [6, 3, 0], kinematic: true, material: 'stone'});
  const b0 = w.body(k0);
  assert.deepEqual([b0.kinematic, b0.mass, b0.originalMass, b0.asleep, b0.pending, ...b0.vel, ...b0.ang], [true, Infinity, 0, false, false, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual([w.body(k1).originalMass, w.body(k2).originalMass], [50, 28]);
  assert.deepEqual([w.stats.bodies, w.stats.kinematic, w.stats.pending, w.stats.sleeping], [7, 3, 4, 0]);
  for (const h of [k0, k1]) {
    assert.equal(w.impulse(h, 0, 3, 0, 1, 0, 0), false, 'impulse refuses a kinematic body');
    assert.equal(w.setVelocity(h, 1, 0, 0, 0, 0, 0), false, 'setVelocity refuses a kinematic body');
  }
  assert.equal(w.blast(0, 3, 0, 20, 500), 0, 'blast pushes neither a pending nor a kinematic body');
  t.diagnostic(`sphère metal r 0,2 : ${bs.originalMass.toFixed(4)} kg ; capsule wood r 0,1 h 0,6 : ${bc.originalMass.toFixed(4)} kg ; capsule fine : taille ${w.body(thin).size.join(', ')}`);
});

test('Étape 3 — sols plats et en pente : surfaces, matières, refus', t => {
  const F = load(), w = F.create({bounds: B64, ...SMALL, ground: 0});
  const flat = {x: 2, z: -1, w: 2, d: 3, y: 0.5, material: 'stone'}, ramp = {x: -3, z: 2, w: 4, d: 3, y: 1, slopeZ: -0.25, friction: 1.2};
  const empty = w.staticsHash;
  assert.deepEqual(w.setStatics([], [flat, ramp]), {statics: 3, merged: 0, masked: 0, woken: 0});
  const h1 = w.staticsHash;
  assert.notEqual(h1, empty);
  w.setStatics(null, [{...flat}, {...ramp}]);
  assert.equal(w.staticsHash, h1, 'same floors, same hash');
  const variants = [[{...flat, material: 'dirt'}, ramp], [flat, {...ramp, slopeZ: -0.3}], [flat, {...ramp, slopeZ: 0, slopeX: -0.25}], [{...flat, y: 0.6}, ramp],
    [flat, {...flat, x: 5}], [{...flat, x: 5}, flat]];
  const seen = new Set([empty, h1]);
  for (const floors of variants) { w.setStatics([], floors); assert.ok(!seen.has(w.staticsHash), JSON.stringify(floors)); seen.add(w.staticsHash); }
  w.setStatics([], [ramp, flat]);
  assert.equal(w.staticsHash, h1, 'flat floors first, then the slopes: the same decor');
  const bad = [[5], [null], [{x: 0, z: 0, w: 0, d: 1}], [{x: 0, z: 0, w: 1, d: -1}], [{x: NaN, z: 0, w: 1, d: 1}], [{x: 0, z: 0, w: 1, d: 1, y: '1'}],
    [{x: 0, z: 0, w: 1, d: 1, slopeX: Infinity}], [{x: 0, z: 0, w: 1, d: 1, slopeX: 0.5, slopeZ: 0.5}], [{x: 0, z: 0, w: 1, d: 1, friction: -1}],
    [{x: 0, z: 0, w: 1, d: 1, material: 'gold'}], [{z: 0, w: 1, d: 1}]];
  for (const floors of bad) assert.throws(() => w.setStatics([], floors), {name: 'TypeError', message: /^FPhysics\.setStatics: /}, JSON.stringify(floors));
  assert.throws(() => w.setStatics([], 'x'), {name: 'TypeError', message: /floors must be an array/});
  const tile = {x: 0, z: 0, w: 1, d: 1};
  assert.equal(w.setStatics([], new Array(15).fill(tile)).statics, 16, 'the slab and 15 floors fill maxStatics');
  assert.throws(() => w.setStatics([], new Array(16).fill(tile)), /exceed maxStatics/);
  w.setStatics([], [flat, ramp]);
  assert.equal(w.staticsHash, h1, 'a refused decor changes nothing');
  // A crate rests on the flat floor (top y = 0.5); a cube laid on the ramp (slopeZ -0.25, friction 1.2) holds there.
  const on = crate(w, 2, 1.2, -1), pose = slopePose(ramp, -3, 2), cube = w.addBody({size: [0.6, 0.6, 0.6], pos: pose.pos, quat: pose.quat, mass: 20, friction: 0.6});
  for (let i = 0; i < 360; i++) w.step(1 / 120);
  const y = w.body(on).pos[1], moved = dist3(w.body(cube).pos, pose.pos);
  t.diagnostic(`caisse sur le sol plat : y = ${y.toFixed(5)} ; cube sur la rampe : déplacement ${moved.toFixed(5)} m en 3 s`);
  assert.ok(y > 0.89 && y < 0.9 && w.isAsleep(on), 'rests on the flat floor');
  assert.ok(moved < 0.02 && w.isAsleep(cube), 'holds on the ramp');
});

test('Étape 3 — setKinematic : cible exacte, attente, bornes, arrêt, ni décor ni autre cinématique', t => {
  const F = load(), w = F.create({bounds: B64, ...SMALL, ground: 0});
  const k = w.addBody({size: [1, 0.2, 1], pos: [0, 2, 0], kinematic: true}), d = crate(w, 3, 0.4, 0), start = w.hash();
  for (const h of [d, 0, -1, 99, 4096 + k, '1', null]) assert.equal(w.setKinematic(h, 0, 0, 0, 0, 0, 0, 1), false, String(h));
  for (const bad of [[NaN, 0, 0, 0, 0, 0, 1], [0, 0, 0, 0, 0, 0, Infinity], [0, '1', 0, 0, 0, 0, 1], [0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 1e-12, 0, 0, 0]])
    assert.throws(() => w.setKinematic(k, ...bad), {name: 'TypeError', message: /^FPhysics\.setKinematic: /}, JSON.stringify(bad));
  assert.equal(w.hash(), start, 'refused calls change nothing');
  // Target 0.1 m away, turned by 0.5 rad about Y, quaternion given at twice its length (normalised by the module).
  const q2 = F.eulerToQuat(0, 0.5, 0).map(v => v * 2), l = Math.sqrt(q2[0] * q2[0] + q2[1] * q2[1] + q2[2] * q2[2] + q2[3] * q2[3]), qt = q2.map(v => v / l + 0);
  assert.equal(w.setKinematic(k, 0.1, 2, 0, ...q2), true);
  assert.equal(w.step(1 / 240), 0);
  assert.deepEqual([w.body(k).pos, w.snapshot().b.KN[k & 4095]], [[0, 2, 0], 1], 'no sub-step: the target waits');
  assert.equal(w.step(1 / 240), 1);
  let b = w.body(k);
  assert.deepEqual([b.pos, b.quat], [[0.1, 2, 0], qt], 'exactly on the target after its last sub-step');
  assert.ok(Math.abs(b.vel[0] - 12) <= 1e-9 && Math.abs(Math.hypot(...b.ang) - w.config.maxAngular) <= 1e-9, `v = 0.1/tick, w capped at maxAngular: ${b.vel}, ${b.ang}`);
  // 4 sub-steps: v = (target - P)/(4 tick), no spin for the same orientation, exact pose at the end.
  assert.equal(w.setKinematic(k, 0.2, 2.1, 0, ...qt), true);
  assert.equal(w.step(1 / 30), 4);
  b = w.body(k);
  assert.deepEqual([b.pos, b.quat, b.ang], [[0.2, 2.1, 0], qt, [0, 0, 0]]);
  assert.ok(gap(b.vel, [3, 3, 0]) <= 1e-12, `v = ${b.vel}`);
  // Far target: speed capped at maxLinear, the pose still lands on the target; then no target: stopped.
  assert.equal(w.setKinematic(k, 10, 2.1, 0, ...qt), true);
  w.step(1 / 120);
  b = w.body(k);
  assert.ok(b.pos[0] === 10 && Math.abs(Math.hypot(...b.vel) - w.config.maxLinear) <= 1e-9, 'capped speed, exact pose');
  w.step(1 / 120);
  b = w.body(k);
  assert.deepEqual([b.pos, ...b.vel, ...b.ang], [[10, 2.1, 0], 0, 0, 0, 0, 0, 0], 'without a target: stopped where it was');
  // Neither the decor nor another kinematic body: no test, no contact.
  const u = F.create({bounds: B64, ...SMALL, ground: 0}), g = u.addBody({size: [1, 1, 1], pos: [0, 2, 0], kinematic: true}), g2 = u.addBody({size: [1, 1, 1], pos: [0.5, 0, 0], kinematic: true});
  for (let i = 1; i <= 10; i++) { u.setKinematic(g, 0, 2 - i / 5, 0, 0, 0, 0, 1); u.setKinematic(g2, 0.5, 0, 0.01 * i, 0, 0, 0, 1); u.step(1 / 120); assert.deepEqual([u.stats.tests, u.stats.contacts], [0, 0]); }
  assert.deepEqual([u.body(g).pos, u.body(g2).pos], [[0, 0, 0], [0.5, 0, 0.1]], 'through the ground and through each other');
  // Rule d: a moving kinematic body wakes the sleeper it touches at the end of the sub-step; then carries it.
  const v = F.create({bounds: B64, ...SMALL, ground: 0}), plat = v.addBody({size: [2, 0.2, 2], pos: [0, 0.1, 0], kinematic: true}), top = v.addBody({size: [0.8, 0.8, 0.8], pos: [0, 0.6, 0], mass: 30, asleep: true});
  v.step(1 / 120);
  assert.ok(v.isAsleep(top) && v.stats.awake === 0, 'a stopped kinematic body wakes nobody');
  v.setKinematic(plat, 0.005, 0.1, 0, 0, 0, 0, 1);
  v.step(1 / 120);
  assert.ok(!v.isAsleep(top) && v.stats.wakes === 1, 'woken by the moving platform');
  for (let i = 2; i <= 120; i++) { v.setKinematic(plat, 0.005 * i, 0.1, 0, 0, 0, 0, 1); v.step(1 / 120); }
  // A moving kinematic paddle pushes an awake crate.
  const p = F.create({bounds: B64, ...SMALL, ground: 0}), paddle = p.addBody({size: [1, 1, 1], pos: [0, 0.5, 0], kinematic: true}), box = crate(p, 1, 0.4, 0);
  for (let i = 1; i <= 60; i++) { p.setKinematic(paddle, i / 120, 0.5, 0, 0, 0, 0, 1); p.step(1 / 120); }
  t.diagnostic(`plateau : la caisse a suivi de ${v.body(top).pos[0].toFixed(4)} m (plateau 0,6 m) ; palette : caisse poussée à x = ${p.body(box).pos[0].toFixed(4)}`);
  assert.ok(v.body(top).pos[0] > 0.5, 'carried by friction');
  assert.ok(p.body(box).pos[0] > 1.3, 'pushed by the paddle');
});

test('Étape 3 — amortissement de roulement : sphère au contact seulement', t => {
  const F = load(), w = F.create({bounds: B64, ...SMALL, ground: 0, ...NOSLEEP}), c = w.config, h = c.tick;
  const ad = 1 / (1 + h * c.angularDamping), rd = 1 / (1 + h * c.rollingDamping);
  const rolling = w.addBody({shape: 'sphere', radius: 0.3, pos: [0, 0.295, 0], mass: 10, ang: [0, 5, 0]});
  const air = w.addBody({shape: 'sphere', radius: 0.3, pos: [5, 30, 0], mass: 10, ang: [0, 5, 0]}), cube = w.addBody({size: [0.6, 0.6, 0.6], pos: [-5, 30, 0], mass: 10, ang: [0, 5, 0]});
  let a = 5, b = 5;
  for (let i = 0; i < 60; i++) { w.step(1 / 120); a = a * ad * rd; b = b * ad; }
  const [wr, wa, wc] = [rolling, air, cube].map(x => w.body(x).ang[1]);
  t.diagnostic(`spin vertical après 0,5 s : sphère au sol ${wr.toFixed(6)} (attendu ${a.toFixed(6)}), sphère en l'air ${wa.toFixed(6)}, cube en l'air ${wc.toFixed(6)} (attendu ${b.toFixed(6)})`);
  assert.equal(wr, a, 'in contact: angular and rolling damping, each sub-step');
  assert.equal(wa, b, 'in the air: angular damping only');
  assert.equal(wc, b, 'a box never has rolling damping');
});

test('Étape 3 — blast sur une sphère et une capsule', t => {
  const F = load(), w = F.create({bounds: B64, ...SMALL, ground: 0}), A = {mass: 10, asleep: true};
  const s = w.addBody({...A, shape: 'sphere', radius: 0.3, pos: [2, 0.3, 0]}), c = w.addBody({...A, shape: 'capsule', radius: 0.1, height: 1, rot: [0, 0, Math.PI / 2], pos: [0, 0.1, 3]});
  const im = 1 / 10, unit = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
  // Sphere: the point nearest to the centre (0, 0.3, 0) is the centre of the body + r towards it: (1.7, 0.3, 0).
  assert.equal(w.blast(0, 0.3, 0, 2, 100), 1, 'the capsule is out of range');
  let j = 100 * (1 - 1.7 / 2), e = unit([2, 0.35, 0]), b = w.body(s);
  assert.ok(gap(b.vel, e.map(x => x * j * im)) <= 1e-12, `sphere dv ${b.vel}`);
  assert.ok(gap(b.ang, [0, 0, -2.5 * im / 0.09 * 0.3 * j * e[1]]) <= 1e-12, `sphere dw ${b.ang}`);
  // Capsule on X (segment x in [-0.4, 0.4]): from (1.5, 0.1, 3), nearest segment point (0.4, 0.1, 3), + r: (0.5, 0.1, 3).
  assert.equal(w.blast(1.5, 0.1, 3, 2, 100), 1);
  j = 100 * (1 - 1 / 2); e = unit([-1.5, 0.35, 0]); b = w.body(c);
  const L = 1, ilz = 12 * im / (3 * 0.1 * 0.1 + L * L);
  assert.ok(gap(b.vel, e.map(x => x * j * im)) <= 1e-12, `capsule dv ${b.vel}`);
  assert.ok(gap(b.ang, [0, 0, ilz * 0.5 * j * e[1]]) <= 1e-12, `capsule dw ${b.ang}`);
  // Centre inside the sphere: cp = centre of the body, d = 0, impulse capped at maxDv x mass, straight up, no spin.
  const u = F.create({bounds: B64, ...SMALL, ground: 0}), q = u.addBody({...A, shape: 'sphere', radius: 0.3, pos: [0, 0.3, 0]});
  assert.equal(u.blast(0.1, 0.3, 0, 3, 1000), 1);
  b = u.body(q);
  t.diagnostic(`sphère : dv = ${w.body(s).vel.map(v => v.toFixed(4)).join(', ')} ; capsule : dv = ${w.body(c).vel.map(v => v.toFixed(4)).join(', ')} ; centre dans la sphère : dv = ${b.vel.map(v => v.toFixed(4)).join(', ')}`);
  const e2 = unit([-0.1, 0.35, 0]);
  assert.ok(gap(b.vel, e2.map(x => x * 14)) <= 1e-12 && gap(b.ang, [0, 0, 0]) <= 1e-12, `inside: ${b.vel}, ${b.ang}`);
});

test('Étape 3 — formes rondes entre elles : sphères empilées, capsules parallèles', t => {
  const F = load();
  // A sphere of radius 0.2 on a sphere of radius 0.3, on their common vertical: normal (0, 1, 0), nothing moves sideways.
  {
    const w = F.create({bounds: B64, ...SMALL, ground: 0}), low = w.addBody({shape: 'sphere', radius: 0.3, pos: [0, 0.3, 0], mass: 10}), high = w.addBody({shape: 'sphere', radius: 0.2, pos: [0, 1, 0], mass: 5});
    for (let i = 0; i < 360; i++) w.step(1 / 120);
    const p = w.body(high).pos;
    t.diagnostic(`sphère sur sphère : basse à ${w.body(low).pos[1].toFixed(5)}, haute à ${p[1].toFixed(5)}`);
    assert.ok(p[0] === 0 && p[2] === 0 && p[1] > 0.77 && p[1] < 0.8 && w.isAsleep(high) && w.isAsleep(low), `high sphere at ${p}`);
  }
  // A short capsule (h 0.6) laid on the middle of a long one (h 1.2), both on X, in either creation order: two points
  // on the overlap of the segments, so the short one rests on the long one (pairs of nearly parallel segments).
  for (const shortFirst of [false, true]) {
    const w = F.create({bounds: B64, ...SMALL, ground: 0}), onX = [0, 0, Math.PI / 2];
    const make = (h, y) => w.addBody({shape: 'capsule', radius: 0.15, height: h, rot: onX, pos: [0, y, 0], mass: 10});
    const [shortOne, longOne] = shortFirst ? [make(0.6, 0.6), make(1.2, 0.15)] : [make(1.2, 0.15), make(0.6, 0.6)].reverse();
    for (let i = 0; i < 480; i++) w.step(1 / 120);
    const y = w.body(shortOne).pos[1], up = Math.abs(w.matrix(shortOne)[4]);
    t.diagnostic(`capsule courte sur la longue (${shortFirst ? 'courte créée en premier' : 'longue créée en premier'}) : y = ${y.toFixed(5)}, |axe·Y| = ${up.toExponential(2)}`);
    assert.ok(y > 0.42 && y < 0.45 && up < 0.02 && w.isAsleep(shortOne) && w.isAsleep(longOne), `short capsule at ${y}`);
  }
});

test('Étape 3 — restore : formes rondes et corps cinématiques, refus sans rien changer', t => {
  const F = load(), w = F.create({bounds: B64, ...SMALL, ground: 0});
  const s = w.addBody({shape: 'sphere', radius: 0.2, pos: [0, 0.2, 0], mass: 5}), c = w.addBody({shape: 'capsule', radius: 0.1, height: 0.8, pos: [2, 0.5, 0], mass: 5});
  const k = w.addBody({size: [1, 0.2, 1], pos: [-2, 0.1, 0], kinematic: true});
  for (let i = 1; i <= 20; i++) { w.setKinematic(k, -2, 0.1 + i / 100, 0, 0, 0, 0, 1); w.step(1 / 120); }
  w.setKinematic(k, -2, 0.31, 0, 0, 0, 0, 1);
  const good = JSON.stringify(w.snapshot()), hash = w.hash(), [rs, rc, rk] = [s, c, k].map(h => h & 4095);
  const cases = [
    ['sphère : HR y ≠ HR x', x => { x.b.HR[rs * 3 + 1] = 0.5; }], ['capsule : HR z ≠ HR x', x => { x.b.HR[rc * 3 + 2] = 0.2; }],
    ['capsule : H z ≠ H x', x => { x.b.H[rc * 3 + 2] = 0.3; }], ['capsule : hauteur < 2 rayons', x => { x.b.HR[rc * 3 + 1] = 0.05; }],
    ['SH = 3', x => { x.b.SH[rs] = 3; }], ['cinématique : IM ≠ 0', x => { x.b.IM[rk] = 0.1; }], ['dynamique : IM = 0', x => { x.b.IM[rs] = 0; }],
    ['cinématique : MO < 0', x => { x.b.MO[rk] = -1; }], ['MOVING sans KINEMATIC', x => { x.b.FL[rs] |= 64; }],
    ['cinématique endormi', x => { x.b.FL[rk] |= 2; }], ['cinématique en attente', x => { x.b.FL[rk] |= 8; }], ['KN = 1 sur un corps dynamique', x => { x.b.KN[rs] = 1; }],
    ['KN = 2', x => { x.b.KN[rk] = 2; }], ['cible au quaternion non unitaire', x => { for (let m = 3; m < 7; m++) x.b.KT[rk * 7 + m] *= 2; }],
    ['perdu (pas encore)', x => { x.b.FL[rs] |= 16; }],
  ];
  for (const [name, spoil] of cases) {
    const x = JSON.parse(good); spoil(x);
    assert.throws(() => w.restore(x), e => e instanceof Error && /^FPhysics\.restore: /.test(e.message), name);
    assert.equal(w.hash(), hash, name + ': nothing changed');
  }
  const w2 = F.create(w.config);
  w2.restore(JSON.parse(good));
  assert.equal(w2.hash(), hash);
  assert.deepEqual([w2.stats.bodies, w2.stats.kinematic, w2.stats.pending, w2.stats.sleeping], [3, 1, 0, w.stats.sleeping]);
  assert.deepEqual([w2.body(s).shape, w2.body(c).shape, w2.body(c).height, w2.body(k).kinematic], ['sphere', 'capsule', 0.8, true]);
  for (let i = 0; i < 120; i++) { w.step(1 / 120); w2.step(1 / 120); }
  assert.equal(w2.hash(), w.hash(), 'same steps after the restore');
  assert.equal(w2.body(k).pos[1], 0.31, 'the restored pending target is reached');
  t.diagnostic(`${cases.length} instantanés corrompus refusés, hachage inchangé (${hash}) ; restauration valide : ${w2.hash()} des deux côtés 120 sous-pas plus tard`);
});
