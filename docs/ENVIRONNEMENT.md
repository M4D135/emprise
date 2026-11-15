# Environnement procédural — passe 0.4

Les volumes restent intégralement générés en JavaScript. Aucun modèle, feuillage détouré, photographie ou texture importée n'est utilisé. Les références architecturales déjà décrites dans `REFERENCES-VISUELLES.md` restent des documents d'étude.

## Végétation

`RADE.details.prepareVegetation(scenery, city, bounds)` remplace chaque ancien arbre complet avant la construction des collisions. Les positions viennent du générateur urbain existant : elles ne constituent pas un inventaire vérifié des arbres réels de Marseille. Chaque arbre comporte un tronc, une couronne de neuf volumes irréguliers et une géométrie commune de branches ramifiées. Hauteur, étalement, orientation et teinte varient de manière déterministe. Les branches ne sont affichées qu'au niveau de détail proche. Des fosses de terre affleurantes accompagnent les arbres de bord de rue.

Le préparateur contrôle la chaussée au pied du tronc, autour de chaque volume de feuillage, aux sommets et aux milieux des arêtes de la couronne. Il resserre modérément une couronne gênante ou supprime l'arbre entier. Le tronc est le seul collider : les branches aériennes et le feuillage ne créent pas une boîte invisible. Ce traitement fonctionne aussi sans moteur graphique, comme dans les tests de simulation.

## Façades et sol

Les 240 façades détaillées conservent leurs empreintes et leurs marges d'angle. Les vitrages se trouvent derrière des jambages et des linteaux plus épais ; les appuis débordent. Volets fermés, volets entrouverts, stores et rideaux ponctuels rompent les répétitions. Les lames des volets et les garde-corps sont regroupés en formes procédurales partagées. Les huit arcades restent réservées aux deux façades Pouillon déjà sourcées ; ce sont des reliefs, pas des galeries traversables.

Les devantures sont limitées à 260. Les petites reprises de pavage et leurs joints sont posés sur des surfaces libres hors chaussée, restent non solides et disparaissent à distance. Ces variations sont une interprétation visuelle, pas une reproduction vérifiée de chaque fenêtre ou commerce.

## Validation et limites

`node tests/environment.mjs` contrôle la géométrie finie et son orientation, l'absence de feuillage sur la chaussée, l'accord entre tronc et collision, les marges des fenêtres, les budgets d'instances et l'égalité des placements avec ou sans moteur graphique. Résultats détaillés dans `environment-acceptance.json`.

| Mesure du monde statique | Avant | Après |
|---|---:|---:|
| Instances totales | 173 118 | 127 173 |
| Instances de façade détaillée | 98 471 | 53 966 |
| Arbres conservés | 637 | 628 |
| Arbres retirés pour dégager la chaussée | 148 | 157 |

Les 813 888 sommets de couronnes instanciées contrôlés ne croisent pas la chaussée. Le scénario de mission complet a également parcouru les 14 points de passage et atteint la phase finale en 65,17 secondes, sans déplacement forcé.

La baisse des instances ne garantit pas une baisse des appels de dessin : le comptage théorique de tous les groupes de formes de la carte passe de 3 407 à 3 849, car branches et menuiseries utilisent des formes distinctes. Les mesures GPU et captures de la vue réellement affichée doivent donc compléter ce contrôle. Le feuillage demeure constitué de petites masses facettées ; aucune promesse de photoréalisme, de feuilles individuelles ou de reproduction botanique exacte n'est faite.
