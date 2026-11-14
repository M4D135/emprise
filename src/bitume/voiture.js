/* BITUME — monoplace de 1980 dessinée d'après la Ferrari 312 T5 : cotes, silhouette et livrée rouge à détails blancs,
   sans nom, emblème ni marque de commanditaire. Primitives du moteur : vue extérieure, cockpit vu du siège, fantôme.
   Repère local : x vers l'avant, y vers le haut, z vers la droite ; origine au sol, au milieu de l'empattement. */
(function (B) {
  'use strict';

  // ---------------------------------------------------------------- matrices 3×3 (colonnes : images de x, y, z)
  function euler(rx, ry, rz) { // même ordre que le moteur : Rz·Ry·Rx
    const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
    return [[cz * cy, sz * cy, -sy], [cz * sy * sx - sz * cx, sz * sy * sx + cz * cx, cy * sx], [cz * sy * cx + sz * sx, sz * sy * cx - cz * sx, cy * cx]];
  }
  const mul = (m, v) => [m[0][0] * v[0] + m[1][0] * v[1] + m[2][0] * v[2], m[0][1] * v[0] + m[1][1] * v[1] + m[2][1] * v[2], m[0][2] * v[0] + m[1][2] * v[1] + m[2][2] * v[2]];
  const mulM = (a, b) => [mul(a, b[0]), mul(a, b[1]), mul(a, b[2])];
  const croix = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norme = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  function angles(m) {
    const b = -Math.asin(Math.max(-1, Math.min(1, m[0][2])));
    return [Math.atan2(m[1][2], m[2][2]), b, Math.atan2(m[0][1], m[0][0])];
  }
  // Repère direct dont l'axe y suit `axe` (cylindre, bras) : colonnes x, y, z.
  function selonAxe(axe) {
    const y = norme(axe), aide = Math.abs(y[1]) < .9 ? [0, 1, 0] : [1, 0, 0], x = norme(croix(y, aide));
    return [x, y, croix(x, y)];
  }
  // Attitude de la caisse : cap h (tangente (cos h, sin h) dans le plan x, z), tangage p (nez vers le haut positif),
  // roulis q (côté droit vers le bas positif). M = Ry(−h)·Rz(p)·Rx(q).
  function attitude(h, p, q) { return mulM(euler(0, -h, 0), mulM(euler(0, 0, p), euler(q, 0, 0))); }

  const ROUE_AXE = euler(Math.PI / 2, 0, 0);       // cylindre couché : son axe suit z (la droite de la voiture)
  const VERS_AVANT = euler(0, 0, -Math.PI / 2);    // cylindre dont l'axe suit x

  // ---------------------------------------------------------------- cotes de la 312 T5
  // Empattement 2,70 m, voies 1,70 m à l'avant et 1,615 m à l'arrière, longueur 4,53 m, largeur 2,12 m, hauteur 1,02 m.
  const EMPATTEMENT = 2.70, DEMI_VOIE_AV = .85, DEMI_VOIE_AR = .8075, JANTE_R = .165; // jantes de 13 pouces
  const ROUES = [
    { x: 1.35, z: -DEMI_VOIE_AV, r: .29, l: .28, avant: true }, { x: 1.35, z: DEMI_VOIE_AV, r: .29, l: .28, avant: true },
    { x: -1.35, z: -DEMI_VOIE_AR, r: .335, l: .46, avant: false }, { x: -1.35, z: DEMI_VOIE_AR, r: .335, l: .46, avant: false }
  ];

  const LAQUE = 16, PEINTURE = 17, MAT = 7, METAL_MAT = 0, TISSU = 18;
  const PNEU = [.035, .035, .04], FOND_JANTE = [.11, .11, .12], JANTE = [.72, .73, .74], NOIR = [.03, .03, .035],
    CARBONE = [.06, .065, .07], ARGENT = [.76, .77, .79], BLANC = [.95, .94, .9], GANT = [.9, .9, .87],
    ACIER = [.56, .57, .59], SOMBRE = [.17, .175, .19], CRAIE = [.82, .82, .78], IVOIRE = [.93, .92, .87];
  const VITESSE_FLOU = 30;   // m/s : au-delà, la rotation des roues ne se lit plus image par image

  // Braquage d'Ackermann : la roue intérieure au virage braque plus que l'extérieure. d > 0 : virage à droite.
  // Rend les angles des roues 0 (avant gauche) et 1 (avant droite).
  function braquages(d) {
    if (Math.abs(d) < 1e-5) return [d, d];
    const R = EMPATTEMENT / Math.tan(Math.abs(d));
    const interieur = Math.atan(EMPATTEMENT / (R - DEMI_VOIE_AV)), exterieur = Math.atan(EMPATTEMENT / (R + DEMI_VOIE_AV));
    return d > 0 ? [exterieur, interieur] : [-interieur, -exterieur];
  }

  // ---------------------------------------------------------------- carènes de la 312 T5
  // Volumes lisses bâtis une fois au chargement (src/carene.js) et enregistrés comme formes libres du moteur. Une pièce
  // de carène porte le centre et la taille de sa forme (repère de la voiture) ; sa couleur est celle de la livrée.
  const C = B.carene, FORMES = {};
  function forme(nom, triangles) {
    const n = C.normaliser(triangles), f = { nom: 'bitume-' + nom, centre: n.centre, taille: n.taille, triangles: n.triangles.length, tri: n.triangles };
    const R = globalThis.window && globalThis.window.FRender;
    if (R && R.forme) R.forme(f.nom, n.triangles);
    return (FORMES[nom] = f);
  }
  const deuxCotes = t => t.concat(C.miroir(t));
  // Sections (x : abscisse, y0–y1 : bas et haut, l : demi-largeur, n : exposant), de l'avant vers l'arrière, mesurées
  // sur les photos de la voiture de 1980 (trois quarts avant de haut).
  // BITUME (voi-1) : la dernière section prolonge la quille sous les pontons ; sans elle, le flanc reste percé derrière la roue avant
  const S_QUILLE = [{ x: 2.16, y0: .12, y1: .22, l: .10, n: 3 }, { x: 1.60, y0: .10, y1: .30, l: .15, n: 3 }, { x: .95, y0: .10, y1: .34, l: .20, n: 4 }, { x: .58, y0: .10, y1: .36, l: .22, n: 4 }];
  const S_FLECHE = [{ x: 2.08, y0: .22, y1: .25, l: .04, n: 3 }, { x: 1.60, y0: .27, y1: .34, l: .26, n: 4 }, { x: 1.05, y0: .30, y1: .40, l: .52, n: 5 }, { x: .60, y0: .30, y1: .43, l: .72, n: 5 }];
  // pontons : ils s'arrondissent devant, sous la flèche, et se resserrent derrière, à l'intérieur des roues arrière
  const S_PONTONS = [{ x: .66, y0: .14, y1: .40, l: .66, n: 6 }, { x: .60, y0: .10, y1: .43, l: .72, n: 6 }, { x: -.40, y0: .10, y1: .45, l: .72, n: 6 },
    { x: -.88, y0: .10, y1: .45, l: .70, n: 6 }, { x: -1.08, y0: .12, y1: .43, l: .50, n: 5 }, { x: -1.30, y0: .16, y1: .40, l: .30, n: 4 }];
  const S_GOUTTE = [{ x: 1.30, y0: .36, y1: .40, l: .03, n: 2 }, { x: .90, y0: .38, y1: .54, l: .20, n: 2.5 }, { x: .55, y0: .38, y1: .63, l: .29, n: 3 },
    { x: .10, y0: .38, y1: .65, l: .31, n: 3 }, { x: -.35, y0: .40, y1: .66, l: .27, n: 3 }];
  const OUVERTURE = { de: .52, a: -.24, angle: 1.2 };
  const S_MOTEUR = [{ x: -.35, y0: .40, y1: .70, l: .30, n: 3 }, { x: -1.00, y0: .42, y1: .60, l: .34, n: 4 }, { x: -1.65, y0: .30, y1: .50, l: .26, n: 4 }];
  const S_BULLE = [{ x: .64, y0: .60, y1: .62, l: .05, n: 2 }, { x: .50, y0: .58, y1: .76, l: .22, n: 2.2 }, { x: .34, y0: .58, y1: .80, l: .27, n: 2.4 }, { x: .16, y0: .58, y1: .78, l: .29, n: 2.4 }];
  forme('quille', C.carene(S_QUILLE, { cotes: 16 }));
  forme('fleche', C.carene(S_FLECHE, { cotes: 28, pas: 5 }));
  forme('pontons', C.carene(S_PONTONS, { cotes: 28 }));
  // voi-6 : la bande suit la peau des pontons, décalée de 4 mm le long des normales (une carène à part, à
  // flancs presque droits, sortait jusqu'à 19 cm de la peau), coupée sous y0 + 0,07
  {
    const peau = C.carene(S_PONTONS.slice(1, 5), { cotes: 28, bouts: false }), decalee = [];
    for (const t of peau) {
      if ((t[0][1] + t[1][1] + t[2][1]) / 3 >= .17) continue;
      decalee.push([0, 1, 2].map(r => [0, 1, 2].map(k => t[r][k] + t[3 + r][k] * .004)).concat([0, 1, 2].map(r => t[3 + r])));
    }
    forme('bande', decalee);
  }
  {
    const exterieur = C.carene(S_GOUTTE, { cotes: 28, pas: 5, ouverture: OUVERTURE });
    forme('goutte', exterieur);
    forme('goutte-dedans', C.carene(S_GOUTTE, { cotes: 28, pas: 5, ouverture: OUVERTURE, interieur: true }).slice(exterieur.length));
    // jonc du bord de l'ouverture : il suit le bord gauche, l'arc arrière, le bord droit et l'arc avant de l'ouverture
    // (voi-4 : trois points par arc, sinon la corde de Catmull-Rom bombe hors de l'ouverture et passe sous la peau)
    const g = C.profil(S_GOUTTE), bord = [], w = OUVERTURE.angle / 2;
    for (let i = 0; i <= 6; i++) { const x = OUVERTURE.de + (OUVERTURE.a - OUVERTURE.de) * i / 6; bord.push(C.pointSection(g(x), Math.PI / 2 + w)); }
    for (let k = 1; k <= 3; k++) bord.push(C.pointSection(g(OUVERTURE.a), Math.PI / 2 + w - 2 * w * k / 4));
    for (let i = 6; i >= 0; i--) { const x = OUVERTURE.de + (OUVERTURE.a - OUVERTURE.de) * i / 6; bord.push(C.pointSection(g(x), Math.PI / 2 - w)); }
    for (let k = 1; k <= 3; k++) bord.push(C.pointSection(g(OUVERTURE.de), Math.PI / 2 - w + 2 * w * k / 4));
    forme('jonc', C.tube(bord, .012, { cotes: 8, ferme: true, pas: 3 }));
  }
  forme('moteur', C.carene(S_MOTEUR, { cotes: 24 }));
  forme('bulle', C.carene(S_BULLE, { cotes: 24, bouts: false, interieur: 'tout' }));
  {
    // filet de la seconde couleur au bord de la flèche, puis le long du flanc des pontons
    const f = C.profil(S_FLECHE), p = C.profil(S_PONTONS), ligne = [];
    for (let x = 2.04; x > .62; x -= .12) { const s = f(x); ligne.push([x, (s.y0 + s.y1) / 2, s.l + .002]); }
    for (const x of [.50, -.20, -.80]) ligne.push([x, .365, p(x).l + .002]);
    forme('filet', deuxCotes(C.tube(ligne, .008, { cotes: 6, pas: 2 })));
  }
  // rétroviseurs : boîtier profilé, glace vers l'arrière (x = 0,53), sur une patte fine fixée au flanc du carénage
  forme('retros', deuxCotes(C.carene([{ x: .61, y0: .560, y1: .575, l: .02, n: 2, z: .47 }, { x: .57, y0: .540, y1: .592, l: .072, n: 3, z: .47 }, { x: .53, y0: .538, y1: .594, l: .078, n: 4, z: .47 }], { cotes: 16, pas: 3 })
    .concat(C.tube([[.565, .53, .27], [.565, .55, .40]], .009, { cotes: 6 }))));
  {
    // suspension avant : basculeur supérieur noir, large à la coque et fin à la roue ; triangle inférieur et biellette
    const versZ = [[0, 0, 1], [0, 1, 0], [-1, 0, 0]];
    forme('basculeurs', deuxCotes(C.transformer(C.carene([{ x: 0, y0: .325, y1: .365, l: .075, n: 4 }, { x: .43, y0: .330, y1: .350, l: .028, n: 3 }], { cotes: 12, pas: 2 }), versZ, [1.35, 0, .28])));
    // voi-7 : attaches intérieures posées sur la peau de la quille (demi-largeur ≈ 0,143 à x 1,52 et 0,167 à x 1,18, y 0,15)
    forme('triangles', deuxCotes([].concat(C.tube([[1.52, .15, .145], [1.35, .17, .71]], .011, { cotes: 6 }), C.tube([[1.18, .15, .17], [1.35, .17, .71]], .011, { cotes: 6 }),
      C.tube([[1.47, .29, .22], [1.45, .30, .70]], .008, { cotes: 6 }))));
  }
  // arceau de sécurité derrière le casque
  forme('arceau', C.tube([[-.28, .62, -.17], [-.27, .88, -.14], [-.265, .995, 0], [-.27, .88, .14], [-.28, .62, .17]], .015, { cotes: 8 }));
  // version lointaine : trois carènes à huit côtés
  forme('loin-caisse', C.carene([{ x: 2.08, y0: .20, y1: .25, l: .05, n: 3 }, { x: 1.60, y0: .12, y1: .34, l: .26, n: 4 }, { x: 1.05, y0: .11, y1: .40, l: .52, n: 5 },
    { x: .60, y0: .10, y1: .43, l: .72, n: 5 }, { x: -.88, y0: .10, y1: .45, l: .70, n: 5 }, { x: -1.08, y0: .12, y1: .43, l: .50, n: 5 }, { x: -1.30, y0: .16, y1: .40, l: .30, n: 4 }], { cotes: 8, pas: 1 }));
  forme('loin-dessus', C.carene([S_GOUTTE[0], S_GOUTTE[2], S_GOUTTE[3], S_MOTEUR[0], S_MOTEUR[1], S_MOTEUR[2]], { cotes: 8, pas: 1 }));
  forme('loin-quille', C.carene(S_QUILLE, { cotes: 8, pas: 1 }));
  // Pneus : carène de révolution autour de l'axe y local (celui des cylindres de roue), flanc presque droit depuis la
  // jante, épaule arrondie, bande de roulement plate
  function pneu(r, w) {
    const profil = [[-w / 2, JANTE_R + .012], [-w / 2 + .004, r - .05], [-w / 2 + .018, r - .012], [-w / 2 + .045, r], [w / 2 - .045, r], [w / 2 - .018, r - .012], [w / 2 - .004, r - .05], [w / 2, JANTE_R + .012]];
    return C.transformer(C.carene(profil.map(([x, q]) => ({ x, y0: -q, y1: q, l: q, n: 2 })), { cotes: 24, pas: 2 }), [[0, 1, 0], [-1, 0, 0], [0, 0, 1]]);
  }
  forme('pneu-av', pneu(ROUES[0].r, ROUES[0].l));
  forme('pneu-ar', pneu(ROUES[2].r, ROUES[2].l));
  // Habitacle de la vue cockpit. L'œil du cockpit est plus bas et plus en arrière que celui du pilote : la goutte de la
  // vue extérieure boucherait la vue. À sa place, deux épaules galbées qui montent des coins du bas vers la planche et
  // se rejoignent devant elle, un dôme devant la planche, une cuve sombre entre les épaules, un saute-vent en arc.
  const S_EPAULE = [{ x: -.40, y0: .30, y1: .60, l: .10, n: 3, z: .30 }, { x: .00, y0: .30, y1: .62, l: .10, n: 3, z: .28 },
    { x: .30, y0: .32, y1: .64, l: .10, n: 3, z: .22 }, { x: .55, y0: .36, y1: .64, l: .08, n: 3, z: .14 }, { x: .75, y0: .40, y1: .60, l: .05, n: 3, z: .08 }];
  forme('epaules', deuxCotes(C.carene(S_EPAULE, { cotes: 24 })));
  // flanc intérieur sombre sous le jonc : l'épaule n'est rouge que dessus et dehors
  forme('flancs', deuxCotes(C.carene(S_EPAULE.map(sc => Object.assign({}, sc, { z: sc.z - .03, l: sc.l * .75, y1: sc.y1 - .035 })), { cotes: 16 })));
  {
    const e = C.profil(S_EPAULE), bord = [];
    for (let x = -.30; x <= .70; x += .1) bord.push(C.pointSection(e(x), 2.25));
    forme('epaules-jonc', deuxCotes(C.tube(bord, .008, { cotes: 8, pas: 3 })));
  }
  forme('dome', C.carene([{ x: .40, y0: .40, y1: .60, l: .14, n: 2.5 }, { x: .70, y0: .40, y1: .645, l: .19, n: 2.5 }, { x: 1.00, y0: .40, y1: .58, l: .17, n: 2.5 }, { x: 1.30, y0: .38, y1: .42, l: .04, n: 2.5 }], { cotes: 28 }));
  forme('cuve', C.carene([{ x: -.45, y0: .12, y1: .48, l: .26, n: 4 }, { x: .30, y0: .12, y1: .48, l: .22, n: 4 }, { x: .80, y0: .15, y1: .47, l: .10, n: 3 }], { cotes: 16 }));
  {
    // saute-vent : ruban mince en arc devant l'ouverture, vu des deux côtés, et son arête claire
    const haut = [], bas = [];
    for (let i = 0; i <= 16; i++) {
      const f = -1.25 + 2.5 * i / 16, x = .27 + .20 * Math.cos(f), z = .24 * Math.sin(f), y = .675 + .025 * Math.cos(f);
      haut.push([x, y, z]); bas.push([x - .015, y - .07, z]);
    }
    const faces = [];
    for (let i = 0; i < 16; i++) faces.push([bas[i], bas[i + 1], haut[i + 1]], [bas[i], haut[i + 1], haut[i]]);
    forme('pare-brise', C.lisser(faces).concat(C.lisser(faces.map(t => [t[0], t[2], t[1]]))));
    forme('pare-brise-arete', C.tube(haut, .003, { cotes: 6, pas: 2 }));
  }
  // ---------------------------------------------------------------- modèle
  function piece(shape, o, s, mat, color, extra) { return Object.assign({ shape, o, s, mat, color }, extra || {}); }

  function modele(livree) {
    const c1 = livree.couleur, c2 = livree.seconde || BLANC, casque = livree.casque || c2, combi = livree.combinaison || c1.map(v => v * .7);
    const corps = [], simples = [];
    const P = (shape, o, s, mat, color, extra) => { const p = piece(shape, o, s, mat, color, extra); corps.push(p); return p; };
    const AR = extra => Object.assign({ arriere: true }, extra); // derrière l'œil du cockpit : pas dessiné dans cette vue
    const pilote = { pilote: true };

    // Carrosserie : quille de nez, grand capot en flèche qui devient les pontons, carénage du cockpit en goutte sur
    // l'axe, capot moteur, saute-vent en bulle teintée. Filet et bande basse de la seconde couleur.
    const L = (nom, mat, color, extra) => P(FORMES[nom].nom, FORMES[nom].centre, FORMES[nom].taille, mat, color, extra);
    const dehors = { exterieur: true }; // remplacé en vue cockpit (voir cockpit)
    L('quille', PEINTURE, c1);
    L('fleche', PEINTURE, c1);
    L('pontons', PEINTURE, c1);
    L('bande', PEINTURE, c2);
    L('filet', PEINTURE, c2);
    L('goutte', PEINTURE, c1, dehors);
    L('goutte-dedans', MAT, c1.map(v => v * .22), dehors);
    L('jonc', MAT, NOIR, dehors);
    L('bulle', METAL_MAT, [.30, .50, .86], { fx: true, alpha: .3, exterieur: true });
    L('moteur', PEINTURE, c1, AR());
    L('arceau', METAL_MAT, ARGENT, AR());
    L('retros', PEINTURE, c1);
    L('basculeurs', MAT, NOIR);
    L('triangles', METAL_MAT, SOMBRE);
    // Aileron avant argent de 1,62 m, bord de fuite relevé, et ses deux dérives rouges
    P('box', [2.11, .13, 0], [.38, .025, 1.62], LAQUE, ARGENT, { m: euler(0, 0, -.08) });
    for (const k of [-1, 1]) P('box', [2.11, .17, k * .81], [.38, .19, .02], PEINTURE, c1);
    // Habitacle de la vue cockpit (dessiné seulement dans cette vue) : épaules, jonc, dôme, saute-vent.
    // voi-5 : la cuve sombre se dessine aussi en vue extérieure — sans elle, vu du dessus, l'habitacle paraît
    // plein couleur caisse ; prolongée par la quille (voi-1), elle ne se voit de dehors que par l'ouverture.
    const dedans = { dedans: true };
    L('epaules', PEINTURE, c1, dedans);
    L('epaules-jonc', MAT, NOIR, dedans);
    L('flancs', MAT, [.05, .05, .055], dedans);
    L('dome', PEINTURE, c1, dedans);
    L('cuve', MAT, [.035, .035, .04]);
    L('pare-brise', METAL_MAT, [.30, .50, .86], { fx: true, alpha: .2, dedans: true });
    L('pare-brise-arete', METAL_MAT, [.86, .9, .94], { fx: true, alpha: .5, dedans: true });
    // Pilote : casque, visière, épaules
    P('sphere', [0, .865, 0], [.27, .29, .27], LAQUE, casque, pilote);
    P('box', [.11, .875, 0], [.07, .07, .2], METAL_MAT, [.05, .06, .09], pilote);
    P('sphere', [-.04, .66, 0], [.30, .20, .38], TISSU, combi, pilote);
    // Glaces des rétroviseurs, tournées vers le pilote (en vue cockpit : glace vivante)
    for (const k of [-1, 1]) P('box', [.527, .566, k * .47], [.004, .048, .132], METAL_MAT, [.2, .23, .27], { glace: true });
    // Suspension arrière : deux bras noirs
    for (const k of [-1, 1]) {
      P('box', [-1.35, .40, k * .45], [.05, .02, .32], MAT, CARBONE, AR());
      P('box', [-1.35, .22, k * .45], [.07, .02, .32], MAT, CARBONE, AR());
    }
    // Numéro : grand chiffre penché, posé directement sur la caisse (lisible de face) et sur les flancs des pontons.
    // BITUME (voi-2) : blanc sur le rouge du joueur, noir sur les caisses claires — encre choisie pour un contraste ≥ 3
    if (livree.numero) {
      const lum = c => .2126 * c[0] + .7152 * c[1] + .0722 * c[2], encre = (lum(BLANC) + .05) / (lum(c1) + .05) >= 3 ? BLANC : NOIR;
      const texte = String(livree.numero).slice(0, 2), n = texte.length, penche = .21;
      // chiffre dans le plan (ex : sa droite, ey : son haut), centré en o, hauteur h ; colle(c) pose chaque segment sur
      // la peau
      const chiffres = (o, ex, ey, h, colle, extra) => {
        const l = h * .5, t = h * .15, pas = l + h * .24, nz = croix(ex, ey), eyp = norme(ey.map((v, k) => v + ex[k] * Math.tan(penche))), exp = croix(eyp, nz);
        const places = { a: [0, h / 2, l + t, t, 0], b: [l / 2, h / 4, t, h / 2 + t, 1], c: [l / 2, -h / 4, t, h / 2 + t, 1], d: [0, -h / 2, l + t, t, 0], e: [-l / 2, -h / 4, t, h / 2 + t, 1], f: [-l / 2, h / 4, t, h / 2 + t, 1], g: [0, 0, l + t, t, 0] };
        for (let i = 0; i < n; i++) for (const nom of SEGMENTS[texte[i]] || '') {
          const [x, y, sx, sy, vertical] = places[nom], dx = x + (i - (n - 1) / 2) * pas + y * Math.tan(penche);
          const c = colle(o.map((v, k) => v + ex[k] * dx + ey[k] * y));
          P('box', c, [sx, sy, .003], MAT, encre, Object.assign({ m: vertical ? [exp, eyp, nz] : [ex, ey, nz] }, extra));
        }
      };
      // nez : devant la pointe du carénage, le haut du chiffre vers l'habitacle ; flancs : sur la partie droite du ponton
      // hauteur du dessus d'une section en z, et largeur d'une section à la hauteur y (superellipse)
      const dessus = (sc, z) => { const c = Math.min(1, Math.abs(z - (sc.z || 0)) / sc.l) ** (sc.n / 2); return (sc.y0 + sc.y1) / 2 + (sc.y1 - sc.y0) / 2 * Math.sqrt(1 - c * c) ** (2 / sc.n); };
      const flanc = (sc, y) => { const h = (sc.y1 - sc.y0) / 2, t = Math.min(1, Math.abs(y - (sc.y0 + sc.y1) / 2) / h) ** (sc.n / 2); return sc.l * Math.sqrt(1 - t * t) ** (2 / sc.n); };
      const f = C.profil(S_FLECHE), xN = 1.62, s0 = f(xN + .1), s1 = f(xN - .1), ey = norme([-.2, s1.y1 - s0.y1, 0]);
      chiffres([xN, f(xN).y1, 0], [0, 0, -1], ey, .18, c => [c[0], dessus(f(c[0]), c[2]) + .004, c[2]]);
      const p = C.profil(S_PONTONS);
      // voi-3 : numéro de flanc calé entre la bande basse (haut y 0,17) et le filet (bas y 0,357)
      for (const k of [-1, 1]) chiffres([-.62, .262, k * .72], [k, 0, 0], [0, 1, 0], .15, c => [c[0], c[1], k * (flanc(p(c[0]), c[1]) + .004)], AR());
    }
    // Boîte, échappements du douze-cylindres à plat, aileron arrière blanc sur mât central, dérives rouges
    P('box', [-1.80, .28, 0], [.50, .28, .34], METAL_MAT, [.3, .31, .33], AR());
    for (const k of [-1, 1]) P('cylinder', [-1.85, .38, k * .22], [.09, .36, .09], METAL_MAT, [.34, .31, .28], AR({ m: VERS_AVANT }));
    P('box', [-2.02, .66, 0], [.20, .48, .05], PEINTURE, c1, AR());
    P('box', [-2.05, .90, 0], [.32, .035, 1.10], PEINTURE, c2, AR({ m: euler(0, 0, -.12) }));
    P('box', [-2.18, .95, 0], [.12, .025, 1.08], PEINTURE, c2, AR({ m: euler(0, 0, -.5) }));
    for (const k of [-1, 1]) P('box', [-2.05, .87, k * .56], [.36, .30, .02], PEINTURE, c1, AR());
    // Roues : pneu, jante sombre, six rayons qui tournent, moyeu ; les avant braquent
    ROUES.forEach((w, i) => {
      const base = { roue: i, m: ROUE_AXE, arriere: !w.avant };
      const f = FORMES[w.avant ? 'pneu-av' : 'pneu-ar'];
      P(f.nom, [w.x, w.r, w.z], f.taille, MAT, PNEU, base);
      P('cylinder', [w.x, w.r, w.z], [2 * JANTE_R, w.l + .012, 2 * JANTE_R], METAL_MAT, FOND_JANTE, base);
      for (let b = 0; b < 3; b++) P('box', [w.x, w.r, w.z], [2 * JANTE_R * .94, w.l + .02, .04], METAL_MAT, JANTE, Object.assign({ tourne: b * Math.PI / 3 }, base));
      P('cylinder', [w.x, w.r, w.z], [.09, w.l + .05, .09], METAL_MAT, JANTE, base);
    });
    // Disques de frein avant, dans la roue, côté coque. Puis les pièces qui dépendent de la vitesse, en fin de liste :
    // deux repères à la craie sur chaque flanc tant que l'œil suit la rotation, une bande plus claire au-delà.
    ROUES.forEach((w, i) => {
      const base = { roue: i, m: ROUE_AXE, arriere: !w.avant }, k = Math.sign(w.z), flanc = (JANTE_R + w.r) / 2;
      if (w.avant) P('cylinder', [w.x, w.r, w.z], [.27, .016, .27], METAL_MAT, [.40, .40, .42], Object.assign({ decale: [0, -k * (w.l / 2 + .03), 0] }, base));
      for (const cote of [-1, 1]) for (const a of [0, Math.PI]) P('box', [w.x, w.r, w.z], [.07, .004, .016], MAT, CRAIE, Object.assign({ tourne: a, decale: [flanc, cote * (w.l / 2 + .001), 0], lent: true }, base));
      P('cylinder', [w.x, w.r, w.z], [2 * flanc + .06, w.l + .006, 2 * flanc + .06], MAT, [.062, .062, .068], Object.assign({ vite: true }, base));
    });

    // Version lointaine : trois carènes à huit côtés, les ailerons, le casque et les quatre roues
    const loin = nom => piece(FORMES[nom].nom, FORMES[nom].centre, FORMES[nom].taille, PEINTURE, c1);
    simples.push(loin('loin-caisse'), loin('loin-dessus'), loin('loin-quille'),
      piece('box', [2.11, .13, 0], [.38, .04, 1.62], LAQUE, ARGENT),
      piece('box', [-2.05, .90, 0], [.34, .06, 1.10], PEINTURE, c2),
      piece('box', [-2.02, .66, 0], [.20, .48, .05], PEINTURE, c1),
      piece('sphere', [0, .865, 0], [.27, .29, .27], LAQUE, casque));
    for (const w of ROUES) simples.push(piece('cylinder', [w.x, w.r, w.z], [2 * w.r, w.l, 2 * w.r], MAT, PNEU, { m: ROUE_AXE }));
    return { corps, simples, livree };
  }

  // ---------------------------------------------------------------- pose dans le monde
  // ev = { p: [x, y, z] (sol sous le milieu de l'empattement), cap, tangage, roulis, braquage (rad, droite positive),
  //        roule (distance parcourue, m : fait tourner les roues), v (vitesse, m/s : repères ou flou des pneus) }
  // Rend la rotation d'une pièce de roue : braquage d'Ackermann à l'avant, rotation propre −distance/rayon.
  function rotationRoue(M, pc, braq, roule) {
    const w = ROUES[pc.roue];
    let m = pc.tourne === undefined ? pc.m : mulM(pc.m, euler(0, pc.tourne - roule / w.r, 0));
    if (w.avant) m = mulM(euler(0, -braq[pc.roue], 0), m);
    return mulM(M, m);
  }
  // Une pièce se dessine-t-elle ? En vue cockpit, ni le pilote, ni l'arrière, ni le carénage et les glaces de la vue
  // extérieure ; l'habitacle (dedans) seulement dans cette vue ; les repères des pneus à basse vitesse seulement, leur
  // bande floue au-delà.
  function visible(pc, cockpit, v) {
    if (cockpit && (pc.pilote || pc.arriere || pc.exterieur || pc.glace)) return false;
    if (!cockpit && pc.dedans) return false;
    return !(pc.lent && v > VITESSE_FLOU) && !(pc.vite && !(v > VITESSE_FLOU));
  }
  function poser(mod, ev, sortie, options = {}) {
    const M = attitude(ev.cap, ev.tangage || 0, ev.roulis || 0), rotM = angles(M), braq = braquages(ev.braquage || 0), roule = ev.roule || 0;
    const liste = options.simple ? mod.simples : mod.corps, v = ev.v || 0;
    for (const pc of liste) {
      if (!visible(pc, options.cockpit, v)) continue;
      // Chantier 3 : une roue détachée (degats.roues[i]) n'est plus dessinée
      if (pc.roue !== undefined && options.roues && options.roues[pc.roue]) continue;
      let o = mul(M, pc.o), rot;
      if (pc.roue !== undefined) {
        // pièce de roue : elle tourne avec elle ; `decale` la place hors de l'axe, dans le repère de la roue
        const Rr = rotationRoue(M, pc, braq, roule);
        rot = angles(Rr);
        if (pc.decale) { const d = mul(Rr, pc.decale); o = [o[0] + d[0], o[1] + d[1], o[2] + d[2]]; }
      } else rot = pc.m ? angles(mulM(M, pc.m)) : rotM;
      const m = { shape: pc.shape, p: [ev.p[0] + o[0], ev.p[1] + o[1], ev.p[2] + o[2]], s: pc.s, r: rot, mat: pc.mat, color: pc.color, surface: 'object' };
      if (pc.fx) { m.fx = true; m.alpha = pc.alpha; }
      if (options.overlay) m.overlay = true;
      sortie.push(m);
    }
    return M;
  }

  // ---------------------------------------------------------------- cockpit
  // Œil du cockpit dans le repère de la voiture. Ce n'est pas l'œil du pilote : il est plus bas et 0,30 m plus en
  // arrière, 16 cm au-dessus des pneus avant pour les cadrer aux coins du bas, comme dans vroom-unreal 0.35. Pour la
  // même raison, le capot de l'habitacle y est plus bas que sur la voiture vue de dehors : le nez se voit au milieu.
  const OEIL = [-.30, .74, 0];
  // Volant, planche, gants et avant-bras sont composés à leur place apparente vue de l'œil (VOLANT.centre : 1 m devant,
  // 16° sous l'horizon), puis ramenés vers l'œil par une homothétie de rapport K. L'image ne change pas et l'ensemble
  // tient dans l'habitacle, devant le capot.
  const K = .5;
  // Cadrage de vroom-unreal 0.35 : le volant est gros et bas, 16,8° sous l'horizon ; le bas de sa jante sort de l'image
  // (41,6° de champ vertical), les mains sont au premier plan et les manches quittent le champ dès le poignet.
  // Comme dans vroom-unreal, la face du volant regarde le pilote et un peu le bas (inclinaison négative : le haut de la
  // jante vient vers lui) : l'axe des mains, perpendiculaire au volant, prolonge celui des avant-bras qui montent du bas
  // de l'image, sans casser le poignet. Mains à 9 h et 3 h, sur les branches (prise : angle depuis le haut de la jante).
  const VOLANT = { centre: [1.0, -.302, 0], rayon: .125, inclinaison: -.436, course: 1.6, prise: Math.PI / 2 };
  // Planche : face au pilote, inclinée de 25° vers l'arrière ; elle ne suit pas l'inclinaison du volant.
  const PLANCHE = [1.12, -.21, 0], PENTE_PLANCHE = .436;
  const COUDE = [.48, -.58, .20];              // coude du pilote, bras repliés près du corps, sous l'image (vroom-unreal)
  const LEVIER = [.93, -.315, .262];           // pommeau du levier de vitesses, à droite du volant, au point mort
  const REGIME_LAMPE = 12000;                  // la lampe de la casquette s'allume : il est temps de monter un rapport
  // Afficheurs à sept segments : a en haut, puis b, c, d, e, f dans le sens des aiguilles d'une montre, g au milieu.
  const SEGMENTS = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', N: 'ceg', '-': 'g' };
  const AMBRE = [1, .56, .12], ETEINT = [.09, .035, .02];
  // Formes libres du cockpit, en positions apparentes (voir K). Planche et casquette dans le repère de la planche
  // (x : vers la droite, y : vers le haut de la planche, z : vers le pilote) ; jante et branches dans celui du volant
  // (x : vers le haut de la jante, y : vers le pilote, z : vers la droite de la jante).
  {
    const R = VOLANT.rayon, e = R / .105, sym = (sec, ...xs) => xs.map(x => Object.assign({}, sec, { x }));
    forme('planche', C.carene([{ x: -.200, y0: -.044, y1: .044, l: .005, n: 6 }, ...sym({ y0: -.056, y1: .056, l: .009, n: 6 }, -.192, .192), { x: .200, y0: -.044, y1: .044, l: .005, n: 6 }], { cotes: 20, pas: 2 }));
    forme('casquette', C.carene([{ x: -.206, y0: .049, y1: .055, l: .016, n: 4, z: .026 }, { x: -.19, y0: .051, y1: .064, l: .036, n: 4, z: .028 }, { x: 0, y0: .056, y1: .070, l: .040, n: 4, z: .030 },
      { x: .19, y0: .051, y1: .064, l: .036, n: 4, z: .028 }, { x: .206, y0: .049, y1: .055, l: .016, n: 4, z: .026 }], { cotes: 20, pas: 3 }));
    forme('jante', C.tube(Array.from({ length: 24 }, (_, i) => { const a = i * Math.PI / 12; return [R * Math.cos(a), 0, R * Math.sin(a)]; }), .0225 * e / 2, { cotes: 10, ferme: true, pas: 2 }));
    // une branche le long de x, de la flasque à la jante, aux bords arrondis ; trois copies : 3 h, 9 h et 6 h
    const branche = C.carene([{ x: .028 * e, y0: -.003, y1: .003, l: .0135 * e, n: 4 }, { x: R * .98, y0: -.003, y1: .003, l: .0135 * e, n: 4 }], { cotes: 12, pas: 1 });
    const autourY = a => [[Math.cos(a), 0, -Math.sin(a)], [0, 1, 0], [Math.sin(a), 0, Math.cos(a)]];
    forme('branches', [].concat(...[-Math.PI / 2, Math.PI / 2, Math.PI].map(a => C.transformer(branche, autourY(a)))));
  }
  // Mains : le maillage de src/main.js (main droite, taille réelle, repère de la prise) et son miroir pour la gauche
  const MAIN = B.main.construire(), MAIN_OUVERT = B.main.construire(true);
  for (const [cote, t] of [['d', x => x], ['g', C.miroir]]) for (const piece of ['gant', 'paume', 'garde', 'poignet', 'sangle']) forme('main-' + piece + '-' + cote, t(MAIN[piece]));
  forme('main-gant-d-ouvert', MAIN_OUVERT.gant);                  // cockpit-3 : doigts ouverts pendant le trajet au pommeau
  const borner = (x, a, b) => x < a ? a : x > b ? b : x, lisse = (a, b, x) => { const t = borner((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const clarte = c => .3 * c[0] + .59 * c[1] + .11 * c[2], ecart = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  // Position du pommeau selon le rapport, grille en H : impairs vers l'avant, pairs vers l'arrière ; 1-2 à gauche.
  const grille = n => n > 0 ? [(n % 2 ? 1 : -1) * .024, (Math.floor((n - 1) / 2) - 1) * .017] : [0, 0];

  // etat = { regime (tr/min), volant (−1 à 1), rapport (0 = point mort), kmh (vitesse affichée),
  //          passage (0 à 1 : avancement du changement de rapport en cours, 1 ou absent : aucun), rapportAvant,
  //          derriere ([{ x, z, couleur }] : rivaux dans le repère de la voiture, du plus proche au plus loin),
  //          ciel, brume (couleurs du jour, pour les glaces des rétroviseurs) }
  function cockpit(mod, ev, sortie, etat) {
    const M = poser(mod, ev, sortie, { overlay: true, cockpit: true, roues: etat.roues });
    const rotM = angles(M), liv = mod.livree, c1 = liv.couleur, c2 = liv.seconde || BLANC;
    const pousser = (shape, p, s, m, mat, color, extra) => sortie.push(Object.assign({ shape, p, s, r: m ? angles(mulM(M, m)) : rotM, mat, color, overlay: true, surface: 'object' }, extra));
    const monde = o => { const w = mul(M, o); return [ev.p[0] + w[0], ev.p[1] + w[1], ev.p[2] + w[2]]; };
    // dans : pièce à sa vraie place dans la voiture ; mettre : pièce composée vue de l'œil, ramenée vers lui
    const dans = (shape, o, s, mat, color, m, extra) => pousser(shape, monde(o), s, m, mat, color, extra);
    const mettre = (shape, v, s, mat, color, m, extra) => pousser(shape, monde([OEIL[0] + K * v[0], OEIL[1] + K * v[1], OEIL[2] + K * v[2]]), [s[0] * K, s[1] * K, s[2] * K], m, mat, color, extra);
    const plus = (a, ...termes) => a.map((v, k) => termes.reduce((s, [d, f]) => s + d[k] * f, v));

    // Repères du volant : plan incliné face au pilote (wu vers le haut de la jante, wn vers le pilote), rotation phi ;
    // repère de la planche : pu vers son haut, pn vers le pilote
    const regime = etat.regime || 0, tau = VOLANT.inclinaison, phi = borner(etat.volant || 0, -1, 1) * VOLANT.course;
    const wn = [-Math.cos(tau), Math.sin(tau), 0], wu = [Math.sin(tau), Math.cos(tau), 0], wr = [0, 0, 1];
    const pn = [-Math.cos(PENTE_PLANCHE), Math.sin(PENTE_PLANCHE), 0], pu = [Math.sin(PENTE_PLANCHE), Math.cos(PENTE_PLANCHE), 0];
    const u = wu.map((v, k) => v * Math.cos(phi) + wr[k] * Math.sin(phi)), r = wu.map((v, k) => -v * Math.sin(phi) + wr[k] * Math.cos(phi));
    const C = VOLANT.centre, R = VOLANT.rayon, jante = [u, wn, croix(u, wn)], cadre = [wr, pu, pn], rond = [pu, pn, wr], plat = [pn.map(v => -v), pu, wr];
    const cap = b => pu.map((v, k) => v * Math.cos(b) + wr[k] * Math.sin(b));           // direction dans le plan de la planche
    const sur = (a, b, d) => plus(PLANCHE, [wr, a], [pu, b], [pn, d]);                 // point de la planche : droite, haut, vers le pilote
    const trait = (centre, b, rayon, long, large, mat, color, extra) => { const d = cap(b); mettre('box', plus(centre, [d, rayon]), [long, .002, large], mat, color, [d, pn, croix(d, pn)], extra); };

    // Planche : tôle sombre, casquette noire et sa lampe de régime, fenêtres des afficheurs
    const posee = (nom, origine, m, mat, color, extra) => { const f = FORMES[nom]; mettre(f.nom, plus(origine, [m[0], f.centre[0]], [m[1], f.centre[1]], [m[2], f.centre[2]]), f.taille, mat, color, m, extra); };
    posee('planche', PLANCHE, cadre, MAT, [.075, .078, .085]);
    for (const a of [-.184, .184]) for (const b of [-.048, .048]) mettre('cylinder', sur(a, b, .0095), [.008, .004, .008], METAL_MAT, ARGENT, rond);   // vis des coins
    posee('casquette', PLANCHE, cadre, MAT, NOIR);
    const passe = regime > REGIME_LAMPE && etat.rapport > 0 && etat.rapport < 6;
    mettre('cylinder', sur(0, .068, .044), [.032, .008, .032], MAT, NOIR, rond);
    mettre('sphere', sur(0, .076, .046), [.024, .024, .024], 5, passe ? [1, .13, .04] : [.20, .03, .02], null, passe ? { emissive: 3.2 } : undefined);
    mettre('box', sur(-.125, .006, .0085), [.004, .054, .036], LAQUE, [.012, .012, .014], plat);
    mettre('box', sur(.142, .004, .0085), [.004, .042, .080], LAQUE, [.012, .012, .014], plat);
    // Compte-tours : lunette, cadran noir, graduations ivoire tous les 1 000 tr/min (longues aux milliers pairs),
    // zone rouge dès 12 000, aiguille orange
    const cadran = (a, b, d, fond) => { mettre('cylinder', sur(a, b, .009), [d + .010, .008, d + .010], METAL_MAT, ARGENT, rond); mettre('cylinder', sur(a, b, .012), [d, .006, d], MAT, fond, rond); return sur(a, b, .016); };
    const tours = cadran(0, 0, .089, [.02, .02, .022]);
    for (let g = 0; g <= 13; g++) {
      const long = g % 2 ? .006 : .011, rouge = g >= 12;
      trait(tours, -2.36 + 4.72 * g / 13, .041 - long / 2, long, .0028, rouge ? 5 : TISSU, rouge ? [1, .1, .05] : IVOIRE, rouge ? { emissive: .5 } : undefined);
    }
    trait(plus(tours, [pn, .002]), -2.36 + 4.72 * borner(regime / 13000, 0, 1), .014, .037, .0036, 5, [1, .40, .08], { emissive: .9 });
    mettre('cylinder', plus(tours, [pn, .003]), [.016, .006, .016], METAL_MAT, ARGENT, rond);
    // Deux petits cadrans : température d'eau à gauche, pression d'huile à droite (elle suit le régime)
    for (const [a, valeur] of [[-.074, .5 + .2 * borner(regime / 13000, 0, 1)], [.074, .12 + .78 * borner(regime / 11000, 0, 1)]]) {
      const centre = cadran(a, -.006, .040, [.02, .02, .022]);
      for (let g = 0; g < 5; g++) trait(centre, -1.2 + .6 * g, .0155, .005, .0022, TISSU, IVOIRE);
      trait(plus(centre, [pn, .0015]), -1.2 + 2.4 * valeur, .008, .017, .0026, 5, [1, .40, .08], { emissive: .7 });
      mettre('cylinder', plus(centre, [pn, .002]), [.008, .005, .008], METAL_MAT, ARGENT, rond);
    }
    // Rangée du bas : deux interrupteurs à levier, témoin vert du contact, témoin rouge (ralenti ou surrégime)
    // voi-8 (cockpit-8) : le régime ne descend jamais sous le ralenti de conduite.js ; seuil pris dans PARAMS
    for (const a of [-.046, -.034]) { mettre('cylinder', sur(a, -.043, .011), [.010, .006, .010], METAL_MAT, ARGENT, rond); mettre('box', sur(a, -.039, .019), [.003, .011, .003], METAL_MAT, ARGENT, cadre); }
    // voyants encastrés (David 14/11 : le témoin flottait à mi-hauteur de la planche) : lunette de métal noyée
    // dans la tôle, lentille posée dedans, comme les vis des coins
    const ralenti = B.conduite.PARAMS.ralenti, alerte = regime > 12600 || regime < ralenti + 300;
    const voyant = (a, allume, couleur, force) => {
      mettre('cylinder', sur(a, -.043, .0105), [.0125, .005, .0125], METAL_MAT, [.32, .32, .34], rond);
      mettre('sphere', sur(a, -.043, .014), [.009, .009, .009], 5, allume ? couleur : [.2, .03, .02], null, allume ? { emissive: force } : undefined);
    };
    voyant(.032, true, [.14, .9, .3], 1.1);
    voyant(.050, alerte, [1, .14, .05], 1.8);
    // Rapport à gauche, vitesse à droite, en segments ambre
    const chiffre = (texte, centre, h) => {
      const l = h * .56, t = h * .13, seg = SEGMENTS[texte] || '';
      const places = { a: [0, h / 2, l, t], b: [l / 2, h / 4, t, h / 2], c: [l / 2, -h / 4, t, h / 2], d: [0, -h / 2, l, t], e: [-l / 2, -h / 4, t, h / 2], f: [-l / 2, h / 4, t, h / 2], g: [0, 0, l, t] };
      for (const nom in places) {
        const [x, y, sx, sy] = places[nom], allume = seg.includes(nom);
        mettre('box', plus(centre, [wr, x], [pu, y], [pn, .011]), [sx, sy, .002], allume ? 5 : MAT, allume ? AMBRE : ETEINT, cadre, allume ? { emissive: 1.1 } : undefined);
      }
    };
    chiffre(etat.rapport > 0 ? String(etat.rapport) : 'N', plus(PLANCHE, [wr, -.125], [pu, .006]), .036);
    const kmh = String(Math.min(999, Math.max(0, Math.round(etat.kmh || 0)))).padStart(3, ' ');
    for (let k = 0; k < 3; k++) if (kmh[k] !== ' ' || k === 2) chiffre(kmh[k], plus(PLANCHE, [wr, .118 + k * .024], [pu, .004]), .026);

    // Volant : jante gainée, trois branches d'aluminium ajourées, flasque, cache et vis, ruban blanc en haut de la jante
    const e = R / .105, TUBE = .0225 * e;   // e : échelle du volant et des mains
    posee('jante', C, jante, TISSU, [.045, .045, .05]);
    posee('branches', plus(C, [wn, -.004]), jante, METAL_MAT, ACIER);
    for (const dir of [r, r.map(v => -v), u.map(v => -v)]) {
      const m = [dir, wn, croix(dir, wn)];
      for (const f of [.40, .66]) mettre('box', plus(C, [dir, R * f], [wn, -.0005]), [R * .17, .003, .010 * e], MAT, NOIR, m);
    }
    mettre('cylinder', plus(C, [wn, .002]), [.060 * e, .012, .060 * e], METAL_MAT, ACIER, jante);
    mettre('cylinder', plus(C, [wn, .008]), [.040 * e, .012, .040 * e], MAT, NOIR, jante);
    for (let b = 0; b < 3; b++) { const a = b * 2.0944 + 1.0472, d = u.map((v, k) => v * Math.cos(a) + r[k] * Math.sin(a)); mettre('cylinder', plus(C, [d, .0245 * e], [wn, .009]), [.007 * e, .004, .007 * e], METAL_MAT, ARGENT, jante); }
    mettre('cylinder', plus(C, [u, R]), [TUBE + .003, .010, TUBE + .003], TISSU, IVOIRE, selonAxe(r));

    // Levier de vitesses à droite : tige et pommeau d'aluminium, qui passe d'une position de la grille à l'autre
    const t = borner(etat.passage === undefined ? 1 : etat.passage, 0, 1), gA = grille(etat.rapportAvant === undefined ? etat.rapport : etat.rapportAvant), gB = grille(etat.rapport), w = lisse(.25, .6, t);
    const pommeau = [LEVIER[0] + gA[0] + (gB[0] - gA[0]) * w, LEVIER[1], LEVIER[2] + gA[1] + (gB[1] - gA[1]) * w];
    const pied = [LEVIER[0], LEVIER[1] - .14, LEVIER[2] + .012], tige = pommeau.map((v, k) => v - pied[k]);
    mettre('cylinder', pied.map((v, k) => v + tige[k] * .5), [.011, Math.hypot(tige[0], tige[1], tige[2]), .011], METAL_MAT, ARGENT, selonAxe(tige));
    mettre('sphere', pommeau, [.040, .040, .040], METAL_MAT, [.80, .81, .83]);

    // Mains : un seul maillage par main (src/main.js), fixe dans le repère de la jante, à 9 h et 3 h sur les branches,
    // comme dans vroom-unreal : doigts serrés autour du tube, pouce couché le long de la jante. Gant de la couleur de la
    // voiture (sombre si elle est très claire), paume de cuir sombre, garde des jointures plus sombre, élastique sombre
    // au poignet sous la sangle du gant. La manche de la combinaison sort de la manchette dans l'axe de la main, droite
    // sur 8 cm, puis descend vers le coude fixé à la caisse sous l'image (courbe de Bézier de vroom-unreal).
    // Pendant un changement de rapport, la main droite va au pommeau, s'y pose paume vers le bas, puis revient.
    const combi = liv.combinaison || c1.map(v => v * .7), gant = clarte(c1) > .62 ? [.13, .13, .15] : c1, cuir = [.055, .05, .048];
    const tubeEntre = (a, b, d, mat, color) => { const v = b.map((x, i) => x - a[i]); mettre('cylinder', a.map((x, i) => (x + b[i]) / 2), [d, Math.hypot(v[0], v[1], v[2]), d], mat, color, selonAxe(v)); };
    const boule = (p, d, mat, color) => mettre('sphere', p, [d, d, d], mat, color);
    // rotation d'angle a autour de l'axe unitaire n
    const tourner = (v, n, a) => { const c = Math.cos(a), x = croix(n, v), d = n[0] * v[0] + n[1] * v[1] + n[2] * v[2]; return v.map((q, i) => q * c + x[i] * Math.sin(a) + n[i] * d * (1 - c)); };
    const versLevier = lisse(0, .3, t) * (1 - lisse(.65, 1, t)), PRISE = VOLANT.prise, echelle = R / B.main.JANTE.R;
    const couleurs = [['gant', gant], ['paume', cuir], ['garde', gant.map(v => v * .8)], ['poignet', [.06, .06, .065]], ['sangle', gant.map(v => v * .92)]];
    for (const k of [-1, 1]) {
      const rk = r.map(v => v * k), ex = u.map((v, i) => v * Math.cos(PRISE) + rk[i] * Math.sin(PRISE)), haut = u.map((v, i) => v * Math.sin(PRISE) - rk[i] * Math.cos(PRISE));
      // repère de la prise : x vers le pilote, y le long de la jante vers le haut, z vers le moyeu (miroir à gauche)
      let G = plus(C, [ex, R]), m = [wn, haut, ex.map(v => -k * v)], ecart = 0;
      if (k > 0 && versLevier > 0) {
        const cible = plus(pommeau, [wn, .020], [wu, .030]);
        // cockpit-3 : doigts fermés, ils traversaient le tore de la jante (jusqu'à 12,5 mm) et la branche de 3 h
        // pendant le trajet ; la main s'écarte d'abord vers le dehors et vers le pilote avant de tourner, et le
        // gant passe en variante doigts ouverts dès qu'il ne touche plus le tube (ecart à fond)
        ecart = borner(Math.min(t, 1 - t) / .02, 0, 1);
        G = G.map((v, i) => v + ex[i] * .016 * ecart + wn[i] * .016 * ecart);
        // cockpit-3 (suite) : en ligne droite les doigts piquaient dans la boule du pommeau en vol (35 mm à
        // t 0,15) ; le trajet devient un arc de Bézier qui passe 15 cm au-dessus, la main retombe dessus
        const sommet = plus(cible, [wu, .15]);
        G = G.map((v, i) => v * (1 - versLevier) ** 2 + sommet[i] * 2 * versLevier * (1 - versLevier) + cible[i] * versLevier ** 2);
        m = m.map(v => tourner(v, wn, lisse(0, .10, t) * (1 - lisse(.86, 1, t)) * (Math.PI / 2 + phi)));      // cockpit-4 : le repère de départ porte déjà −phi ;
        // sans le +phi, la paume restait tournée du braquage au pommeau (91,5° du bas volant à fond)
      }
      const cote = k > 0 ? 'd' : 'g', local = q => plus(G, [m[0], q[0] * echelle], [m[1], q[1] * echelle], [m[2], k * q[2] * echelle]);
      for (const [piece, color] of couleurs) {
        const fo = FORMES['main-' + piece + '-' + cote + (k > 0 && piece === 'gant' && ecart >= .25 ? '-ouvert' : '')];
        mettre(fo.nom, plus(G, [m[0], fo.centre[0] * echelle], [m[1], fo.centre[1] * echelle], [m[2], fo.centre[2] * echelle]), fo.taille.map(v => v * echelle), TISSU, color, m);
      }
      // manche : elle part de l'intérieur de la manchette, puis tronçons le long de la courbe, du poignet au coude
      const vers = q => MAIN.points.poignet.map((v, i) => v + MAIN.points.axe[i] * q);
      const bout = local(vers(.012)), dir = norme(local(vers(.03)).map((v, i) => v - bout[i]));
      const coude = [COUDE[0], COUDE[1], k * COUDE[2]];
      const P2 = plus(bout, [dir, .08 * echelle]), P1 = plus(coude, [bout.map((v, i) => v - coude[i]), .48], [[0, 1, 0], -.019]);
      const bezier = f => bout.map((v, i) => (1 - f) ** 3 * v + 3 * (1 - f) ** 2 * f * P2[i] + 3 * (1 - f) * f * f * P1[i] + f ** 3 * coude[i]);
      let avant = bout;
      for (let n = 1; n <= 6; n++) {
        const ici = bezier(n / 6), d = (.050 + .022 * n / 6) * echelle;
        tubeEntre(avant, ici, d, TISSU, combi); boule(ici, d, TISSU, combi);
        avant = ici;
      }
    }

    // Rétroviseurs : ciel, horizon et piste dans la glace, et les voitures qui suivent, à leur place et à leur taille.
    // Champ de 32° par glace, ouvert de 6° vers l'extérieur ; trois voitures au plus.
    const ciel = etat.ciel || [.66, .77, .88], brume = etat.brume || [.62, .70, .76], suiveurs = etat.derriere || [];
    const GL = .132, GH = .048;                                    // glace : largeur et hauteur
    for (const k of [-1, 1]) {
      const zc = k * .47, x = .5225, y = .565;
      dans('box', [x, y + GH * .25, zc], [.003, GH * .5, GL], LAQUE, ciel.map(v => v * .62));
      dans('box', [x, y - GH * .04, zc], [.003, GH * .1, GL], LAQUE, brume.map(v => v * .5));
      dans('box', [x, y - GH * .295, zc], [.003, GH * .41, GL], LAQUE, [.085, .09, .095]);
      let n = 0;
      for (const v of suiveurs) {
        if (n >= 3) break;
        const b = .55 - v.x, a = v.z - zc, f = (Math.atan2(a, b) - k * .105) / .28;
        if (b < 2 || b > 90 || Math.abs(f) > 1) continue;
        const dist = Math.hypot(a, b), large = borner(1.9 / dist / .56 * GL, .005, GL * .55), haut = borner(1.0 / dist / .23 * GH, .004, GH * .62);
        // cockpit-1 : le suiveur le plus proche est enfoncé plus profond dans la glace (un seul lot, depthFunc LEQUAL) ;
        // cockpit-5 : hauteur et largeur bornées pour que caisse et pneus restent dans la glace
        const zi = borner(zc + f * GL / 2, zc - GL / 2 + .54 * large, zc + GL / 2 - .54 * large),
          yi = borner(y - GH * .08 - haut * .3, y - GH / 2 + .51 * haut, y + GH / 2 - haut / 2), xi = x - .0012 - .001 * (2 - n);
        dans('box', [xi, yi, zi], [.003, haut, large], LAQUE, v.couleur || c2);
        dans('box', [xi - .0006, yi - haut * .34, zi], [.003, haut * .34, large * 1.08], MAT, [.03, .03, .035]);
        n++;
      }
    }
    return M;
  }

  // Fantôme du meilleur tour : silhouette translucide.
  function fantome(ev, sortie) {
    const M = attitude(ev.cap, ev.tangage || 0, ev.roulis || 0), rotM = angles(M);
    const P = o => { const w = mul(M, o); return [ev.p[0] + w[0], ev.p[1] + w[1], ev.p[2] + w[2]]; };
    const bleu = [.45, .85, 1];
    for (const nom of ['quille', 'fleche', 'pontons', 'goutte', 'moteur']) sortie.push({ shape: FORMES[nom].nom, p: P(FORMES[nom].centre), s: FORMES[nom].taille, r: rotM, fx: true, alpha: .26, color: bleu });
    for (const [o, s] of [[[2.11, .13, 0], [.38, .04, 1.62]], [[-2.05, .90, 0], [.34, .06, 1.10]]]) sortie.push({ shape: 'box', p: P(o), s, r: rotM, fx: true, alpha: .26, color: bleu });
    const rot = angles(mulM(M, ROUE_AXE));
    for (const w of ROUES) sortie.push({ shape: 'cylinder', p: P([w.x, w.r, w.z]), s: [2 * w.r, w.l, 2 * w.r], r: rot, fx: true, alpha: .22, color: bleu });
  }

  B.voiture = { modele, poser, cockpit, fantome, visible, attitude, angles, mul, mulM, euler, braquages, OEIL, K, VOLANT, PLANCHE, PENTE_PLANCHE, COUDE, LEVIER, ROUES, EMPATTEMENT, FORMES };
})(globalThis.BITUME = globalThis.BITUME || {});
