# EMPRISE 0.6.1 — ville active

Cette passe réduit le travail CPU du décor et des collisions sans changer les modèles, les populations, les effets ou les réglages graphiques.

## Travail supprimé

Les requêtes piétonnes réutilisent les volumes des véhicules. Une requête située dans une seule cellule parcourt directement ses colliders. La reconstruction d’un décor conserve les volumes et les cellules inchangés ; elle respecte l’ordre original lors d’une insertion, d’un retrait ou d’un réordonnancement.

Le moteur de destruction mémorise les relations de support et les volumes des solides. Il recompile les groupes touchés dans leur ordre original. Restaurer une sauvegarde invalide ces caches. Un feu qui ne modifie aucune surface ne déclenche plus une reconstruction du monde ; ses particules continuent d’être simulées et affichées.

Les renderers réutilisent leurs buffers de préparation CPU. L’index spatial conserve les entrées inchangées et leur ordre ; seuls les chunks concernés sont repackés et transférés. Le décor EMPRISE utilise explicitement le contrat `revisionedMeshes` documenté dans [WEBGPU.md](WEBGPU.md). Un objet statique modifié doit changer d’identité ou incrémenter `renderRevision`. Les producteurs de destruction, de streaming et de projection intérieure ont été examinés ; les recolorations par le feu sont versionnées. Les appels génériques conservent les vérifications strictes.

Les doublons, réordonnancements, nouvelles scènes et restaurations de contexte conservent un chemin de reconstruction complète. Les objets dynamiques, ombres, effets transparents et personnages restent soumis aux mêmes règles de sélection et de détail.

## Protocole extérieur

`tests/outdoor-stress.py` exécute la vraie session dans Chrome sur Apple M5, macOS 27.2.1, Chrome 157.0.8103.39, à 1 440 × 900 et DPR 1. La scène contient 960 PNJ, dont 360 placés dans des cellules libres du quai, et 39 véhicules de trafic. Trois voitures sont détruites par les fonctions de détonation réelles ; les IA et les débris physiques restent actifs. Le joueur est maintenu vivant pour conserver le même parcours ; il s’agit d’un test de charge préparé, pas d’une session de combat enregistrée au clavier.

La caméra, les modèles, le MSAA 4×, les ombres, les réflexions et le bloom sont identiques. Après préparation du streaming et 90 images de chauffe, chaque essai mesure 600 images. Deux pas normaux de simulation de 1/120 s suivent chaque image, afin que la version la plus lente ne fasse pas moins de travail. Un essai séparé en temps réel conserve l’accumulateur de production.

`tests/outdoor-report.py` refuse la comparaison si l’état initial, les empreintes de simulation, le calendrier des détonations ou les compteurs de modèles, triangles, instances et appels de dessin diffèrent. Les rapports conservent le SHA du HTML et de la fixture. Les profils CPU sont effectués séparément et exclus des chiffres de cadence.

## Résultats et limite de mesure

**Les essais finaux ne sont pas isolés : une partie de Point de rupture tournait simultanément sur le Mac.** Sa charge CPU/GPU variable empêche d’attribuer les écarts de cadence au seul correctif. Les chiffres suivants sont des diagnostics conservés, sans promesse de 60 FPS ni pourcentage de gain annoncé. Une comparaison isolée reste à réaliser ; aucune autre partie n’a été suspendue sans accord.

Trois paires de 600 images ont été alternées : avant/après, après/avant, avant/après. Tous les états, empreintes et compteurs de rendu échantillonnés correspondent exactement. Les deux versions ont conservé les mêmes effets et détails. Les six captures WebGPU en fin de parcours sont identiques octet par octet (SHA-256 `cafe1ff41b1911488a75ba81fd0efe0296ed75901a24a9a4ace24b693d1cef9d`). [Rapport comparatif et données brutes](outdoor-comparison.json).

| Essai | p95 avant → après (ms) | p99 avant → après (ms) | Maximum avant → après (ms) |
|---|---:|---:|---:|
| 1 | 84.7 → 73.8 | 331.2 → 84.2 | 706.0 → 384.6 |
| 2 | 73.6 → 75.9 | 289.2 → 88.3 | 888.2 → 398.1 |
| 3 | 90.6 → 71.3 | 376.5 → 85.1 | 647.6 → 382.8 |

Le rendu final ne reconstruit le décor qu’aux trois destructions : les trois invalidations supplémentaires de feux sans changement de surface ont disparu. Pour la dernière destruction, la planification des chunks visite 178 entrées au lieu de parcourir les 308268 meshes. Cela ne supprime pas encore tous les scans de l’index spatial ni les pics d’explosion.

Le même parcours passe sur [WebGL2](outdoor-webgl2.json), avec les mêmes empreintes de simulation, modèles, PNJ, débris et réglages. Les captures WebGPU/WebGL2 ont été inspectées. [L’essai en temps réel](outdoor-realtime.json) couvre 900 images avec l’accumulateur de production et les trois détonations, sans erreur JS/GPU ni changement de backend. Sous la charge concurrente, son p95 est de 73.5 ms : cet essai valide la continuité de simulation, **pas une fluidité à 60 FPS**.


## Vérification fonctionnelle

- `renderer-pack-pool.mjs` : 120 lots identiques octet par octet, égalités de tri transparent, espaces de travail indépendants et formes enregistrées après création du cache.
- `renderer-incremental.mjs`, `renderer-revisioned.mjs`, `renderer-chunks.mjs`, `webgpu-renderer.mjs` : index, ordre, données GPU, mutations, doublons présents et précédents, changement de scène et libération des buffers.
- `world-collision-cache.mjs` : 9 753 requêtes et 2 000 changements de véhicules comparés aux anciennes routines ; altitudes, débris, bordures et intérieurs.
- `world-collider-rebuild.mjs` : 33 207 volumes de la vraie ville, retraits, ajouts, mutations publiques, doublons et ordre des rayons. 23 885 cellules non touchées restent inchangées pendant une destruction locale.
- `destruction-cache.mjs` : géométrie, collisions, sauvegardes, événements et débris identiques à `3ac8e4c` sur 226 210 éléments marseillais ; restauration vierge puis nouvelle destruction, supports et groupes partageant un mesh.
- `fire-invalidation.mjs` : feu sans effet sur le décor et recoloration réellement invalidante.

Les suites de brèches, incendies, destruction, explosions de véhicules, fragmentation, dégagement, sauvegarde et récupération sont consignées dans [outdoor-regressions.json](outdoor-regressions.json). Les scénarios navigateur de reprise fatale et de secours graphique complètent ces contrôles.

Ces mesures concernent une scène préparée et cette machine. Elles ne prouvent ni une cadence constante dans toute la ville, ni le même résultat sur Safari, sur une autre résolution ou sur un autre GPU.
