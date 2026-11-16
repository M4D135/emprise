# FERRO 0.3.2 — moteur procédural de référence

Décision de David, 16 novembre 2026 : moteur commun prioritaire, EMPRISE pilote, éditeur secondaire. Aucun plafond de taille des sources, du moteur ou des builds. La taille est mesurée ; elle ne décide pas des fonctionnalités.

La source de référence est `src/ferro` du dépôt [M4D135/FERRO](https://github.com/M4D135/FERRO). Elle a été extraite du pilote EMPRISE sans changer les 32 modules qualifiés. Les 32 modules sont distribués à EMPRISE, METAL, BITUME et Point de rupture avec les mêmes octets. Chaque jeu possède `FERRO.lock.json` ; son build vérifie les SHA256 et refuse une copie divergente. Les réglages, règles et styles propres au jeu restent dans des adaptateurs.

## Apports réunis

| Origine | Fonctions communes |
|---|---|
| EMPRISE | Rendu WebGPU et WebGL2, PBR généré, mer procédurale, SSR, grands mondes, lots de décor, mises à jour locales de destruction, fragmentation bornée, humanoïdes et démarche pilotée par la distance |
| METAL | Géométrie de collision, capsules continues, joints, réveil local, requêtes physiques, ciels avancés, captures de reflets locaux, composition, résolution native, mesure GPU, cache temporel de visibilité, audio spatial et musique synthétisée, boucle fixe, ordonnanceur, tâches en arrière-plan, réseau tactique procédural et outils de démo/rejeu |
| BITUME | Indexation des primitives sans changer leurs triangles, surfaces et décors par lots, carrosseries procédurales, noyau de conduite, météo humide persistante, matériaux et éclairage du cockpit |
| Point de rupture | Navigation par champs, foule GPU, interpolation des états, sélection et niveaux de détail, brouillard de guerre, lots et éclairage des grandes foules |

La géométrie, les surfaces, les sons et les instruments sont calculés. Les recettes, partitions, paramètres, règles et données cartographiques du jeu sont des données d'auteur ; les captures de validation ne sont pas des assets chargés par le jeu. Aucun modèle, image, police ou son externe n'est nécessaire au runtime du moteur.

## Distribution

- `ferro-runtime.js` : noyau et API `FERRO`.
- `ferro-render-extras.js` : ciel avancé, reflets locaux, surface native et profilage.
- `ferro-music.js` : musique synthétisée et transitions.
- `ferro-simulation.js` : passages, réseau tactique, boucle fixe, ordonnanceur, tâches et démo/rejeu.
- `modules/` : fichiers séparés pour composer le build de chaque jeu.
- `manifest.json` : version, origines et empreinte de chaque fichier.
- `tools/install-ferro.py` et `tools/check-ferro-lock.py` : installation et contrôle des copies.

Les modules optionnels sont disponibles dans les quatre dépôts ; les builds n'exécutent que ceux dont le jeu a besoin. L'absence de plafond de fichier n'impose pas de charger des systèmes inutilisés.

Depuis le dépôt de référence, ou depuis l'archive décompressée :

```sh
python3 tools/install-ferro.py emprise /chemin/vers/EMPRISE
python3 tools/install-ferro.py metal /chemin/vers/METAL
python3 tools/install-ferro.py bitume /chemin/vers/bitume
python3 tools/install-ferro.py point-de-rupture /chemin/vers/point-de-rupture/Jeu
python3 tools/check-ferro-lock.py /chemin/vers/le/jeu
```

Pour corriger le moteur : modifier la référence, qualifier le pilote, changer la version, reconstruire le paquet, réinstaller les modules et qualifier les jeux concernés. Une modification propre à un jeu passe par son adaptateur, pas par une copie locale du moteur.

La version 0.3.1 ajoute l’option `preferWebGL2OnSafari`, opt-in pour le choix automatique. Les scènes `revisionedMeshes` évitent les copies de contrôle réservées aux mutations implicites. `setWorld([])` libère les références à l’ancien monde sans supprimer les programmes compilés.

## Éclairage transitoire stable

Depuis 0.3.2, une source transitoire peut définir `selectionPower` comme puissance nominale de sélection. Sa puissance instantanée `power` reste celle du rendu, y compris zéro : un gyrophare ne remplace plus périodiquement un lampadaire voisin. Le budget de lampes et les shaders restent identiques. Sans cette propriété, la sélection historique est inchangée. Le helper est partagé par WebGL2 et WebGPU ; `tests/ferro/renderer-lights.test.mjs` couvre les phases, limites et compatibilité.

## API et profils

`FERRO.capabilities()` indique les modules chargés. `FERRO.require(name)` échoue explicitement si le module demandé n'est pas chargé. `FERRO.createRenderer`, `createPhysics`, `createAudio` et `compileRecipe` constituent les points d'entrée usuels. Les anciens noms `FRender`, `FPhysics`, etc. restent utilisables pour les jeux existants.

`FERRO.createPhysics()` active les profils géométrique et borné. Les appels historiques `FPhysics.create()` et les anciennes sauvegardes gardent leur comportement ; une migration de solveur nécessite une validation propre au jeu. La destruction expose les splices ordonnés d'EMPRISE et les deltas multi-lecteurs de METAL. `fragmentation:'source'` préserve les débris historiques de METAL ; le profil par défaut produit les fragments bornés d'EMPRISE.

La foule reçoit son style, ses shaders et ses règles. Point de rupture conserve ses figurines et animations ; EMPRISE conserve ses humanoïdes. Les maillages sont normalisés en indices 32 bits avant l'envoi au GPU. Le noyau de conduite reçoit les paramètres de la voiture ; la course, le trafic et les règles de collision restent dans les jeux.

| Fonction | WebGL2 | WebGPU |
|---|---|---|
| Géométrie procédurale, PBR, mer, ombres, lots, SSR | Oui | Oui |
| Foule générique et profil EMPRISE | Oui | Oui |
| Profil de foule personnalisé | Shaders GLSL injectés | Programmes WGSL correspondants requis |
| Ciel avancé FSky, captures locales, résolution native et profilage METAL | Oui | Profil non porté |

La sélection automatique choisit WebGL2 lorsqu'un profil exige ces fonctions avancées. La perte de périphérique WebGPU réinstalle WebGL2 en conservant la session et les commandes. Le repli Canvas2D de METAL reste disponible. Cette version ne prétend pas offrir des fonctions absentes d'un backend.

## Atelier

L'atelier 0.1 utilise le moteur 0.3.2 : objets, transformations, matériaux, répétitions, annuler/rétablir, visite libre, recettes JSON et export JavaScript déterministe. Il est publié sur `https://ferro.estrasse.fr/`, avec le paquet du moteur. Le moteur constitue la référence commune des quatre jeux.

## Qualification et limite connue

Les preuves initiales sont conservées dans `docs/ferro-reference/`. Les contrôles de 0.3.1 sont dans `docs/performance-031/` ; ceux du correctif d’éclairage 0.3.2 dans `docs/lighting-032/`, avec ses limites et ses captures. Les essais natifs ont été faits sur le Mac ; ils ne représentent pas une mesure universelle de performances ni une validation de tous les appareils.

Un test physique historique reste marqué TODO : un cube incliné glisse après son basculement au-delà du seuil de déplacement attendu. Il est conservé et signalé ; ce comportement du solveur n'est pas présenté comme corrigé. Les tests de fonctionnement et de compatibilité exigés pour la propagation doivent passer sans échec hors de ce TODO explicite.
