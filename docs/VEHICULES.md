# Modèles et références

Les cinq types sont des maillages originaux entièrement construits par code. Les photographies servent uniquement à comparer les proportions et les détails : aucune texture photographique ni aucun maillage importé n'est embarqué dans ces véhicules. Le rendu conserve les limites d'une reconstruction procédurale, sans prétention de réplique industrielle exacte.

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
