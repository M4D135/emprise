/* BITUME — main droite gantée d'un pilote qui tient la jante du volant à 3 h, sur la branche, comme dans vroom-unreal.
   Une forme par pièce (gant, paume, garde des jointures, manchette, sangle), en carènes et tubes (src/carene.js).
   Prise : la main est à l'extérieur de la jante, dos tourné vers le dehors, axe de la main perpendiculaire au plan du
   volant, vers le pilote ; la jante passe dans la paume, juste sous les jointures. Les doigts font le tour du tube
   par la planche : l'index au-dessus de la branche et l'auriculaire au-dessous reviennent côté moyeu, le majeur et
   l'annulaire s'arrêtent contre le dos de la branche. Le pouce remonte la jante sur sa face tournée vers le pilote.
   Le poignet reste dans l'axe : la manche le prolonge, puis descend vers le coude (src/voiture.js).
   Repère local, en mètres, taille réelle : origine au centre de la section du tube de la jante au point de prise ;
   x vers le pilote, y le long de la jante vers le haut du volant, z vers le moyeu. La main gauche est son miroir. */
(function (B) {
  'use strict';

  const JANTE = { R: .135, r: .0145 };
  const deg = Math.PI / 180, JEU = .0004;                       // jeu entre le gant et le gainage de la jante

  // Point autour du tube de la jante. psi : abscisse angulaire le long de la jante (> 0 vers le haut du volant) ;
  // theta : angle autour du tube (0 : vers le pilote, 90° : dehors, 180° : vers la planche, 270° : vers le moyeu) ;
  // d : distance à l'axe du tube.
  function AUTOUR(psi, theta, d) {
    const cy = JANTE.R * Math.sin(psi), cz = JANTE.R - JANTE.R * Math.cos(psi);
    const ct = Math.cos(theta), st = Math.sin(theta);
    return [d * ct, cy + d * st * Math.sin(psi), cz - d * st * Math.cos(psi)];
  }

  // Branche de 3 h du volant (src/voiture.js), dans ce repère : demi-largeur le long de la jante, faces côté planche et
  // côté pilote. Elle part du tube vers le moyeu, dans le plan du volant.
  const BRANCHE = { demi: .0174, dos: -.0076, face: -.0011 };
  // Jointures sur le flanc extérieur de la jante, un peu vers la planche
  const JOINTURES = { theta: 95 * deg, d: .034 };
  // Axe de la main, des jointures vers le poignet : vers le pilote, un peu vers le moyeu (dos tourné de 80° vers le
  // dehors, comme dans vroom-unreal)
  const AXE = normalise([.985, 0, .174]);
  // Doigts : place le long de la jante, rayon, puis angles autour du tube (milieu de la première phalange, deux
  // articulations, bout), chaque point au contact du tube. Rayons le long du doigt : base, jointure, puis ces 4 points.
  const DOIGTS = [
    { nom: 'index', s: .0318, r: .0098, tour: [136, 178, 226, 260] },
    { nom: 'majeur', s: .0108, r: .0102, tour: [134, 165, 196, 218] },
    { nom: 'annulaire', s: -.0103, r: .0097, tour: [134, 165, 196, 218] },
    { nom: 'auriculaire', s: -.0302, r: .0086, tour: [134, 172, 216, 248] }
  ];
  const EFFILE = [1, 1, .99, .96, .9, .84];
  // Pouce : éminence charnue du poignet au bas de l'index, côté paume, puis le long de la jante vers le haut, couché sur
  // sa face tournée vers le pilote, devant la branche. Éminence : [vers les jointures depuis le poignet, vers
  // l'index, vers la paume] ; pouce : [abscisse le long de la jante, angle autour du tube] ; rayons de la base au bout.
  // carene-4 : la base du pouce était trop serrée (rayon de courbure de l'axe 8,8 mm sous le rayon du tube,
  // 12,4 mm : la peau se recoupait) ; le premier point de contact est un peu plus haut sur la jante.
  const POUCE = { r: [.0160, .0158, .0124, .0108, .0094], eminence: [[.016, .012, .018], [.036, .020, .026]], tour: [[.028, -20], [.040, -32], [.052, -36]] };

  function construire(ouvert) {
    const C = B.carene;
    const K = AUTOUR(0, JOINTURES.theta, JOINTURES.d);            // jointure du majeur et de l'annulaire : origine du dos
    const a = AXE, bz = [0, 1, 0], Y = croix(bz, a);              // Y : normale au dos de la main, vers le dehors
    const m = [a, Y, bz];
    const W = additionner(K, multiplier(a, .088));                // centre du poignet

    // --- Doigts : de l'intérieur du dos à la jointure, puis autour du tube ---
    // cockpit-3 : variante ouverte pour le trajet au pommeau — les doigts ne serrent plus le tube (ils le
    // traversaient, fermés, jusqu'à 12,5 mm) ; ils restent ouverts vers le dehors, à plat sur la paume levée
    const serrage = ouvert ? .28 : 1;
    const gant = [], pointsDoigts = [], jointures = [];
    for (const doigt of DOIGTS) {
      const psi = doigt.s / JANTE.R, jointure = AUTOUR(psi, JOINTURES.theta, JOINTURES.d), r = doigt.r;
      const rayons = EFFILE.map(f => r * f);
      const pts = [additionner(jointure, multiplier(a, .024)), jointure, ...doigt.tour.map((t, i) => AUTOUR(psi, JOINTURES.theta + (t * deg - JOINTURES.theta) * serrage, JANTE.r + rayons[i + 2] + JEU))];
      gant.push(...C.tube(pts, rayons, { cotes: 10, pas: 4, bouts: true }));
      pointsDoigts.push(pts); jointures.push(jointure);
    }

    // --- Dos de la main : carène bombée, large aux jointures, effilée vers le poignet ---
    const SECTIONS = [
      { x: -.008, y0: -.012, y1: .006, l: .036, n: 2.2 },
      { x: .004, y0: -.0165, y1: .0115, l: .0425, n: 2.5 },
      { x: .030, y0: -.0195, y1: .0125, l: .0440, n: 2.6 },
      { x: .060, y0: -.0185, y1: .0120, l: .0405, n: 2.5 },
      { x: .086, y0: -.0150, y1: .0105, l: .0325, n: 2.3 }
    ];
    gant.push(...C.transformer(C.carene(SECTIONS, { cotes: 22, pas: 4, bouts: true }), m, K));

    // --- Pouce : de l'éminence, côté index et paume, jusque sur la face de la jante tournée vers le pilote ---
    const eminence = POUCE.eminence.map(([x, y, z]) => additionner(additionner(W, multiplier(a, -x)), additionner(multiplier(bz, y), multiplier(Y, -z))));
    const pouce = [...eminence, ...POUCE.tour.map(([s, t], i) => AUTOUR(s / JANTE.R, t * deg * (ouvert ? .3 : 1), JANTE.r + POUCE.r[i + 2] + 4 * JEU))];
    gant.push(...C.tube(pouce, POUCE.r, { cotes: 12, pas: 4, bouts: true }));

    // --- Paume : cuir sombre côté jante, sous le dos ---
    const paume = C.transformer(C.carene(SECTIONS.map(q => ({ x: q.x + .003, y0: q.y0 - .0012, y1: q.y0 + .008, l: q.l * .97, n: q.n })),
      { cotes: 22, pas: 4, bouts: true }), m, K);

    // --- Garde : une bosse de cuir sur chaque jointure, dans l'axe du doigt ---
    const garde = [];
    jointures.forEach((j, i) => {
      const p = additionner(j, multiplier(Y, .0045));
      garde.push(...C.tube([additionner(p, multiplier(a, .014)), additionner(p, multiplier(a, -.003))], i === 3 ? .0085 : .0098, { cotes: 10, pas: 2, bouts: true }));
    });

    // --- Manchette évasée, qui recouvre le bout de la manche, et sangle à sa base ---
    // (bouts plats : la manche entre dans la manchette)
    const rond = (x, r) => ({ x, y0: -r, y1: r, l: r, n: 2 });
    const poignet = C.transformer(C.carene([rond(-.004, .0262), rond(.014, .0282), rond(.028, .0298)], { cotes: 18, pas: 3 }), m, W);
    const sangle = C.transformer(C.carene([rond(-.002, .0292), rond(.012, .0292)], { cotes: 18, pas: 1 }), m, W);

    const points = { doigts: pointsDoigts, pouce, jointures, poignet: W, axe: a, dos: Y };
    return { gant, paume, garde, poignet, sangle, points };
  }

  // --- Outils vectoriels ---
  function normalise(v) { const l = Math.hypot(v[0], v[1], v[2]); return l ? [v[0] / l, v[1] / l, v[2] / l] : [0, 0, 0]; }
  function croix(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function additionner(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function multiplier(v, s) { return [v[0] * s, v[1] * s, v[2] * s]; }

  B.main = { construire, AUTOUR, JANTE, JEU, BRANCHE, AXE, DOIGTS, EFFILE, POUCE };
})(globalThis.BITUME = globalThis.BITUME || {});
