# Génération procédurale

EMPRISE 0.6.0 ne charge aucun asset graphique ou sonore externe : aucun modèle, squelette, animation, image, texture photographique, police ou enregistrement audio n'est embarqué. Les anciens fichiers MakeHuman et Poly Haven ont été retirés du projet et du build.

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

Les hauteurs complémentaires viennent de la BD TOPO IGN, sous [Licence Ouverte 2.0](https://www.etalab.gouv.fr/licence-ouverte-open-licence/). Les références, méthodes d'acquisition, précisions et critères de correspondance sont conservés dans les données et rapports. Les empreintes ne sont pas déplacées pour s'adapter à ces hauteurs.

La triangulation des empreintes polygonales utilise le code de [Mapbox Earcut 3.0.2](https://github.com/mapbox/earcut), licence ISC reproduite dans `src/city-stream.js`. C'est un algorithme de génération de triangles, sans modèle préfabriqué. Les données géographiques restent soumises à leurs licences respectives.

Le backend WebGPU utilise les mêmes générateurs et matériaux. Les shaders WGSL sont produits hors ligne depuis les shaders FERRO par [Naga 30.0.1](https://github.com/gfx-rs/wgpu/tree/v30.0.1/naga), sous licence MIT/Apache-2.0. Le compilateur et ses dépendances ne sont pas embarqués dans le jeu ; le WGSL généré est livré dans le HTML, sans CDN ni compilation Rust au chargement. Sources et verrouillage du compilateur : `tools/webgpu-compiler/`.
