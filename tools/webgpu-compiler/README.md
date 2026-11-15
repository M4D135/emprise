# Compilation des shaders FERRO

`python3 tools/webgpu-shaders.py` extrait les shaders originaux de FERRO et de la foule PDR, ainsi que la formule de marche de `human.js`, puis les convertit hors ligne en WGSL. Le résultat embarqué est `src/ferro/webgpu-shaders.js`. Le build Python du jeu ne nécessite ni Rust, ni réseau, ni compilateur de shaders externe.

L'outil Rust utilise **Naga 30.0.1**, version et dépendances fixées par `Cargo.lock`. La première génération le construit avec `cargo build --release --locked`; les fichiers intermédiaires se trouvent dans le dossier `work` voisin des sorties du chat. `NODE` et `CARGO` peuvent définir les exécutables. Aucun service ni port d'écoute n'est créé.

Les formules de matériaux, éclairage, ciel, brouillard, reflets et animations restent celles des shaders GLSL originaux. La conversion ajoute uniquement les adaptations d'API : uniformes dans des emplacements vec4 alignés à 16 octets, types texture/sampler séparés, profondeur de clip de [−w,w] vers [0,w], retournement vertical des coordonnées des textures issues d'un rendu. Les textures procédurales et les données de foule gardent leur ordre de texels. Les valeurs de vignette et de seuil de bloom deviennent des uniformes pour préserver les options FERRO.

`python3 tools/webgpu-validate.py` compile tous les modules WGSL et les pipelines correspondants sur le vrai adaptateur WebGPU de Chrome, par CDP pipe, sans serveur. La validation conserve les empreintes des sources compilées et les éventuels messages de Dawn dans `docs/webgpu-shaders-validation.json`. Compiler ne prouve pas à lui seul la parité visuelle ; celle-ci requiert les captures comparatives du jeu.

Le frontend GLSL et le backend WGSL sont ceux de [Naga / gfx-rs](https://github.com/gfx-rs/wgpu/tree/trunk/naga), sous MIT ou Apache-2.0. Le compilateur est un outil de développement et n'est pas embarqué dans le jeu. Aucun modèle, texture, son ou autre asset visuel n'est importé par ce processus.
