# Téléphone et missions SMS

O au clavier ou croix haut à la manette ouvre le téléphone. LB/L1 puis Téléphone donne aussi accès à cette vue. Les conversations regroupent les messages, leurs pastilles signalent les nouveaux SMS et une fiche garde le contrat accepté. Le monde continue ; le téléphone ne sert pas de minimap.

La coque cuivrée, les coins arrondis et l'interface sont générés en HTML/CSS. L'inscription « concept iPhone 18 Pro Max » décrit une interprétation visuelle fictive demandée pour le jeu, sans prétendre fournir une fiche technique ou reproduire fidèlement un appareil réel. Aucun visuel ou modèle importé.

Un premier contact peut arriver après quinze secondes de jeu calme. Les propositions suivantes sont espacées ; une seule offre ou mission active à la fois. Les adresses doivent être renseignées dans le catalogue. Trois types : retirer une provision au comptoir désigné puis la livrer à une autre adresse (achat nécessaire seulement si le sac est vide), parcourir 350 m avec le véhicule civil précisément demandé puis s'arrêter deux secondes devant le garage, ou obtenir la protection d'un commerce par sa mission de conflit et revenir confirmer. Accepter un SMS ne déclenche aucun paiement. Le système conserve un registre des récompenses pour éviter leur duplication au rechargement. Ces demandes et relations commerciales sont des fictions du jeu.

Les conversations, lectures, contrats et identifiants des paiements sont sauvegardés avec le monde. Les valeurs et références sont validées à la reprise. Les notifications sont des sons synthétiques ; elles ne communiquent avec aucun service de messagerie externe.

Vérifications : `tests/phone.mjs` couvre les trois parcours et les refus/limites/reprises ; `tests/experience-browser.py` exerce le délai normal, le clavier, l'acceptation par clic, la croix haut et B de la Gamepad API virtuelle. Les missions restent solo.
