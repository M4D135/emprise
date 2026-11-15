# Modèles et références

Les véhicules sont des maillages originaux entièrement construits par code. Les photographies servent uniquement à comparer les proportions et les détails : aucune texture photographique ni aucun maillage importé n'est embarqué dans ces véhicules. Le rendu conserve les limites d'une reconstruction procédurale, sans prétention de réplique industrielle exacte.

| Modèle | Caractéristiques reproduites |
|---|---|
| Peugeot 205 GTI 1.9 | 3,705 × 1,589 m, empattement 2,42 m ; élargisseurs noirs, filet rouge, petites optiques, jantes à trous, becquet, tapis rouge, sièges, combiné analogique et trois boutons de ventilation |
| Renault Supercinq GT Turbo, interprétation phase 2 | 3,59 × 1,59 m ; ailes et boucliers couleur caisse, bande noire, antibrouillards jaunes, losange, jantes pleines à fines ouïes radiales, interprétées d'après la photographie officielle, tableau de bord avec instruments supplémentaires et tablette passager |
| Yamaha TMAX 560 | gabarit de 2,195 m et empattement de 1,575 m ; maxi-scooter à carénage, double optique, bulle, selle à deux niveaux, rétroviseurs et panneau d’instruments simplifié |
| Trottinette électrique | modèle générique inspiré d’une Xiaomi Scooter 4, petites roues 10 pouces, plateau, potence, guidon, afficheur et feu arrière ; 25 km/h au maximum dans ce réglage |
| Vélo de ville | cadre diamant tubulaire, roues de type 28 pouces à rayons, selle, fourche, chaîne, pédalier animé, porte-bagages et béquille |

Peintures libres sur les cinq modèles, huit couleurs rapides et sélecteur RGB. Les roues tournent, les aiguilles des autos suivent vitesse/régime et le volant suit le braquage. Vue de conduite pour chaque véhicule ; déplacement de la tête à la souris. Un conducteur stylisé apparaît sur les deux-roues en poursuite. Les rétroviseurs sont des surfaces teintées, sans rendu caméra secondaire.

## Sources consultées

- [Peugeot / Stellantis — 205 GTI](https://www.media.stellantis.com/uk-en/peugeot/press/10-reasons-why-the-peugeot-205-gti-is-the-greatest-hot-hatch-ever) : référence constructeur conservée ; la consultation du 15 novembre 2026 n'a livré que l'en-tête de navigation. Les cotes utilisées sont contrôlées dans la fiche FIA ci-dessous.
- [FIA — homologation 205, formulaire 5301](https://historicdb.fia.com/sites/default/files/car_attachment/1601059801/homologation_form_number_5301_group_a.pdf) : dimensions de caisse. Cette fiche concerne la base homologuée ; elle ne certifie pas la dynamique de notre modèle 1.9.
- [Renault Originals — Supercinq GT Turbo](https://theoriginals.renault.com/supercinq-gt-turbo) : modèle correctement identifié ; la page directe renvoyait 404 le 15 novembre 2026, mais [la photographie officielle de trois quarts](https://img2.storyblok.com/1536x0/filters%3Aformat%28jpeg%29%3Aquality%2880%29/f/118112/4100x2100/a823f7ca7c/supercinq_turbo-01.jpg) a été consultée. Elle guide les montants, les optiques, le bouclier et les ouïes de jante ; elle ne certifie pas tous les détails de phase 2.
- [FIA — Renault 5 GT Turbo](https://historicdb.fia.com/car/renault-5-gt-turbo-c-405-1401) : identification, architecture à traction et moteur turbo.
- [Phil Mires — photos d’une 205 GTI 1.9 de 1992](https://philmiresclassiccars.co.uk/collections/hot-hatches/products/1992-peugeot-205-gti-1-9) : habillage et tableau de bord ; référence photographiée avec volant à droite, interprétation ici avec volant à gauche.
- [Artcurial — Renault 5 GT Turbo, lot 53](https://www.artcurial.com/ventes/3887/lots/53-a) : photos de l’intérieur.
- [Yamaha — TMAX 560 2025, spécifications](https://www.yamaha-motor.co.th/bigbike/new-tmax-560-2025/specification) et [fiche constructeur](https://cdn2.yamaha-motor.eu/prod/product-assets/2025/XP500A/Factsheets/2025-XP500A_en.pdf) : proportions et équipement.
- [Xiaomi — Scooter 4, spécifications](https://www.mi.com/fr/product/xiaomi-electric-scooter-4/specs/) : dimensions de référence, roues et vitesse.

Les images `205-exterior.png`, `205-interior.png`, `r5-exterior.png`, `r5-interior.png`, `tmax-exterior.png`, `tmax-interior.png`, `scooter-exterior.png` et `bike-exterior.png` sont des captures de nos propres modèles dans le navigateur. Aucun de ces modèles n’est présenté comme une réplique industrielle exacte ou un produit officiel.

## Révision procédurale du 15 novembre 2026

Les 205 et Supercinq disposent de panneaux A/B/C pleins, d'une vitre de porte et d'une vitre de custode distinctes, de joints fins et d'angles de hayon fermés. Le capot présente une légère courbure et des épaules latérales. Les indicateurs orange sous les phares de la Supercinq, sa prise d'air basse à lames, les bourrelets des pneus, les supports latéraux de sièges, les garnitures de porte et le volume du combiné ont été repris. Les vitrages sont plus lisibles en vue extérieure ; ils restent masqués par le mode cockpit pour conserver la visibilité de conduite.

Le modèle fixe de la 205 passe de 482 à **518 pièces** (+7,5 %), celui de la Supercinq de 533 à **571** (+7,1 %). Les roues et aiguilles mobiles s'ajoutent lors du rendu. Les cinq champs physiques des deux voitures — longueur, largeur, hauteur, empattement et masse — ainsi que l'œil de conduite `[-0.48, 1.10, -0.34]` sont inchangés. Les contrôles Node vérifient les tailles positives, coordonnées finies et transformations de rendu. La validation visuelle complète dépend des captures de la version intégrée ; les anciennes images présentes dans ce dossier peuvent montrer l'état précédent.

Voir [REFERENCES-VISUELLES.md](REFERENCES-VISUELLES.md) pour la correspondance entre sources et formes reconstruites.

## Révision des deux-roues — 0.5.0

Le TMAX reçoit un tablier avant mince et galbé, des panneaux latéraux continus, deux zones de selle, des optiques ajustées à la surface du carénage, une bulle courbe et des bras de fourche distincts. Les freins, le carter de transmission et l'échappement sont de vrais volumes. L'interprétation s'appuie sur les doubles optiques, les panneaux latéraux en boomerang, la selle sculptée et l'échappement relevé décrits par [Yamaha pour le modèle 2025](https://www.yamaha-motor.eu/de/de/news/2024/2025-tmax-and-tmax-tech-max/). Elle ne reproduit pas chaque pièce d'une version commerciale précise.

Le vélo dispose de deux bases et deux haubans, d'une fourche courbée à deux branches, de garde-boue fins, d'un porte-bagages, d'une chaîne et d'une selle profilée. La trottinette conserve une silhouette distincte : plateau avec batterie et surface antidérapante, articulation de potence, fourche, moyeu moteur fermé et disque arrière. Les roues de 10 pouces et le frein arrière correspondent aux caractéristiques consultées chez [Xiaomi](https://www.mi.com/fr/product/xiaomi-electric-scooter-4/specs/) ; le modèle reste générique.

Les pneus sont construits par révolution d'un profil arrondi. Jantes, rayons ou branches de roue, moyeux et disques partagent l'orientation de leur roue. La direction tourne autour d'un axe incliné commun à la roue avant, à la fourche et au guidon. Les mains suivent les poignées ; les pieds du cycliste suivent les pédales, avec les semelles sur leurs plateformes. Les poses des conducteurs restent des représentations simplifiées.

Les valeurs de `V.SPECS`, les yeux de conduite, les collisions et la fonction `V.step` sont conservés. `model(type, color)` garde `spec`, `pieces`, `wr`, `wb`, `eye`, `front` et ajoute `steering`, `handle`, `wheels`, `contacts(distance, turn)` et `triangleCounts`. `render(vehicle, meshes, options)` accepte `options.distance` : rendu complet jusqu'à 28 m, détails intermédiaires jusqu'à 75 m, puis silhouette et roues simplifiées. Sans distance, le rendu complet reste le comportement par défaut.

Les nombres ci-dessous incluent le conducteur ; les triangles des primitives correspondent au niveau graphique élevé du moteur. La version 0.4 sert de comparaison. Les formes supplémentaires augmentent le coût proche, tandis que les niveaux distants évitent de remplacer chaque deux-roues par une boîte générique.

| Modèle | Instances 0.4 → 0.5 proche | Triangles 0.4 → 0.5 proche | Instances / triangles intermédiaires | Instances / triangles lointains |
|---|---:|---:|---:|---:|
| TMAX | 62 → 93 | 5 588 → 14 612 | 79 / 12 280 | 55 / 9 672 |
| Trottinette | 46 → 68 | 3 432 → 7 956 | 54 / 6 156 | 37 / 3 948 |
| Vélo | 76 → 79 | 4 308 → 9 760 | 79 / 8 288 | 51 / 4 916 |

`tests/mobility-models.mjs` vérifie les gabarits, les nombres finis, les normales unitaires, le sens des surfaces fermées, les contacts, l'alignement des rayons pendant le braquage, les budgets des trois distances et l'absence de déplacement des pièces lors d'un changement de peinture. Les mesures détaillées sont dans `mobility-models-acceptance.json`. Les captures finales et la mesure du rendu intégré complètent ces contrôles numériques.


## Moto routière de police — 0.5.0

Le modèle `policebike` remplace le TMAX des patrouilles. Les cotes de base reprennent la [fiche constructeur BMW R 1250 RT](https://www.bmw-motorrad.fr/fr/modeles/tour/r1250rt/technicaldata.html) : longueur 2,222 m, largeur avec valises 0,990 m, empattement 1,485 m, selle voisine de 0,805 m et roues de 17 pouces. Le gabarit en hauteur inclut le gyrophare sur mât ; la masse du jeu ajoute une estimation de 20 kg d’équipement au véhicule de base. Ce n'est pas une simulation homologuée du RT-P.

Réservoir entre les jambes, moteur à cylindres opposés, protection tubulaire, cadre arrière, transmission par arbre, fourche, disque double à l'avant, carénage routier, bulle, instruments et repose-pieds sont générés en géométrie. L’équipement de service s’inspire du [catalogue BMW pour administrations](https://www.authorities.bmw-motorrad.com/content/dam/bmwmotorradnsc/marketAUTHMASTER/common/downloads/broschueren/BMW_F800GS-P_Broschuere_270824_Sprachversion_GB.pdf) : valises, radio et signalisation avant/arrière. La livrée du jeu est une interprétation originale ; aucun modèle ni image n'est importé.

Les bras et jambes du pilote utilisent une résolution géométrique à deux segments. Les mains suivent le guidon, les pieds portent sur les repose-pieds et le bassin touche la selle. Casque clair, visière, veste marine, empiècements réfléchissants et gants identifient le policier. Un joueur qui vole la moto ne récupère pas son uniforme. Les accessoires suivent l'inclinaison de la moto ; les bandes et la rampe automobile ne sont plus utilisées. Le pilote garde encore les deux pieds sur les repose-pieds à l'arrêt ; la descente reste simplifiée.

Les collisions et la conduite utilisent le gabarit propre à la moto. Les anciennes sauvegardes d'un TMAX policier acquis sont reconnues comme cette nouvelle moto, sous réserve d'une position encore libre. `police-motorcycle.mjs` vérifie gabarit, contacts, transformation, feux et budgets ; `police-motorcycle.py` fournit les vues de face, de dos, de trois quarts et selle vide.

## Conduite urbaine

Le modèle de pneus à deux essieux, les transferts de charge et la boîte proviennent de BITUME. Les 205 et R5 utilisent leur masse et empattement propres ; la poussée reste à l'avant. Le volant et son retour au centre sont filtrés. La R5 reçoit une montée/retombée progressive de suralimentation, sans reproduire une courbe constructeur exacte. Le frein à main freine l'essieu arrière et réduit son adhérence ; relâcher ce frein ne génère plus de turbo de jeu de course. La pluie et les dégâts continuent de modifier la conduite. `realism-validation.json` décrit les essais sur piste plane, leurs mesures ne sont pas des performances homologuées.
