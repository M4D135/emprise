# EMPRISE 0.6.5 — qualification Safari et démarrage

`diagnosis.json` distingue le build public initial, les candidats abandonnés et les observations natives. Les rapports portent leur SHA256 : une mesure ancienne ne qualifie pas implicitement un build ultérieur. Les fichiers Chrome sont des tests sur ce Mac, y compris `mobile-launch.json` qui émule le viewport et les commandes tactiles d’un iPhone ; ils ne constituent pas un test sur iPhone physique.

Les fenêtres de cadence excluent le chargement explicite et mesurent les callbacks navigateur, pas la présentation physique de chaque image. Les pics, les périodes masquées et les rechargements mémoire observés sont conservés. La qualité 3D et la population en jeu ne sont pas réduites.

Les preuves d’éclairage et les références de carrosserie sont séparées dans `docs/shadows-065/` et les documents véhicules. Le cycle mémoire est décrit dans `docs/DEMO-LIFECYCLE.md`.

Le dernier passage natif dans Safari varie selon les conditions : la reprise ne recharge plus la page dans l’observation retenue, mais certaines fenêtres restent à environ 35–45 images/s. Ces résultats ne constituent pas une garantie de 60 images/s constantes. Le contrôle sur iPhone 15 Pro Max physique reste à faire.

Le nom affiché devient « Seille », discret ; les slogans du titre sont retirés. Le bus des moteurs est réglé à 30 % de son gain précédent (environ −10,5 dB), sans baisser les effets d’armes et les autres ambiances.

Le trafic freine devant les PNJ vivants (y compris ceux qui rampent). Après une attente de1,6–2s, il émet un klaxon court, puis attend3,5–6s avant de recommencer. Conducteurs absents/morts, véhicules hors service et arrêts volontaires restent silencieux. Le son est directionnel et atténué jusqu’à45m. Les33cas de trafic, le rendu WebAudio hors ligne et les quatre scénarios enregistrés passent ; les résultats se trouvent dans `traffic-horn-audio.json` et `attract-horns-webgpu.json`.
