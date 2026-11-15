# FERRO et les trois jeux

La comparaison porte sur les fichiers des commits indiqués dans `ORIGINS.json`, lus avant intégration. Aucun des trois dépôts de départ n’a reçu les modifications de EMPRISE.

| Fonction | METAL | BITUME | Point de rupture |
|---|---|---|---|
| Renderer WebGL2, matériaux, soleil, ombres, effets | oui | oui | oui |
| Formes libres enregistrables et coin `wedge` | non | oui | non |
| Décor par lots et nappes | non | oui | oui, héritage commun |
| Passes de foule spécialisées, atlas humains GPU | non | non | oui |
| Contrôleur FPS, combat, armes, motion | modules complets | — | — |

**Décision : renderer PDR.** Il garde les passes de foule, le partage de l’éclairage et des ombres, les lots PDR et les nappes/lots BITUME déjà présents. Le bloc de géométrie BITUME apporte `forme`, `wedge`, la correction de winding, les offsets en octets et les indices `Uint32`. Les appels instanciés utilisent `UNSIGNED_INT`. Les formes libres sont enregistrées avant la création du contexte. Les carènes projettent les ombres. Le fichier résultant appartient à ce nouveau dépôt ; l’ancienne provenance PDR est conservée et identifiée comme archive.

## Un monde, une horloge

- `src/game.js` est le seul propriétaire de `requestAnimationFrame`, du canvas et du renderer.
- `session.update` avance FPS et véhicule à 120 Hz ; trafic à 30 Hz, foule à 20 Hz avec interpolation GPU. Un changement de mode ne recrée aucun de ces états.
- Mètres : x est, z sud, y haut. Le cap d’un véhicule est `atan2(vz,vx)` ; le yaw FPS correspondant vaut `cap + π/2`. Les rotations du renderer utilisent leur matrice commune.
- `world.js` indexe les volumes urbains dans une grille spatiale de 8 m. Les tests disque/OBB, SAT véhicule, balayages, rayons et eau/bord du secteur partagent ce monde. Les objets solides ajoutés par `details.js` passent dans le même index.
- Le mouvement automobile est balayé par sous-pas de 15 cm au plus. Les roues sont visuelles, le contact utilise une OBB du gabarit de chaque véhicule. Les toitures inclinées reçoivent des enveloppes conservatrices.

La ville PDR est gardée avec ses rues, bâtiments, sol et eau ; seules les décorations de QG/sites de son RTS sont écartées. La grille de navigation civile est recalculée contre les mêmes obstacles. Les arbres dont le tronc touche une chaussée ou son voisinage immédiat sont retirés avec leur feuillage. Les terrasses/mobilier supplémentaire ne sont posés que sur des zones libres hors chaussée.

## Conduite

`bitume/conduite.js` reprend les courbes d’adhérence, l’ellipse des forces, les charges de roues filtrées, le lacet, le frein moteur, la boîte, le drift et les réactions de choc. `dynamique` fournit les vitesses du repère caisse ; `integrerMonde` transpose vers x/z et applique les contacts. Plus de coordonnées s/d, de rail, d’accrochage à un circuit ou de guidage de trajectoire. La marche arrière utilise une vitesse longitudinale signée ; le frein s’oppose au mouvement.

Pour les 205/R5, les constantes passent d’une monoplace à un réglage commun de compacte : empattement 2,42 m, masse de référence 910 kg, moteur cinq rapports à régime routier et motricité avant. Le gabarit de collision dépend du modèle. Ces constantes ne prétendent pas distinguer finement le comportement réel de chaque auto. Les deux-roues ont leur propre intégrateur cinématique avec accélération, frein, braquage, inclinaison visuelle et le même balayage de collisions. Aucun deux-roues n’utilise une carrosserie automobile invisible.

Les modèles 205/R5 ont des passages de roue découpés, leurs pare-chocs, jantes et optiques propres, sièges, panneaux de portes, tapis, levier, pédales, rétroviseurs, volant et aiguilles animés. Le TMAX a une carène lissée, le vélo un cadre tubulaire et des pédales animées. La palette n’est pas limitée aux couleurs d’origine : le sélecteur accepte toute couleur RGB.

## FPS, foule et événements

Les adaptations dans `metal/simulation.js` sont étroites : sol, obstacle et rayons délèguent au monde ; un joueur assis laisse le véhicule posséder sa pose ; le pas de grille de navigation passe à 2 m pour ce secteur. `weapon.js` extrait le modèle procédural de l’arme de `game.js` de METAL. Ennemis, dégâts, tirs, impacts, mouvement et recul restent les systèmes METAL.

`crowd.js` utilise les champs de navigation et le codage d’état PDR ; `pdr/foule.js` garde l’animation/rendu GPU avec une échelle humaine réduite à 1. Des destinations civiles remplacent les ordres militaires. Anticipation de la trajectoire du véhicule, séparation locale et fuite aux événements de tir sont ajoutées. Un piéton déjà chevauché peut s’échapper sans traverser le décor. Les personnages ne sont pas des obstacles rigides. Les volumes de tête, torse, bras et jambes sont désormais des cibles de combat communes dans `injuries.js`.

Les positions de véhicule/joueur et les événements partagent la session. Entrée au véhicule voisin avec contrôle d’accès, sortie latérale vérifiée sur les deux côtés, refus expliqué si aucun espace libre. La souris et le mouvement sont purgés à chaque transition ; la capture continue ou peut être reprise par clic. Sons procéduraux METAL et BITUME uniquement, pas de téléchargement audio. Le rythme d’allumage est adapté à quatre cylindres ; le son du TMAX reste une approximation synthétique.

## Coût et arbitrages

Le décor est précalculé en chunks GPU conservés entre les images. Leur volume englobant est testé contre la caméra, avec distances de détail pour les ornements ; les volumes principaux conservent la rive lointaine. L’ombre solaire sélectionne séparément ses casters pour ne pas perdre les ombres venant de hors champ. Les morceaux inchangés sont réutilisés après destruction. Les structures de destruction et de physique sont préparées au chargement pour éviter leur construction lors du premier choc.

La foule est transmise à 20 Hz et interpolée sur le GPU. Les acteurs proches utilisent un nombre borné de maillages déformés avec les mêmes poids articulaires. L’ATH affiche désormais la moyenne et le pire intervalle récent, au lieu d’une médiane qui dissimulait les pauses.

L’ensemble privilégie un jalon cohérent : pas de chargement entre trois moteurs séparés, pas de serveur requis, ni d’assets empruntés à GTA. Les limites fonctionnelles sont listées dans le README.

## Socle hérité de la version 0.2.0

`campaign.js` possède la progression solo, les douze sites et la loi ; `traffic.js` utilise le graphe routier à 944 nœuds. `interiors.js` catalogue 746 adresses et génère sept usages avec des étages chargés par interaction. `injuries.js` unifie les volumes de tir des adversaires, civils et commerçants à pied. Les conducteurs ont un état propre, utilisé pour l’extraction et la persistance.

`urban.js` branche les dégâts sur `ferro/destruction.js` et le solveur rigide METAL. Les coupures conservent les orientations du décor ; les volumes statiques orientés évitent de boucher une rue avec une boîte englobante. Les corps rigides sont isolés par scène intérieure ou extérieure. Les masses proviennent du volume, du matériau et d’une approximation de coque. Les budgets sont volontairement finis. Les explosions de véhicules déclenchent les effets METAL, les dégâts de proximité, le feu et des fragments, une seule fois par épave.

`weather.js` intègre un déplacement continu des nuages selon le vent, au lieu d’un aller-retour sinusoïdal. Le renderer partage ciel et réflexions d’environnement ; une passe SSR en demi-résolution suit la profondeur du monde avant l’arme FPS. Les cartes de matériaux sont générées au chargement par `materials.js`, sans JPEG, image source ni réseau.

`human-data.js` et `body-data.js` sont des générateurs paramétriques originaux exécutés en mémoire, sans MakeHuman ni maillage importé. Les validateurs `tools/prepare-head.py` et `tools/prepare-body.py` ne lisent aucun asset externe. Voir `MODELS.md` et `ASSETS.md`.

`replay.js` enregistre les commandes consommées à 120 Hz. Les données RLE validées dans `src/replays.js` sont rejouées dans une session isolée ; la session du joueur est restaurée à la fin et aucune sauvegarde de démo n’est écrite. Les fixtures des tests de destruction sont explicitement identifiées comme telles.


## Comparaison actuelle des autres jeux

Le 15 novembre, les sources locales BITUME `ba6de78` et Point de rupture `5398fd3` ont été relues sans modification. EMPRISE reprend les conventions manette, réglages et vibrations de conduite de BITUME, les carènes pour les embarcations et les passes de foule de PDR. Son rendu conserve ses reflets de scène et son mouillage piloté par la météo : le renforcement analytique du ciel de BITUME ne remplace pas cette passe. Le clone METAL disponible dans ce travail reste `731ace7` ; sa simulation FPS, ses dégâts et sa physique restent intégrés. Il ne s’agit pas d’une fusion globale des trois dépôts ni de l’importation de tout leur travail en cours.

`business.js` réserve ses adversaires avant la création de la simulation METAL et utilise ses vrais tirs et PV. `marine.js` possède la pose en nage et en bateau ; la simulation continue à traiter les autres acteurs. Les données de ces modules sont isolées dans la sauvegarde solo.
