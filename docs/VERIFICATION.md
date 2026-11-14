# EMPRISE 0.2.0 — vérification des 14–15 novembre 2026

Les tests ci-dessous sont exécutés sur les copies du nouveau projet. Les scénarios et rapports JSON sont livrés dans le dépôt. Ils distinguent les commandes du joueur, les scénarios automatisés et les fixtures préparées pour un cas précis.

## Commandes et jeu réel

`python3 tests/inputs.py` envoie de vrais événements clavier et souris Chromium, sans contrôleur de scénario : Z/W, entrée, démarrage automatique, accélération, freinage, marche arrière, sortie, clic unique, rafale, visée et pause. Le dernier passage atteint 7,16 m/s, puis −4,77 m/s en recul. Un clic produit un tir ; après relâchement, aucune voix de tir ne reste active et la file d’événements est vide. La rafale de ce passage compte huit tirs avant relâchement. Aucune erreur JavaScript. Rapport : `input-regression.json`.

`python3 tests/sandbox-browser.py` pilote des commandes de simulation dans Chrome avec 480 passants et 15 véhicules de trafic. Parcours sans téléportation : rejoindre un commerce, acheter le plan, provoquer ses défenseurs, tirer, occuper et recevoir un revenu. Capture après 16,26 secondes simulées, huit tirs, 100 PV. L’interface confirme absence de minimap, plan seulement après achat, panneaux publics, temps qui continue pendant la lecture et persistance après rechargement. Rapport : `sandbox-browser.json`.

## Dégradation, feu, explosion et carcasse

`node tests/vehicle-explosion.mjs` vérifie la fumée avant le feu, puis **8.49 secondes de combustion visible avant l’explosion**, sans raccourci sous les tirs. Le test traverse le vrai chemin de tir ; la collision utilise le balayage de véhicule et son contact, pas un appel de dégâts substitué. Deux chocs de 19 m/s dans la fixture provoquent un incendie, puis l’explosion. Une sauvegarde au bout de trois secondes de feu reprend avec ce temps conservé. La réaction en chaîne est différée ; une épave n’explose qu’une fois et n’est plus utilisable.

`python3 tests/explosion-browser.py` prépare un véhicule et une position de tir sur le quai, puis enregistre uniquement les commandes de la simulation en temps réel. Cette passe compte **73 tirs**, une explosion et **33 corps rigides** après projection de carrosserie et fragments. Elle capture successivement la fumée, le feu croissant, l’explosion et la carcasse brûlée. Audio arrêté en pause, aucune erreur JS. Rapports : `vehicle-explosion-acceptance.json`, `explosion-browser.json`.

Le délai normal est 8,5 s pour les compactes, 7 s pour les deux-roues et 10 s pour le fourgon. L’extinction ou la réparation peut interrompre un incendie avant l’explosion. Les gros morceaux sont des pièces physiques simplifiées ; la carcasse est un modèle dédié calciné.

## Autres régressions

| Commande | Couverture | Rapport |
|---|---|---|
| `node tests/acceptance.mjs` | Parcours initial marche/conduite/combat, sortie bloquée, rayons et collisions, trois types de deux-roues | `acceptance.json` |
| `node tests/sandbox.mjs` | Progression, revenus, plafond hors ligne, sauvegardes invalides, prises/défenses, 120 s de trafic, interpellation | `sandbox-acceptance.json` |
| `node tests/injuries.mjs` | Tête, bras, jambe, occlusion par mur, décès, carjacking, conduite après extraction, commerçants persistants | `injuries-acceptance.json` |
| `node tests/interiors.mjs` | 746 adresses, 177 passages, accès distincts, points d’apparition et paliers libres, sept usages, entrée/sortie/étage/reprise | `interiors-acceptance.json` |
| `node tests/weather.mjs` | 750 s, cinq phases météo, éclairs/tonnerre, abri, dérive et sauvegarde des nuages | `weather-acceptance.json` |
| `node tests/urban.mjs` | Brèche réelle et retrait de collision, roquette, masse/impulsion, G/B, débris isolés par intérieur, contacts orientés, véhicule dégradé, pompiers et jet | `urban-acceptance.json` |
| `node tests/models.mjs` | Indices, normales, poids et poses anatomiques : marche, assis, au sol, ramper, variantes de tenue | `models-acceptance.json` |

Le test de secours livre trois pompiers et maîtrise le foyer préparé en environ 48 s. Les validations d’accès intérieur ne constituent pas une preuve de cheminement extérieur exhaustif depuis toutes les rues.

## Démonstrations enregistrées

Les enregistrements `input-recording.json`, `sandbox-recording.json` et `explosion-recording.json` sont validés par `node tests/replays.mjs`, qui reconstruit `src/replays.js`. Positions finales, tirs, argent, contrôle et explosion doivent correspondre à la capture. La troisième séquence comprend explicitement son état de départ préparé ; ce n’est pas présenté comme un trajet depuis le point d’apparition.

`python3 tests/attract.py` contrôle l’attente de 5 s au titre, les trois séquences, le silence audio, la conservation de la sauvegarde, le retour au titre par touche/clic et la reprise du jeu. `attract-validation.json` identifie précisément le build validé.

## Vérification visuelle

Captures propres au jeu : `emprise-title.png`, `crowd-outfits.png`, `anatomical-body.png`, `traffic-driver.png`, `facade-corners.png`, `weather-storm.png` et les quatre étapes `vehicle-damaged/burning/explosion/wreck.png`. Les vues rapprochées de modèles utilisent une caméra de contrôle et des positions préparées.

La foule de 480 personnages utilise 359 carnations de la palette foncée à mate, 96 variantes avec voile et 144 tenues avec casquette et sacoche. Ce sont des choix de direction artistique pour une population fictive, pas des statistiques de Marseille. Leur attribution dépend de l’identité stable du personnage, sans condition sur son gang ou son agressivité.

## Mesure locale

MacBook Air Mac17,4, Apple M5, 24 Go ; Chrome 157.0.0.0, WebGL2 ; canvas 1440 × 900, pixels 1:1, MSAA 4×, SSR, ombres et matériaux PBR actifs. Deux passes :

| Scénario | Images | Médiane / p95 image | Médiane / p95 CPU |
|---|---:|---:|---:|
| Commerce | 976 | 16.7 / 16.8 ms | 3.6 / 7.4 ms |
| Incendie et explosion | 2021 | 16.7 / 17.0 ms | 3.4 / 7.4 ms |

L’intervalle d’image est celui de requestAnimationFrame, soumis à la synchronisation de l’écran ; le CPU mesure le JavaScript et l’envoi de commandes, pas le GPU. Les rapports conservent leur SHA-256. La passe commerce précède les derniers habits et le feu progressif ; la passe explosion les inclut. Les anciens `browser-performance.json`, `browser-input.json` et captures du premier prototype restent des archives et ne constituent pas la mesure de cette version.

## Limites et dépôts d’origine

Voir le périmètre du README : solo local, intérieurs chargés séparément, terrain/eau exclus de la destruction, budget de corps physiques, animations simplifiées. Le rendu reste stylisé ; pas de photoréalisme établi ni de ray tracing matériel. Les conducteurs sont extractibles ; leurs volumes de tir à travers les vitres ne sont pas encore intégrés au système de blessures des personnages à pied. Aucun test global de chaque ruelle ou de chaque navigateur/mobile n’est revendiqué.

Au contrôle final, METAL et Point de rupture ont des arbres de travail propres aux commits d’origine. BITUME garde son commit d’origine mais contient maintenant des modifications locales dans `src/conduite.js`, `src/decor.js`, `src/jeu.js` et l’entrée non suivie `.claude/worktrees/`. Ces changements extérieurs au dépôt EMPRISE sont laissés en place ; aucun nettoyage, commit ni modification de ces fichiers n’est effectué par cette livraison.
