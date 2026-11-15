# Commerces, protection et hôtels

Ce système décrit une œuvre de fiction. Les commerces et adresses sourcés situent le décor ; leurs stocks, leurs occupants, leurs revenus et tout lien avec les factions du jeu sont entièrement inventés. Ils ne décrivent pas l’activité réelle de ces établissements.

## Contrat

Charger `business.js` avant `session.js`. `RADE.business.prepare(world)` réserve huit personnages METAL avant `FSimulation.create` ; l’appel est idempotent. `RADE.business.create(world,sim,{interiors,campaign,saved,notify})` expose :

- `context()` : cible `kind:'business'`, distance, libellé, actions `{id,label,disabled}`, inventaire, revenus et mission. Comptoir à moins de 1,8 m, bagage à moins de 1,6 m. La session compare avec les portes et escaliers.
- `act(id)` : transaction validée au moment de l’action, y compris portée, argent, santé, temporisations et lieu de retour.
- `consume('bandage'|'provision')` : consommation partout, sans comptoir. `act('use_bandage'|'use_provision')` appelle la même opération pour conserver un seul chemin d’enregistrement des commandes.
- `update(dt,events)`, à appeler avant les blessures pour enregistrer les nouveaux résidents ; `geometry()` fournit les bagages ; `save()` conserve progression, inventaire, temporisations, chambres vidées et occupants.

Tous les lieux commerciaux identifiés dans le catalogue sont concernés, y compris les locaux secondaires d’un immeuble. Les commissariats ne sont pas des commerces. Les immeubles sans commerce sourcé restent résidentiels.

## Actions

Les commerces vendent des bandages ; les restaurants, hôtels et supermarchés des provisions. Le catalogue courant ne contient aucune armurerie sourcée. Après un vrai contrat de protection, le comptoir propose un « Réapprovisionnement du réseau » fictif : 24 cartouches de mitraillette, 6 de pompe ou 2 roquettes pour 35 €, selon l’arme équipée. Le commerçant doit être vivant, le joueur à portée et la réserve non pleine ; un refus ne débite rien. Aucune armurerie réelle supplémentaire n’est inventée. La branche générique armurerie, si un lieu de ce type est un jour sourcé, utilise les mêmes quantités. Un bandage rend 35 PV, une provision 20 PV. Aucun soin n’est consommé à pleine santé. Les services existants de repas, plan et armurerie demeurent disponibles par leurs interactions propres.

Voler rapporte le contenu de la caisse, puis impose 180 secondes de temporisation. Le racket impose 300 secondes. Les deux actions provoquent une infraction et transmettent l’entrée réelle du bâtiment à la police, jamais les coordonnées techniques de la pièce intérieure. Les temporisations survivent aux sauvegardes et aux changements de local.

Proposer une protection déclenche une seule mission : un responsable de la faction rivale est déployé physiquement dehors, à au moins 24 m du commerce. Un indice cite la rue OSM la plus proche lorsqu’elle est connue et donne direction et distance depuis le commerce. Le responsable utilise les tirs, dégâts et déplacements METAL ordinaires. Il faut le vaincre, puis retourner au comptoir du commerce concerné pour confirmer la protection. Aucune validation à distance ni simple bouton de victoire.

La protection verse de 24 à 48 €/minute, y compris hors du bâtiment, sauf lorsque le seuil est physiquement occupé par les assaillants d’une représaille. Elle est conservée au chargement, sans nouvelle récompense. La mort du commerçant ferme durablement le commerce et suspend ces revenus, même après la sortie. Les revenus sont calculés pendant la simulation ; ce module n’ajoute pas de revenu hors ligne.

## Hôtels et occupants

Chaque chambre d’étage possède un identifiant stable par hôtel, étage et chambre. Un bagage contient de l’argent et un objet. Il ne se remplit pas en sortant, en changeant d’étage ou en rechargeant. Les objets de valeur se revendent aux comptoirs ; les soins se consomment partout.

Les résidents utilisent `room.civil`, les personnages et hitboxes existants. Ils sont visibles, blessables, occupent de l’espace et marchent lentement dans des zones libres. Les portes, escaliers, comptoirs et le joueur sont exclus de leurs emplacements. Leur identité, position et état survivent aux visites ; une personne morte ne revient pas intacte au prochain étage. Les pièces utilisent leurs collisions normales pour rester séparées de la rue : se cacher supprime la visibilité policière et permet la baisse habituelle de menace sans nouvelle infraction.

## Vérification

`node tests/business.mjs` produit `docs/business-acceptance.json`. Les fixtures déterministes vérifient achat, argent, soins dehors, refus à distance, anti-répétition, sauvegarde d’une mission active, décès avec des tirs METAL normaux, retour au bon commerçant, revenus après sortie et restauration, loot indépendant par étage, occupants solides et blessures persistantes, cache intérieure et fermeture définitive.

Le combat de référence emploie trois tirs ordinaires ; le test place explicitement le joueur à une position de tir accessible. Il s’agit d’un test de composant, pas d’un enregistrement présenté comme un parcours joué depuis la rue. La validation navigateur et les parcours complets appartiennent aux tests globaux de la session.


## Carnet et récupération — 0.4.0

J ouvre le carnet du réseau. Il est aussi accessible par le menu des actions à la manette et depuis la pause. Le carnet liste uniquement les commerces déjà rencontrés et les territoires possédés : statut, revenus, contrat et piste donnée par le commerçant. Il ne révèle pas les positions des adversaires et n’affiche aucune carte permanente. Le monde poursuit sa simulation pendant la lecture. Les bandages et provisions peuvent y être utilisés ; les événements récents sont conservés dans la sauvegarde.

`loot.js` suit la mort des ennemis de combat, sans récompenser celle des civils. Un sac contient 12–40 € et un bandage, une provision ou un objet revendable. Il faut s’approcher à moins de 1,65 m et utiliser E/X ; deux rayons bloquent la fouille à travers une paroi. Les sacs ne tournent pas et ne brillent pas. Une poche pleine conserve l’objet dans le sac après la prise de l’argent. La réserve de sacs est plafonnée à 64, les plus anciens étant retirés à saturation. Chaque nouveau déploiement d’un emplacement d’ennemi peut produire un nouveau sac ; charger une sauvegarde ne produit pas de récompense supplémentaire.

Tests : `tests/loot.mjs`, `tests/immersion.py` (cible et position préparées, puis tir et fouille avec vrais événements clavier/souris). Les butins des chambres d’hôtel restent distincts.

## Représailles du réseau — 0.5.0

Après 8 à 11 minutes de protection simulée, un commerce peut recevoir un avertissement au carnet. Le nom et l'adresse du commerce sont connus ; aucune position cachée d'ennemi n'est révélée. Le joueur dispose de 90 secondes pour intervenir. Deux membres de la réserve METAL existante peuvent ensuite apparaître dans un espace libre à 4–7 m de l'entrée. Une apparition est refusée à moins de 12 m du joueur ou si une partie du personnage serait visible dans la portée de rendu. L'arrivée attend alors une position sûre pendant au plus une minute, puis les représailles sont reportées sans perte.

L'objectif est le seuil extérieur. Au moins un assaillant vivant, dans un rayon de 8 m et sans paroi entre lui et l'entrée, occupe le commerce et suspend ses revenus. Un joueur vivant dehors à moins de 12 m, avec une ligne dégagée sur le seuil, conteste cette occupation. Être dans une pièce intérieure ou derrière un mur ne suffit pas. Soixante secondes d'occupation sans opposition font perdre la protection ; les revenus cessent, mais le contrat ordinaire peut être repris au comptoir. Éliminer les assaillants défend le commerce. Une défense maintenue pendant les 150 secondes de l'assaut, ou leur éloignement du seuil à ce terme, les fait se retirer. La défense conserve la protection sans prime d'argent supplémentaire.

Un seul raid de commerce existe à la fois. Aucun nouveau contrat de protection ne débute pendant celui-ci. Un contrat ou raid territorial déjà en cours et la mort du joueur suspendent ses délais. Le prochain raid automatique territorial est retardé pendant l'attaque du commerce. Il y a ensuite 8 à 11 minutes de répit global et 18 minutes pour le même commerce encore protégé. Les survivants restent des acteurs physiques : leur retrait est enregistré et leur retrait de la simulation attend qu'ils soient hors vue et à distance. Les morts restent disponibles pour le système ordinaire de butin.

L'IA reçoit uniquement l'adresse connue du commerce ou un point de retrait ; elle observe le joueur avec les capteurs METAL ordinaires. Le module ne téléporte aucun ennemi vers un joueur caché. Comme les autres acteurs METAL, les assaillants éloignés peuvent dormir, mais leur présence physique au seuil continue de compter. Il n'y a ni nouveau marqueur permanent ni nouvelle minimap.

`business.raid` expose `{stage,name,address,hint,timer,hold,holdRequired,attackers,paused,occupied,buildingId,placeId}` pour le carnet et le HUD. `journal()` garde ses statuts existants et ajoute `raid` et `lastRaid`; son revenu affiché tient compte de l'occupation. `save()` passe à la version 2 et conserve l'avertissement, l'occupation, la santé et la position des attaquants, les retraits et les délais. Les sauvegardes version 1 restent acceptées avec un répit initial, sans paiement ni apparition à leur chargement.

`tests/business-raids.mjs` emploie une rue de composant déterministe avec les vrais acteurs et tirs METAL. Il vérifie le délai, le refus d'apparition visible, les murs, l'espace intérieur, la mort, la reprise des phases et des retraits, l'occupation/perte, la défense par tirs ordinaires, les temporisations et les trois packs de munitions. `tests/business.mjs` vérifie aussi le réapprovisionnement d'un commerce obtenu par le contrat complet existant. Ces contrôles ne remplacent pas le parcours navigateur du carnet et du HUD.
