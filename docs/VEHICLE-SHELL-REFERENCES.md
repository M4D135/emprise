# Carrosseries procédurales — 16 novembre 2026

Le défaut signalé était géométrique : le flanc s'arrêtait à 84 cm de haut, environ 7 cm à l'extérieur du bas de la cabine situé à 86 cm. Aucune tôle ne raccordait ces deux bords. Une lumière traversante restait donc visible sous les vitres, indépendamment des ombres.

Les flancs comportent maintenant leurs épaules de tôle dans les mêmes maillages. Le capot, le pied de pare-brise, le bas des vitrages et le hayon partagent leurs coordonnées de raccord. Le capot rejoint aussi la hauteur réelle des optiques au nez. Le pavillon rectangulaire est remplacé par une surface faiblement bombée, avec retours de tôle sur les deux traverses de vitrage.

La custode de la 205 reçoit un bord arrière presque vertical, conforme à la photographie de profil, et un montant C plus large portant deux petits supports de badges. Les gros tubes qui dessinaient les passages de roue sont remplacés par quatre moulures continues : plastique sombre sur la 205, élargisseurs peints et plus plats sur la Supercinq. La poignée verticale et les garnitures peintes de la R5 la différencient davantage. Ces modèles restent des interprétations procédurales de jeu, pas des scans ou des répliques industrielles certifiées.

## Références réellement consultées

- [Peugeot — 40 years of the 205 GTi](https://www.peugeot.co.uk/about-us/brand/peugeot-magazine/40-years-of-the-205-gti.html) : page constructeur ; [photographie d'en-tête](https://www.peugeot.co.uk/content/dam/peugeot/master/b2c/brand/news/l-m/peugeot-magazine/2024/september/40-years-of-the-205-gti/header/header_desktop_big_1920x810_GTI.png).
- [205 GTI 1.9 de 1989, photographie de profil publiée par Top Gear](https://www.topgear.com/sites/default/files/images/news-article/carousel/2016/08/aacbdf694c812164f1398d01e4608e18/1989-peugeot-205-1.9-gti.jpg) : proportions des ouvertures, custode presque verticale, badges distincts, élargisseurs larges et raccord portière/vitrage. C'est une référence photographique, pas une source de cotes techniques.
- [Renault Originals — photographie officielle de Supercinq GT Turbo](https://a.storyblok.com/f/118112/4100x2100/a823f7ca7c/supercinq_turbo-01.jpg) : toit peu bombé, continuité capot/aile/pare-brise, forme des élargisseurs et position des optiques. La vieille URL de la page modèle renvoie 404 ; l'image officielle reste accessible. Cet exemplaire présente l'habillage de première phase et ne sert pas à justifier les détails de phase 2.
- [Supercinq GT Turbo phase 2, photographie de profil publiée par L'Argus](https://images.largus.fr/images/styles/max_1300x1300/public/2023-05/renault-5-GT-turbo-ph1-1989-2-bd.jpg) : silhouette de trois portes, poignée verticale, élargisseurs et bas de caisse peints. Les jantes existantes restent une interprétation, elles ne sont pas présentées comme une reproduction exacte des jantes de cette photographie.
- [FIA — Renault 5 GT Turbo C405, homologation 5262](https://historicdb.fia.com/car/renault-5-gt-turbo-c-405-1401) : identification du modèle et distinction avec la Renault 5 Turbo à moteur central. Les dimensions et la dynamique déjà utilisées par le jeu ne sont pas retouchées dans cette passe.

Aucune photographie, texture, maillage téléchargé ni nouvelle ressource externe n'est intégrée au jeu. Les références restent des liens documentaires ; chaque panneau est généré en JavaScript.

## Contrôles

`node tests/vehicle-shell.mjs` compare au code précédant la correction, commit `0a68dbe2b907e6795c3c8fe2f7701fa9d59d191c`. Il vérifie 2 610 rayons sur les épaules et le toit ; la même fixture expose 1 548 traversées manquantes dans l'ancien modèle. Elle vérifie également les triangles finis et non dégénérés, les couleurs sans variation de forme, ainsi que l'identité des caractéristiques mécaniques, sièges, garnitures, commandes, jauges et position de conduite.

`node tests/vehicle-trim.mjs` vérifie 400 triangles de badges et garnitures, attachés aux vraies faces du montant C avec leur retrait physique. Son ancienne assertion d'identité complète de la R5, liée à une correction antérieure portant uniquement sur la 205, est remplacée par les contrôles dédiés ci-dessus puisque les deux carrosseries changent volontairement.

| Modèle | Pièces fixes avant | Pièces fixes après |
|---|---:|---:|
| 205 GTI | 428 | 350 |
| Supercinq GT Turbo | 573 | 495 |

Le remplacement des arches regroupe les 80 tubes en une seule forme par modèle ; une surface sombre commune aux quatre passages de roues ferme la vue traversante derrière les pneus. Le bilan est de 78 instances de moins par modèle. Cela ne constitue pas une mesure de cadence d'affichage. Les roues, commandes mobiles et conducteurs suivent toujours leur rendu existant.

`python3 tests/vehicle-shell-browser.py --backend webgl2` et `--backend webgpu` produisent une galerie isolée de chaque voiture : profil, face de trois quarts, arrière de trois quarts, côté opposé, pavillon, raccord sous les vitres et profil sans ombres. L'option `--source CHEMIN --label before` permet une comparaison avec l'ancien code sans charger Marseille. Ces captures doivent être relues visuellement ; les contrôles numériques ne prouvent pas à eux seuls la fidélité d'une silhouette.

Validation effectuée sur les deux backends : 16 captures finales chacun, dont les trois quarts avant sans ombres, et 14 captures de référence avant sur WebGL2. Les rapports `vehicle-shell-after-webgl2.json`, `vehicle-shell-after-webgpu.json` et `vehicle-shell-before-webgl2.json` conservent les empreintes et compteurs. Le profil et les vues de trois quarts confirment la fermeture de la bande sous vitrages et des fonds de passages de roue. Les suites `cockpit.mjs`, `drivers.mjs` et `vehicle-explosion.mjs` passent également. Les traces des fils de dégivrage restent visibles à travers l'habitacle, même sans ombres ; elles n'ont pas été supprimées.

Dans cette seule fixture de trois quarts avec ombres, la 205 passe de 42 968 à 36 716 triangles rendus et la R5 de 46 408 à 40 212. Les appels WebGL2 passent respectivement de 61 à 69 et de 49 à 57 : les nouveaux panneaux ajoutent quatre groupes de formes, rendus en couleur puis en ombre. Les quatre moulures d'arches sont regroupées dans une seule forme pour contenir ce coût. Ce compromis est explicite ; aucun gain de fréquence d'affichage n'est déduit de ces compteurs. L'aspect reste une modélisation procédurale stylisée, sans prétention de photoréalisme atteint.
