# Personnages et vêtements

Le visage, le corps, les mains, les vêtements et leurs poids d'articulation sont entièrement générés par du code original. Aucun modèle externe, OBJ, squelette importé, texture photographique ou maillage encodé n'intervient dans les personnages. `human-data.js` construit les surfaces à l'exécution ; `body-data.js` ajoute les vêtements et les membres paramétriques.

Les surfaces continues utilisent des profils interpolés et deux influences articulaires par sommet. Le visage possède une mâchoire, un nez, des joues, des orbites et une bouche sculptés par des fonctions, ainsi que des oreilles et un cou. Les doigts et les paumes sont générés séparément avec des proportions adultes. Le haut a une coupe ample : son volume est distinct des détails anatomiques du torse. Les manches suivent un profil continu autour des bras et des avant-bras. Les poignets et l'ourlet suivent des limites paramétriques nettes, les mains restent découvertes. Les normales sont recalculées après la mise en forme.

Les personnages proches déforment leurs sommets avec `human.poseBody` et les poids articulaires, dans les emplacements de maillage réutilisés par le moteur. La foule utilise les mêmes données et la même fonction de coupe `human.fit`, avec déformation dans le shader. Les deux coupes sont précalculées pour les acteurs proches ; le calcul par image réutilise les positions et normales sans créer des objets pour chaque sommet. Aucun cylindre rigide supplémentaire ne remplace les bras du maillage détaillé.

Le foulard comporte une enveloppe de tête avec ouverture du visage et un drapé séparé sur les épaules. Les mêmes deux maillages servent à la foule et aux acteurs proches. Leur couleur de tissu est indépendante du teint, du camp et du comportement.

Les modèles restent stylisés. Ces modifications ne constituent pas une promesse de photoréalisme. Les personnages éloignés conservent des représentations simplifiées pour maîtriser le coût de rendu.

`tools/prepare-head.py` et `tools/prepare-body.py` valident ces générateurs sans lire aucun asset source.

Vérification : `node tests/models.mjs` contrôle les indices, normales, poids, poses, l'utilisation des maillages déformés et les proportions minimales des vêtements. Une validation visuelle en jeu complète ces contrôles numériques.
