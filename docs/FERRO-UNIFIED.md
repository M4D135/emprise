# FERRO commun — 0.2.0-preview.1

Le moteur commun est le chantier principal. L’éditeur est secondaire (décision de David du 16 novembre 2026). Le pilote reste EMPRISE ; la propagation aux trois autres jeux vient après qualification. Cette version est un **candidat de moteur**, pas l’annonce que toutes les fonctionnalités des quatre moteurs sont déjà fusionnées ou distribuées.

## Une source commune réelle

Les implémentations partagées sont dans `src/ferro/`. Les anciennes copies de physique, mathématiques, entrées, mouvement, effets, audio, géométrie BITUME et navigation PDR ont été retirées de leurs anciens dossiers ; le build et les harnais consomment les chemins communs. `FERRO.json` définit la version et les modules. `tools/build-ferro-runtime.py` produit un paquet autonome, ses modules individuels et leurs empreintes SHA256.

L’archive fournit `ferro-runtime.js`, la bibliothèque musicale optionnelle `ferro-music.js`, `modules/` et `manifest.json`. Aucun modèle, image, enregistrement sonore, CDN ou téléchargement de contenu n’est requis. Les matériaux sont calculés en mémoire ; les sons et instruments sont synthétisés. Les coordonnées géographiques et règles des jeux restent des données d’adaptateur.

| Domaine | Choix et travail effectué | Qualification |
| --- | --- | --- |
| Rendu | Base EMPRISE WebGL2/WebGPU, ombres, SSR, météo, lots PDR, formes libres BITUME ; constructeur de maillage commun METAL ajouté | Rendu du pilote et reprise WebGPU → WebGL2 exercés |
| Physique | Fusion à trois entre METAL `731ace7`, EMPRISE `672bb46` et METAL `474aa08` : articulations, requêtes, événements de contact, réveil local ; conservation des statiques orientées et de `bodyInto` EMPRISE | Tests donneur et comparaison des états physiques du pilote ; TODO historique de pente conservé |
| Géométrie | Carènes, tubes, profils et normales BITUME ; source finale identique à la copie EMPRISE, devenue module commun `FGeometry` | Comparaison directe des sources et régressions modèles du pilote |
| Navigation | Champs de direction PDR ; source finale identique à la copie EMPRISE, devenue `FNavigation` | Régressions du pilote et équivalence avec la source PDR |
| Matériaux | Générateur EMPRISE extrait en `FMaterials`, banque passée explicitement aux deux renderers ; ancien accès RADE conservé pour compatibilité | Sortie procédurale inchangée ; chargement sans namespace RADE vérifié dans le harnais commun |
| Entrées | Module générique METAL récent, avec les adaptations EMPRISE fusionnées | Tests FInput et commandes du pilote, y compris après remplacement du canvas |
| Mouvement et effets | Modules génériques fusionnés ; les effets utilisent le constructeur de maillage commun | Tests donneur et scénario réel EMPRISE |
| Audio | Noyau METAL récent fusionné ; conservation du compteur de voix par cue EMPRISE ; préparation PCM, mixage et cycle de vie | Suite audio du donneur exécutée sur le module fusionné |
| Musique | Transport et transitions adaptatives METAL, bibliothèque optionnelle ; pas d’ajout automatique de bande-son à EMPRISE | 46 tests du transport, du directeur de transitions et de la préparation PCM réussis |
| Recettes | Format v1 déterministe partagé, indépendant de l’éditeur | Les tests du premier jalon restent disponibles |

Les adaptations des règles de jeu, armes, véhicules, personnages, météo et foules restent dans le pilote. Une classe de personnage ou une règle de course ne devient pas arbitrairement une règle du moteur commun.

## API hôte

```html
<script src="ferro-runtime.js"></script>
```

```js
const {renderer, activate} = await FERRO.createRenderer(canvas, {backend: 'auto'});
const generated = FERRO.compileRecipe(recipe);
renderer.setWorld(generated.meshes, [], environment);
await activate();

const physicalWorld = FERRO.createPhysics({
  bounds: {minX: -30, maxX: 30, minZ: -30, maxZ: 30}, ground: 0
});
const navigation = FERRO.navigation;
const forms = FERRO.geometry;
const audio = FERRO.createAudio(gameAudioOptions);
```

Le résultat de création du renderer conserve le contrat du pilote : canvas éventuellement remplacé, raison de repli, puis `activate()` après installation de la scène. Le jeu reste propriétaire de l’horloge et des événements. `FERRO.capabilities()` indique les modules chargés. Les noms historiques (`FPhysics`, `FInput`, `BITUME.carene`, `PDR.nav`, etc.) sont des alias de la même implémentation, conservés pour migrer les hôtes sans dupliquer le moteur.

Les nouveaux mondes créés par `FERRO.createPhysics` activent la géométrie et les budgets. Les anciens mondes d’EMPRISE utilisent encore leur profil compatible via `FPhysics.create`, ce qui préserve leurs sauvegardes et leurs états physiques. Les fonctionnalités nouvelles sont exercées dans les tests ; leur activation progressive dans le gameplay doit être mesurée. Un budget ne gèle jamais arbitrairement un objet en chute ; l’excès inévitable est signalé.

## Validation et provenance

Sources figées : EMPRISE `672bb463466584f997ea572e40d48b149009bffe`, METAL `474aa08bd4bf717947fa794bd50fe0484b97eab0`, BITUME `365b3e2d43c9d4fd84a81c7d7974b62c2a906129`, Point de rupture `5ba44c9d2f9c667eac687b9d0fa2f170606ce2f8`. La collection initiale et ses 113 empreintes restent dans `docs/ferro-editor/sources-20261116.json`.

La fusion physique conserve exactement les états/contacts du test EMPRISE sur 360 pas et du scénario urbain lourd sur 900 pas. Les nouveaux compteurs d’événements et de joints sont vérifiés séparément : leur apparition est une fonctionnalité, pas une modification des états physiques. Le plafond de taille source du test donneur passe de 80 000 à 82 000 octets pour accueillir les deux APIs EMPRISE conservées ; les contraintes de calcul et de déterminisme restent inchangées. Aucun échec numérique n’a été masqué.

Le bilan détaillé est enregistré dans `docs/ferro-unified/validation.json`. Les suites finales couvrent **262 tests réussis, aucun échec et un TODO physique historique**, ainsi que 13 scripts de régression du pilote, les comparaisons physiques sur 360/900 pas et les scénarios navigateur. Le paquet autonome charge dans Node sans `window`, puis affiche 25 objets et deux couches PBR procédurales dans Chrome sur WebGL2 et WebGPU, sans namespace `RADE`. Le build final d’EMPRISE passe la perte réelle du device WebGPU, le repli WebGL2 et les commandes après remplacement du canvas.

Les 197 tests d’audio, entrées, mouvement, effets et musique utilisent un harnais figé du donneur avec les modules communs substitués ; cela ne signifie pas que le jeu METAL public a été modifié. `tools/check-ferro-donor.py --metal /chemin/du/depot/metal` reconstruit ce harnais depuis le commit collecté. Il adapte uniquement l’accès aux exports du renderer et la lecture de ses indices : le moteur commun utilise des indices 32 bits, le donneur supposait 16 bits. Les assertions physiques et visuelles restent intactes. Les tests d’acteurs exécutés pendant l’exploration ne sont pas comptés dans ce bilan : ce module de contenu n’a pas été remplacé dans le pilote.

Un premier processus de test audio s’est interrompu lors de l’exécution groupée ; la suite audio isolée a ensuite réussi intégralement. L’essai hors navigateur a trouvé une dépendance globale implicite de l’audio à `window`, corrigée par le même paramètre d’environnement que les autres modules. Les logs finaux et ceux des étapes antérieures restent conservés dans le dossier de travail.

Le Spark a été consulté pour les conflits physiques. Sa proposition confondait `bodyInto` et `sample` et n’a pas été appliquée. La résolution conserve les fonctions donneur, le wrapper `body` et le vrai corps `bodyInto` EMPRISE ; les tests exécutent le résultat réel.

## Travaux encore nécessaires avant propagation

1. Unifier les interfaces de terrain/lots, la foule et ses adaptations WebGPU, ainsi que la conduite et les obstacles de BITUME. Conserver les capacités présentes dans EMPRISE, comparer les derniers ajouts avant tout remplacement.
2. Comparer les sondes locales et SSR de METAL au rendu EMPRISE, mesurer coût et image sur des scènes communes, puis intégrer les apports justifiés sur les deux backends.
3. Qualifier les nouvelles options physiques dans le gameplay du pilote, les limites de pente, les sauvegardes et les scènes lourdes. Les performances universelles, tous matériels confondus, ne sont pas démontrées.
4. Préparer les adaptateurs et tests de migration METAL, BITUME et PDR ; installer exactement la même version des modules communs, avec retour arrière. Ne pas réintroduire des variantes de code moteur propres aux jeux.
5. Reprendre ensuite les fonctions avancées de l’éditeur, qui consommera ce moteur et ses recettes.

Commandes principales de reproduction depuis les sources (Node, Python et Chrome local ; aucun service HTTP nécessaire). Le build et la reprise du pilote nécessitent le checkout EMPRISE complet ; l’archive runtime seule sert à intégrer le moteur dans un hôte.

```sh
python3 tools/build-ferro-runtime.py
node --test tests/ferro/*.test.mjs
python3 tests/ferro-runtime-browser.py
python3 tools/check-ferro-donor.py --metal /chemin/du/depot/metal
python3 build.py
python3 tests/render-recovery.py --label ferro-unified-final-recovery --cases device-lost adapter-rejected
```

La version publique de l’éditeur sur `ferro.estrasse.fr` reste le jalon 0.1 validé. Ce candidat moteur et son pilote isolé ne remplacent pas les jeux publiés. Le dépôt de travail reste celui d’EMPRISE ; aucun ancien dépôt central FERRO supprimé n’est recréé.
