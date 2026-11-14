# Vérification du 14 novembre 2026

## Parcours complet

`node tests/acceptance.mjs` puis `python3 tests/browser.py` ont exécuté la même séquence de commandes dans une session neuve : marche/course, entrée dans la 205, contact, 14 points de passage sur le quai et aux intersections, freinage, marche arrière, arrêt, sortie, combat contre les trois sentinelles, marche vers l’objectif, retour au véhicule et départ. Le contrôleur de test fournit des commandes à l’interface de jeu ; il ne téléporte pas le joueur, ne modifie pas les PV et ne force pas la mission. Le navigateur avance à sa fréquence réelle de rendu.

Résultat : mission terminée en **65,17 s simulées**, **22,86 m à pied**, vitesse de recul maximale **3,11 m/s**, trois ennemis vaincus, **92 PV** restants. Foule active pendant toute la séquence ; évitements du véhicule observés. Les captures ne remplacent pas les assertions : les résultats détaillés sont dans `acceptance.json` et `browser-performance.json`.

## Régressions contrôlées

- Dix cycles entrée/sortie successifs : même véhicule, même tableau de piétons, combat conservé.
- Mur ajouté à un côté : sortie du côté libre. Deux côtés fermés : maintien dans le véhicule et explication affichée. Répété dans Chromium, résultat dans `browser-input.json`.
- Déplacement balayé vers une façade réelle de Marseille : véhicule arrêté avant pénétration.
- Rayon partagé vers cette façade : contact à la face ; tirs METAL répétés vers un ennemi derrière le mur sans diminution de ses PV.
- TMAX, trottinette et vélo : accélération, limite de vitesse, freinage jusqu’à l’arrêt. Chaque modèle a été rejoint et monté dans le navigateur, sans erreur JavaScript.
- Entrée clavier `E` après le parcours : retour en FPS ; clic puis mouvement réels injectés par le protocole du navigateur : capture souris obtenue, variation de yaw de 0,11 rad et de pitch de −0,044 rad.
- Aucune erreur JavaScript pendant le parcours WebGL2. Les deux voitures ont été inspectées à l’extérieur et en cockpit ; les autres véhicules ont aussi été capturés à hauteur de rue.
- Aucun tronc issu du mobilier végétal PDR sur une cellule de chaussée après filtrage ; 143 arbres complets retirés. Les nouveaux groupes de mobilier sont positionnés hors chaussée.

Les tests de murs et de collisions isolées créent des situations dédiées ; cette préparation est distincte du parcours complet sans téléportation. Les captures de véhicules utilisent une caméra de contrôle libre.

## Mesures

| Paramètre | Valeur |
|---|---|
| Machine | MacBook Air, identifiant Mac17,4, Apple M5, 24 Go |
| Navigateur | Google Chrome 157.0.0.0, WebGL2 |
| Résolution du canvas | 1440 × 900, facteur de pixels 1 |
| Population | 480 piétons |
| Réglages | MSAA 4×, ombres soleil, bloom, décor statique complet |
| Images échantillonnées | 3 911 |
| Temps d’image médian | **16,7 ms** |
| Temps d’image 95ᵉ percentile | **17,1 ms** |
| CPU JavaScript médian / p95 | 2,9 / 7,0 ms |
| Build testé SHA-256 | `0c97bb4062703ae9d1ac4180daa3b55a053386a3ec9d8c71ac7e74e74a3c900a` |

Temps d’image = intervalle entre appels de `requestAnimationFrame`, donc influencé par la synchronisation de l’écran ; ce n’est pas un timer GPU. Le temps CPU couvre le traitement JavaScript de l’image et l’envoi des commandes, sans mesure du GPU. Une passe au premier plan après chargement. Le rapport JSON contient aussi la version navigateur et les compteurs du renderer ; son compteur de foule générique n’inclut pas la passe spécialisée PDR, d’où l’usage du nombre de piétons de la session.

Optimisations retenues : transfert de foule seulement à 20 Hz, interpolation GPU, décors immuables déjà empaquetés, grille spatiale commune, navigation civile par champs réutilisés. Le décor entier reste dessiné pour préserver les façades lointaines visibles depuis le port ; aucune baisse supplémentaire de qualité n’a été nécessaire sur cette machine. Les données supplémentaires de décor représentent 10 602 pièces, avec 95 groupes de mobilier.

## Limites vérifiées et limites de vérification

Cette version est un prototype de secteur ouvert, à sol plat, non une reproduction intégrale de Marseille. Les boîtes de contact de bâtiments et véhicules sont simplifiées. Les piétons se dégagent, mais ne sont ni des obstacles rigides ni des ragdolls. La foule, les véhicules et la mission persistent dans la session, pas après rechargement. Pas de trafic autonome ni de système de police.

Les silhouettes des véhicules et leurs détails sont procéduraux et stylisés. Pas de simulation de suspension complète des deux-roues, de rétroviseur caméra, de dégâts de carrosserie ni d’ouverture animée des portières. Les paramètres routiers sont communs aux deux compactes. Commandes tactiles et autres navigateurs/machines non certifiés. Le parcours et les cas isolés décrits ne couvrent pas toutes les rues.

État des dépôts sources après travail : METAL propre ; Point de rupture propre ; BITUME conserve uniquement son entrée préexistante non suivie `.claude/worktrees/`. Aucun changement de fichiers suivis ni commit dans ces dépôts.
