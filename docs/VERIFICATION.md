# EMPRISE 0.3.0 — vérification du 15 novembre 2026

Les reçus JSON et les scripts sont livrés dans le dépôt. Les tests de composants, les fixtures de placement et les commandes réelles dans Chrome sont distingués ci-dessous. Aucun serveur ni port d'automatisation n'est nécessaire : Chrome est piloté par CDP sur un tube local.

## Jeu et commandes

- `tests/inputs.py` : véritables événements clavier/souris, AZERTY/WASD, marche, montée, accélération, freinage, recul et sortie. Dernière mesure : 7,33 m/s, recul −4,77 m/s. Un clic produit un tir ; relâcher termine son, recul et rafale. Pause silencieuse, aucune erreur JavaScript.
- `tests/gamepad.py` : Gamepad API virtuelle Xbox standard dans Chrome, sans contrôleur de scénario. Sticks, gâchettes analogiques, tir, conduite, menus, réglages persistants, vibrations finies, pause au débranchement et relâchement obligatoire avant reprise. Aucune manette physique n'a été testée.
- `tests/new-features.py` : positions initiales explicitement préparées, puis événements clavier/souris réels. Menu du vrai Shawarmax, achat d'une provision, plan payé, proposition de protection et adversaire METAL déployé ; étage d'un hôtel réel, occupants et butin ; échelle, nage, canot, voilier et jet-ski, accélération/freinage/sortie. Ce test ne prétend pas parcourir tout le trajet depuis le départ.

Rapports : `input-regression.json`, `gamepad-validation.json`, `new-features-browser.json`. Captures : `business-counter.png`, `hotel-room.png`, `swimming-port.png`, `marine-*.png`.

## Régressions de simulation

| Test | Couverture |
|---|---|
| `acceptance.mjs` | Parcours marche/conduite/combat, sorties bloquées, rayons, collisions, vélo/trottinette/TMAX |
| `sandbox.mjs` | Capture/défense, revenus, sauvegarde, trafic, interpellation |
| `police.mjs` | Visibilité, mur réel, mémoire sans poursuite omnisciente, radio, retour en patrouille, cap A*320, recul, arrêt à distance et interpellation intégrée |
| `business.mjs` | Acheter/voler/racketter, plan à60€ unique, chef combattu avec vrais tirs, retour au commerçant, revenus persistants, cache, loot hôtel unique, résidents collidants/blessables, fermeture après décès |
| `interiors.mjs` | 3952 entrées, 633 passages, locaux et paliers, POI réels, appartements distincts, halls, services, sauvegarde et commissariat42LaCanebière |
| `places.mjs` | Projection, rattachement aux empreintes et adresses sourcées, bornes dynamiques, données déterministes |
| `marine.mjs` | Trois coques séparées, propulsion/vent,13échelles, nage, SAT obstacles/bateaux, mur empêchant l'embarquement, sauvegardes invalides et reprise |
| `injuries.mjs` | Tête/bras/jambe, occultation, décès, carjacking, conducteur, commerçants persistants |
| `urban.mjs` | Brèche et retrait de collision, masses/impulsions, objets, intérieurs isolés, chocs, incendie, pompiers |
| `vehicle-explosion.mjs` | Dégradation/fumée/feu, délai de combustion, explosion unique, pièces projetées, chaîne et carcasse persistante |
| `weather.mjs` | Cinq phases, vent, éclairs, abri, dérive continue des nuages et sauvegarde |
| `models.mjs` | Générateurs originaux, indices/normales/poids, marche/assis/rampement/sol, vêtements CPU/GPU, skinning proche |

Ces suites passent. Les dernières vérifications business/police/interiors/acceptance/sandbox utilisent le raccordement final des nouveaux modules. Les validatrices tête/corps passent sans aucun fichier de modèle externe. Les tests de passage ne certifient pas chaque itinéraire extérieur de la ville.

## Démonstrations

Le nouvel enregistrement clavier remplace l'ancien dont le résultat dépendait de l'interpellation précédente. `node tests/replays.mjs` valide exactement les positions, tirs, argent et résultats des trois séquences : commandes réelles, commerce contesté, véhicule sous le feu. La séquence d'explosion garde son état initial préparé et73tirs ; son résultat correspond toujours à une seule explosion.

`tests/attract.py` valide le départ après **5,14 secondes**, les trois séquences, leur silence, l'absence de modification de sauvegarde, retour au titre par touche/clic et reprise du jeu. La première session de démo est préparée avant l'affichage du titre : son constructeur ne retarde plus le départ. Reçus : `replay-validation.json`, `attract-validation.json` avec empreinte du build.

## Fluidité et rendu

Le profil initial a identifié une longue tâche d'environ331ms : la première collision construisait paresseusement les structures de destruction de toute la ville. Elles sont désormais préparées pendant le chargement. Les lots statiques sont conservés sur le GPU ; sélection par caméra et distance, ombres sélectionnées séparément, reconstruction des seuls lots modifiés. Les petites lames de volets/traverses ne sont plus classées comme du sol visible à l'infini. La coupe des corps est précalculée pour supprimer les allocations par sommet pendant l'animation.

La passe finale `tests/streaming.py` utilise Chrome157/WebGL2 sur Mac AppleM5, canevas1758×1024, MSAA4×, ombres, reflets et480passants ; autosauvegarde active, sans profileur d'échantillonnage. Elle dure40secondes, dont20secondes de rotation de caméra. Résultat :

- 2398images ; médiane16,7ms, p9516,8ms, p9918ms.
- Un seul intervalle au-delà de25ms :66,7ms. Aucun au-delà de100ms ; aucune saccade à cadence d'une seconde observée dans cette passe.
- Vue finale :271942éléments statiques,25386dessinés et246556écartés ; environ2,58millions de triangles, ombres comprises.
- Lots retenus entre images et restauration du contexte WebGL vérifiés ; aucune erreur JavaScript.

Le reçu `frame-pacing.json` conserve les intervalles, longues tâches, mesures CPU, configuration et SHA-256. Ces valeurs décrivent cette passe locale, pas une garantie sur tous les appareils. Une passe précédente plafonnait à30Hz, y compris sur une page vide ; elle n'est pas utilisée pour revendiquer60FPS. Les captures/debug et transitions de pièce peuvent produire leurs propres pics, distincts de cette mesure continue.

## Provenance et limites

Aucun asset graphique ou sonore importé dans le build : géométrie, textures, animation et son générés par le code. Les données géographiques OpenStreetMap/BAN sont conservées ; les photographies sont des références de formes, non des textures du jeu. Aucun asset GTA n'est fourni.

Le rendu est stylisé, pas photoréaliste ; pas de ray tracing matériel. Le jeu reste solo. Nage de surface, pas de plongée ; embarcations sans destruction/incendie complet. Les intérieurs sont des compositions de jeu, pas des relevés de pièces réelles. Aucun concessionnaire ni armurerie réel n'a été inventé dans la zone en l'absence de POI vérifié. Les anciennes captures/mesures0.2.0 sont des archives ; les reçus nommés ci-dessus décrivent cette version.

La correction finale de l’enchaînement automatique conserve aussi une pause de titre de cinq secondes entre deux replays, afin que la prochaine session puisse être préparée hors de la frame de démarrage. La mesure de fluidité et les captures fonctionnelles précèdent uniquement cette modification de transition de démo ; leurs empreintes propres restent dans les reçus.

`tests/demo-cycle.py` vérifie également la fin naturelle du premier replay et le passage au suivant : retour au titre, pause de 5,20 s, deuxième séquence et aucune erreur. Rapport `demo-cycle.json`.
