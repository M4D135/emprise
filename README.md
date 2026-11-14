# EMPRISE — 0.2.0 « Territoires »

Sandbox FPS solo persistant dans un secteur de Marseille, avec conduite et combat dans un seul renderer **FERRO**. Jouer : **[gta.estrasse.fr](https://gta.estrasse.fr)** · [Dépôt GitHub privé](https://github.com/M4D135/rade).

Cette version réunit le trafic civil et policier, les vols de véhicules, les gangs, les commerces et territoires à conquérir, les revenus passifs et les contre-attaques. Les conducteurs sont visibles et peuvent être extraits d’un véhicule arrêté. Les blessures distinguent tête, bras et jambes ; une blessure à la jambe impose une posture au sol et une mobilité très réduite.

Les véhicules se dégradent au fil des impacts : moteur, pneus et direction affectent la conduite. Les chocs et les tirs provoquent déformations, fumée, puis un feu progressif. Une voiture brûle au moins 8,5 secondes avant une grosse explosion : capot, toit, portes, roues et fragments sont projetés ; une carcasse calcinée persistante remplace le véhicule. Les véhicules voisins peuvent prendre feu à leur tour. Les roquettes ouvrent des brèches dans le décor ; des débris physiques ont une masse selon leur matériau. Les feux se propagent et les marins-pompiers peuvent intervenir.

## Jouer hors ligne

```sh
python3 build.py
open dist/index.html
```

Python 3 standard pour construire ; Node et Chrome pour les tests. Le HTML autonome pèse environ **7,31 Mo**, textures comprises, sans CDN ni requête réseau à l’exécution. `SIZE.json` donne son empreinte. WebGL2 et un navigateur de bureau sont requis pour la configuration vérifiée.

La version et l’identifiant du build apparaissent à l’écran titre. Après **5 secondes sans interaction**, des sessions de test enregistrées sont rejouées. Une touche ou un clic ramène au titre ; cette démonstration ne modifie pas la progression.

## Commandes

| Action | Commande |
|---|---|
| Marcher / conduire | ZQSD ou WASD |
| Courir / déraper | Maj |
| Interagir, entrer, sortir, extraire un conducteur arrêté | E |
| Contact moteur | Automatique à la montée ; F pour couper / rallumer |
| Freiner puis reculer | S maintenu |
| Frein / esquive à pied | Espace |
| Cockpit / poursuite | C |
| Regarder / tirer | Souris / clic gauche ; glisser si capture refusée |
| Mitraillette / fusil / roquette | 1 / 2 / 3 |
| Crosse / onde | V / R |
| Saisir un petit objet / le lancer | G / B |
| Allumer un feu à portée / réparer au garage | I / T |
| Couleur du véhicule | H ; sélecteur RGB dans la pause |
| Lire le plan acheté | M |
| Pause / reprise | P ou Échap |

**Aucune minimap à l’ATH.** Les quatre panneaux publics permettent de consulter le plan ; un exemplaire portable coûte 60 € dans un commerce. Le monde continue pendant sa consultation. L’objectif apparaît pendant une prise ou une défense, sans trajet GPS permanent.

Les six commerces et six points de deal ont chacun leurs défenseurs et leur gang. Les prendre puis les conserver génère un revenu ; les adversaires peuvent les reprendre. La sauvegarde locale conserve argent, contrôle, véhicules acquis, blessures, destruction, incendies et intérieur visité. Les revenus hors ligne sont plafonnés à huit heures. Le bouton de nouvelle partie efface cette sauvegarde après confirmation. Les sauvegardes de l’URL publique et du fichier local sont distinctes.

## Monde et modèles

- Secteur de 660 × 660 m, données OpenStreetMap embarquées. Mobilier urbain, façades détaillées, fenêtres écartées des angles ; 143 arbres retirés des chaussées.
- 746 adresses accessibles par portes ou passages communs. Intérieurs meublés : commerces, supermarchés, hôtels, bâtiments publics, logements, bureaux et garages. L’entrée et les escaliers chargent un espace distinct ; les étages ne sont pas tous géométriquement continus avec la rue.
- 205 GTI, R5 GT Turbo, TMAX, trottinette et vélo : couleurs libres, habitacles et tableaux de bord des autos, silhouettes procédurales. Fourgon de secours supplémentaire.
- Corps et mains issus d’un maillage anatomique MakeHuman CC0, vêtements adaptés, articulations pondérées pour la foule, chaussures affinées. Carnations majoritairement foncées à mates, femmes avec voile ou sans voile, tenues longues, casquettes et sacoches en bandoulière ; variantes sans lien avec la faction ni le comportement. Visages et carrosseries restent stylisés : le résultat n’est pas encore photoréaliste.
- Textures PBR Poly Haven pour asphalte et enduit, ombres dynamiques, reflets d’environnement et réflexions à l’écran. Soleil, nuages en dérive continue, pluie, vent, orages et éclairs. Sol mouillé et adhérence variable. Ce rendu WebGL2 n’utilise pas de ray tracing matériel.

## Intégration et origine

| Source | Commit utilisé |
|---|---|
| METAL | `731ace7016b0a787afd3b390c5882bf0527f6a29` |
| BITUME | `e9a5e7f96503a1fe65c79227a0624fb44a318f38` |
| Point de rupture | `1e8b6351a8c9f52c66858c731648ae0606045334` |

Socle renderer PDR pour ses passes de foule, complété par les formes libres et indices 32 bits de BITUME. Le contrôleur, les armes, les ennemis et les effets viennent de METAL. La dynamique automobile conserve les courbes de pneus, le transfert de charge, les freins et la boîte de BITUME ; son intégration de circuit est remplacée par des positions libres et des collisions urbaines. Les réglages sont adaptés à des compactes à traction. Les deux-roues utilisent un modèle plus simple.

[Détails techniques](docs/INTEGRATION.md) · [Références et modèles](docs/VEHICULES.md) · [Vérification et performances](docs/VERIFICATION.md). Les copies de travail de EMPRISE sont indépendantes des trois dépôts sources. `ORIGINS.json` donne les empreintes de départ, avant adaptation des copies.

## Validation et limites

Les tests couvrent les vrais événements clavier/souris, les sessions de combat et conduite, la capture/reprise d’un commerce, la sauvegarde, le trafic et la police, les accès intérieurs, la météo, les blessures, la destruction, les pompiers et les explosions. Les rapports et leurs conditions sont détaillés dans [VERIFICATION.md](docs/VERIFICATION.md).

C’est une version solo ; le multijoueur reste à développer. Le terrain et l’eau ne sont pas destructibles. La physique utilise des volumes simplifiés, un budget de 240 débris et 96 corps actifs, sans calcul de structure d’ingénierie ni ragdoll intégral. La foule n’est pas un obstacle rigide. Les animations d’extraction, de chute et de rampement sont simplifiées. Les deux-roues et le fourgon ont un niveau de détail inférieur aux compactes. Les intérieurs restent accessibles même si leur enveloppe extérieure a été endommagée. Un feu intérieur hors de la scène chargée ne simule pas toute sa destruction structurelle.

La sauvegarde dépend du navigateur. Les tests n’attestent pas chaque ruelle, chaque accès depuis tous les itinéraires, ni toutes les machines et commandes tactiles. Aucun asset de GTA n’est embarqué.

## Publication

```sh
./deploy.sh
```

Le script exige sources, assets et build commités, envoie l’HTML sur le VPS `amiga`, vérifie son SHA-256 puis bascule atomiquement `/home/ddd/apps/rade/current`. Le vhost Caddy existant n’est réappliqué que s’il change. Les anciennes releases sont conservées pour retour arrière.

Données : **© les contributeurs OpenStreetMap**, [ODbL](https://www.openstreetmap.org/copyright), OpenFreeMap / OpenMapTiles. Modèles, licences et références : [VEHICULES.md](docs/VEHICULES.md), [ASSETS.md](docs/ASSETS.md). Projet indépendant, sans affiliation aux marques représentées.
