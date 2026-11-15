# Nage et navigation

Le Vieux-Port accueille trois embarcations procédurales : canot à moteur, voilier et jet-ski. Leurs coques, ponts, sièges, console, garde-corps, mât, voiles et gréement sont construits par le code de `marine.js` avec les formes libres de FERRO et les outils de carène de BITUME.

À pied, avancer dans l'eau déclenche la nage de surface. ZQSD/WASD ou le stick gauche dirigent le nageur ; Maj/A accélère. Les échelles visibles relient l'eau à des points d'arrivée vérifiés sur le quai. E/X sert à monter, descendre ou embarquer ; une embarcation doit être presque arrêtée avant la sortie.

Au moteur, W/RT accélère, S/LT freine puis recule, A/D ou le stick gauche braque, Espace/B freine. F/croix bas coupe le moteur. Sur le voilier, C/Y alterne trois postes : gouvernail, manivelle d'orientation et manivelle de déploiement. A/D ou le stick horizontal règle l'orientation au poste correspondant ; W/S ou RT/LT déploie ou enroule au second. La propulsion dépend du vent apparent, de la surface déployée et de l'angle de voile. Une girouette et les voiles gonflées indiquent la prise au vent. Le moteur auxiliaire est coupé par défaut ; F/croix bas l'active et W/S commande alors ses gaz depuis le gouvernail. Aucun bruit moteur sur le voilier à moteur coupé. Il ne remonte pas directement face au vent. Souris/stick droit : regarder. Les coques oscillent selon la météo et produisent des sillages à budget limité.

Positions, cap, moteur, voile et mode embarqué/nage sont sauvegardés. Les valeurs non finies, positions sur terre ou hors zone sont rejetées ; une reprise embarquée se fait à l'arrêt. Les coques rencontrent la rive, les obstacles et les autres bateaux. La zone maritime couvre le littoral de Marseille, les îles d'If/Frioul/Maïre/Riou et les Calanques. Les limites extérieures sont matérialisées par des bouées. Les contours viennent d'OSM ; falaises et reliefs sont des approximations procédurales, pas une bathymétrie ni un relevé topographique.

La nage reste en surface : pas de plongée ni d'oxygène simulé. La poussée d'Archimède n'est pas un solveur volumétrique, et la destruction/incendie des bateaux reste à développer. Les collisions et oscillations sont des approximations de jeu.

Vérifications : `node tests/marine.mjs`, rapport `marine-acceptance.json`, plus contrôle WebGL de la nage, des trois postes de pilotage et des échelles. Les tests de placement utilisent explicitement des fixtures ; ils ne prétendent pas parcourir chaque mètre du littoral.
