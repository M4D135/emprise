# EMPRISE 0.4.0 — vérification du 15 novembre 2026

Version « La rue réagit », build `7f69d7cada`, HTML autonome de 3,770,463 octets. Les reçus conservent leurs propres empreintes. Les tests de simulation, les scènes préparées et les événements réels de navigateur sont distingués ci-dessous.

## Commandes et interactions

- `tests/inputs.py` : événements Chromium clavier/souris réels, AZERTY/WASD, entrée, conduite, freinage, recul, sortie, clic unique et rafale. Aucun tir ni son de tir continu après relâchement. La visée après sortie utilise le glisser si Chrome refuse la capture du pointeur ; ce choix est indiqué dans le reçu. Pause silencieuse, aucune erreur JavaScript.
- `tests/gamepad.py` : Gamepad API Xbox standard virtuelle, sticks/gâchettes, conduite, armes, menus, carnet, réglages, vibration finie et débranchement. Pas de manette physique testée.
- `tests/immersion.py` : J ouvre le carnet sans carte permanente, un soin est consommé depuis son inventaire, un ennemi est vaincu par clic réel puis le sac se fouille avec E une seule fois. La cible et le joueur sont placés explicitement pour tester ces interactions ; le déplacement jusqu’au combat n’est pas testé par ce script.
- `tests/new-features.py` : vrai Shawarmax, achat, plan payé, contrat de protection ; hôtel, étage, occupants et butin ; échelle, nage et trois embarcations. Positions initiales préparées puis clavier/souris réels.
- `tests/sandbox-browser.py` : parcours de commerce avec commandes de simulation enregistrées, affrontement, prise, revenu, achat du plan, panneau et reprise de sauvegarde. Ce script utilise un contrôleur de scénario, contrairement au test clavier/souris.

Rapports : `input-regression.json`, `gamepad-validation.json`, `immersion-browser.json`, `new-features-browser.json`, `sandbox-browser.json`.

## Simulations

Les 17 suites Node passent : acceptance, sandbox, police, combat, business, injuries, urban, vehicle-explosion, weather, interiors, places, marine, crowd, loot, environment, models et replays. `node-validation.json` donne les suites de la passe générale. Les tests de modèle et replays sont exécutés séparément.

Les ajouts couvrent notamment :

- Navigation autour d’un mur fourni seulement par l’API spatiale, riposte après contournement, interruption d’une visée/rafale quand un obstacle ferme la ligne, pression, couvert et mémoire expirante. Budget A* de deux recherches et 1 536 expansions maximum par tick ; 24 essais de couvert partagés. Voir `COMBAT.md`.
- Fuite qui se poursuit après le bruit, retour à la marche, issue latérale devant un mur, anticipation d’un véhicule qui recule, jambe blessée et déterminisme. Réactions aux tirs du joueur et des ennemis ainsi qu’aux explosions.
- Sac créé à la mort d’un adversaire, récompense unique, contrôles de distance et d’occlusion, capacité d’inventaire, reprise et nouveau déploiement d’une réserve. Aucun sac de ce type pour les civils.
- Arbres et leur couronne contrôlés hors chaussée, collisions limitées aux troncs, fenêtres écartées des angles et budgets géométriques. Le trajet de conduite complet passe après correction du raccord de végétation sans renderer dans les tests Node.
- Profils, normales, poids, marche, contact des semelles, poses assises, cache CPU/GPU et proportions des épaules/col/nez. Corps de 9 816 triangles, tête de 3 648 triangles.

Les suites de simulation et d’interaction précèdent uniquement la dernière retouche géométrique des épaules, du nez et du col. Le contrôle des modèles, les captures et la mesure de fluidité incluent cette retouche ; aucune logique de jeu n’a changé après leurs validations.

## Captures 3D

`tests/visual-quality.py` compile le shader WebGL2 et place trois identités procédurales, de face, de profil, en marche puis assises. Ces scènes sont des fixtures d’inspection, sans parcours de gameplay revendiqué. Captures examinées : `quality-people-front.png`, `quality-people-profile.png`, `quality-people-walk.png`, `quality-people-seated.png`, `quality-street.png` et `quality-fps.png`. La revue a conduit à arrondir les épaules et à réduire la saillie du nez avant le build final.

Les personnages et le décor restent stylisés. Il n’y a pas de promesse de photoréalisme, de motion capture ou de ray tracing matériel.

## Démonstrations enregistrées

Les trois séquences ont été recapturées avec cette version puis rejouées dans Node. Positions, tirs, argent, propriété et explosion correspondent exactement aux résultats enregistrés :

- Tir et conduite · clavier / souris réels : 12.26 s.
- Commerce contesté · session de test validée : 16.32 s.
- Véhicule sous le feu · test de destruction : 34.34 s.

Le test `attract.py` mesure un départ à 5.12 s. Touches/clics ramènent au titre, le jeu peut reprendre, les démos restent silencieuses et ne changent ni la session réelle ni sa sauvegarde. `demo-cycle.py` valide aussi la fin naturelle du premier replay et une pause de titre de 5.19 s avant le suivant. Rapports : `replay-validation.json`, `attract-validation.json`, `demo-cycle.json`.

## Fluidité du build final

Mesure Chrome 157 / WebGL2 sur Mac Apple M5, rendu 1 758 × 1 024, MSAA 4×, ombres et reflets, 480 passants et trafic actif. Autosauvegarde activée, sans profileur d’échantillonnage ; 40 secondes dont 20 secondes de rotation de caméra.

- 2400 images ; médiane 16.7 ms, p95 18.7 ms, p99 18.7 ms.
- Maximum 18.8 ms ; 0 image au-delà de 25 ms et 0 au-delà de 100 ms.
- Vue finale : 23 302 éléments statiques visibles, 202 695 écartés ; 1 214 appels de dessin et 2 536 556 triangles, ombres comprises.
- Lots GPU conservés, restauration du contexte WebGL et absence d’erreurs JavaScript vérifiées.

Le reçu `frame-pacing.json` contient les intervalles bruts et l’empreinte du build. Ces chiffres décrivent cette passe locale ; ils ne garantissent pas la même fluidité sur chaque appareil, lors d’un changement d’intérieur ou dans toutes les batailles. Les captures d’écran ne font pas partie de cette mesure continue.

Le préchauffage urbain existant est conservé. Sans lui, une première collision de trafic peut construire des structures coûteuses ; le benchmark de combat préparé ne présente plus ce coût au milieu d’un tick. Aucune reconstruction globale de navigation par voiture n’a été ajoutée.

## Provenance et limites

Aucun modèle, image, texture, police ou fichier sonore importé dans `src/` ou `assets/`, et aucune image encodée `data:image` dans le HTML. Géométrie, textures, animation et sons sont générés par le code. Les données OpenStreetMap/BAN sont géographiques ; les photos restent des références externes, les PNG de documentation des captures exclues du runtime.

Le jeu reste solo. La police reste principalement motorisée. Nage de surface, pas de plongée ; destruction complète des embarcations non intégrée. Les intérieurs sont des compositions de jeu, pas des relevés de pièces réelles. La physique, les chutes et les silhouettes éloignées sont simplifiées. Les limites ancrées, le sol et l’eau ne sont pas destructibles. Les contrôles ne certifient pas chaque ruelle ni tous les navigateurs ; Safari et Firefox n’ont pas été retestés dans cette passe.
