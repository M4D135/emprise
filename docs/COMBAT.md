# Combat et tactique des gangs — EMPRISE 0.4

Les adversaires utilisent les collisions de la ville pour voir, tirer et se déplacer. La version précédente contrôlait les extrémités des déplacements, mais ses segments de navigation ignoraient les bâtiments fournis par `world.spatial` : des chemins supposés directs aboutissaient à un mur. Les segments vérifient désormais aussi les collisions spatiales intermédiaires. Un garde peut contourner un obstacle et retrouver une ligne de tir.

## Observation et engagement

La perception existante reste cadencée à 0,15 s, la réflexion à 0,65–0,75 s. Les décisions utilisent le dernier point effectivement observé, ou un renseignement reçu par un allié/tir entendu. La mémoire visuelle expire après huit secondes sans renouvellement ; aucun objectif ne suit les coordonnées actuelles d’un joueur invisible. Les rôles assaut, flanc et appui conservent leurs distances propres. Des objectifs proches déjà réservés par un allié du même gang sont refusés.

Chaque attaque reste annoncée par sa phase de visée. Le canon et la ligne de tir sont contrôlés à nouveau au départ effectif, puis pour chaque balle d’une rafale. Un mur ou un allié qui ferme la ligne interrompt la rafale et provoque une nouvelle décision après récupération. La visée engagée utilise le point observé et une anticipation plafonnée, sans correction continue vers une cible cachée.

Un tir proche et visible exerce une pression sur les membres d’un gang. Un impact déjà résolu ne peut pas être esquivé rétroactivement. La pression décroît naturellement ; plusieurs tirs rapprochés peuvent interrompre une visée. Le garde cherche alors un couvert réellement occultant dans les collisions locales. Les objectifs de couvert déjà occupés sont écartés. Il attend derrière le couvert avant de tenter de retrouver une ligne de tir. La même priorité de couvert s’applique en cas de bras blessé ou de santé basse.

## Blessures et sauvegarde

Une jambe neutralisée abaisse les yeux et le départ du tir, annule charge et esquive, et conserve le déplacement rampant existant. Une faible progression liée à cette blessure n’est plus comptée comme un blocage. Le bras blessé conserve sa visée plus lente. Les identifiants, PV, états `deployed`, réserves, munitions et récompenses ne changent pas de sens.

Le checkpoint de simulation passe à `aiVersion: 4` : pression et blessures sont conservées, avec validation des données. Les versions précédentes restent acceptées. Ce checkpoint METAL ne remplace pas la sauvegarde de campagne, dont les blessures restent gérées par le module dédié.

## Bornes et mesures

- Au plus deux recherches A* par tick, chacune limitée à 768 nœuds développés, soit 1 536 au total. L’ancienne borne était de 2 400 par recherche. Une recherche inachevée retourne un échec ; elle ne téléporte pas l’acteur.
- Les segments spatiaux sont échantillonnés tous les 0,32 m au plus, avec 192 échantillons maximum. Un segment plus long doit passer par une route locale.
- Le couvert utilise `world.spatial.coverBoxes(x,z,10)` (itérable, y compris `Set`) ou les cellules de collision locales. Inspection plafonnée à 64 colliders fournis, ou 128 entrées de cellules natives ; 32 colliders candidats au maximum. Un budget global de 24 positions de couvert est partagé par tick. Au plus quatre positions classées sont proposées à la navigation, sous le budget A* commun.
- `sim.state.aiStats` expose notamment `pathSearches`, `pathDeferred`, `pathExpansions`, `maxPathExpansions`, `coverChecks`, `coverBoxes`, `shotBlocked` et `suppressed`.

Une mesure Node sans rendu sur la même session urbaine, avec première contestation de commerce et 20 secondes simulées après une seconde d’échauffement (2 400 ticks), appelle `urban.prepare()` avant les ticks, comme `install()` et `prepareDemo()`. La préparation coûte 503–512 ms et ne fait pas partie du temps de simulation mesuré. Ensuite, la simulation de `376d126` donne 0,070 ms/tick (pic 2,73 ms), contre 0,067 ms (pic 2,33 ms) avec le changement. Cet écart ponctuel relève du bruit de mesure ; il ne constitue pas une promesse de gain. La nouvelle simulation effectue 11 recherches, 109 expansions et six tirs ennemis. `navUpdates` reste à zéro malgré la circulation : les véhicules ne provoquent pas de reconstruction globale de la grille.

Sans cette préparation, le profil relève un tick de 482,41 ms, dont 482,37 ms dans `traffic.update` et 0,012 ms dans `sim.step` ; la même session préparée n’a aucun tick au-dessus de 10 ms. Il ne faut donc pas attribuer ce pic à A* ni ajouter un `sim.nav.rebuild()` au chargement. Le préchauffage urbain déjà présent le retire des ticks. Ce microbenchmark ne mesure ni les FPS ni le rendu et n’atteste pas le coût de toutes les rues.

## Vérification et limites

`node tests/combat.mjs` produit `docs/combat-acceptance.json`. Les cas vérifient les murs disponibles uniquement via l’API spatiale, leur contournement suivi d’une riposte, un obstacle apparu pendant la visée ou la rafale, la pression et le couvert effectif, la mémoire figée puis expirée, les blessures, les bornes sous 16 adversaires et une continuation déterministe après checkpoint. La comparaison des snapshots est exacte sur les mêmes commandes et la même géométrie.

Les régressions `sandbox`, `injuries` et `business` passent : le parcours sandbox élimine réellement les gardes par les armes puis valide la prise du commerce. La régression `acceptance` a d’abord révélé un obstacle végétal dans le parcours automobile ; le raccord indépendant du rendu a été corrigé par le lot monde et est revérifié dans la QA générale.

La navigation reste une grille locale bornée : une très longue déviation peut être refusée et donner lieu à une nouvelle tentative, sans garantie de passage dans chaque ruelle. Le moteur ne recalcule pas une navigation globale à chaque image. Aucun asset, modèle externe ni code GPL n’est ajouté. Les principes de mémoire, cadence de décision et visibilité sont adaptés indépendamment ; les références primaires étudiées et leurs licences figurent dans `POLICE.md`.
