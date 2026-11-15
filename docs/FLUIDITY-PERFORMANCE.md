# EMPRISE 0.6.3 — cadence extérieure

Comparaison avec la version publiée **0.6.2, commit `d22a5eb`**. Cette passe réduit les calculs répétés et les allocations ; elle ne diminue ni la population, ni les budgets physiques, ni la qualité 3D.

## Changements

- Les collisions piétons/véhicules rejettent les voitures éloignées avant de calculer leur boîte orientée. Les cinq sondes terre/eau partagent les intersections des polygones, tout en lisant leurs sommets actuels.
- La foule réutilise ses listes temporaires et ses cellules spatiales. Les angles constants sont précalculés. L’ordre des voisins, les callbacks réentrants et la fréquence de l’IA restent identiques.
- La lecture des corps physiques utilise des buffers possédés par l’appelant. Les positions publiées au rendu, aux collisions et aux sauvegardes restent des copies indépendantes. Le solveur et ses pas sont inchangés.
- La destruction maintient les décalages des sources dans un index cumulatif. Les listes de géométrie sont assemblées par plages ; la publication des collisions utilise les seules occurrences solides et les cellules modifiées. Les changements d’intérieurs exposés sont composés localement.
- Un garde invalide l’index compact si la source a changé de longueur après sa préparation, notamment après `addMesh` ou un ajout direct dans `scenery`.

## Protocole et définition des temps

Apple M5, 24 GiB, macOS 27.2.1 (26B131), Chrome 157.0.8103.39, le 15 novembre 2026. Un seul navigateur de test à la fois, profils temporaires, aucun autre test d’agent simultané. Point de rupture était déjà fermé ; aucun de ses processus n’a été suspendu ou relancé.

Scène lourde : **960 PNJ**, dont 360 placés sur des cellules piétonnes légales du quai, **39 véhicules de trafic**, trois voitures détruites dans le même pas puis deux impacts réels sur une façade de Marseille. Le premier ouvre un intérieur meublé. Caméra, heure, météo, positions et déclenchements identiques ; streaming terminé et 90 frames de préchauffage.

Rendu conservé : **1440 × 900, DPR 1, MSAA 4×, ombres, reflets SSR et bloom**, mêmes distances, détails, corps et effets. HUD masqué et son coupé dans les deux versions. Les trois paires déterministes alternent avant/après, après/avant, avant/après : 600 frames et deux pas ordinaires de 1/120 s par frame. Elles comparent exactement le même travail. Les captures finales et les états sont vérifiés avant de calculer les médianes.

Les mesures sont désormais séparées :

| Mesure | Signification |
| --- | --- |
| `callbackCpu` | Temps écoulé sur le thread principal dans le callback du jeu, simulation et rendu inclus ; peut inclure une interruption du système. |
| `simulation` | Temps CPU de la simulation instrumentée, explosions incluses. |
| `raf` / `observedRaf` | Écarts entre timestamps fournis par le navigateur. `observedRaf` se limite aux callbacks mesurés ; `raf` peut contenir une frame de bord. |
| `drawSubmission` / ancien `frame` | Écarts entre entrées CPU dans `renderer.draw`. En temps réel, la simulation a lieu avant cet appel : son coût fait varier cet intervalle même si rAF reste régulier. |
| `gpu` | Durée des passes GPU lorsqu’elle est disponible ; exclut la file d’attente, le compositeur et la présentation. |

**La présentation réelle à l’écran n’est pas mesurée.** Aucun de ces chiffres ne prouve à lui seul une absence totale de saccades. Les anciens rapports gardent leurs valeurs historiques ; leur mesure nommée `frame` doit se lire comme intervalle de soumission CPU, pas comme mesure directe de présentation.

Le nouveau traceur préalloue ses lignes numériques. Les signatures périodiques sont hors des chronomètres séparés simulation/rendu mais peuvent affecter le callback et l’intervalle suivant. Les SHA finaux et les résumés sont calculés après arrêt. Les petits décalages signés entre horloges sont conservés ; un délai inférieur à −1 ms fait échouer la validation. Les profils CPU de diagnostic ne participent pas aux chiffres finaux.

## Résultats

Médianes des **trois paires lourdes**, toutes conservées dans la [synthèse vérifiée](fluidity-comparison.json) :

| Mesure | 0.6.2 | 0.6.3 |
| --- | ---: | ---: |
| CPU du callback · p95 | 14.3 ms | 9.7 ms |
| CPU du callback · pic | 65.3 ms | 39.2 ms |
| Simulation · p95 | 11.2 ms | 6.5 ms |
| Simulation · pic | 62.0 ms | 35.2 ms |
| Intervalle rAF observé · pic | 50.0 ms | 33.4 ms |
| Soumission du rendu · pic | 73.0 ms | 48.4 ms |

Le pic CPU médian baisse de **40 %** et le p95 de simulation de **42 %**. Les maxima CPU individuels sont 65,7 / 63,0 / 65,3 ms avant et 38,3 / 39,2 / 40,1 ms après. Le p95 rAF observé reste proche de 17,3 ms ; les callbacks rAF espacés de plus de 25 ms passent de deux à un dans chacun des trois essais. Les deux callbacks CPU >25 ms restent présents : la destruction la plus lourde dépasse encore le budget de 16,7 ms.

Les six états initiaux, événements, signatures périodiques, compteurs et six SHA finaux correspondent exactement. Les six PNG WebGPU sont identiques octet par octet. Les 1 200 ticks, 960 PNJ et budgets physiques sont conservés. Les captures WebGPU et WebGL2 ont été inspectées.

| Répétition | Avant | Après |
| --- | --- | --- |
| 1 | [rapport](outdoor-fluidity-before-1.json) | [rapport](outdoor-fluidity-after-1.json) |
| 2 | [rapport](outdoor-fluidity-before-2.json) | [rapport](outdoor-fluidity-after-2.json) |
| 3 | [rapport](outdoor-fluidity-before-3.json) | [rapport](outdoor-fluidity-after-3.json) |

**Contrôle standard, une paire** : trois explosions espacées. Pic CPU global 45,5 → 28,4 ms ; pic de simulation 42,1 → 24,7 ms ; pic de soumission 52,8 → 35,9 ms. États, compteurs et PNG identiques. Ce contrôle unique ne constitue pas une médiane de plusieurs essais. [Avant](outdoor-fluidity-standard-before.json), [après](outdoor-fluidity-standard-after.json).

**Secours WebGL2, scène lourde** : p95 CPU 9,8 ms, pic 39,0 ms ; p95 simulation 6,4 ms ; pic rAF 33,3 ms. Les six SHA finaux, événements et états simulés correspondent au test WebGPU. Les compteurs propres aux passes GPU ne sont pas assimilés entre backends. Aucun incident JS/GPU ni changement de backend. [Rapport](outdoor-fluidity-webgl2.json).

### Temps réel et sauvegarde normale

Un essai de 900 frames par version utilise l’accumulateur du jeu et **la sauvegarde automatique réellement activée**, sans `?test=1`. Le profil de navigateur temporaire ne touche pas à la partie de David. Les deux versions effectuent trois autosauvegardes durant la fenêtre mesurée ; la sauvegarde de pause finale est exclue des comptes. La relecture utilise `storage.load`, avec égalité du JSON écrit ; elle ne prétend pas tester un nouveau chargement complet de session.

| Mesure | 0.6.2 | 0.6.3 |
| --- | ---: | ---: |
| CPU callback p95 | 13,8 ms | 9,4 ms |
| CPU callback pic | 73,2 ms | 47,5 ms |
| Simulation p95 | 10,9 ms | 6,4 ms |
| rAF observé pic | 66,7 ms | 33,4 ms |
| Soumission p95 | 26,5 ms | 22,6 ms |
| Soumission pic | 85,1 ms | 59,4 ms |

La construction de chaque sauvegarde prend au maximum 0,7 ms et sa sérialisation/écriture 0,4 ms dans les deux essais. La sauvegarde finale du candidat pèse 193 903 octets. Ce chemin n’explique pas les gros pics de cette scène ; aucune modification risquée de la persistance n’a été introduite.

Les versions effectuent respectivement 1 806 et 1 804 ticks : le temps réel ne garantit pas un travail ou un état final identique. Ces deux essais sont des contrôles séparés et n’entrent pas dans les médianes déterministes. Les passes GPU du candidat ont un p95 de 12,9 ms, sans mesure de présentation. [Avant](outdoor-fluidity-production-before.json), [après](outdoor-fluidity-production-after.json).

**Build testé** : `702ff88469`, SHA-256 `28e5ca4e00ae4d852d3ce430588d6c0602cdf63ae848a964d0ff903d51e70bc3`. Référence : `365a85a73310a028f29d8d82556514b84e1b3b492a2557e4f1c0c7c7ad8d26a7`. Les empreintes des fixtures figurent dans chaque rapport.


## Équivalence et régressions

| Contrôle | Résultat |
| --- | --- |
| `world-probe-fastpath.mjs` | 23 432 sondes terre/eau, 19 103 collisions booléennes et 4 000 contacts véhicule identiques à `d22a5eb`, avec modifications vivantes des polygones, poses et dimensions. |
| `crowd-exact.mjs` | 151 étapes, 885 512 requêtes de collision ordonnées ; positions, packed et locomotion exacts, callbacks réentrants et reprise après exception. |
| `physics-body-read.mjs` | 360 étapes, descriptions exactes des corps et absence d’alias ; formes, masses, états, impulsions, restauration et handles invalides. |
| `urban-body-read.mjs` | 900 ticks lourds, historique exact des solveurs, géométries, colliders et snapshots ; 240 corps après les explosions. |
| `destruction-cache.mjs` | 226 210 pièces : explosions, detach, restauration, nouvelle destruction ; événements, volumes, géométries, colliders, sauvegardes et plages exacts. |
| `scene-publication.mjs` | Trois voitures et deux façades : huit SHA exacts après chaque impact, mêmes publications et changements de références. [Preuve](fluidity-scene-publication.json). |
| `world-collider-rebuild.mjs` | 119 cas, doublons et mutations publiques inclus ; 23 885 cellules inchangées restent figées. [Rapport](world-collider-rebuild.json). |

Les contrôles `urban`, `urban-zones`, `fragmentation`, `rubble-support`, `breach-urban`, `scene-delta-compose` et `urban-blast-batching-failure` passent également. Le microbenchmark de collision est conservé [séparément](fluidity-collision-cache.json) ; il ne mesure pas les FPS.

## Limites restantes

La plus grosse explosion et la publication de la façade gardent du travail synchrone. Les mesures ne permettent donc pas de promettre 60 FPS constants dans toute situation. L’essai de sauvegarde couvre cet état de partie, pas une très longue progression cumulant toutes les destructions possibles.

Le trafic garde sa cadence de simulation et son affichage existants à 30 Hz ; une interpolation visuelle séparée reste à traiter. Les débris affichent leur pose physique courante. Ces limites de mouvement sont distinctes des pics CPU, et aucun paramètre n’a été masqué ou baissé pour améliorer les chiffres.
