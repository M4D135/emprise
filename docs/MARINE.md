# Nage et navigation

Le Vieux-Port accueille trois embarcations procédurales : canot à moteur, voilier et jet-ski. Leurs coques, ponts, sièges, console, garde-corps, mât, voiles et gréement sont construits par le code de `marine.js` avec les formes libres de FERRO et les outils de carène de BITUME.

À pied, avancer dans l'eau déclenche la nage de surface. ZQSD/WASD ou le stick gauche dirigent le nageur ; Maj/A accélère. Les échelles visibles relient l'eau à des points d'arrivée vérifiés sur le quai. E/X sert à monter, descendre ou embarquer ; une embarcation doit être presque arrêtée avant la sortie.

Au moteur, W/RT accélère, S/LT freine puis recule, A/D ou le stick gauche braque, Espace/B freine. F/croix bas coupe le moteur. Sur le voilier, W/RT et S/LT règlent la voile ; la propulsion dépend du vent et de l'angle au vent. Il ne remonte pas directement face au vent. Souris/stick droit : regarder. Les coques oscillent selon la météo et produisent des sillages à budget limité.

Positions, cap, moteur, voile et mode embarqué/nage sont sauvegardés. Les valeurs non finies, positions sur terre ou hors zone sont rejetées ; une reprise embarquée se fait à l'arrêt. Les coques rencontrent la rive, les obstacles et les autres bateaux. Les limites maritimes sont matérialisées par les barrages flottants.

La nage reste en surface : pas de plongée ni d'oxygène simulé. La poussée d'Archimède n'est pas un solveur volumétrique, et la destruction/incendie des bateaux reste à développer. Les collisions et oscillations sont des approximations de jeu.

Vérifications : `node tests/marine.mjs`, rapport `marine-acceptance.json`, plus contrôle WebGL de la nage, des trois postes de pilotage et des échelles. Les tests de placement utilisent explicitement des fixtures ; ils ne prétendent pas parcourir chaque mètre du littoral.
