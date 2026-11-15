# Police d’EMPRISE

Les patrouilles utilisent les véhicules et les collisions BITUME. Douze civils et trois équipages sont créés une fois au lancement ; aucune patrouille n’est téléportée, même si elle reste bloquée. Les rues du cœur historique sont construites avant le tirage initial, puis le graphe est étendu jusqu’aux limites de la ville moins 20 m.

## Perception et recherche

- Un capteur, au plus5Hz par équipage, exige une ligne dégagée et une distance de72m. Un équipage neutralisé ne voit plus le joueur.
- Une infraction transmet un signalement explicite numéroté. La radio conserve la position et l’heure du dernier signalement ou de la dernière observation réelle ; la retransmission ne rajeunit pas ce souvenir.
- Perte de vue : les véhicules rejoignent le dernier point connu, puis examinent les rues connectées autour de ce point. Les coordonnées actuelles du joueur caché ne servent ni à la recherche ni à l’interception.
- La confiance décroît avec l’âge du renseignement. La recherche dure22/27/32s selon le niveau1/2/3+, puis les équipages reprennent leur patrouille. Une nouvelle observation ou infraction relance l’intervention. Le niveau de recherche continue à décroître selon les règles de campagne existantes.
- Une à trois étoiles mobilisent respectivement un, deux ou trois équipages. Départ radio après6/5/4s ; un poursuivant principal et des intercepteurs reçoivent des objectifs routiers distincts. L’anticipation utilise uniquement une vitesse réellement observée, plafonnée.

## Conduite et arrestation

La vitesse visée est10/11,5/13m/s en poursuite. Les virages, obstacles, véhicules et piétons la réduisent. L’approche du joueur anticipe la distance de freinage et vise un arrêt à5,2m. Le recul dure au plus une seconde, vérifie l’espace arrière pendant la manœuvre et comporte un délai croissant après échec. Attendre volontairement un véhicule ou une interpellation ne déclenche pas ce secours.

Depuis EMPRISE 0.5, la session exige un policier réellement descendu pour interpeller. `traffic.arrestStatus` reste disponible pour les contrôles du module routier ; il ne suffit plus à déclencher l’arrestation en jeu. `police.arrestStatus(player,{seated,vehicle,speed,hidden})` contrôle le policier visible, sa santé, ses jambes, sa distance et la ligne dégagée au moment du contrôle. À pied, il doit être à moins de 1,9 m. En voiture arrêtée sous 1,8 m/s, il doit être à moins de 0,85 m d’une vraie position de portière libre ; le véhicule du joueur reste pris en compte dans les collisions d’approche. Le compteur de quatre secondes appartient à `session.js`.

`campaign.arrest()` conserve l’amende, expose `law.lastArrest={fine,time}` et protège la réapparition pendant dix secondes. Une nouvelle infraction reste possible pendant cette protection. La destination au commissariat est gérée par `interiors.respawnPolice()` ; aucune adresse n’est inventée dans le module police.

## Policiers à pied — version 0.5

`R.police.create(world,sim,{traffic,campaign,saved,notify})` réutilise le conducteur existant de chaque patrouille, après initialisation des blessures. Les identités `14000 + car.id` restent les mêmes à bord, au sol et après sauvegarde. Il n’ajoute aucun personnage : trois policiers au maximum, dont un/deux/trois engagés à pied selon les étoiles. Les policiers de barrage restent distincts.

Un véhicule en intervention doit rouler sous 0,8 m/s. Le conducteur descend seulement près d’un joueur réellement visible ou d’un point récemment signalé. Les deux côtés et plusieurs positions de porte sont testés contre les collisions ; si aucune sortie n’est libre, il reste assis. La sortie place le même conducteur au bord immédiat du véhicule, avec une pause de 0,55 s avant la poursuite. La patrouille coupe son moteur, s’arrête et cesse sa conduite automatique. Un véhicule du joueur encore rapide ne provoque pas cette sortie.

Le capteur à environ 5 Hz voit jusqu’à 38 m avec un rayon effectivement dégagé. L’agent rejoint le dernier point observé, puis fouille à proximité de ce point. Le joueur caché ne fournit aucune nouvelle coordonnée. Après 14 à 18 secondes sans renseignement frais, l’agent rejoint sa voiture. Les observations sont transmises à la radio au plus une fois par seconde sans ajouter d’infraction. La poursuite à pied reste limitée à 60 m du véhicule ; aucun agent n’est téléporté pour rattraper le joueur. Les intérieurs, la nage et les bateaux désactivent l’interpellation.

La vitesse normale est 2,65 m/s ; les blessures la réduisent. Une jambe neutralisée donne un déplacement rampant, des yeux bas et interdit l’interpellation. Un policier mort reste rendu comme corps et ne voit, ne poursuit ni n’arrête personne. Les impacts et explosions utilisent les mêmes volumes anatomiques et le même module `injuries` que les autres personnes. Il n’y a pas de tir automatique des policiers.

Le retour suit les collisions jusqu’à une porte. Réembarquer rend la conduite au trafic et impose cinq secondes avant une nouvelle sortie. Une voiture occupée par le joueur, volée (`policeStolen`), détruite ou trop éloignée n’est pas récupérée. L’agent peut rester sur place si le retour est impossible : aucun remplacement ni respawn silencieux n’est effectué. Les véhicules du trafic prennent les agents au sol en compte dans leurs évitements.

L’API expose `update(dt,{seated,vehicle,speed,hidden})`, `arrestStatus`, `save`, `geometry(time,camera)`, `actors`, `units`, `seen` et `metrics`. `world.policeOfficers` référence les mêmes conducteurs. Le rendu utilise les corps procéduraux `people` avec une tenue de police ; `injuries` conserve leurs impacts mais ne leur applique pas la fuite des civils et ne les rend pas une deuxième fois. Le module blessures reste propriétaire du délai de chute `thrown`.

La sauvegarde version 1 valide identité du véhicule, coordonnées, santé, état, blessures, délais, mémoire et route. Les valeurs invalides sont rejetées ou bornées. La santé restaurée ne peut pas ressusciter un conducteur déjà mort dans les données de blessures. Le statut volé est conservé. La perception est revérifiée après reprise avant d’autoriser une interpellation.

## Coût et vérification

La navigation routière A* ne développe jamais plus de 320 nœuds par demande. Une voiture ne recalcule pas plus d’une fois par seconde ; les premières demandes sont décalées. La sélection des rues de recherche est elle aussi bornée. `traffic.metrics` expose demandes, expansions maximales et récupérations. Le graphe ne dépend pas du rendu.

Exécuter `node tests/police.mjs`. Le reçu `police-acceptance.json` vérifie notamment : occultation réelle par un mur, mémoire figée, réacquisition, expiration, partage radio, interventions graduées, objectifs distincts,320 expansions exactement sur un composant de1685 nœuds, frein libéré, recul sûr, conservation des spawns après extension et sauvegarde au-delà de l’ancienne limite320m. Le parcours intégré tire une vraie balle et attend l’interpellation via la session : 13,82 s, distance minimale des véhicules 4,80 m, déplacement maximal des véhicules 0,23 m par échantillon lors de la dernière validation.

Les tests de composants utilisent des routes synthétiques ; le test intégré utilise la vraie ville. Ils ne certifient pas chaque ruelle ni toutes les intersections encombrées. Les policiers n’ont pas de tir ni d’aimbot ; la poursuite à pied est validée séparément ci-dessous.

La navigation à pied utilise une grille locale de 0,9 m, limitée à 384 expansions par recherche. Une seule recherche peut commencer par `update`, au plus une toutes les 0,18 s globalement et environ une par seconde par agent. Les échecs imposent un délai allant jusqu’à trois secondes. Les segments contrôlent les collisions tous les 0,25 m, avec 144 échantillons maximum. Les obstacles mobiles restent contrôlés à chaque déplacement ; les voisins humains sont indexés cinq fois par seconde. Aucun A* global sur la ville n’est ajouté.

`node tests/police-foot.mjs` vérifie dix groupes de cas : sortie/retour du même conducteur, contournement d’un mur, perte de vue et expiration de mémoire, portes bloquées, blessures/décès, restauration et voiture volée, budgets sous trois agents, interpellation à une vraie portière, déterminisme des mêmes commandes et sortie dans la vraie ville avec impacts via `injuries`. `node tests/police.mjs` passe également sans assouplir ses assertions. Le parcours intégré part d’une nouvelle partie, tire une balle, puis ne reçoit plus de commande : sortie à 8,13 s, poursuite à 8,69 s et interpellation au commissariat à 13,82 s lors de la validation.

La recherche est locale et bornée : elle peut échouer face à une longue déviation ou à un passage encombré. Les tests ne certifient pas chaque ruelle. Le comportement choisit alors une nouvelle tentative ou un retour, sans franchir les murs ni déplacer arbitrairement un agent.

## Sources d’IA étudiées le15novembre2026

Implémentation JavaScript indépendante, adaptée aux rues OSM et à la physique existante ; aucun code C des projets suivants n’est incorporé.

| Source primaire | Idée retenue et adaptation |
| --- | --- |
| [Quake III : ai_main.c](https://github.com/id-Software/Quake-III-Arena/blob/master/code/game/ai_main.c) | Cadence de réflexion distincte du déplacement et décalage des agents : capteurs et routes sont cadencés séparément. |
| [Quake III : ai_dmq3.c](https://github.com/id-Software/Quake-III-Arena/blob/master/code/game/ai_dmq3.c) | But de poursuite fondé sur `lastenemyorigin` : point effectivement observé et daté, conservé après perte de vue. |
| [Quake III : be_aas_route.c](https://github.com/id-Software/Quake-III-Arena/blob/master/code/botlib/be_aas_route.c) | Coûts de déplacement et amortissement du calcul : A* à budget explicite. Le garde-fou `MAX_FRAMEROUTINGUPDATES` est commenté dans cette source ; EMPRISE impose sa propre borne effective. |
| [Quake III : be_ai_goal.c](https://github.com/id-Software/Quake-III-Arena/blob/master/code/botlib/be_ai_goal.c) | Buts temporaires et délais d’évitement : recherche locale expirante et délai après récupération infructueuse. |
| [DOOM : p_enemy.c](https://github.com/id-Software/DOOM/blob/master/linuxdoom-1.10/p_enemy.c) | Contrôle de visibilité et changement de direction après échec du mouvement : perception vérifiée, recul limité et nouvelle route. |
| [ioquake3](https://github.com/ioquake/ioq3) | Référence maintenue pour l’architecture du moteur ; aucun moteur ni asset ajouté au jeu. |

Les fichiers Quake III cités indiquent GPL-2.0-or-later. Les [licences DOOM](https://github.com/id-Software/DOOM/blob/master/LICENSE.TXT) et [ioquake3](https://github.com/ioquake/ioq3/blob/main/COPYING.txt) fournies sont GPLv2 ; DOOM conserve aussi des notices historiques plus anciennes dans certains fichiers. Aucune licence de ces dépôts n’est présentée comme autorisant une incorporation silencieuse dans le code MIT du projet.
