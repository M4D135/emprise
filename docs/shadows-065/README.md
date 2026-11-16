# Éclairage intermittent — FERRO 0.3.2

Le tri des lumières transitoires dépendait de leur puissance instantanée. Un gyrophare clignotant changeait ainsi le rang et parfois la présence de lampadaires constants. Le shader donne aussi un coefficient de 0,27 aux deux premiers rangs, contre 0,13 aux suivants : un changement de rang modifiait donc une autre source lumineuse.

Le champ facultatif `selectionPower` fixe une puissance nominale pour ce classement. La puissance réelle, la couleur, la portée et le clignotement restent transmis normalement, y compris pendant la phase éteinte. Sans ce champ, le comportement existant demeure inchangé. EMPRISE fournit `selectionPower:45` pour ses gyrophares. Le budget reste de huit lumières transitoires ; shaders, ombres, biais et résolution ne changent pas.

Le contrôle GPU utilise le vrai renderer WebGL2 canonique. Le témoin ne remplace que la fonction de sélection par sa version précédente. Huit lampadaires fixes éclairent un sol ; un gyrophare passe par onze puissances, de 0 à 45 puis à 0. Les 672 pixels mesurés sont sélectionnés par intersection analytique avec le sol et se trouvent à au moins 13,01 m du gyrophare, dont la portée est de 10 m.

- Avant : les 672 pixels varient, avec un écart maximal de 13 niveaux RGB.
- Après : aucun pixel ni canal ne varie entre ces phases.
- Aucune erreur WebGL.

Le rapport [light-render.json](light-render.json) conserve le navigateur, les empreintes de source, les rangs et chaque mesure. Les captures montrent les phases [ancienne éteinte](lights-before-0.png), [ancienne allumée](lights-before-45.png), [corrigée éteinte](lights-after-0.png) et [corrigée allumée](lights-after-45.png). Le script de scène [fixture.js](fixture.js) attend `OldRender` et `NewRender`, deux instances du module canonique ; le témoin utilise [previous-selection.js](previous-selection.js). [manifest.json](manifest.json) conserve le commit du témoin et les empreintes des preuves.

Les quatre tests Node du dépôt canonique, `tests/ferro/renderer-lights.test.mjs`, valident également 241 phases, les valeurs invalides, les plafonds, les égalités de score, les budgets et l’absence de mutation. Ils reproduisent dix changements de présence et dix changements de coefficient des lampadaires avec l’ancien tri ; ces changements disparaissent avec la puissance nominale.

Cette mesure isolée s’exécute dans Chromium sur Mac, pas dans Safari ou un iPhone physique. Elle désactive les ombres solaires, le bloom et le MSAA uniquement dans la fixture pour isoler le classement des sources. Elle ne prouve pas la disparition de tout scintillement : les déplacements réels des sources et les contours d’ombre restent des phénomènes distincts. WebGPU partage la même fonction de sélection ; ses pixels n’ont pas été remesurés pour ce correctif.

## Diagnostic solaire distinct

[solar-temporal.json](solar-temporal.json) conserve 45 cas WebGL2 : mur, sol et obstacle, à 6 h, 8 h, 14 h, 18 h et 23 h, chacun avec une projection fixe, un soleil mobile ou une translation du centre de projection. Chaque cas comporte 31 instants à 60 Hz, soit 1 395 instants et 2 790 rendus appariés avec/sans ombres. La résolution de lecture est de 320 × 240 ; l’atlas solaire conserve 1 024 × 1 024 texels et une demi-étendue de 110 m.

Les murs et sols sans obstacle ont zéro pixel d’auto-ombre dans les régions mesurées. La projection fixe et la translation du centre de 0 à 9 cm ne font pas varier l’ombre de l’obstacle. Le soleil mobile déplace son contour : écart maximal entre deux instants de 18 niveaux à 14 h et de 2 niveaux à 23 h. Ces résultats ne constituent pas une preuve universelle de stabilité, ne couvrent pas toute Marseille ou ses matériaux et n’excluent pas l’aliasing des contours mobiles. Ils ne justifient ici ni de figer le soleil ni de modifier les biais. Aucune correction de projection solaire n’a été appliquée.

## Détails fins de la 205 : diagnostic complémentaire

La vue [profil avec ombres](../vehicle-shell-after-webgl2-gti-profile.png) présente un contour dentelé sous la baguette et le rétroviseur ; ces contours disparaissent [sans ombres, au même cadrage](../vehicle-shell-after-webgl2-gti-unshadowed.png). En revanche, les traits aperçus à travers la vitre arrière restent visibles dans la [vue avant sans ombres](../vehicle-shell-after-webgl2-gti-front-unshadowed.png) : ils ne sont pas attribués au calcul d’ombre (le modèle contient notamment des fils de dégivrage).

[trim.json](trim.json) compare le shader actuel à trois variantes temporaires : pente du récepteur issue de la position sans décalage normal, biais orienté selon la normale de face, et combinaison des deux. Les sources de production ne sont pas modifiées par cet essai. La fixture emploie le véritable modèle de 205, une demi-étendue solaire de 7 m et un atlas de 1 024 texels, soit environ 13,7 mm par texel ; la baguette fait 25 mm de profondeur et le décalage normal actuel vaut 14 mm.

Les quatre variantes produisent zéro variation sur la bande mesurée à soleil fixe, y compris lorsque le centre de projection se translate de 0 à 12 mm. Lors d’une petite rotation du soleil, elles produisent toutes la même variation maximale de 32 niveaux et 96 changements de pixels cumulés sur la séquence. Calculer la pente depuis la position sans biais ne change pas la mesure ; employer la normale de face ne réduit pas la dentelure. Ces variantes sont donc rejetées, sans modification du biais ou du shader livré.

Cette vérification confirme un aliasing visible du contour d’ombre sur les détails minces ; elle ne démontre pas que tout mouvement de ce contour est imperceptible. La correction du classement des gyrophares ne prétend pas résoudre cet aliasing distinct. Les captures [actuelle](trim-base.png), [pente sans décalage](trim-receiver.png), [normale de face](trim-face.png) et [combinée](trim-both.png) ainsi que [la fixture](trim-fixture.js) conservent cette limite explicitement.
