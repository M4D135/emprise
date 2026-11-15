# Police d’EMPRISE

Les patrouilles utilisent les véhicules et les collisions BITUME. Douze civils et trois équipages sont créés une fois au lancement ; aucune patrouille n’est téléportée, même si elle reste bloquée. Les rues du cœur historique sont construites avant le tirage initial, puis le graphe est étendu jusqu’aux limites de la ville moins20m.

## Perception et recherche

- Un capteur, au plus5Hz par équipage, exige une ligne dégagée et une distance de72m. Un équipage neutralisé ne voit plus le joueur.
- Une infraction transmet un signalement explicite numéroté. La radio conserve la position et l’heure du dernier signalement ou de la dernière observation réelle ; la retransmission ne rajeunit pas ce souvenir.
- Perte de vue : les véhicules rejoignent le dernier point connu, puis examinent les rues connectées autour de ce point. Les coordonnées actuelles du joueur caché ne servent ni à la recherche ni à l’interception.
- La confiance décroît avec l’âge du renseignement. La recherche dure22/27/32s selon le niveau1/2/3+, puis les équipages reprennent leur patrouille. Une nouvelle observation ou infraction relance l’intervention. Le niveau de recherche continue à décroître selon les règles de campagne existantes.
- Une à trois étoiles mobilisent respectivement un, deux ou trois équipages. Départ radio après6/5/4s ; un poursuivant principal et des intercepteurs reçoivent des objectifs routiers distincts. L’anticipation utilise uniquement une vitesse réellement observée, plafonnée.

## Conduite et arrestation

La vitesse visée est10/11,5/13m/s en poursuite. Les virages, obstacles, véhicules et piétons la réduisent. L’approche du joueur anticipe la distance de freinage et vise un arrêt à5,2m. Le recul dure au plus une seconde, vérifie l’espace arrière pendant la manœuvre et comporte un délai croissant après échec. Attendre volontairement un véhicule ou une interpellation ne déclenche pas ce secours.

`traffic.arrestStatus(player,{seated,vehicle,speed})` vérifie recherche active, équipage en poursuite, visibilité effective, distance inférieure à6m, policier sous3m/s et véhicule du joueur sous1,8m/s. Le compteur de4s appartient à `session.js`. `campaign.arrest()` conserve l’amende, expose `law.lastArrest={fine,time}` et protège la réapparition pendant10s. Une nouvelle infraction reste possible pendant cette protection. La destination au commissariat est gérée par `interiors.respawnPolice()` ; aucune adresse n’est inventée dans le module police.

## Coût et vérification

A* ne développe jamais plus de320 nœuds par demande. Une voiture ne recalcule pas plus d’une fois par seconde ; les premières demandes sont décalées. La sélection des rues de recherche est elle aussi bornée. `traffic.metrics` expose demandes, expansions maximales et récupérations. Le graphe ne dépend pas du rendu.

Exécuter `node tests/police.mjs`. Le reçu `police-acceptance.json` vérifie notamment : occultation réelle par un mur, mémoire figée, réacquisition, expiration, partage radio, interventions graduées, objectifs distincts,320 expansions exactement sur un composant de1685 nœuds, frein libéré, recul sûr, conservation des spawns après extension et sauvegarde au-delà de l’ancienne limite320m. Le parcours intégré tire une vraie balle et attend l’interpellation via la session : environ11,67s, distance minimale4,77m, déplacement maximal0,23m par échantillon lors de la dernière validation.

Les tests de composants utilisent des routes synthétiques ; le test intégré utilise la vraie ville. Ils ne certifient pas chaque ruelle ni toutes les intersections encombrées. Les policiers restent des équipages motorisés : pas de tir, pas d’aimbot, pas de poursuite à pied inventée.

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
