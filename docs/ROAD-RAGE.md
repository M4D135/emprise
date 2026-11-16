# EMPRISE 0.6.6 — altercations de rue

Deux klaxons rapprochés peuvent déclencher une dispute chez certains conducteurs. La voiture devant ou le piéton qui bloque doit être proche et visible. Les conducteurs sortent par une porte libre, se rapprochent, se disputent puis échangent des coups avant de retourner physiquement à leur véhicule. Des disputes piétonnes occasionnelles complètent ces événements.

Les caractères sont déterminés par des identifiants indépendants de l'apparence. Deux incidents au maximum, proches du joueur ; décisions une fois par seconde, déplacements continus. Accumulateurs de klaxons et délais bornés. La foule, les véhicules, les modèles, la résolution, les ombres, les reflets et le MSAA restent identiques.

Les coups ambiants restent non létaux et ne donnent ni dégâts ni recherche policière au joueur témoin. Tirs proches, blessure, peur, danger routier et police visible interrompent le conflit. Le système existant de propriétaire volé reste prioritaire. Aucun retour n'éjecte le joueur, ne téléporte le conducteur ni ne réactive une carcasse. Si la porte est inaccessible, le personnage reste dehors et le véhicule immobile.

La sauvegarde conserve les participants, leurs coordonnées via le système de blessures, la phase, les délais et le générateur aléatoire. Les anciens enregistrements d'un conducteur déplacé sont mis à jour après son retour, même sans perte de santé.

Validation :

- `tests/altercations.mjs` : déclencheurs, mouvement, riposte, limites de dégâts, témoins, police/visibilité, blessures, vol, retour bloqué, bornes, pause, intérieur et reprise déterministe.
- `tests/altercations-session.mjs` : monde et collisions réels, sauvegarde/reprise avec 480 passants, retour des deux pilotes, absence de double rendu piéton, mise à jour des enregistrements.
- `tests/altercations-browser.py` : scénario réel affiché par FERRO, coups puis retour des pilotes, testé en WebGL2 et WebGPU ; captures jointes. Les autres véhicules sont déplacés pour isoler ce contrôle fonctionnel : ce n'est pas un test de trafic dense.
- Régressions conducteurs, blessures, foule, klaxons et quatre démos enregistrées : validées.
- `tests/road-rage-pacing.py` : comparaison avant/après sur les secondes 1–9 de la même démo, 480 passants et 15 agents de trafic, mêmes réglages. Les premiers relevés courts incluant le démarrage sont conservés dans `demo-*-road-rage-webgl2.json` ; ils ne permettent pas de conclure sur un petit écart de performances.

Limites : comportements et animations procéduraux stylisés ; la présence policière disperse, elle ne crée pas une procédure complète d'arrestation des deux PNJ. Les tests Chrome ne prouvent pas la fluidité de Safari ni la stabilité d'un iPhone physique. Les derniers relevés Safari natifs de la version précédente restaient autour de 35–45 FPS dans les conditions mesurées ; 60 FPS constants ne sont pas acquis. Voir également `safari-065/README.md` et `shadows-065/README.md` pour les limites encore ouvertes.

Le Spark a fourni les premiers brouillons et la liste de scénarios. Ils ont été corrigés et raccordés localement ; seuls le code exécuté et les résultats des tests ci-dessus font foi. Aucun asset externe ajouté ; FERRO partagé reste à sa référence 0.3.2.
