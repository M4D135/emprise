# RADE

Un premier monde ouvert jouable autour du Vieux-Port : FPS de **METAL**, conduite libre issue de **BITUME**, Marseille et foule GPU de **Point de rupture**, dans un seul renderer **FERRO**. Une mission courte, 480 piétons et cinq véhicules utilisables : **205 GTI, R5 GT Turbo, TMAX, trottinette électrique et vélo**. Modèles procéduraux stylisés, couleurs libres et habitacles des deux voitures.

**Jouer : [gta.estrasse.fr](https://gta.estrasse.fr)** · [Sources](https://github.com/M4D135/rade) (dépôt privé).

## Hors ligne et développement

```sh
python3 build.py
open dist/index.html                   # macOS ; sinon ouvrir ce fichier dans Chrome
node tests/acceptance.mjs              # physique, mission, collisions et transitions
python3 tests/browser.py               # parcours WebGL2 réel, environ 70 secondes
```

Python 3 standard et Node suffisent. Aucun npm, téléchargement, CDN, serveur local, texture ou fichier audio externe. Le build HTML autonome pèse environ **1,27 Mo**. `SIZE.json` contient son empreinte. `tests/browser.py --chrome /chemin/vers/chrome` accepte un autre exécutable Chromium.

## Commandes

| Action | Commande |
|---|---|
| Marcher / conduire | ZQSD sur AZERTY, WASD sur QWERTY |
| Courir / dérapage en voiture | Maj |
| Monter dans le véhicule le plus proche / sortir à l’arrêt | E |
| Démarrer / couper le moteur | Automatique à la montée ; F pour couper / rallumer |
| Freiner puis reculer | S maintenu |
| Frein / esquive à pied | Espace |
| Cockpit ou poursuite | C |
| Regarder, viser, tirer | Souris, clic gauche ; glisser si capture refusée |
| Armes / coup de crosse / onde | 1 et 2 / V / R |
| Couleur du véhicule | H, ou sélecteur de couleur dans la pause |
| Pause / reprise | P ou Échap ; bouton Reprendre |

Au départ, les véhicules sont alignés sur le quai. La mission indique le quai du Port. Après le combat contre trois sentinelles fictives, remonter et repartir termine la mission ; l’exploration continue. Aucun chargement entre marche et conduite. La session conserve véhicules, foule et combat jusqu’au rechargement de la page.

## Intégration et origine

| Source | Commit utilisé |
|---|---|
| METAL | `731ace7016b0a787afd3b390c5882bf0527f6a29` |
| BITUME | `e9a5e7f96503a1fe65c79227a0624fb44a318f38` |
| Point de rupture | `1e8b6351a8c9f52c66858c731648ae0606045334` |

Socle renderer PDR pour ses passes de foule, complété par les formes libres et indices 32 bits de BITUME. Le contrôleur, les armes, les ennemis et les effets viennent de METAL. La dynamique automobile conserve les courbes de pneus, le transfert de charge, les freins et la boîte de BITUME ; son intégration de circuit est remplacée par des positions libres et des collisions urbaines. Les réglages sont adaptés à des compactes à traction. Les deux-roues utilisent un modèle plus simple.

[Détails techniques](docs/INTEGRATION.md) · [Références et modèles](docs/VEHICULES.md) · [Vérification et performances](docs/VERIFICATION.md). Les trois dépôts sources sont restés intacts. `ORIGINS.json` donne les empreintes de départ, avant adaptation des copies.

## Périmètre de cette version

Secteur continu de 660 × 660 m issu des données embarquées, sol plat, bâtiments extérieurs et contacts simplifiés. Plus de 10 000 pièces de détail ajoutées ; 143 arbres retirés des chaussées. Les véhicules sont stationnés au départ : pas encore de trafic automobile autonome, de police, d’intérieurs de bâtiments ou de sauvegarde entre sessions. Les modèles sont des interprétations procédurales, pas des scans ni une simulation mécanique exacte. Les piétons s’écartent et fuient les tirs ; ils n’ont pas de ragdoll.

WebGL2 et navigateur de bureau requis pour la version vérifiée. Les commandes tactiles sont expérimentales. Le parcours testé ne certifie pas chaque ruelle ou chaque configuration mobile. Aucun élément de GTA n’est embarqué ; l’inspiration porte sur la liberté de déplacement et l’alternance à pied / véhicule.

## Publication

```sh
./deploy.sh
```

Le script exige sources et build commités, envoie l’HTML par SSH vers le VPS `amiga`, vérifie son SHA-256, bascule le lien `current`, puis applique le vhost Caddy existant pour `gta.estrasse.fr`. Publication manuelle, aucun service de jeu supplémentaire. Pour revenir à un commit précédemment déposé : remplacer le lien `/home/ddd/apps/rade/current` par `releases/<commit>` avec une bascule atomique identique au script. Les anciennes versions sont conservées.

Données géographiques : **© les contributeurs OpenStreetMap**, [ODbL](https://www.openstreetmap.org/copyright), tuiles OpenFreeMap / schéma OpenMapTiles. Attribution visible dans le jeu. Les marques des véhicules servent à identifier les références ; projet indépendant sans affiliation aux constructeurs.
