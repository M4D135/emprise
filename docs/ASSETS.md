# Génération procédurale

EMPRISE 0.4.0 ne charge aucun asset graphique ou sonore externe : aucun modèle, squelette, animation, image, texture photographique, police ou enregistrement audio n'est embarqué. Les anciens fichiers MakeHuman et Poly Haven ont été retirés du projet et du build.

- Corps, mains, visages et vêtements : surfaces paramétriques originales dans `human-data.js`, `body-data.js`, `human.js`. Articulations et poids calculés par le code, mêmes proportions CPU/GPU.
- Véhicules et bateaux : panneaux, carènes, tubes, roues et instruments construits en triangles. Bâtiments et mobilier : volumes, profils, ouvertures et détails générés.
- Asphalte et enduit : albédo, normales et rugosité calculés en mémoire à partir de bruits déterministes dans `materials.js`. Les tableaux de pixels sont créés au chargement ; aucun fichier image ni téléchargement.
- Éclairage, reflets, météo, particules et animations : shaders et simulation FERRO. Musique/sons : synthèse METAL/BITUME.

Les données OpenStreetMap/BAN décrivent la géographie et les établissements réels. Ce sont des données cartographiques, pas des modèles 3D ni des textures : voir `PLACES.md`. Les photos liées dans les références servent à étudier formes et proportions ; elles ne sont pas des ressources du jeu. Les PNG de `docs/` sont des captures de vérification, exclus du build.

```sh
python3 tools/prepare-head.py
python3 tools/prepare-body.py
python3 build.py
node tests/models.mjs
```

Le jeu demeure stylisé. La génération procédurale ne constitue pas une promesse de photoréalisme.
