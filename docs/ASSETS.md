# Assets visuels et reproduction

Les assets suivants sont livrés dans le dépôt et embarqués dans le build autonome. Leurs URL et SHA-256 sont conservés dans les fichiers `SOURCES.json` correspondants.

| Asset | Source | Licence et adaptation |
|---|---|---|
| Corps, tête, mains, squelette et poids | [MakeHuman](https://github.com/makehumancommunity/makehuman), `makehuman/data/3dobjs/base.obj` et `data/rigs/default*` | [CC0 pour les assets](https://www.makehumancommunity.org/about/license.html). Sources et licences dans `assets/human`. Maillage de corps habillé, coutures découpées, pose de repos et poids convertis pour FERRO. |
| Asphalte : albédo, normale OpenGL, rugosité 1K | [Poly Haven — asphalt_02](https://polyhaven.com/a/asphalt_02), Rob Tuytel | [CC0](https://polyhaven.com/license), JPEG conservés dans `assets/materials`. |
| Enduit : albédo, normale OpenGL, rugosité 1K | [Poly Haven — plastered_wall_02](https://polyhaven.com/a/plastered_wall_02) | [CC0](https://polyhaven.com/license), mêmes conventions. |

Aucun téléchargement à l’exécution. Les sources humanoïdes ne sont pas incorporées en OBJ brut : les conversions produisent `human-data.js` et `body-data.js`, positions quantifiées à 0,1 mm et normales signées 16 bits. La tête a 4 328 sommets / 8 608 triangles ; le corps a 7 340 sommets / 14 200 triangles avant assemblage des vêtements et accessoires. Les données de conversion viennent du groupe anatomique du fichier, en excluant ses volumes auxiliaires.

```sh
python3 tools/prepare-head.py
python3 tools/prepare-body.py
python3 build.py
node tests/models.mjs
```

Les scripts utilisent les fichiers vendus dans ce dépôt et fonctionnent indépendamment du répertoire courant. La conversion n’écrase pas les manifestes d’origine. Les fichiers JavaScript restent des maillages adaptés au moteur : les visages, cheveux, habits et animations ne prétendent pas atteindre un rendu photoréaliste.
