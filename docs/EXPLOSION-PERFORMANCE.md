# EMPRISE 0.6.2 — performances des explosions

Cette passe réduit le travail répété pendant les explosions et la circulation parmi les débris. La référence est **EMPRISE 0.6.1, commit `76e5ed7`**. Le build final est `6ed602edbe` (0.6.2 « Déflagrations »). Les profils et essais intermédiaires servent au diagnostic ; ils ne constituent pas la comparaison finale.

## Protocole commun

Le lanceur [outdoor-stress.py](../tests/outdoor-stress.py) exécute le HTML de référence préservé puis le candidat avec la même fixture. Chaque rapport contient les SHA-256 du HTML et de la fixture, la version du jeu, l’identité de la scène, les événements, les compteurs de rendu, les erreurs et les éventuels changements de backend.

Les deux scènes utilisent 960 PNJ, dont 360 positionnés dans des cellules piétonnes autorisées du quai, et 39 véhicules de trafic : 36 civils et 3 véhicules de police. Le joueur, la caméra, les véhicules ciblés et l’heure initiale sont fixes. La météo commence au soleil à 14 h. Le streaming doit être terminé, puis 90 images de préchauffage sont rendues avant la mesure.

Le rendu conserve **1440 × 900 pixels, DPR 1, MSAA 4×, ombres, reflets SSR et bloom**. La caméra conserve son champ de vision et ses distances de rendu. Le HUD est masqué et le son coupé pour les deux versions. Aucun réglage de population, de détail géométrique, d’animation, d’IA, de physique ou d’effets n’est abaissé.

La comparaison déterministe porte normalement sur 600 images. Deux pas ordinaires de simulation de 1/120 s sont exécutés par image : les versions reçoivent ainsi la même quantité de travail, même si leur vitesse de rendu diffère. Des essais séparés en temps réel conservent l’accumulateur normal du jeu. Les profils CPU sont enregistrés séparément des essais utilisés pour calculer les gains.

## Deux charges distinctes

| Scène | Déclenchements | Vérifications particulières |
| --- | --- | --- |
| [Standard](../tests/outdoor-stress-scenes.js) | Une détonation de véhicule aux images 90, 210 et 330. | Trois événements, mêmes véhicules, foule et trafic actifs, physiques et incendies ordinaires. |
| [Lourde](../tests/explosion-heavy-scenes.js) | Trois véhicules explosent dans le même pas de simulation à l’image 90 ; deux impacts sur une façade réelle aux images 210 et 330, puissance 240 et rayon 10 m. | Même bâtiment, mêmes points et normale ; les impacts doivent modifier la scène et le premier doit révéler un intérieur meublé. |

En temps réel, les déclenchements sont liés aux pas de simulation 180, 420 et 660. Les durées mesurées distinguent l’intervalle entre images, le rendu CPU, la simulation et le temps CPU global collecté par le jeu. Les timestamps GPU sont rapportés séparément lorsqu’ils sont disponibles.

L’état et les compteurs sont échantillonnés toutes les 60 images. Pour la scène lourde, des SHA-256 finaux sont aussi calculés après l’arrêt des mesures : destruction persistante, meshes ordonnés, colliders, bilan urbain, corps physiques et projections intérieures. Ils comprennent notamment les positions, orientations, vitesses linéaires et angulaires, masses et états de sommeil des débris.

## Travail supprimé, comportement conservé

- **Destruction :** réutilisation des géométries déjà calculées pour un même état, et production des listes de collision seulement lorsqu’un appelant les demande. Les tableaux déjà retournés restent des snapshots.
- **Supports des bâtiments :** graphe inverse des dépendances et vérification des seuls supports concernés par un changement de volume. L’ordre de la passe originale est conservé, y compris le report au prochain dommage d’une dépendance modifiée après son passage. Les sommes ne sont ni arrondies ni réordonnées.
- **Scène et collisions statiques :** propagation des ajouts et retraits ordonnés, composition des changements successifs d’une même image, réutilisation des colliders et mise à jour des cellules affectées.
- **Intérieurs exposés :** conservation des copies déjà valides et accès aux plages de géométrie du bâtiment concerné. Les pièces touchées gardent leurs mutations, collisions et événements immédiats ; la publication extérieure est groupée à la fin de la boucle, y compris en cas d’exception. Les deux explosions de façade passent de quatre publications à deux, avec un résultat final identique.
- **Rendu :** invalidation des entrées et groupes de géométrie concernés. Le contrat `revisionedMeshes` est explicite pour EMPRISE ; le comportement strict reste disponible par défaut pour les autres appelants. Une recoloration statique invalide le rendu.
- **Débris et PNJ :** index spatial conservateur des proxies physiques publiés. Il accélère les requêtes booléennes de collision ; le test exact capsule/boîte orientée reste utilisé. L’ordre des candidats et les doublons sont conservés. Les sommes de contact et la récupération du joueur restent inchangées.

La publication des débris est explicite : une simple affectation publique de `dynamicBodies` conserve le chemin strict, tandis que le jeu publie ses snapshots via `publishBodies`. Cela évite de supposer immuables les listes modifiables utilisées par les autres appelants et les tests.

## Validations déjà réalisées

Ces résultats concernent les changements vérifiés pendant cette passe. Les mesures navigateur suivantes utilisent le build final identifié par son SHA-256.

| Test | Résultat observé |
| --- | --- |
| [clearance-broadphase.mjs](../tests/clearance-broadphase.mjs) | PASS : 2 039 requêtes identiques au scan strict ; 360 étapes de dégagement identiques ; ordre, doublons, publications, cellules et cas limites couverts. |
| [clearance-review.mjs](../tests/clearance-review.mjs) | PASS : 11 scénarios, dont 128 contacts OBB comparés à un oracle numérique, sortie de pile, murs, pentes et obstacles ajoutés pendant la récupération. |
| [destruction-supports.mjs](../tests/destruction-supports.mjs) | PASS : 27 fixtures et 372 opérations ; chaînes dans les deux sens, detach, dommages sans changement géométrique, restaurations rejetées ou acceptées, cycles, supports dupliqués/manquants et ratios supérieurs à un. |
| [destruction-cache.mjs](../tests/destruction-cache.mjs) | PASS : comparaison exacte avec l’implémentation antérieure sur 226 210 pièces de Marseille ; explosions, frappes de façade, detach, restauration et nouvelle destruction. Événements, débris, géométrie, collisions et sauvegardes identiques. |

La preuve structurelle du test de broadphase est indépendante d’un chronomètre : 960 requêtes éloignées de 240 débris passent de 230 400 appels de contact à zéro, avec le même résultat. Ce nombre n’est pas un gain de FPS. Les différentiels utilisent notamment `3ac8e4c` comme oracle fonctionnel ; la référence des **mesures de performance** reste `76e5ed7` / 0.6.1.

## Mesures finales

Mesures du 15 novembre 2026, Apple M5 / 24 GiB, macOS 27.2.1 (26B131), Chrome 157.0.8103.39. Point de rupture était déjà fermé lors de l’inspection préalable ; aucun processus de ce jeu n’a été suspendu ou relancé. Chaque essai utilise un seul navigateur de test, sans autre test d’agent simultané. Les processus ordinaires du bureau restent actifs.

Les trois paires de chaque scène sont exécutées dans l’ordre avant/après, après/avant, avant/après. Les valeurs ci-dessous sont les médianes des trois essais, pas une sélection du meilleur résultat. [Synthèse vérifiée et données brutes](explosion-comparison.json).

| Scène | p95 avant → après | p99 avant → après | Pic avant → après | Images >25 ms avant → après |
| --- | ---: | ---: | ---: | ---: |
| Trois explosions espacées | 17.5 → 17.4 ms | 18.8 → 18.0 ms | 87.2 → 52.7 ms | 3 → 1 |
| Trois voitures simultanées + deux façades | 17.6 → 17.3 ms | 20.0 → 18.0 ms | 139.0 → 74.2 ms | 3 → 3 |

Les pics restent perceptibles : cette version ne garantit pas encore 60 FPS constants pendant la plus grosse détonation. Les optimisations réduisent le coût synchrone de destruction et de publication, sans le supprimer.

- **Standard** : maxima individuels 85.4, 91.9, 87.2 ms avant, 52.3, 54.1, 52.7 ms après. Pic de simulation médian 52.5 → 42.1 ms ; p95 simulation 13.4 → 10.7 ms.
- **Lourde** : maxima individuels 140.0, 139.0, 137.7 ms avant, 73.4, 74.2, 74.3 ms après. Pic de simulation médian 103.6 → 62.7 ms ; p95 simulation 14.1 → 11.1 ms.

Les six captures WebGPU de chaque scène sont identiques octet par octet. Les états initiaux, événements, ticks, signatures périodiques et tous les compteurs correspondent ; les six SHA-256 finaux de la scène lourde sont également identiques. Le test exige ces égalités avant de produire la synthèse. Les meshes, triangles, instances, collisions, débris, personnages et effets sont donc conservés dans les parcours comparés.

**Secours WebGL2, scène lourde** : p95 17.1 ms, p99 18.1 ms, pic 72.3 ms, 3 images >25 ms et 2 >50 ms. Aucun incident JS/GPU ni changement de backend. [Rapport](outdoor-heavy-webgl2.json).

**WebGPU en temps réel, 900 images** : p95 26.3 ms, p99 28.0 ms, pic 84.7 ms, 116 images >25 ms et 2 >50 ms. Aucun incident JS/GPU ni changement de backend. [Rapport](outdoor-heavy-realtime.json).

Un contrôle supplémentaire de la référence 0.6.1 en temps réel donne p95 28,9 ms, p99 31,0 ms et pic 149,0 ms, avec 222 images >25 ms. [Rapport de référence](outdoor-heavy-realtime-before.json). Ce contrôle unique a été exécuté après celui du candidat ; il confirme la limite du mode réel sans constituer une comparaison à travail exact : 1 814 ticks avant contre 1 806 après sur 900 images. Il n’entre pas dans les médianes des trois paires déterministes.

Le secours conserve les états simulés et les six signatures finales de la scène lourde ; les compteurs spécifiques aux passes GPU sont exclus de cette comparaison entre backends. Le temps réel utilise l’accumulateur de production : son état final dépend du temps réellement écoulé et n’est pas présenté comme identique au test déterministe.

**Build final** : `6ed602edbe`, SHA-256 `365a85a73310a028f29d8d82556514b84e1b3b492a2557e4f1c0c7c7ad8d26a7`. La référence est `b6641fc16d61894c12af1ff0f5be4506ade18de670d1e8b841129bacafa514d3`. Les empreintes des deux fixtures et toutes les mesures CPU/GPU figurent dans la synthèse JSON.

| Charge | Référence | Candidat |
| --- | --- | --- |
| Standard | [essai 1](outdoor-explosion-before-1.json), [essai 2](outdoor-explosion-before-2.json), [essai 3](outdoor-explosion-before-3.json) | [essai 1](outdoor-explosion-after-1.json), [essai 2](outdoor-explosion-after-2.json), [essai 3](outdoor-explosion-after-3.json) |
| Lourde | [essai 1](outdoor-heavy-before-1.json), [essai 2](outdoor-heavy-before-2.json), [essai 3](outdoor-heavy-before-3.json) | [essai 1](outdoor-heavy-after-1.json), [essai 2](outdoor-heavy-after-2.json), [essai 3](outdoor-heavy-after-3.json) |

Les contrôles d’intégration de cette passe couvrent `urban`, `urban-zones`, `vehicle-explosion`, `breach-urban`, `fragmentation`, `fire-invalidation`, `world-collider-rebuild`, `scene-delta-compose`, `renderer-sparse-buckets`, `renderer-mesh-delta`, `webgpu-renderer`, `urban-blast-batching`, `urban-blast-batching-failure`, `save-recovery` et `fatal-recovery`. Le différentiel de publication groupée retrouve huit SHA exacts et les mêmes événements après chacune des cinq explosions contre `76e5ed7`.

La reprise graphique est vérifiée sur ce même build : perte réelle du périphérique WebGPU et erreur d’installation native, puis retour WebGL2 dans la même session avec argent, santé, inventaire et commandes conservés. [Rapport](explosion-render-recovery.json). Les captures finales WebGPU et WebGL2 de la scène lourde ont été inspectées visuellement.

## Limites d’interprétation

Un écran synchronisé autour de 60 Hz peut afficher presque le même FPS moyen malgré des pics très différents. La conclusion doit donc porter sur les distributions des temps d’image et les images longues, pas sur un FPS théorique calculé à partir du seul temps GPU.

Les profils CPU échantillonnés servent à localiser les coûts et perturbent eux-mêmes l’exécution. Ils ne sont pas mélangés aux essais sans profilage. Les mesures restent sensibles aux autres processus, à la température et au ramasse-miettes ; les répétitions avant/après et leur dispersion doivent être conservées, sans sélectionner uniquement le meilleur essai.

Les signatures périodiques sont hors des chronomètres séparés du rendu et de la simulation, mais leur coût et leurs allocations peuvent affecter l’intervalle entre images suivant. Les SHA-256 finaux de la scène lourde sont calculés après les mesures. Les signatures périodiques quantifiées complètent les différentiels exacts ; elles ne les remplacent pas.

Le scénario déterministe impose deux pas par image pour comparer le même travail. Il doit être complété par le contrôle de cadence réelle ; ce contrôle ne garantit pas le même nombre de pas ou un état final identique entre machines. Cette campagne couvre ces scènes, cette durée et le matériel indiqué, pas toutes les destructions possibles ni tous les navigateurs.
