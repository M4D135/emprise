# FERRO Atelier 0.1 — premier jalon, 16 novembre 2026

Le chantier démarre dans une copie isolée d’EMPRISE, branche `codex/ferro-editor-20261116`, après la fin des modifications surveillées dans les quatre jeux. La création manuelle produit une recette versionnée qui génère des instances avec le renderer FERRO réel. Le jeu pilote reste EMPRISE.

## Sources figées et collecte

| Jeu | Révision figée | Apports retenus pour le chantier | Décision d’intégration |
| --- | --- | --- | --- |
| EMPRISE | `672bb463466584f997ea572e40d48b149009bffe` | WebGL2/WebGPU, sélection de backend, géométrie partagée, matériaux générés, révisions/chunks de scène, météo et destruction intégrées | Base active de l’éditeur ; les renderers sont utilisés tels quels |
| METAL | `474aa08bd4bf717947fa794bd50fe0484b97eab0` | Physique et requêtes géométriques, réveil local après destruction, sauvegarde physique, audio procédural, contrôles | Sources finales collectées ; adaptation séparée indispensable avant remplacement des copies intégrées à EMPRISE |
| BITUME | `365b3e2d43c9d4fd84a81c7d7974b62c2a906129` | Formes libres, conduite, contacts et obstacles, météo et sons de véhicules | Les formes libres sont déjà présentes dans EMPRISE ; contacts/conduite restent des candidats à comparer dans leurs adaptateurs |
| Point de rupture | `5ba44c9d2f9c667eac687b9d0fa2f170606ce2f8` | Foule instanciée, sélection/LOD, lots, navigation et simulation en worker | Les passes de foule existent déjà dans le renderer pilote ; les modules métier restent isolés |

113 fichiers de source/provenance ont été collectés depuis les objets Git de ces révisions, soit 5 145 682 octets. Le [manifeste](ferro-editor/sources-20261116.json) indique pour chacun le chemin d’origine, la taille et le SHA256. Les fichiers de travail non suivis des jeux n’ont pas servi de source.

La collecte est une réserve de modules identifiés, **pas une fusion déclarée de tous les derniers changements**. Les versions des moteurs sont déjà croisées : le renderer EMPRISE reprend les passes PDR et les formes BITUME, et la dernière livraison BITUME reprend le renderer EMPRISE. Les recopier en bloc serait une régression possible. Pour METAL, `fmath.js` est identique à la copie EMPRISE ; `physics`, `simulation`, `input`, `audio`, `motion`, `actors` et `effects` diffèrent. Les anciens clones METAL `731ace7` et `c31d2c5` ne sont pas les sources finales de cette collecte.

Les validations annoncées dans les chantiers sources ne sont pas présentées comme des tests relancés ici. Leurs limites restent ouvertes : pics des grosses explosions EMPRISE, qualification matérielle Xbox/téléphones, cas de pente et fonctions expérimentales METAL, limites propres aux scénarios de foule PDR. Aucun chiffre ne promet une performance universelle.

## Ce qui fonctionne

- Sept primitives, position/dimensions/rotation, sélection et déplacement au sol à la souris, cadrage et caméra orbitale.
- Répétitions paramétriques, variation déterministe par graine, duplication d’une procédure avec ses dépendances ; groupes supportés par le format et l’inspecteur.
- Matériaux nommés, procédures de surface existantes, teinte, émission et copie indépendante d’un matériau partagé.
- Annuler/refaire, sauvegarde locale au navigateur, import/export JSON et export d’un module JavaScript générateur.
- Visite libre dans FERRO, sans collision. Le mode édition ne redessine pas une scène immobile ; les recettes se compilent à la modification, pas à chaque image.
- Aperçu WebGL2 par défaut ; `?renderer=webgpu` demande WebGPU avec le repli prévu par le moteur. Les deux chemins ont été exécutés dans Chrome sur le Mac.
- Fichier HTML autonome d’environ 679 ko, sans CDN, modèle, texture ou son importé.

Le nouveau module moteur `src/ferro/recipes.js` est indépendant du DOM, du renderer et du jeu. Il ajoute un format de recettes, un validateur, un compilateur déterministe, un cache LRU borné et un historique. Les renderers de production n’ont pas été modifiés pour ce jalon. Le build normal d’EMPRISE n’embarque pas l’éditeur.

## Utiliser et reconstruire

Ouvrir `editor/index.html` directement dans Chrome, ou construire la page autonome :

```sh
python3 tools/build-ferro-editor.py
open dist/ferro-editor.html
```

Le bouton « Répéter » enveloppe la procédure sélectionnée. Modifier sa forme source modifie toutes ses occurrences. Le déplacement à la souris agit sur X/Z ; Y et les rotations se règlent dans l’inspecteur. Maj pendant le déplacement accroche à une grille de 25 cm. Clic droit : orbite ; Maj + droit : translation de vue ; molette : distance ; F : cadrage. La visite utilise ZQSD/WASD, E/C pour la hauteur, glisser pour regarder et Échap pour revenir.

« Sauvé localement » désigne le stockage de ce navigateur et de cette origine. Ce n’est pas une sauvegarde sur le VPS. Exporter le JSON reste le moyen de déplacer ou conserver un projet indépendamment du navigateur. Une scène vide, la démonstration et les imports passent par l’historique et peuvent être annulés.

## Contrat de recette et réutilisation

La source est un graphe JSON `ferro-recipe`, version 1, avec `materials`, `nodes`, `roots` et une graine entière. Les opérations sont `primitive`, `repeat` et `group`. Les dimensions sont en mètres, les rotations en radians, les couleurs en composantes 0–1. Une répétition conserve sa source, son nombre, son décalage et sa variation. Aucun code fourni par un fichier importé n’est exécuté.

Le générateur retourne `{meshes, owners, stats}`. Les objets sont immuables : un adaptateur de jeu qui doit les enrichir crée ses copies. `owners` relie chaque instance à la primitive et à la racine de sa procédure.

```js
// Charger src/ferro/recipes.js, puis le module exporté par l’atelier.
import generate from './mon-decor.ferro.mjs';
const {meshes} = generate(globalThis.FRecipes, 135);
// Dans une scène d’essai isolée du jeu, après création de son renderer :
renderer.setWorld(meshes, [], environment);
```

Ce raccord d’instances est testé avec le renderer EMPRISE. La recette est portable, mais les conventions de matériaux, unités, collisions, sauvegarde et LOD devront être qualifiées par un adaptateur de chaque autre jeu avant propagation. Le jalon n’affirme pas une intégration gameplay déjà livrée dans les quatre jeux.

Limites d’import : 1 Mo, 256 opérations, 64 matériaux, 256 répétitions par opération, 10 000 instances générées. Les cycles (même inaccessibles), références manquantes, valeurs non finies et dimensions invalides sont rejetés. Le nombre d’instances est calculé avant expansion ; les positions générées sont bornées à ±10 km. Cache de 32 compilations par défaut, historique de 80 états.

## Vérification du jalon

```sh
node --test tests/recipes.test.cjs
python3 tools/build-ferro-editor.py
python3 tests/ferro-editor-browser.py
```

9 tests du noyau passent : déterminisme, variation locale, graphe, limites, import, immutabilité/cache, historique, module exporté et empaquetage par le vrai FERRO. 31 contrôles navigateur passent, dont sélection/déplacement natifs, modification de matériau, répétition, annuler/refaire, téléchargements, réouverture identique, fichier invalide atomique, visite, restauration WebGL et rendu natif WebGPU du fichier autonome. Le test navigateur utilise le harnais Chrome existant, avec profil temporaire et canal de débogage par pipe ; aucun serveur local n’est nécessaire.

Les preuves sont dans `docs/ferro-editor/browser-report.json` et les captures associées. Ces contrôles portent sur la scène de l’atelier, pas sur un benchmark du jeu complet. Ils ne constituent pas une qualification Safari, Firefox, mobile, console ou PC NVIDIA.

## Prochaines étapes, dans EMPRISE uniquement

1. Ajouter assemblages réutilisables, groupes transformables, contraintes d’alignement, poignées 3D et graphe visuel éditable.
2. Généraliser les surfaces : paramètres de rugosité/métallicité/relief indépendants des procédures intégrées, bibliothèque de matériaux et invalidation ciblée. Cette version sélectionne des procédures existantes ; ce n’est pas encore un graphe de shaders.
3. Ajouter extrusions, profils, courbes et déformations avec niveaux de détail et coûts affichés. Sculpture libre et rétro-ingénierie arbitraire ne sont pas livrées.
4. Raccorder une scène de test au gameplay EMPRISE : collisions, interaction/destruction, navigation et sauvegarde provenant de la même recette. Qualifier les apports METAL/BITUME/PDR séparément avec leurs tests.
5. Mesurer coûts de génération, mémoire et rendu sur scènes représentatives ; stabiliser le format et les migrations.
6. Ensuite seulement, adapter et distribuer une version identifiée du runtime aux trois autres jeux, avec leurs tests et retour arrière.

## Publication demandée

David a demandé `ferro.estrasse.fr` sur le VPS après validation locale. Le vhost dédié est versionné dans `deployment/ferro.estrasse.fr.Caddyfile`. Déploiement statique sous `/home/ddd/apps/ferro/releases/<révision>`, lien `current` basculé atomiquement après vérification SHA256, via l’alias SSH `amiga` du Mac. Le DNS du domaine pointe déjà sur le VPS. Le reçu de publication doit distinguer la préparation, le déploiement et la vérification HTTPS effective.

Le Spark a été sollicité pour le noyau, mais l’appel a expiré après 300 s sans livrable. David a alors explicitement demandé de terminer ce premier jalon sur Codex. Aucune sortie non vérifiée du Spark n’a été intégrée.
