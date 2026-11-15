# FERRO : WebGPU natif, secours WebGL2

Les tableaux de migration ci-dessous sont ceux de la version 0.6.0. Les optimisations CPU et la validation de l’extérieur chargé en 0.6.1 figurent dans [OUTDOOR-PERFORMANCE.md](OUTDOOR-PERFORMANCE.md).

EMPRISE 0.6.0 sélectionne WebGPU en priorité lorsque le navigateur fournit un adaptateur utilisable. WebGL2 reste disponible au démarrage et après une défaillance du périphérique natif. Le backend annoncé correspond à l’API qui dessine effectivement la scène.

Cette migration conserve le jeu procédural et sa simulation JavaScript. Elle n’ajoute ni ray tracing matériel, ni moteur physique GPU, ni modèles ou textures importés. Les reflets restent des réflexions d’environnement et des réflexions en espace écran (SSR).

## Architecture

| Fichier | Responsabilité |
| --- | --- |
| `src/ferro/renderer.js` | Renderer WebGL2 existant et fonctions communes `FRender.shared` : géométrie procédurale, format des instances, index spatial, visibilité et réglages. |
| `src/ferro/webgpu-renderer.js` | Ressources, pipelines et commandes WebGPU natifs ; ombres, scène, effets, SSR, post-traitement et mesures GPU. |
| `src/ferro/webgpu-shaders.js` | WGSL généré hors ligne et manifestes des uniformes, textures et samplers. |
| `src/ferro/backends.js` | Choix du backend, échecs d’initialisation, transfert de responsabilité au jeu et notification d’un incident. |
| `src/pdr/foule-webgpu.js` | Maillages, interpolation, locomotion, LOD et rendu natif de la foule PDR. |
| `src/game.js` | Installation de la scène et reprise de la même session avec un canvas WebGL2 neuf. |

Les deux backends partagent les données et les règles de visibilité. Ils possèdent leurs propres ressources graphiques. Le renderer natif expose `renderer.gpu`, pas un faux contexte `.gl`.

Les instances utilisent le même format de 64 octets. Les chunks statiques et leurs buffers restent en cache tant que leurs objets ne changent pas. Les mises à jour de formes animées passent par `updateShape()`. Les pipelines sont mis en cache ; les bind groups sont réutilisés lorsque leurs textures sont identiques. Chaque état de passe dispose de son propre buffer d’uniformes : une écriture pour le soleil, l’arme ou le bloom ne peut pas écraser l’état d’une autre passe avant la soumission.

L’ordre général des passes est :

1. Atlas de profondeur des ombres : soleil, lampes et phare/torche selon la scène.
2. Ciel, mer lointaine, monde, terrain, lots, acteurs, foule et effets translucides.
3. Résolution explicite de la profondeur MSAA pour le SSR, si nécessaire.
4. Arme et effets proches avec leur propre profondeur et plan de coupe.
5. SSR à demi-résolution, puis bloom et composition finale.

La couleur avant l’arme et la profondeur du monde sont conservées pour les reflets. Une arme proche ne remplace donc pas la géométrie utilisée par le SSR.

### Contrat des mises à jour statiques

`updateWorld(meshes, revision, points, {revisionedMeshes: true})` permet au producteur du décor de garantir qu’un objet conservant son identité et son `renderRevision` est inchangé. L’option vaut uniquement pour cet appel ; les appels sans option conservent les vérifications strictes des signatures spatiales et des catégories de chunks.

Avec cette garantie, toute modification d’un champ de rendu doit soit créer un nouvel objet mesh, soit incrémenter son `renderRevision` avant `updateWorld`. Cela comprend le contenu ou le remplacement des tableaux `p`, `s`, `r` et `color`, ainsi que `shape`, `mat`, `emissive`, `detail`, `ground`, `backgroundWater` et les champs utilisés par `surfaceFlags`. Les métadonnées internes de l’index ne doivent pas être modifiées directement. Une identité ou une révision différente reconstruit complètement la ligne d’instance et ses métadonnées spatiales ; elle invalide les chunks concernés.

EMPRISE active cette option uniquement sur la mise à jour du décor de sa frame : les destructions, ouvertures et projections d’intérieur produisent de nouveaux meshes ; les recolorations d’incendie incrémentent leur révision. Le contrat ne réduit ni le nombre d’objets, ni leurs détails, ni les effets. Les insertions, suppressions, doublons, réordonnancements et changements complets de scène restent pris en charge. `tests/renderer-revisioned.mjs` compare le chemin strict et ce chemin explicite, avec les octets du renderer de référence `3ac8e4c` reconstruits à neuf.

## Sélection et reprise

Les paramètres d’URL permettent de vérifier chaque chemin :

- `?renderer=auto` : préférence WebGPU, puis WebGL2 si nécessaire ; c’est aussi le comportement sans paramètre.
- `?renderer=webgpu` : demande explicite de WebGPU, avec secours WebGL2 si cette demande échoue.
- `?renderer=webgl2` : utilise directement WebGL2 sans demander d’adaptateur WebGPU.

La version et le backend actif apparaissent sur l’écran titre. Les diagnostics sont accessibles dans `RADE.game.renderer.stats` : `backend`, `requestedBackend`, `fallbackReason`, `deviceLost`, `errorEvents`, résolution et compteurs de rendu. `RADE.game.backendEvents` conserve les reprises effectuées pendant la session.

Le contrat du sélecteur est asynchrone :

```js
const chosen = await FRenderBackends.create(canvas, {
  backend: 'auto',
  msaa: 4,
  shadowMapScale: 1,
  vignette: .9,
  bloomThreshold: [.9, .99],
  onDeviceLost: recoverRenderer,
  onError: recoverRenderer
});

renderer = chosen.renderer;
canvas = chosen.canvas;
installCurrentScene(renderer);
await chosen.activate();
```

`activate()` intervient après que le jeu possède le renderer et a installé sa scène. Les pertes de périphérique et erreurs reçues pendant cet intervalle sont mémorisées, puis livrées une seule fois. Si l’incident est déjà connu avant la fin de `create()`, le sélecteur choisit directement WebGL2.

L’initialisation native a une limite de 30 secondes. Une initialisation qui termine après ce délai est libérée ; elle ne remplace pas le secours déjà actif. Une erreur de création libère le périphérique, les buffers, les textures et la configuration du canvas partiellement installés.

Un canvas ne pouvant pas passer d’un type de contexte à l’autre, le secours utilise un clone neuf. Le jeu conserve la même session, ses objets de simulation et son état persistant. Il réinstalle le décor et la foule, remet les commandes transitoires à zéro et reprend son état de marche précédent. Les événements de souris, tactile, molette et menu contextuel ciblent le canvas courant. La sortie volontaire de pointer lock pendant cette opération est distinguée d’une demande de pause du joueur.

`FRenderWebGPU.create(canvas, options)` peut aussi être utilisé directement. Il retourne les méthodes de rendu habituelles : `setWorld`, `updateWorld`, `setEnvironment`, `draw`, `resize`, `actorFilter`, `updateShape`, `setNappes`, `setLots` et `dispose`. L’application qui l’appelle directement reste responsable du traitement de `onDeviceLost` et `onError`.

## Fidélité du rendu

La comparaison garde les mêmes géométries, matériaux, populations, caméras et réglages. Elle n’abaisse pas silencieusement le niveau de détail pour accélérer WebGPU.

| Élément | Traitement natif |
| --- | --- |
| Géométrie et chunks | Mêmes formes procédurales, instance packing, portées et tests de visibilité. |
| Matériaux | Même shader PBR ; albedo `rgba8unorm-srgb`, normales et rugosité `rgba8unorm`, mipmaps et anisotropie. |
| Ciel et météo | Même soleil, nuages, vent, pluie, éclairs et paramètres horaires. |
| Ombres | Même atlas et mêmes volumes ; profondeur `depth32float` au lieu de `DEPTH_COMPONENT24` côté WebGL2. |
| Anticrénelage | MSAA 4 échantillons au même réglage ; changement 4↔1 pris en charge par la scène et la foule. |
| Reflets | Même SSR de 48 étapes et même résolution ; profondeur MSAA résolue explicitement. |
| Foule | Mêmes maillages procéduraux, listes de LOD, interpolation des états, locomotion et matériaux. |
| Effets et arme | Même transparence, éclairage et ordre ; profondeur séparée pour l’arme proche. |
| Post-traitement | Même bloom, tonemapping et vignettage. |

Le passage des conventions GL à WebGPU est explicite : clip Z remappé de `[-w,+w]` vers `[0,w]`, inversion Y des seules textures issues du rendu, conversion des viewports de l’atlas, et signe des dérivées Y corrigé pour les repères tangents des normal maps. Les matrices fournies par le jeu conservent leur convention GL.

Deux différences de compteurs sont normales et ne représentent pas une différence de population :

- WebGPU n’a pas de taille programmable pour les points. Les sprites de foule lointains deviennent des quads de six sommets. Dans la scène de port mesurée, **434 sprites ajoutent 868 triangles comptabilisés** ; leur fonction visuelle et leur LOD restent les mêmes.
- La résolution explicite de la profondeur MSAA ajoute **un draw call** lorsque le SSR est actif. WebGL2 effectuait cette opération par un blit de profondeur, absent de son compteur de dessins.

Les profondeurs flottantes, le choix des échantillons lors de leur résolution et les calculs du pilote peuvent produire de petites différences de pixels. La validation visuelle compare les scènes et les effets ; elle ne prétend pas obtenir une identité binaire entre deux API graphiques.

## Compilation des shaders

Les sources GLSL du moteur et de la foule restent les références. `tools/webgpu-shaders.py` les extrait, explicite leur disposition mémoire et utilise **Naga 30.0.1** pour produire le WGSL. Le petit compilateur Rust est dans `tools/webgpu-compiler/`, avec ses versions verrouillées.

```sh
python3 tools/webgpu-shaders.py
python3 tools/webgpu-validate.py
```

La génération valide les 18 stages correspondant à neuf programmes. La validation navigateur crée les modules et pipelines sur le vrai périphérique. Les empreintes des sources et stages figurent dans [webgpu-shaders-validation.json](webgpu-shaders-validation.json).

Naga et Rust sont des outils de développement. Le jeu livré charge le WGSL déjà généré ; aucun compilateur, téléchargement de modèle, texture externe ou service réseau supplémentaire n’est nécessaire pour cette migration. Les données cartographiques déjà intégrées au jeu restent inchangées.

## Vérifications effectuées

La machine de référence utilise Chrome sur un adaptateur Apple, architecture `metal-3`. La sonde vérifie l’API, l’adaptateur, le périphérique, les fonctionnalités et les limites réellement disponibles : [webgpu-capabilities.json](webgpu-capabilities.json). Cette vérification ne vaut pas certification de tous les navigateurs ou GPU ; le secours couvre leur éventuelle indisponibilité.

Les tests ont des rôles distincts :

| Test | Ce qu’il vérifie |
| --- | --- |
| `tests/webgpu-renderer.mjs` | Disposition des uniformes, indépendance des états entre passes, profondeur arme/SSR, hooks de foule, caches de resize bornés, anneau de mesures et libération après échec. Device instrumenté, sans prétendre valider un GPU réel. |
| `tests/render-backends.mjs` | Sélection, refus, timeout, nettoyage tardif, activation et notification unique des incidents. |
| `tests/render-backends-handoff.mjs` | 24 placements d’erreur/perte dans les microtâches autour du transfert au jeu, y compris installation asynchrone. |
| `tests/crowd-webgpu.mjs` | Géométrie, données d’états, LOD, uniformes, ressources et 20 transitions MSAA 4↔1 sans croissance des buffers ou bind groups. |
| `tests/crowd-webgpu-browser.py` | Rendu natif réel de la foule, ombres, changement de pose et erreurs GPU. |
| `tests/render-recovery.py` | Cinq défaillances réelles ou injectées dans le navigateur et reprise avec les mêmes objets de session. |

Le [rapport de reprise](render-recovery.json) couvre `device.destroy()`, une erreur de validation GPU non capturée, un rejet de `requestAdapter`, l’absence d’API et un échec d’installation de scène native. L’identité de session, l’argent, les PV, l’arme et les munitions sont conservés. Le jeu est testé avec `testing=false` lors de la reprise pour exercer le comportement normal de pointer lock.

Pour vérifier les commandes sans modifier cet état témoin, **la simulation est gelée et ses commandes sont enregistrées**. W, E et le clic gauche sont envoyés par CDP. Le mouvement de regard, la molette et le menu contextuel sont des événements DOM synthétiques. Ces tests prouvent le raccordement des commandes au nouveau canvas ; ils ne constituent pas une nouvelle campagne de tests physiques des déplacements ou des tirs. La [capture du secours](render-recovered-webgl2.png) montre le rendu après reprise.

## Benchmark avant/après

Le protocole utilise `tests/render-benchmark-scenes.js` et `tests/render-benchmark.py`. Chaque rapport garde le SHA-256 du HTML et du fixture, le build, le navigateur, la signature du contenu, les réglages, les erreurs et les compteurs.

Trois séries permettent de séparer le changement de build du changement d’API :

- **before** : build 0.5.0 conservé avant migration, WebGL2.
- **after-webgl2** : build migré, secours WebGL2 forcé.
- **after-webgpu** : même build migré, WebGPU effectivement actif.

Les cinq scènes figées sont le Vieux-Port de jour, de nuit, sous la pluie avec reflets, une vue de Notre-Dame de la Garde et l’intérieur d’une boutique. Elles utilisent les mêmes caméras, objets, population, heure, météo et tick de simulation, en **1440 × 900, DPR 1, MSAA4**, avec ombres et reflets. Le streaming de la ville est achevé avant la mesure. Chaque scène est préchauffée pendant 90 frames, puis mesurée sur **trois essais de 240 frames**.

```sh
python3 tests/render-benchmark.py --backend webgl2 --label before --html /chemin/vers/baseline-050.html
python3 tests/render-benchmark.py --backend webgl2 --label after-webgl2
python3 tests/render-benchmark.py --backend webgpu --label after-webgpu
```

Les navigateurs de mesure sont lancés successivement avec un profil neuf, par pipe CDP, sans serveur ni port d’écoute. Les captures `render-<label>-<scene>.png` permettent de contrôler la fidélité en plus des signatures des paquets.

### Lecture des mesures

- **Frame** : temps entre deux rendus réels, sensible à la synchronisation écran et aux autres tâches du navigateur.
- **Render CPU** : durée de l’appel au renderer, dont préparation des commandes et envois.
- **Game CPU** : travail de la frame du jeu, construction des modèles et rendu compris. La simulation est figée : ce chiffre ne mesure pas le coût d’une bataille ou d’une destruction active.
- **GPU** : temps mesuré par `EXT_disjoint_timer_query_webgl2` côté WebGL2 et `timestamp-query` côté WebGPU, si disponibles.

Les timestamps natifs encadrent la première et la dernière passe de la frame. Les résultats passent par un anneau de trois buffers et `mapAsync()` ; le jeu n’attend pas `queue.onSubmittedWorkDone()` à chaque frame. `await renderer.setProfiling(true)` commence une mesure ; `await renderer.setProfiling(false)` draine les lectures restantes et retourne les échantillons en millisecondes. Le stockage est borné et les mesures non disponibles sont signalées.

**Les périmètres GPU ne sont pas strictement identiques** : les écritures `queue.writeBuffer`/`writeTexture` précédant la première passe WebGPU sont hors de ses timestamps, tandis que la query WebGL entoure l’appel `draw()`. Les mesures frame et CPU complètent donc le temps GPU ; un seul chiffre ne suffit pas à attribuer un gain à l’API.

L’écran de référence est plafonné à 60 Hz. Une réduction du temps GPU peut laisser les deux versions à environ 60 FPS. Les p50/p95/p99, pics et nombres de frames dépassant 25/50/100 ms sont plus utiles qu’un compteur FPS moyen. WebGPU n’est pas une garantie d’accélération : les résultats dépendent du pilote, de la scène, du coût CPU et du travail envoyé.

### Portage mesuré avant les corrections visuelles

**Résultats sur ce Mac : gain GPU net dans la boutique, coût GPU proche en extérieur, aucun gain de FPS démontré.** Le coût CPU de rendu augmente légèrement au port et dans la boutique ; le p95 des intervalles au port passe de 16,9 à 18,3–18,6 ms dans cette série. La migration seule ne prouve donc pas une amélioration de la fluidité.

Valeurs en millisecondes, médiane des p95 des trois essais ; plus bas est meilleur.

| Scène | GPU avant | GPU secours GL2 | GPU WebGPU | CPU rendu avant → WebGPU | Intervalle avant → WebGPU |
|---|---:|---:|---:|---:|---:|
| Port · jour | 14.36 | 13.51 | 13.76 | 2.30 → 2.60 | 16.90 → 18.30 |
| Port · nuit | 13.86 | 13.62 | 13.37 | 2.30 → 2.50 | 16.90 → 18.60 |
| Port · pluie | 13.97 | 13.44 | 13.57 | 2.20 → 2.40 | 16.90 → 18.60 |
| Bonne-Mère | 13.37 | 13.74 | 13.30 | 3.80 → 3.30 | 18.10 → 18.60 |
| Boutique | 10.02 | 10.01 | 7.67 | 0.70 → 1.10 | 18.10 → 18.10 |

La boutique passe de 10,02 à 7,67 ms de temps GPU p95 (environ −23,5 %), mais le coût CPU de son rendu passe de 0,7 à 1,1 ms. Les médianes des intervalles restent proches de 16,7 ms : un compteur de FPS plafonné à 60 masque ces différences. [Synthèse et contrôles automatiques de parité](render-comparison.json).

Les 45 essais du portage ont des signatures de scène identiques entre versions, un streaming terminé et stable, les mêmes réglages et aucune erreur de rendu. Les distributions indiquent leur effectif : 3 596 échantillons GPU natifs pour 3 600 rendus mesurés, soit quatre timestamps manquants. Le harness conserve aussi le compteur explicite `nativeProfiler.dropped` lors des prochaines exécutions. Le HTML autonome passe de 22 195 193 à 22 640 157 octets (+2,0 %) pour contenir les deux backends.

Rapports : [avant](render-benchmark-before.json), [après WebGL2](render-benchmark-after-webgl2.json), [après WebGPU](render-benchmark-after-webgpu.json).

Les essais sont séquentiels, sur une seule machine ; la fréquence et la température du GPU ne sont pas verrouillées. Les timestamps natifs sont quantifiés par le navigateur. Les petits écarts ne permettent pas de conclure à une accélération générale.

### Build final avec ombres corrigées

Le build `31cd866fea` ajoute un filtre d’ombres continu, corrige la pente des ombres de foule et recale la garniture de la 205 sur son montant. Les causes et les comparaisons visuelles sont détaillées dans [SHADOWS.md](SHADOWS.md). Son HTML fait **22 645 443 octets**, SHA-256 `b699d747128015542c7bcf91d8774ccfb89fb705d153b72a188331134e7b1312`.

La correction de géométrie change la signature des véhicules. Une seconde comparaison mesure donc **WebGL2 et WebGPU sur ce même build final**, avec le protocole précédent : cinq scènes, trois essais de 240 frames, mêmes réglages et signatures identiques entre backends, soit 30 essais supplémentaires.

| Scène | GPU WebGL2 | GPU WebGPU | CPU rendu GL2 → WebGPU | Intervalle p95 GL2 → WebGPU |
|---|---:|---:|---:|---:|
| Port · jour | 13.97 | 14.09 | 2.30 → 2.70 | 16.90 → 17.40 |
| Port · nuit | 14.41 | 14.09 | 2.30 → 2.50 | 17.20 → 17.40 |
| Port · pluie | 15.65 | 13.89 | 2.30 → 2.40 | 16.90 → 17.50 |
| Bonne-Mère | 13.46 | 14.09 | 3.60 → 2.90 | 17.30 → 17.20 |
| Boutique | 9.98 | 7.67 | 0.70 → 1.10 | 17.10 → 17.20 |

Valeurs en millisecondes, médianes des p95 des trois essais. Le gain GPU de la boutique reste d’environ 23 %. Les résultats extérieurs varient selon la scène, sans gain général de fluidité. La vue Bonne-Mère native contient trois intervalles supérieurs à 25 ms sur 720 frames, dont un maximum de 67,1 ms ; les quatre autres scènes restent sous 25 ms. Les mesures de jeu actif ci-dessous complètent ces scènes figées.

Rapports : [comparaison finale](render-final-comparison.json), [WebGL2 final](render-benchmark-final-webgl2.json), [WebGPU final](render-benchmark-final-webgpu.json). Aucune erreur JS ou GPU ni changement de contenu pendant les mesures. Les timestamps natifs fournissent 3 587 échantillons sur 3 600 frames ; les 13 lectures manquantes sont comptées dans `nativeProfiler.dropped`.

### Réglages et jeu actif

`render-options.py` valide sur le GPU réel 27 états combinant MSAA4/1, SSR, bloom, ombres, qualité et trois résolutions. Les 480 PNJ restent présents ; les ressources sont stables après chauffe et la capture restaurée est identique à celle de départ. [Rapport](render-options.json).

La signature de scène crée temporairement des tableaux avant chaque essai. Elle peut influencer les collectes mémoire ultérieures : les pics isolés de ces séries ne sont pas attribués au moteur sans profil supplémentaire. Le contrôle de jeu actif de 40 secondes (`tests/streaming.py`) utilise un observateur de frames sans ces signatures répétées.

La mesure active de 40 secondes du build `50a372023a` (avant le correctif visuel des ombres) contient 2 400 images, à une résolution interne réelle de 1 758 × 1 024 : p95 17,3 ms, p99 17,6 ms, maximum 17,7 ms, aucune image au-dessus de 25 ms et aucune tâche longue observée. Elle inclut rotation de caméra, IA et sauvegardes automatiques ; ce parcours reste limité au secteur de départ. [Rapport conservé avant correction](frame-pacing-pre-shadow.json).

Le même parcours actif a été repris sur le build final `31cd866fea` : **2 400 images, p95 17,2 ms, p99 17,5 ms, maximum 17,7 ms**, zéro intervalle supérieur à 25 ms et zéro tâche longue observée. La résolution interne reste 1 758 × 1 024. La perte volontaire du périphérique en fin de test déclenche le secours WebGL2 et le jeu reprend. [Rapport final](frame-pacing.json).

Le test de façade a échoué une fois malgré des tirs enregistrés. Deux reproductions instrumentées sur WebGPU ont ensuite ouvert la brèche au troisième tir (61 débris, collision de 8 à 20 m), sans erreur ni secours. La cause intermittente initiale n’est pas établie ; les assertions sont conservées et les traces sont désormais écrites même en cas d’échec. Voir `render-gameplay.json` et `collapse-browser.json`.
