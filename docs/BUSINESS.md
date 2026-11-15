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

Les commerces vendent des bandages ; les restaurants, hôtels et supermarchés des provisions ; les armureries des munitions du jeu. Un bandage rend 35 PV, une provision 20 PV. Aucun soin n’est consommé à pleine santé. Les services existants de repas, plan et armurerie demeurent disponibles par leurs interactions propres.

Voler rapporte le contenu de la caisse, puis impose 180 secondes de temporisation. Le racket impose 300 secondes. Les deux actions provoquent une infraction et transmettent l’entrée réelle du bâtiment à la police, jamais les coordonnées techniques de la pièce intérieure. Les temporisations survivent aux sauvegardes et aux changements de local.

Proposer une protection déclenche une seule mission : un responsable de la faction rivale est déployé physiquement dehors, à au moins 24 m du commerce. Un indice cite la rue OSM la plus proche lorsqu’elle est connue et donne direction et distance depuis le commerce. Le responsable utilise les tirs, dégâts et déplacements METAL ordinaires. Il faut le vaincre, puis retourner au comptoir du commerce concerné pour confirmer la protection. Aucune validation à distance ni simple bouton de victoire.

La protection verse de 24 à 48 €/minute, y compris hors du bâtiment. Elle est conservée au chargement, sans nouvelle récompense. La mort du commerçant ferme durablement le commerce et suspend ces revenus, même après la sortie. Les revenus sont calculés pendant la simulation ; ce module n’ajoute pas de revenu hors ligne.

## Hôtels et occupants

Chaque chambre d’étage possède un identifiant stable par hôtel, étage et chambre. Un bagage contient de l’argent et un objet. Il ne se remplit pas en sortant, en changeant d’étage ou en rechargeant. Les objets de valeur se revendent aux comptoirs ; les soins se consomment partout.

Les résidents utilisent `room.civil`, les personnages et hitboxes existants. Ils sont visibles, blessables, occupent de l’espace et marchent lentement dans des zones libres. Les portes, escaliers, comptoirs et le joueur sont exclus de leurs emplacements. Leur identité, position et état survivent aux visites ; une personne morte ne revient pas intacte au prochain étage. Les pièces utilisent leurs collisions normales pour rester séparées de la rue : se cacher supprime la visibilité policière et permet la baisse habituelle de menace sans nouvelle infraction.

## Vérification

`node tests/business.mjs` produit `docs/business-acceptance.json`. Les fixtures déterministes vérifient achat, argent, soins dehors, refus à distance, anti-répétition, sauvegarde d’une mission active, décès avec des tirs METAL normaux, retour au bon commerçant, revenus après sortie et restauration, loot indépendant par étage, occupants solides et blessures persistantes, cache intérieure et fermeture définitive.

Le combat de référence emploie trois tirs ordinaires ; le test place explicitement le joueur à une position de tir accessible. Il s’agit d’un test de composant, pas d’un enregistrement présenté comme un parcours joué depuis la rue. La validation navigateur et les parcours complets appartiennent aux tests globaux de la session.
