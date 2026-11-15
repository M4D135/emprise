# EMPRISE 0.6.2 — grosses explosions

Les comparaisons isolées, leurs limites et les empreintes du build sont dans [EXPLOSION-PERFORMANCE.md](EXPLOSION-PERFORMANCE.md). La charge lourde ajoute trois voitures détruites simultanément et deux explosions de façade, avec leurs intérieurs et débris physiques, aux 960 PNJ et 39 véhicules de trafic. Les réglages 3D sont inchangés.

Les nouveaux contrôles couvrent les deltas de géométrie et leur composition, les seuls groupes spatiaux modifiés, la présélection des débris proches, les supports de destruction, les plages des sources et la publication groupée des pièces touchées. Les sorties sont comparées à l’implémentation précédente, y compris l’ordre, les géométries, les collisions, les événements, les sauvegardes et les octets GPU. Le test d’exception vérifie la publication des pièces déjà modifiées et la reprise normale au tir suivant.

La perte réelle du périphérique et l’échec d’installation native passent aussi sur le build final, avec reprise de la même session et commandes sur le nouveau canvas : [rapport de récupération](explosion-render-recovery.json).

## Historique 0.6.1 — extérieur chargé et récupération

Les mesures à charge identique sont détaillées dans [OUTDOOR-PERFORMANCE.md](OUTDOOR-PERFORMANCE.md). Le scénario conserve 960 PNJ, 39 véhicules de trafic et trois explosions réelles, sans modifier les réglages graphiques. Chaque rapport porte l’empreinte du HTML et de la fixture effectivement exécutés.

La récupération est vérifiée par `save-recovery.mjs`, `fatal-recovery.mjs` et `fatal-recovery-browser.py`. Le dernier contrôle navigateur est consigné dans [fatal-recovery.json](fatal-recovery.json) : erreur avant la première frame, rechargement, annulation et confirmation à la manette virtuelle, effacement sans réécriture par `pagehide`, réglages conservés, reprise en nage aux coordonnées du signalement. Les tests utilisent des profils temporaires, sans toucher à la sauvegarde de David.

## Historique 0.6.0 — migration WebGPU du 15 novembre 2026

Le backend natif, le secours WebGL2 et la comparaison de cinq scènes sont détaillés dans [WEBGPU.md](WEBGPU.md). Le portage avant correction visuelle est mesuré dans [render-comparison.json](render-comparison.json), et le build final dans [render-final-comparison.json](render-final-comparison.json) ; le build et son empreinte sont dans `SIZE.json`. La migration ne change pas les règles de simulation ni les données du monde. Le signalement visuel suivant a ajouté un filtre solaire continu, une correction de pente pour la foule et le recalage de la garniture du montant arrière de la 205 ; les résultats de ces contrôles sont référencés dans `WEBGPU.md`.

Les nouveaux tests couvrent le cycle de vie du renderer, la compilation des 18 shaders sur GPU réel, la foule native, les erreurs et pertes de périphérique avec reprise de la même partie. Les rapports de jeu actif du portage sont listés dans `render-gameplay.json` ; le parcours de 40 secondes du build final figure dans `frame-pacing.json`. Les preuves historiques ci-dessous restent datées et ne sont pas présentées comme une nouvelle validation exhaustive.

## Historique 0.5.0 — vérification du 15 novembre 2026

Version « Tenir la rue ». Le build courant et son SHA-256 sont dans `SIZE.json`. Chaque rapport navigateur conserve le SHA du build effectivement testé : les captures ne proviennent pas toutes du dernier rebuild. Les rapports indiquent les conditions de chaque vérification ; les scènes préparées et les commandes réelles sont distinguées.

## Blocage sous les débris et destruction

`tests/clearance.mjs` vérifie la capsule contre une boîte tournée, les espaces libres à côté d'une plaque, le dégagement progressif au bord d'un mur et le retour des commandes après une chute réelle de 1 600 kg dans la ville. `tests/clearance-review.mjs` couvre notamment les blocs imbriqués et le refus de traverser un nouvel obstacle. Les déplacements de correction sont bornés, sans téléportation vers un point arbitraire.

`tests/fragmentation.mjs` vérifie une taille structurelle maximale de 1,4 m avant le plafond de fragments, la poussière non collidante, la reprise des grosses plaques anciennes et les budgets. Les suites `urban` et `vehicle-explosion` contrôlent encore les brèches, corps rigides, sauvegardes, incendies, secours et explosions de véhicules.

`tests/rubble-support.mjs` reproduit une roquette puis une marche dans la brèche b640, hors cœur. Il vérifie la fracture en petits blocs solides, les volumes pulvérisés, le franchissement réel des gravats stables, le refus de marches de plus de 42 cm ou de débris en mouvement, le plafond et la reprise d’une sauvegarde sur un morceau.

`tests/collapse-browser.py` prépare une plaque au-dessus du joueur puis vérifie la marche par une vraie touche W. Une deuxième scène place le joueur devant une façade existante et tire des roquettes par clics réels jusqu’à ouvrir une brèche. Il ne s'agit pas de la sauvegarde exacte du signalement de David. Rapport : `collapse-browser.json` ; captures `collapse-recovery.png` et `building-breach.png`.

`tests/core-breach-browser.py` prépare uniquement le départ et la visée devant une façade réelle du 1 quai des Belges. Deux roquettes tirées par clic consomment le stock initial, exposent le mobilier intérieur, puis W fait franchir le seuil. Le test vérifie que la pièce rejointe est la même instance que celle projetée dans la rue et que le point de retour est sauvegardé. Il n'injecte ni dégâts, ni munitions, ni téléportation d'entrée ; les adversaires restent actifs. Rapport : `core-breach-browser.json`, build `616770fb…`. Cette preuve porte sur un accès préparé, pas sur toutes les façades de la ville.

## Police et économie

`tests/police-foot.mjs` : conducteurs réutilisés, descente physique, visibilité et mémoire, contournement, budgets, interpellation à pied/véhicule arrêté, blessures/mort, véhicule volé, retour et sauvegarde. `tests/police.mjs` conserve la régression du trafic policier. Les agents à pied n'utilisent pas encore d'armes à feu.

`tests/business-raids.mjs` : avertissement, apparition hors vue, occupation spatiale, défense par vrais tirs METAL, perte, retrait visible, intérieurs/décès, cooldown et reprise. `tests/business.mjs` vérifie également les packs de munitions après une protection obtenue. Aucun paiement de victoire n'est créé pour les représailles.

`tests/ammunition.mjs` et `tests/loot.mjs` : consommation par tir effectif, panne sèche sans crosse automatique, stocks indépendants, capacité, butin partiel, sauvegarde et migration. Aucun butin de gang pour les civils ou policiers.

`tests/street-life.py` utilise clics/touches réels pour la dernière cartouche, la panne sèche et le réapprovisionnement d'un commerce préparé comme protégé. Une patrouille déjà présente rejoint ensuite un joueur placé à proximité et l'interpelle par la simulation normale. Aucune commande de respawn direct. Rapport : `street-life-browser.json`.

## Peur, agressions et conducteurs

`drivers.mjs` vérifie les tirs réels de la simulation sur les têtes de conducteurs 205/R5/TMAX/moto de police, une blessure au bras, l'occlusion par toit et mur, la reprise physique d'une voiture, les coups du propriétaire, sa fuite sous les tirs et la sauvegarde. `crowd.mjs` vérifie aussi les provocateurs sans peur, l'agression spontanée à portée, les limites de blessure, mur et véhicule. Les profils comportementaux sont indépendants de l'apparence.

`drivers-browser.py` reproduit headshot et vol avec clic/touche E réels, puis observe la récupération par l'IA et une agression non provoquée. Les rencontres sont préparées et identifiées comme telles dans `drivers-browser.json`. Détails et limites dans `HOSTILITE.md`.

## Modèles et rendu

TMAX, vélo et trottinette sont examinés de face, de dos, de trois quarts avec conducteur et en gros plan stationné (`vehicles-quality.py`, `vehicles-visual.json`). Les placements sont des fixtures visuelles. `mobility-models.mjs` contrôle les gabarits, normales, données finies, direction, contacts mains/pieds et budgets. La dynamique des trois deux-roues civils est conservée, avec prise en compte du frein à main comme frein. Une moto de police distincte utilise son propre gabarit.

`renderer-pack.mjs` compare 120 lots avec le renderer de 0.4.0 : octets Float32Array, groupes, ordre transparent, matériaux et flags identiques. L'allocation d'un tableau JS temporaire par instance est supprimée ; ce test ne prouve pas un gain de FPS.

`police-motorcycle.mjs` contrôle le gabarit RT, les semelles sur les repose-pieds, les mains au guidon, l'équipement attaché et l'absence d'uniforme hérité après un vol. `police-motorcycle.py` capture face/dos/trois-quarts et selle vide. `realism.mjs` mesure accélération, freinage sec/mouillé, dommages, direction amortie, marche arrière, frein à main sans boost et continuité des cycles de marche.

`shadow-browser.py` compare les ombres activées/coupées, une surface plane sans occluder et une vraie ombre portée, en atlas solaire entier et en demi-atlas. Le défaut signalé était une correction de pente multipliée par deux même en plein atlas ; la conversion dépend maintenant de la taille effective de la tuile. Les captures avant/après et déplacements de caméra sont conservés dans les rapports `shadow-before.json` et `shadow-after.json`. Les ombres restent actives ; ni les matériaux ni le biais ne sont artificiellement assombris pour masquer les bandes. Sur les surfaces tests, les 54 618 / 51 873 composantes faussement assombries avant correction passent à zéro après ; l'ombre d'un obstacle réel reste mesurée.

La foule garde la passe GPU de Point de rupture ; une texture de locomotion contient maintenant les phases et amplitudes issues de la distance parcourue. Le shader interpole entre les deux états de simulation. Les acteurs proches utilisent le même avancement de cycle, sans marcher sur place face à un obstacle.

Les personnages et véhicules restent stylisés, intégralement procéduraux. Aucun modèle, texture, image ou son importé ; les captures PNG sont des preuves de test exclues du runtime.

## Ville étendue, relief et éclairage

Les codecs cartographiques sont contrôlés sur les données sources sans modification des empreintes. Les rapports `city-data-validation.json`, `city-height-validation.json` et `core-height-validation.json` séparent hauteurs présentes, correspondances IGN, interpolations et inconnues. `city-stream.mjs` contrôle chargement borné, coordonnées, collision et cours ; `city-destruction.mjs` contrôle brèches, volumes et persistance ; `city-lights.mjs` vérifie implantation, extinction et reprise des lampadaires détruits. Les mesures de génération CPU ne constituent pas des FPS GPU.

`city-destruction-browser.py` a ensuite reproduit une roquette et une marche W réelle à travers une façade hors cœur, avec débris physiques actifs, puis sauvegarde et restauration de la brèche. Le premier essai avait échoué à cause du pavage jointif des fragments et de l’absence d’appui pour les pieds ; le correctif final passe sur le build `5a58818e…`. Le départ et la visée sont préparés, avec ennemis de mission désactivés et menace initiale nulle pour isoler la destruction ; aucune téléportation pendant le franchissement. Rapport : `city-destruction-browser.json`.

`day-night.mjs` couvre le cycle de vingt minutes, les crépuscules, la sauvegarde, la pluie et les éclairs à altitude locale. `landmarks.mjs` contrôle les coordonnées, hauteurs de référence, budgets, exclusions d'empreintes et l'accord entre interpolation du terrain visible et hauteur physique. Il n'atteste pas la fidélité architecturale des proportions. `altitude.mjs` teste sur la colline procédurale du jeu les collisions de voiture, sortie, reprise et tir sur conducteur. Les limites topographiques et architecturales restent détaillées dans `WORLD.md` et `LANDMARKS.md`.

`experience-browser.py` vérifie le SMS spontané, son acceptation par clic, le téléphone à la manette virtuelle, l'emplacement de l'ATH et les vues FPS/troisième personne par molette réelle. Ses vues de la Bonne-Mère et des rues à 23 h/17 h/12 h utilisent des positions et heures préparées, déclarées dans le rapport. Les lumières transmises au renderer sont observées sans les remplacer ; les images doivent être revues visuellement.

`water-depth-browser.py` vérifie que la mer de fond n'altère plus la terre visible à 150 m et 5 km, avec les mêmes plans de coupe .035/26 000 m. Cette seule nappe est dessinée avant les objets opaques sans écrire la profondeur, coûte un appel de dessin et conserve son buffer entre images. Les eaux locales gardent leur profondeur normale et leurs réflexions à l'écran ; la nappe lointaine conserve les reflets de ciel procéduraux. Le test vérifie aussi restauration du contexte et retrait du fond lors d'une révision de scène.

`city-road-terrain.mjs` mesure les rubans de chaussée sur le relief réel du jeu, longitudinalement et transversalement : aucun triangle sous le terrain dans la fixture Bonne-Mère. Le surcroît de géométrie est local et construit progressivement ; les routes planes gardent leur représentation simple.

Le diagnostic GPU a ensuite isolé un conflit de profondeur : couper les ombres ne supprimait pas les trous, augmenter le plan proche les supprimait. Le plan proche du monde atteint désormais 15 cm dans un champ libre et se réduit jusqu’à 3,5 cm selon cinq rayons du frustum. La passe d’arme existante utilise sa propre projection à 3,5 cm ; aucun biais de profondeur massif n’est ajouté aux routes. `near-plane-browser.json` vérifie les chaussées, l’arme, le cockpit et la proximité d’une vraie façade ; `renderer-overlay.mjs` contrôle les matrices d’arme, particules et SSR. La capture finale montre une chaussée continue. Les coques lumineuses du monument ont aussi une séparation absolue pour réduire leur moiré. `bonne-mere-performance-browser.json` conserve une mesure de dix secondes sur une vue préparée antérieure ; elle ne garantit pas la fluidité partout.

## Navigation et habitacles

`sailing.mjs` contrôle vent apparent, surface/angle de voile, postes et moteur auxiliaire. `sailing-browser.py` utilise clavier et Gamepad API virtuelle et relève les gains WebAudio réels : le voilier est muet au moteur coupé. Les positions en mer et changements météo du test sont préparés, pas une traversée depuis le quai ; le relevé d'entrées ne constitue pas une cinquième démonstration autonome.

`cockpit.mjs` contrôle la cinématique des bras, volant et levier. `cockpit-browser.py` conduit par entrées clavier réelles et observe le passage de rapport effectif, le déplacement de la main vers le levier puis son retour. La caméra rapprochée du pommeau est une fixture visuelle identifiée.

## Régressions et démonstrations

La passe générale comprend 47 suites Node réussies ; elle est détaillée dans `node-validation-050.json`. Les tests de police, commerce, destruction, dégagement et replays ont leurs suites et rapports séparés. Les commandes clavier/souris (`inputs.py`), la manette standard virtuelle (`gamepad.py`), le carnet/butin (`immersion.py`) et les commerces/intérieurs/nage (`new-features.py`) sont vérifiés dans Chromium par CDP pipe, sans serveur ni port d'écoute.

Quatre sessions de démonstration sont enregistrées puis rejouées dans Node : tir/conduite, commerce contesté, explosion de véhicule et interpellation par une patrouille à pied. La dernière commence au départ normal avec une heure préparée à 23 h et utilise un clic réel ; aucune patrouille n'y est déplacée artificiellement. `attract.py` et `demo-cycle.py` vérifient délai de titre, sortie et isolation de la sauvegarde. La manette physique n'a pas été testée.

## Mesure finale de fluidité

Sur le build `4b444e4238` (`ed3d4306…`), `streaming.py` mesure 40 secondes, dont vingt de rotation de caméra, avec autosauvegarde active : 2 400 images, médiane 16,7 ms, p95 16,8 ms, p99 17,1 ms, maximum 17,6 ms ; aucune image au-delà de 25 ms. Le CPU p95 est de 7 ms. Le viewport demandé est de 1 580 × 920 CSS avec DPR 2 ; le budget du renderer limite effectivement son framebuffer à **1 758 × 1 024 pixels**, ce qui ne constitue pas une mesure en 4K native. Ombres, réflexions et MSAA sont actifs. La restauration du contexte WebGL passe également. Rapport : `frame-pacing.json`.

Les six scénarios navigateur de la passe finale sont listés dans `browser-validation-050.json`. Les quatre enregistrements sont rejoués exactement dans Node ; `release-validation-050.json` confirme ensuite le build, le délai de titre, le cycle des démos et la mesure de fluidité. Les scènes de destruction et la vue de la Bonne-Mère ont leurs propres relevés ; ces résultats ne garantissent pas le même débit dans toutes les situations ou sur tous les appareils.

## Limites

Le solveur n'effectue pas de calcul structurel d'ingénierie. Le monde conserve au plus 240 corps au total ; chaque solveur local est configuré pour 96 éveillés au maximum. Sous un gros effondrement, le volume qui dépasse le budget devient une poussière temporaire puis disparaît. Les collisions automobiles gardent des volumes conservateurs. La récupération du joueur n'autorise pas de traverser un mur ou un débris nouveau ; un espace entièrement clos reste un obstacle réel.

Les adresses sont sourcées, mais les aménagements et les rapports de gangs sont des compositions fictives. Solo persistant uniquement. Les mesures locales et les tests ciblés n'attestent pas chaque ruelle, chaque sauvegarde ni tous les matériels. Safari et Firefox n'ont pas été retestés dans cette passe.
