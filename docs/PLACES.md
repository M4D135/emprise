# Lieux et adresses réels — Marseille

Les noms et positions proviennent d'un instantané OpenStreetMap du **14 novembre 2026 à 23:48:06 UTC**. Le monde jouable mesure désormais 1 100 m de côté, centré sur **43.2962 N, 5.3734 E**. Aucun lieu n'est déplacé pour le faire entrer dans le jeu. Les pièces intérieures, les produits et les services jouables sont des interprétations fictives ; les noms ne constituent pas une vérification de l'ouverture actuelle de chaque établissement.

L'instantané contient 1 093 éléments sources : 1 021 POI nommés actifs selon leurs tags, dont 964 dans les bornes ±550 m. Le test du catalogue PDR à 15 îlots et des empreintes intersectant les bornes associe **837 POI à 656 bâtiments**, avec **111 bâtiments accueillant plusieurs POI**. Les 127 points restants ne sont pas forcés dans un bâtiment voisin. Les boîtes de la ville sont simplifiées et certaines ont été retirées ou retaillées pour les rues. Les décomptes décrivent des objets OSM ; des doublons historiques OSM peuvent subsister.

**815 bâtiments** reçoivent au moins un des **1 111 points d'adresse BAN** effectivement contenus par leur empreinte. Les autres restent « Immeuble », sans numéro inventé. Plusieurs adresses d'un même bâtiment sont conservées. L'adresse d'une boutique ne devient jamais, par repli automatique, celle des appartements au-dessus.

## Projection et appariement

La projection reproduit exactement les facteurs WGS84 du générateur d'origine `Point de rupture/Jeu/outils/plans/extraire.py`, classe `Projection` :

- `x = (longitude − 5.3734) × 81148.19357771498` ; x va vers l'est.
- `z = −(latitude − 43.2962) × 111098.50934829589` ; z va vers le sud.
- Coordonnées arrondies au centimètre. L'approximation sphérique antérieure n'est pas utilisée.

Une source doit être contenue dans une boîte orientée du bâtiment (`cap = -lacet`). La tolérance maximale est 0,3 m pour les empreintes quantifiées et simplifiées ; aucun repli vers le bâtiment le plus proche n'existe. Si plusieurs boîtes contiennent le point, le choix est déterministe. Une boîte qui croise la limite du monde peut être retenue même si son centre est dehors ; les portes restent du ressort du catalogue intérieur et de sa vérification de collision.

## Contrat JavaScript

Charger `src/places-data.js`, puis `src/places.js`, avant le catalogue intérieur.

`RADE.places.assign(entries, world)` accepte des entrées `{id, boxes:[{x,z,lx,lz,lacet}]}` et retourne `[{place, entry, buildingId, method:'footprint'}]`. Il utilise **`world.bounds` dynamiquement**, sans se fier au drapeau `place.inBounds` calculé lors de l'export. À défaut, les bornes des métadonnées s'appliquent.

Chaque entrée reçoit `places`, `addresses` (tous les libellés), `addressPoints`, `address` (un libellé ou `null`) et `addressDetail` avec provenance. `name` et `type` ne sont pas modifiés. Chaque POI conserve `id` (`node/…`, `way/…`), `name`, `type`, `kind`, `cuisine`, `services`, `shop`, `address`, `addressDetail`, `lat`, `lon`, `x`, `z`, `tags`, `sourceUrl` et son alias `sourceURL`.

API complémentaire : `places`/`addresses`/`metadata` (getters), `placeById(id)`, `project(lat,lon)`, `unproject(x,z)`, `inBounds(x,z,world)`, `isInBounds(place,world)`, `contains(box,x,z,tolerance)`, `containsEntry(entry,x,z,tolerance)`, `lastStats`. L'appariement est répétable et réinitialise ses propres champs.

Les types viennent des tags : `restaurant`, `commerce`, `supermarche`, `hotel`, `logement` (tourism=apartment), `garage`, `armurerie`, `public`, `bureau`. `kind` conserve la catégorie OSM brute ; `cuisine=kebab` distingue les kebabs. `services` décrit des capacités de jeu, pas un catalogue marchand vérifié. Un réparateur `car_repair` a seulement `['repair']`.

## Contrôles officiels prioritaires

| Lieu | Adresse publiée | Position x / z | Bâtiment |
|---|---|---:|---|
| [Carrefour City Sainte](https://www.carrefour.fr/magasin/city-marseille-sainte) | 87 rue Sainte, 13007 Marseille | −247,48 / 546,59 | 4307 |
| [Shawarmax](https://shawarmaxfrance.fr/) | 32 rue Caisserie, 13002 Marseille | −472,28 / −87,27 | 1386 |
| [Carrefour Market Centre Bourse](https://www.carrefour.fr/magasin/market-marseille-centre-bourse) | 28 rue Bir Hakeim, 13001 Marseille | 126,97 / −52,82 | 1653 |
| [Police municipale — Poste Canebière](https://www.marseille.fr/marseillereussit/secteur-1-7) | 42 La Canebière, 13001 Marseille | 385,08 / −18,10 | 2701 |

[Carrefour Express Caisserie](https://www.carrefour.fr/magasin/express-marseille-caisserie) est confirmé au 3 rue Caisserie. [Istanbul Grill](https://acceslibre.beta.gouv.fr/app/13-marseille/a/restauration-rapide/erp/istanbul-grill-kebab-vieux-port/) est publié au 132 quai du Port, mais aucun point OSM correspondant n'a été confirmé dans cet instantané : aucune position n'est inventée. Ces contrôles, consultés le 15 novembre 2026, sont déclarés dans `assets/places/official-checks.json` ; ils enrichissent le libellé et gardent les coordonnées OSM d'origine.

Aucune armurerie ni concession automobile n'est identifiée dans l'instantané. A.S Auto Services, 10 rue de la Croix, est un réparateur réel dans l'emprise, pas un concessionnaire. Carosserie Saint-Victor est hors de la limite sud. Aucun faux hypermarché, vendeur d'armes ou concessionnaire ne remplace un établissement absent.

## Sources, licences, reproduction

- `assets/places/osm-pois.json` : réponse Overpass brute, bbox sud/ouest/nord/est `43.2907,5.3666,43.3017,5.3802`. **© les contributeurs d'OpenStreetMap, données sous [ODbL](https://www.openstreetmap.org/copyright)**. Chaque objet garde son URL OSM.
- `assets/places/ban-addresses.json` : 2 028 résultats uniques (numéros, rues et lieux-dits) de 121 requêtes IGN, archivés le 15 novembre 2026. Seuls les points numérotés complets sont utilisés. [Base Adresse Nationale — Licence Ouverte 2.0](https://www.data.gouv.fr/datasets/base-adresse-nationale), via le [géocodage IGN Géoplateforme](https://cartes.gouv.fr/aide/fr/guides-utilisateur/utiliser-les-services-de-la-geoplateforme/geocodage/). Les URL de requête sont conservées ; aucune requête réseau n'a lieu dans le jeu.
- `assets/places/projection.json` : facteurs vérifiés du générateur source.
- `assets/places/matching-report.json` : dernier résultat des tests, nombres et identifiants prioritaires.

Génération hors ligne : `python3 tools/prepare-places.py`. Validation : `node tests/places.mjs`. Les tests vérifient la projection source, la rotation des boîtes, les quatre lieux prioritaires, les bornes dynamiques, les bâtiments contenant plusieurs établissements et l'absence de numéro résidentiel fabriqué. Deux générations avec les mêmes instantanés produisent le même fichier.
