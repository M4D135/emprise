# EMPRISE 0.6.4 — mouvement, charge extérieure et navigation

## Changements

Le trafic conserve sa simulation à 30 Hz, avec interpolation de sa pose affichée : carrosserie, roues, conducteur et éclairages restent raccordés. Les téléportations et changements de contrôle invalident cette interpolation. Le véhicule conduit par le joueur garde sa pose physique directe.

Les collisions de la foule utilisent moins de tableaux temporaires ; les recherches de trajet et de freinage écartent les candidats qui ne peuvent pas améliorer le résultat. Les tests différentiels vérifient l’ordre, les égalités, les appels réentrants et les intégrations personnalisées. La cadence de simulation, la population et les budgets de débris sont conservés.

Une explosion ouvrant une façade préparait deux publications du même décor. Le chemin de production compose maintenant une publication finale, avec un instantané intermédiaire exact pour les appels réentrants et les erreurs. Dans le scénario de validation, les cinq impacts passent de sept à cinq publications, et de 6 418 à 2 476 références éditées. Les mondes personnalisés conservent le chemin strict, sans activation implicite de cette optimisation.

Une préparation bornée au chargement réserve un solveur physique et jusqu’à 64 intérieurs proches, dans la limite de 24 000 meshes. Les calculs de déplacement sont également préparés. Cela ajoute du travail au chargement et de la mémoire : environ 42 Mio de heap supplémentaires pour les intérieurs du départ dans le relevé local, plus 2,45 Mio pour le solveur. Les réserves sont validées avant adoption ; elles ne font pas avancer la partie pendant le chargement.

Les primitives WebGPU partagent leurs sommets strictement identiques, sans retirer de triangles. La géométrie libre et les humains gardent leur chemin existant. Le contrôle natif, sur la même scène figée et aux DPR 1 et 2, obtient des PNG identiques octet par octet avec/sans indexation. Ce contrôle visuel ne prouve pas à lui seul un gain GPU. [Rapport](primitive-index-validation.json).

## Protocole comparatif

`python3 tests/movement-benchmark.py` effectue trois paires alternées, puis des contrôles WebGL2, DPR 2 et temps réel avec sauvegarde normale. Chaque essai utilise un profil Chrome temporaire et un pipe CDP, sans serveur ni port d’écoute. Les essais de performance s’exécutent sans autres tests ou navigateurs de jeu concurrents.

La référence utilise les algorithmes de la 0.6.3 (`22a330f`), avec **seulement les trois modules géographiques/nautiques actualisés** : `pdr/ville-reelle`, `coast`, `marine`. Les deux versions ont ainsi les mêmes dalles découpées, le même niveau côtier et les mêmes bateaux. Ce témoin n’est donc pas l’HTML publié de la 0.6.3 à l’octet près. Les empreintes de l’original, du témoin, du candidat et de chaque remplacement figurent dans [le rapport comparatif](movement-comparison.json).

La scène comporte 960 PNJ, 39 véhicules de trafic, trois explosions automobiles simultanées puis deux impacts lourds sur une façade avec mobilier et débris physiques. Les essais fixes effectuent chacun 1 200 ticks sur 600 images. Caméra, événements, population et réglages restent identiques : 1 440 × 900, MSAA 4, ombres, reflets et bloom. Le contrôle DPR 2 garde le plafond de pixels déjà utilisé en production.

Les états initiaux, événements, signatures physiques périodiques et les **six SHA finaux** doivent correspondre exactement : destruction, meshes du monde, colliders, corps physiques, rapport urbain et projections intérieures. Les poses interpolées du trafic changent volontairement le rendu entre les ticks. Aucune qualité n’est réduite pour le benchmark. La grille de vagues est inactive dans cette scène terrestre.

## Résultats

Médianes des trois répétitions, à géométrie identique :

| Mesure | Algorithmes 0.6.3 | 0.6.4 |
| --- | ---: | ---: |
| CPU callback · p50 | 4,0 ms | 4,2 ms |
| CPU callback · p95 | 9,8 ms | 8,8 ms |
| CPU callback · pic | 39,4 ms | 29,5 ms |
| Simulation · p95 | 6,6 ms | 5,3 ms |
| Simulation · pic | 35,8 ms | 25,5 ms |
| Intervalle rAF observé · pic | 33,1 ms | 17,7 ms |
| Intervalle entre soumissions · pic | 48,0 ms | 34,5 ms |

Le pic CPU médian diminue de **25 %**, le p95 de simulation de **20 %**. Les pics CPU individuels sont 39,4 / 38,3 / 40,6 ms avant et 29,5 / 29,8 / 29,3 ms après. Le coût CPU médian ordinaire augmente de 0,2 ms ; tous les indicateurs ne baissent donc pas. Deux intervalles de soumission dépassent encore 25 ms dans chaque essai : la triple explosion garde un pic visible potentiel, malgré des timestamps rAF réguliers.

Les six empreintes finales correspondent exactement dans chaque paire. Le contrôle WebGL2 obtient également les mêmes états physiques : p95 CPU 9,3 ms, pic 26,9 ms. Le contrôle DPR 2 conserve ces états, avec p95 CPU 8,9 ms, pic 27,8 ms ; le p95 des passes GPU est 14,0 ms. Aucun incident JS/GPU ni secours inattendu.

| Contrôle en temps réel, 900 images | Algorithmes 0.6.3 | 0.6.4 |
| --- | ---: | ---: |
| CPU callback · p95 | 9,3 ms | 8,6 ms |
| CPU callback · pic | 48,4 ms | 33,9 ms |
| Simulation · p95 | 6,4 ms | 5,4 ms |
| Intervalle entre soumissions · pic | 59,9 ms | 45,6 ms |
| Passes GPU · p95 | 13,0 ms | 13,1 ms |

Ces contrôles utilisent l’accumulateur normal et la vraie autosauvegarde, dans un stockage temporaire isolé. Ils effectuent respectivement 1 804 et 1 802 ticks ; ils ne prétendent donc pas finir dans le même état et n’entrent pas dans les médianes appariées. Trois autosauvegardes réussissent dans chaque essai. Le candidat prend au maximum 0,5 ms pour construire la sauvegarde et 0,5 ms pour la sérialiser/écrire ; relecture vérifiée, 194 392 octets. Cela ne valide pas une partie de durée arbitraire.

Les valeurs finales et les rapports de chaque essai sont conservés dans [movement-comparison.json](movement-comparison.json). Les temps CPU, de simulation, rAF et de soumission du rendu sont des mesures distinctes ; aucune ne mesure directement la présentation effective à l’écran. Le gain GPU de l’indexation seule n’est pas établi.

Build mesuré : `39955b5b43`, SHA-256 `d112e73ceff0afbfdea7406527d5427182a82c152c6fc3208a494af8a646ac9c`. Témoin à géométrie identique : `8babff9d4cb22202374206447b73a597f5043cb2f303776b0cad086650f68acb`.

## Vérifications fonctionnelles

Les tests ciblés couvrent les trajectoires du trafic, les contacts et récupérations de position, la foule, les recherches de freinage, les publications de scènes, les deltas, les réserves d’intérieurs/physique, les erreurs de destruction, la reprise d’une sauvegarde et la création d’une nouvelle partie. Un oracle supplémentaire conserve les mêmes colliders et meshes pendant 1 200 ticks avec cinq explosions, entre publication stricte et différée.

Le tactile reprend l’ergonomie du snapshot METAL `42b83de48af43041d764cd2cf272c2480ba95419` (`src/touch.js` et `src/game.js` consultés). Les essais CDP natifs couvrent marche/regard/tir simultanés, annulation d’appuis, conduite, nage, trois postes de voile, téléphone, actions, réglages et rotation d’écran. Ils incluent 320 × 568 en portrait et 844 × 390 en paysage. [Validation tactile](mobile-064-integrated.json), [manette](gamepad-validation.json), [transitions entre périphériques](hybrid-input-validation.json). Il s’agit d’émulation tactile Chrome sur Mac et de Gamepad API virtuelle, pas d’un téléphone ou d’une manette physiques.

La navigation est contrôlée sur WebGPU et WebGL2 : départ réel à la voile, immersion, gîte et houle, commandes clavier/manette et silence du moteur auxiliaire coupé. [Documentation et rapports](MARINE.md). Les dalles traversant le bassin sont découpées par leurs anneaux d’eau, sans modifier les pontons : 16 formes corrigées, 216 triangles supplémentaires, 31 512 sondes géométriques validées. [Preuve](port-ground-validation.json).

## Limites

Les grosses explosions gardent du travail synchrone. Cette version ne garantit pas 60 images réellement présentées par seconde dans toutes les situations. Les répétitions concernent une machine et un navigateur ; une longue partie cumulant des destructions et un téléphone physique restent des conditions différentes.

La houle, la polaire de voile et la flottaison sont des modèles procéduraux de jeu. La grille suit la même horloge et les mêmes vagues que les cinq points de flottaison, avec un raccord progressif à la mer distante. Ce n’est pas un solveur hydrodynamique volumétrique.
