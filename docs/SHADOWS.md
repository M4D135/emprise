# Ombres et artefact de carrosserie — EMPRISE 0.6.0

Le signalement a été reproduit près du véhicule de départ, caméra orientée à 122°. Les captures comparent la même scène, la même heure et les mêmes objets, avec et sans ombres.

## Ombres solaires

Le filtre précédent combinait neuf comparaisons de profondeur avec des poids fixes. Les coordonnées de ces lectures passaient brusquement d’un texel à l’autre : les façades montraient des paliers et les contours changeaient par à-coups.

Le filtre utilise désormais neuf comparaisons pondérées par une B-spline quadratique. Les poids varient continûment avec la position dans le texel, leur somme vaut un et la correction de profondeur suit toujours le plan réel de la surface. La résolution, le volume couvert, l’intensité des ombres et le biais restent identiques.

La foule utilisait aussi un facteur deux pour corriger la pente du récepteur lorsque le soleil occupait l’atlas entier. Le facteur est maintenant un pour l’atlas entier et deux pour une tuile de demi-largeur. Le monde et la foule utilisent le même filtre.

La projection était déjà alignée sur les texels dans le plan de la lumière. Elle a été conservée après mesure. À vue fixe, un déplacement de 3 mm du centre du volume produit **3 pixels variant de plus de deux niveaux, contre 27 auparavant**. Une rotation minuscule de ce centre passe de 28 à 3 pixels ; une translation de 25 cm passe de 56 à 17. Ces valeurs décrivent la fixture contrôlée, pas toutes les situations du jeu.

[Avant](shadow-projection-before-on.png) · [Après](shadow-projection-after-on.png) · [Ombres désactivées pour le diagnostic](shadow-projection-after-off.png).

## Montant arrière de la 205

Le motif rose/noir restait visible sans ombres. Le masquage ciblé a montré qu’une garniture dépassait du montant jusque dans la vitre ; les inscriptions étaient aussi positionnées à distance de la surface.

La garniture épouse maintenant les deux triangles réels du montant, avec un relief de 3 mm. Les badges suivent la même surface à 6 mm. Le test géométrique vérifie 428 triangles, leur appartenance au montant et leur distance. La R5 reste géométriquement identique.

[205 corrigée avec ombres](vehicle-trim-after-on.png) · [Sans ombres](vehicle-trim-after-off.png) · [Sous un autre angle](vehicle-trim-after-turn.png).

## Contrôles

- `shadow-bias.mjs` vérifie 2 448 comparaisons de profondeur et les conversions de pente du monde et de la foule.
- `shadow-webgpu-browser.py` lit les pixels réellement produits par le GPU : 18 configurations de mur, sol et obstacle, atlas entier ou tuile, translations de 0, 3 mm et 25 cm. Les récepteurs seuls ont zéro pixel assombri de plus de deux niveaux dans les zones mesurées (écart maximal observé : un niveau) ; un véritable obstacle conserve son ombre. Ce test isolé mesure le monde ; la foule est couverte par le test de pente, la compilation et les captures intégrées. Les répétitions fixes sont identiques.
- `shadow-browser.py` vérifie les récepteurs et l’ombre portée avec WebGL2.
- `shadow-projection-browser.py` conserve les matrices et captures avant/après à l’angle du signalement.
- `vehicle-trim.mjs` et `vehicle-trim-browser.py` vérifient la géométrie et les vues natives de la 205, ombres activées/désactivées et en rotation.

Rapports : [GPU natif](shadow-webgpu-after.json), [WebGL2](shadow-after.json), [projection avant](shadow-projection-before.json), [projection après](shadow-projection-after.json), [garniture](vehicle-trim-validation.json). Les mesures de coût du rendu sont séparées dans [WEBGPU.md](WEBGPU.md).
