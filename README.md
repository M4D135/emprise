# EMPRISE — 0.6.1 « Ville active »

Sandbox FPS solo persistant dans Marseille et ses eaux côtières, avec conduite et combat dans un seul renderer **FERRO**. Jouer : **[gta.estrasse.fr](https://gta.estrasse.fr)** · [Dépôt GitHub privé](https://github.com/M4D135/emprise).

La version 0.6.1 réduit le travail CPU des collisions, du décor détruit et des lots de rendu, à population et qualité graphique constantes. [Mesures en extérieur chargé](docs/OUTDOOR-PERFORMANCE.md).

**Nouvelle partie** est accessible au titre, dans la pause et après une interruption, avec confirmation. Les réglages de manette sont conservés. La reprise d’une sauvegarde en nage ou en bateau ne cherche plus un emplacement terrestre ; une ancienne position terrestre impraticable utilise un point libre vérifié en conservant la progression.

Le rendu utilise maintenant **WebGPU natif avec secours WebGL2**. Le filtre des ombres solaires est continu, la correction de profondeur de la foule tient compte de la taille réelle de sa tuile, et la garniture arrière de la 205 suit son montant. [Mesures et validation](docs/WEBGPU.md) · [Correctifs visuels avant/après](docs/SHADOWS.md).

Cette version réunit le trafic civil et policier, les vols de véhicules, les gangs, les commerces et territoires à conquérir, les revenus passifs et les contre-attaques. Les conducteurs sont visibles et peuvent être extraits d’un véhicule arrêté. Les blessures distinguent tête, bras et jambes ; une blessure à la jambe impose une posture au sol et une mobilité très réduite.

Les véhicules se dégradent au fil des impacts : moteur, pneus et direction affectent la conduite. Les chocs et les tirs provoquent déformations, fumée, puis un feu progressif. Une voiture brûle au moins 8,5 secondes avant une grosse explosion : capot, toit, portes, roues et fragments sont projetés ; une carcasse calcinée persistante remplace le véhicule. Les véhicules voisins peuvent prendre feu à leur tour. Les roquettes ouvrent des brèches dans le décor ; des débris physiques ont une masse selon leur matériau. Les feux se propagent et les marins-pompiers peuvent intervenir.

Les conducteurs peuvent être blessés ou tués dans leur véhicule. Après un vol, le propriétaire peut vous agresser ou reprendre sa voiture à la portière ; la peur peut le faire fuir. Certains PNJ ont un tempérament provocateur sans peur et peuvent lancer une agression spontanée. Les comportements restent indépendants de leur apparence. Voir [hostilité et peur](docs/HOSTILITE.md).

## Nouveautés 0.5

Les patrouilles peuvent maintenant s'arrêter, faire descendre leur conducteur et poursuivre à pied. Chaque policier garde une mémoire limitée, contourne les obstacles et doit approcher réellement pour interpeller. Les blessés et morts ne peuvent pas arrêter le joueur ; les agents ne récupèrent pas un véhicule volé. Une quatrième démonstration enregistrée montre une interpellation de nuit depuis le départ normal, puis le retour au commissariat (heure initiale préparée à 23 h).

La protection des commerces peut provoquer une représaille après plusieurs minutes : avertissement, assaillants visibles dans la rue, défense ou perte du contrôle. Les revenus ne sont suspendus que si l'entrée est occupée. Un même commerce bénéficie d'un long répit ; le monde ne lance qu'une représaille de ce type à la fois. Le carnet **J** expose la menace sans ajouter de minimap.

Les armes consomment désormais leurs munitions. La réserve et l'arme choisie sont sauvegardées ; le stock apparaît sous les PV. Les sacs ennemis peuvent contenir des cartouches ; le surplus reste récupérable. Les commerces protégés proposent au comptoir un **réapprovisionnement du réseau** : 24 cartouches de mitraillette, 6 de pompe ou 2 roquettes pour 35 €. Ces échanges sont des mécaniques fictives du jeu, pas des services attribués aux établissements réels.

TMAX, vélo et trottinette reçoivent carénages, cadres, pneus, jantes, fourches, commandes et poses de conduite retravaillés. Trois niveaux de détail gardent leurs silhouettes à distance. La préparation des buffers GPU évite un tableau temporaire par instance, avec équivalence exacte des données vérifiée.

Les patrouilles motorisées utilisent une **moto routière RT** distincte du TMAX : réservoir, moteur boxer, grandes roues, valises, radio et gyrophares fixés au véhicule. Le pilote est assis sur la selle, les mains suivent le guidon et les semelles reposent sur les repose-pieds. Aucun conducteur fantôme après la descente.

Les cycles de marche suivent la distance réellement parcourue, avec transitions amorties marche/course/arrêt. Les compactes gardent les pneus et transferts de charge de BITUME, avec une direction moins instantanée, une réponse turbo propre à la R5 et un frein à main arrière qui ne donne plus de bonus de vitesse.

Les gros effondrements sont fragmentés avant application du budget de débris : morceaux structurels de 1,4 m maximum, poussière pour le volume excédentaire, migration des anciennes plaques sauvegardées. La collision du joueur suit l'orientation réelle des morceaux. Un chevauchement causé par une chute déclenche un dégagement progressif qui respecte les murs et les nouveaux obstacles. [Destruction et limites](docs/DESTRUCTION.md).

Un téléphone reçoit des propositions par SMS : livraison, véhicule demandé ou reprise de protection. Accepter ne paie rien : la mission vérifie les actions, l'adresse, le véhicule ou le commerce concerné avant de verser sa récompense. Les conversations et contrats sont sauvegardés. Le téléphone reste consultable sans suspendre le monde.

La molette passe progressivement de la vue FPS à une caméra derrière le personnage, avec rétraction devant les obstacles. Les habitacles des compactes montrent les mains au volant et la main droite sur le pommeau lors du changement réel de rapport. Sur le voilier, le gouvernail et les deux manivelles règlent séparément le cap, l'orientation et la surface de voile ; le moteur auxiliaire reste silencieux tant qu'il est coupé.

Le défaut de bandes mobiles dans les ombres est corrigé, ainsi que le conflit de profondeur entre la mer lointaine et la terre. Les routes échantillonnent les deux axes des pentes. Le plan de coupe du monde s’adapte maintenant à la proximité des surfaces, avec une projection séparée pour l’arme : la vue vérifiée de la colline ne présente plus les trous triangulaires de chaussée.

Un jour dure vingt minutes : ciel, soleil, lune, éclairages publics, fenêtres et Bonne-Mère suivent l'heure sauvegardée. La basilique et sa colline sont une interprétation procédurale étudiée sur les photographies et données référencées dans [LANDMARKS.md](docs/LANDMARKS.md).

## Jouer hors ligne

```sh
python3 build.py
open dist/index.html
```

Python 3 standard pour construire ; Node et Chrome pour les tests. Le HTML autonome pèse environ **22,6 Mo**, données géographiques et générateurs procéduraux compris, sans CDN ni requête réseau à l’exécution. `SIZE.json` donne son empreinte. Le moteur utilise **WebGPU natif**, avec **WebGL2 en secours automatique** si WebGPU est absent, échoue ou perd son périphérique en partie. Le moteur réellement actif apparaît à l'écran titre. `?renderer=webgl2` permet de forcer le secours ; `?renderer=webgpu` demande WebGPU tout en conservant le repli en cas d'échec. [Architecture, tests et comparaison avant/après](docs/WEBGPU.md).

La version et l’identifiant du build apparaissent à l’écran titre. Après **5 secondes sans interaction**, des sessions de test enregistrées sont rejouées. Une touche ou un clic ramène au titre ; cette démonstration ne modifie pas la progression.

## Commandes

| Action | Commande |
|---|---|
| Marcher / conduire | ZQSD ou WASD |
| Courir / frein à main | Maj |
| Interagir, entrer, sortir, extraire un conducteur arrêté | E |
| Contact moteur | Automatique à la montée ; F pour couper / rallumer |
| Freiner puis reculer | S maintenu |
| Frein à main / esquive à pied | Espace |
| Vue FPS / troisième personne à pied, cockpit / poursuite en voiture | C ; molette pour rapprocher / éloigner à pied |
| Téléphone et missions SMS | O ; croix haut à la manette |
| Voilier : gouvernail / orientation / déploiement de voile | C ou Y ; A/D pour orienter, W/S pour déployer au poste choisi |
| Regarder / tirer | Souris / clic gauche ; glisser si capture refusée |
| Mitraillette / fusil / roquette | 1 / 2 / 3 |
| Crosse / onde | V / R |
| Saisir un petit objet / le lancer | G / B |
| Allumer un feu à portée / réparer au garage | I / T |
| Couleur du véhicule | H ; sélecteur RGB dans la pause |
| Lire le plan acheté | M |
| Carnet du réseau, inventaire et soins | J ; LB/L1 → Actions à la manette |
| Pause / reprise | P ou Échap |

**Aucune minimap à l’ATH.** Les quatre panneaux publics permettent de consulter le plan ; un exemplaire portable coûte 60 € dans un commerce. Le monde continue pendant sa consultation. L’objectif apparaît pendant une prise ou une défense, sans trajet GPS permanent.

Les douze sites de campagne initiaux ont chacun leurs défenseurs et leur gang, auxquels s’ajoutent les contrats des commerces réels. Les prendre puis les conserver génère un revenu ; les adversaires peuvent les reprendre. La sauvegarde locale conserve argent, contrôle, véhicules acquis, blessures, destruction, incendies, inventaire, protections, butin et intérieur visité. Les revenus hors ligne des sites de campagne initiaux sont plafonnés à huit heures ; les nouveaux contrats produisent pendant la simulation, y compris hors du bâtiment. Le bouton de nouvelle partie efface cette sauvegarde après confirmation. Les sauvegardes de l’URL publique et du fichier local sont distinctes.

## Monde et modèles

- Contour communal de Marseille (237,8 km²), rues et empreintes issues de données OpenStreetMap, complété par le littoral, If, le Frioul, Maïre et Riou. Les quartiers extérieurs sont chargés par cellules de 512 m. Le Vieux-Port conserve son cœur détaillé de 1,1 km de côté. Les hauteurs IGN complètent les correspondances fiables ; le relief reste synthétique, sans modèle numérique de terrain mesuré. [Géographie et limites](docs/WORLD.md). Barrages, clôtures, CRS et obstacles flottants matérialisent les limites ; fenêtres écartées des angles et arcades du quai du Port. Le décor reste en lots GPU, filtrés selon la vue et la distance ; les ombres utilisent leur propre sélection.
- Dans le cœur détaillé, catalogue de bâtiments et entrées élargi, établissements OSM et adresses BAN reliés aux empreintes réelles. Commerces, restaurants, kebabs, supermarchés, hôtels, garages, logements et lieux publics ont des aménagements distincts et des occupants. Un hall permet de choisir entre plusieurs commerces d’un immeuble. Les intérieurs sont des compositions de jeu, chargées séparément ; les adresses sont sourcées, les plans des pièces ne sont pas relevés sur place. Ce catalogue thématique ne couvre pas toute la commune.
- 205 GTI, R5 GT Turbo, TMAX, moto de police RT, trottinette et vélo : couleurs libres, habitacles et tableaux de bord des autos, silhouettes procédurales. Fourgon de secours supplémentaire.
- Personnages entièrement procéduraux : anatomie, mains, visage et vêtements générés, épaules et articulations pondérées, chaussures proportionnées, voiles, casquettes et sacoches. Variantes de carnation et tenue indépendantes de la faction et du comportement. Le rendu reste stylisé.
- Matériaux et sons générés par le code, sans photo, texture ni modèle importés. Ombres dynamiques, reflets d’environnement et réflexions à l’écran, météo avec vent, pluie, orages et éclairs. Pas de ray tracing matériel.
- Nage de surface, échelles de quai, canot à moteur, voilier dépendant du vent et jet-ski ; positions et reprise sauvegardées.
- Police : perception vérifiée, dernier point connu, recherche limitée dans le temps, intercepteurs et agents à pied. Se cacher hors de vue, notamment dans un intérieur, permet à la recherche de décroître. Interpellation après proximité prolongée d’un agent descendu ; réapparition au poste municipal réel du 42 La Canebière.

Dans les commerces, acheter remplit le sac, voler ou racketter rapporte de l’argent et alerte la police. Proposer une protection déclenche une mission contre le responsable de la faction rivale ; il faut revenir confirmer auprès du commerçant pour démarrer les revenus passifs. Les chambres d’hôtel contiennent argent et objets à fouiller, avec persistance pour éviter un nouveau butin à chaque entrée. Tous les rapports de gangs et missions sont de la fiction.

**Manette standard Xbox/PlayStation :** stick gauche déplacement/braquage, droit visée, RT tir/accélération, LT visée/frein-recul, X/carré interaction, A/croix course/frein à main, B/rond frein à main/esquive, Y/triangle arme/vue, LB/L1 menu d’actions, Start/Options pause. Réglages de sensibilité, zone morte, inversion et vibrations. Le débranchement met la partie en pause ; les commandes doivent être relâchées avant reprise. Navigation des menus incluse. Validation sur Gamepad API virtuelle, pas sur une manette physique.


## Intégration et origine

| Source | Commit utilisé |
|---|---|
| METAL | `731ace7016b0a787afd3b390c5882bf0527f6a29` |
| BITUME | `e9a5e7f96503a1fe65c79227a0624fb44a318f38` |
| Point de rupture | `1e8b6351a8c9f52c66858c731648ae0606045334` |

Socle renderer PDR pour ses passes de foule, complété par les formes libres et indices 32 bits de BITUME. Le contrôleur, les armes, les ennemis et les effets viennent de METAL. La dynamique automobile conserve les courbes de pneus, le transfert de charge, les freins et la boîte de BITUME ; son intégration de circuit est remplacée par des positions libres et des collisions urbaines. Les réglages sont adaptés à des compactes à traction. Les deux-roues utilisent un modèle plus simple.

[Police à pied](docs/POLICE.md) · [Combat et tactiques](docs/COMBAT.md) · [Commerces et butin](docs/BUSINESS.md) · [Navigation](docs/MARINE.md) · [Lieux réels](docs/PLACES.md) · [Détails techniques](docs/INTEGRATION.md) · [Références et modèles](docs/VEHICULES.md) · [Vérification et performances](docs/VERIFICATION.md). Les copies de travail de EMPRISE sont indépendantes des trois dépôts sources. `ORIGINS.json` donne les empreintes de départ, avant adaptation des copies.

## Validation et limites

Les tests couvrent les vrais événements clavier/souris, les sessions de combat et conduite, la capture/reprise d’un commerce, la sauvegarde, le trafic et la police, les accès intérieurs, la météo, les blessures, la destruction, les pompiers et les explosions. Les rapports et leurs conditions sont détaillés dans [VERIFICATION.md](docs/VERIFICATION.md).

C’est une version solo ; le multijoueur reste à développer. Le terrain, l’eau et les limites ancrées du secteur ne sont pas destructibles. La destruction des embarcations n’est pas encore intégrée. La physique utilise des volumes simplifiés, un budget global de 240 débris et un plafond configuré de 96 corps éveillés par solveur local, sans calcul de structure d’ingénierie ni ragdoll intégral. La foule n’est pas un obstacle rigide. Les animations d’extraction, de chute et de rampement sont simplifiées. Le fourgon et les silhouettes éloignées restent simplifiés. Les brèches du cœur de ville révèlent la pièce et permettent de franchir son seuil lorsque le passage physique est libre. Les quartiers étendus ont des pièces génériques au rez-de-chaussée derrière une façade percée ; le catalogue de vrais commerces et les étages détaillés ne couvrent pas encore toute la commune. Un feu intérieur hors de la scène chargée ne simule pas toute sa destruction structurelle.

La sauvegarde dépend du navigateur. Les tests n’attestent pas chaque ruelle, chaque accès depuis tous les itinéraires, ni toutes les machines et commandes tactiles. Aucun asset de GTA n’est embarqué.

## Publication

```sh
./deploy.sh
```

Le script exige sources, assets et build commités, envoie l’HTML sur le VPS `amiga`, vérifie son SHA-256 puis bascule atomiquement `/home/ddd/apps/rade/current`. Le vhost Caddy existant n’est réappliqué que s’il change. Les anciennes releases sont conservées pour retour arrière.

Données : **© les contributeurs OpenStreetMap**, [ODbL](https://www.openstreetmap.org/copyright), OpenFreeMap / OpenMapTiles. Hauteurs : IGN BD TOPO, Licence Ouverte 2.0. Modèles, licences et références : [VEHICULES.md](docs/VEHICULES.md), [ASSETS.md](docs/ASSETS.md). Projet indépendant, sans affiliation aux marques représentées.
