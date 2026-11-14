# FERRO et les trois jeux

La comparaison porte sur les fichiers des commits indiqués dans `ORIGINS.json`, lus avant intégration. Aucun des trois dépôts de départ n’a reçu les modifications de RADE.

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
- `session.update` avance FPS et véhicule à 120 Hz ; foule à 20 Hz avec interpolation GPU. Un changement de mode ne recrée aucun de ces états.
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

`crowd.js` utilise les champs de navigation et le codage d’état PDR ; `pdr/foule.js` garde l’animation/rendu GPU avec une échelle humaine réduite à 1. Des destinations civiles remplacent les ordres militaires. Anticipation de la trajectoire du véhicule, séparation locale et fuite aux événements de tir sont ajoutées. Un piéton déjà chevauché peut s’échapper sans traverser le décor. Les personnages ne sont pas des obstacles rigides ni des cibles de combat.

Les positions de véhicule/joueur et les événements partagent la session. Entrée au véhicule voisin avec contrôle d’accès, sortie latérale vérifiée sur les deux côtés, refus expliqué si aucun espace libre. La souris et le mouvement sont purgés à chaque transition ; la capture continue ou peut être reprise par clic. Sons procéduraux METAL et BITUME uniquement, pas de téléchargement audio. Le rythme d’allumage est adapté à quatre cylindres ; le son du TMAX reste une approximation synthétique.

## Coût et arbitrages

Le décor demeure dans un lot statique permanent : `allStatic` évite la disparition de la rive opposée provoquée par le culling à 64 m. L’atlas d’ombre couvre la zone proche du joueur. La foule n’est retransmise qu’à chaque tick de 20 Hz, pas à chaque image ; interpolation entre états côté GPU. Les mesures de la version sont conservées dans `browser-performance.json`.

L’ensemble privilégie un jalon cohérent : pas de chargement entre trois moteurs séparés, pas de serveur requis, ni d’assets empruntés à GTA. Les limites fonctionnelles sont listées dans le README.
