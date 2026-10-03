# État du projet SportNutritionApp

Dernière mise à jour : 3 octobre 2026

Ce document est la source de vérité de continuité pour le produit, son
architecture, ses invariants et sa roadmap. En cas de divergence, vérifier
l’Issue en cours et le code sur `main`; les notes historiques restent datées.

## Identité et objectif

SportNutritionApp est une PWA personnelle de suivi des séances de musculation
et, à terme, de la nutrition. L’application active est une PWA mobile-first,
principalement destinée à l’iPhone installée depuis Safari et utilisée en mode
standalone, en portrait. Le dépôt utilise React 19, TypeScript 6 et Vite 8; il
n’y a pas de backend applicatif. Les dépendances d’exécution sont React et
ReactDOM.

La partie Musculation est utilisable : préparation des séances, exercices,
séries, exécution et suivi des timers. Nutrition reste désactivée/non
implémentée dans l’application. Les spikes Ciqual et Open Food Facts dans
`docs/` sont des recherches, pas des intégrations produit.

## Baseline stable

- Branche stable : `main`.
- État : les issues #61/#62 et #63/#64 sont livrées dans `main`; l’issue #65 est active.
- Commit de référence : `4563b9c8e4fde204d38da2439243b4aab4f1a031`.
- CI de référence : Web CI post-merge #110 réussie sur `99c2a5230914818741da5d0e96528eef84af1806`. Le job Ubuntu / Node 20 exécute format, lint, Vitest et build; il ne lance pas Playwright.
- Référence Vitest de la PR #58 : 127/127. `npm run lint` conserve un avertissement Fast Refresh préexistant dans `src/OrientationGuard.tsx`, sans erreur.
- Validation Playwright de la PR #58 : scénarios ciblés mouvement Chromium et WebKit 12/12 à 320 et 390 px. La suite complète n’a pas été relancée pour son dernier diff ; le run précédent était à 143/146, les cas restants ayant réussi au rejeu documenté.

## Stack et points d’entrée

- `src/main.tsx` : montage React et enregistrement du service worker.
- `src/App.tsx` : shell, écrans de bibliothèque/préparation/exécution et orchestration UI.
- `src/storage/database.ts` : modèles, transitions métier et persistance.
- `src/BottomSheet.tsx`, `src/SetValuePicker.tsx`, `src/ConfirmationDialog.tsx` : feuilles, pickers et confirmations.
- `src/BottomNavigation.tsx`, `src/ExerciseNavigator.tsx`, `src/WorkoutProgress.tsx`, `src/ActiveRestTimer.tsx` : navigation, navigation des exercices, progression et repos.
- `src/ActiveWorkoutCapsule.tsx` (livré par l’issue #48) : reprise visuelle de la session active, sans stockage propre.
- `src/index.css`, `src/App.css`, `src/redesign-v2.css` : styles; la feuille redesign contient des couches cumulatives et des corrections mobiles.
- `public/manifest.webmanifest`, `public/sw.js`, `public/icons/` : installation et cache PWA.
- Configurations : `vite.config.ts` configure Vitest; `tsconfig*.json`, `eslint.config.js`, `.prettierignore`, `playwright.config.ts` et `.github/workflows/web.yml` décrivent compilation, qualité et navigateur.

Scripts principaux dans `package.json` : `npm run dev`, `npm run format:check`,
`npm run lint`, `npm test -- --run`, `npm run build` et `npm run test:e2e`.

## Fonctionnalités livrées

Les jalons utiles pour situer l’implémentation sont le pivot React/PWA
[#32](https://github.com/Stretcho299/SportNutritionApp/pull/32), la séparation
des templates et sessions [#40](https://github.com/Stretcho299/SportNutritionApp/pull/40),
le redesign mobile [#42](https://github.com/Stretcho299/SportNutritionApp/pull/42),
le lifecycle actif [#43](https://github.com/Stretcho299/SportNutritionApp/pull/43),
les modifications en cascade [#44](https://github.com/Stretcho299/SportNutritionApp/pull/44),
la navigation flottante [#45](https://github.com/Stretcho299/SportNutritionApp/pull/45)
et le démarrage/chrono persistant [#47](https://github.com/Stretcho299/SportNutritionApp/pull/47). Les références et
rapports détaillés restent dans l’historique de ces PRs; cette liste ne remplace
pas leur lecture lorsqu’un changement les concerne.

- Création et organisation de templates de séances; exercices et séries
  planifiées; préparation directe de la première séance.
- Démarrage explicite : ouvrir/préparer un template ne crée pas de session.
  Un template ayant un historique terminé conserve sa preview et propose de
  préparer une séance.
- Exécution avec états de séries `upcoming`, `active`, `resting`, `performed`,
  `skipped`, états d’exercices, progression, suppression/ajout encadrés et fin
  anticipée confirmée.
- Reprise de la même session active; abandon explicite et persistant; fin
  confirmée et immuable. Les sessions abandonnées sont conservées, mais ne
  comptent pas comme séance terminée pour l’état « première séance ».
- Notes permanentes d’exercice conservées sur le template et recopiées dans le
  snapshot d’une nouvelle session; notes propres à chaque session séparées et
  conservées dans cette session.
- Modification des valeurs KG/REPS/REPOS sur la série sélectionnée ou sur
  celle-ci et les suivantes en ordre affiché. Les modifications actives sont
  synchronisées vers les valeurs planifiées du template par IDs; les sessions
  historiques et snapshots restent indépendants.
- Repos basé sur `restEndsAt` et `restDurationSeconds`, donc restaurable après
  navigation/rechargement; une seule série peut être en repos à la fois. Le
  repos final inutile n’est pas lancé.
- Chrono global dérivé de `startedAt`, incluant le repos, resynchronisé au retour
  au premier plan/pageshow/visibilité. Une session complétée fige sa durée avec
  `completedAt`; le compteur n’est pas une source de vérité incrémentale.
- BottomSheets avec fermeture au tap sur le backdrop ou par glissement
  vers le bas de la poignée, gestion du focus et contenu défilant (#59).
- Gestion iPhone du clavier via `visualViewport`; `useBodyScrollLock` verrouille
  le fond et restaure les positions et styles mémorisés, y compris les
  conteneurs imbriqués.
- Navigation basse flottante glass/lens avec scrub/hold-slide, capture du
  pointeur, minimisation à la descente et retour à l’approche du haut; respecte
  `prefers-reduced-motion`. Musculation est active, Nutrition désactivée.
- L’issue [#48](https://github.com/Stretcho299/SportNutritionApp/issues/48) est livrée dans `main` via la [PR #51](https://github.com/Stretcho299/SportNutritionApp/pull/51).
  Après les tests physiques iPhone, le dashboard dispose d’une composition
  verticale des quatre modules existants : Mes séances en carte principale,
  puis Calendrier, Performances et Trophées toujours marqués « Bientôt ».
  Ce contenu permet un scroll réel; le second tap Musculation remonte en haut.
  Le gros bloc actif « Séance en cours » a été retiré du dashboard.
  La capsule devient le point principal de reprise hors détail actif : nom
  ellipsé, chrono à droite, progression des séries et point orange pulsant.
  Sa lentille statique reprend le matériau glass de la navigation sans ses gestes
  horizontaux. Les animations sont désactivées en reduced-motion.
  La règle finale du header dépend uniquement de l’écran : effet compact,
  sticky, surface/fade, blur et scale `0.95` sur le dashboard (`list`),
  Mes séances (`workouts`) et l’aperçu (`preview`). Tout écran de détail
  (`detail`) garde un header normal et un titre strictement stable, en
  préparation comme en exécution `inProgress`/`readyToFinish`, sans effet
  lié au scroll. Le dashboard, le retour animé en haut, la capsule et les
  interactions ont été validés physiquement sur iPhone avant merge.
- `ExerciseNavigator` distingue sélection et statut d’exécution; le long press
  tactile (300 ms, tolérance de mouvement de 8 px) démarre le reorder, avec
  clone et auto-scroll horizontal près des bords (44 px).
- PWA française en mode `standalone` portrait. Le service worker utilise un
  cache shell, remplit son cache depuis le réseau pour les GET same-origin et
  sert la dernière réponse en cache ou le shell en mode hors ligne.

## Architecture de stockage et invariants

### Templates, sessions et snapshots

`WorkoutTemplate` contient la séance réutilisable (nom et exercices planifiés).
Chaque `WorkoutSession` référence son template et possède son propre snapshot,
son exécution, ses timestamps et ses notes de séance. Le type `Workout` reste
une vue de compatibilité utilisée par l’UI; ne pas confondre cette vue, un
template et une session historique.

Le statut d’exécution est `inProgress`, `readyToFinish` ou `completed`; une
session peut également être `abandoned`. `inProgress` et `readyToFinish`
comptent comme actives. Le stockage refuse plus d’une session active à la fois.
Une session terminée/abandonnée ne doit pas être réécrite par les changements
ultérieurs du template.

### Valeurs, notes et timers

- Les IDs relient les séries prévues, exécutées et les valeurs propagées.
- Une modification de repos planifié ne décale pas le timer actif, basé sur son
  timestamp de fin.
- Le repos et le chrono global dérivent d’horodatages persistés; à la reprise,
  ne jamais recréer ni décaler `startedAt` ou `restEndsAt`.
- La capsule de continuité est une vue de l’unique session `inProgress` ou
  `readyToFinish`. Son temps est calculé depuis le même `startedAt` et le clock
  global; elle ne crée ni ne modifie une session. Elle est cachée dans le détail
  de cette session et pendant les BottomSheets, pickers et confirmations.
  Sa progression est dérivée de l’exécution, sans donnée persistée supplémentaire :
  `performed` et `skipped` comptent comme terminées, les autres statuts comme
  restantes. Les séries archivées sont incluses, comme dans `WorkoutProgress`.
  La réserve de scroll augmente uniquement lorsque la capsule est visible pour
  garder le contenu inférieur atteignable au-dessus des deux éléments flottants.
- Notes permanentes et notes de session ont des portées distinctes; une note de
  séance ne doit pas se retrouver sur le template.
- Les valeurs manquantes (`null`) et les zéros explicites sont différents.

### Stockage

IndexedDB : base `sport-nutrition`, version 2, object store `data`, clé
`sport-nutrition-workouts`. `WorkoutStore` est versionné et contient
`templates`, `sessions` et, depuis #59, des `customDefinitions` optionnelles. Les tableaux d’anciens objets Workout sont migrés
vers cette enveloppe lors du chargement. Si IndexedDB n’est pas disponible,
l’application utilise localStorage avec la même clé logique et le format v2.
Préserver les données legacy et l’idempotence de migration; aucun changement de
schéma sans issue et tests dédiés.

### iPhone, scroll et viewport

- Le shell utilise `100lvh` pour disposer dès le premier rendu de la grande
  hauteur de viewport iOS, avec fallback `100dvh` si `lvh` n’est pas supporté.
  Des règles CSS historiques en `100dvh` subsistent : ne pas décrire ce choix
  comme un remplacement global de toutes les hauteurs.
- Ne pas restructurer `.workout-fixed-zones` ou le scroll local de
  `.planned-sets` sans nécessité démontrée.
- À l’ouverture d’un BottomSheet/picker/confirmation, le fond doit rester à ses
  positions exactes; un pan natif du viewport visuel iOS ne doit pas déplacer le
  document ou combattre le clavier.
- Navigation basse : préserver hit targets, scrub/hold-slide, arbitration du
  scroll, lens, minimisation et offsets historiques.
- Le header compact est explicitement autorisé par `data-compact-header`
  uniquement lorsque `screen !== "detail"` : dashboard, Mes séances et preview.
  Son état scrolled suit le document. Sur tout `detail`, préparation ou séance
  active, aucun suivi visuel de scroll du header n’est installé : géométrie et
  titre restent identiques avant/après scroll, sans scale, translation,
  compactage ou surface/fade lié au scroll de `.planned-sets`.
  Les fixed zones, le scroll local et les safe areas sont préservés. L’onglet
  Musculation conserve le retour depuis les sous-vues; sur le dashboard actif,
  il remonte le document en haut et respecte reduced-motion.
- ExerciseNavigator : conserver les gestes touch/pointer, long press,
  auto-scroll et restrictions de reorder selon l’exécution. La sélection d’un
  exercice n’active pas son avancement.
- Les BottomSheets se ferment au tap direct sur leur backdrop; un tap interne
  ne ferme pas la feuille. Le drag de poignée reste disponible.

## État actuel et roadmap

### Dernier jalon livré : issue #48

[Issue #48 — moderniser la navigation iOS et la continuité de la séance active](https://github.com/Stretcho299/SportNutritionApp/issues/48) est **CLOSED** et livrée dans `main` via la PR #51. Le commit de merge de référence est `e6aec5939d3baf02e95fdb3383cd2c37a8d883be`.

Le périmètre livré comprend le header compact sur dashboard/Mes séances/preview,
le header stable sur `detail`, le retour en haut via second tap Musculation,
le dashboard vertical et la capsule de continuité enrichie. Les zones tactiles
stabilisées restent gelées : BottomSheet, clavier/visualViewport,
`useBodyScrollLock`, backdrop, ExerciseNavigator/reorder, set pickers, timers,
lifecycle, stockage, cascade KG/REPS/REPOS, glass/lens, offsets et
`100lvh`/`100dvh`, sauf nécessité directement démontrée.

### Issues #52 reportée ; #55/#56, #57/#58, #59/#60, #61/#62 et #63/#64 livrées ; passe active #65

[Issue #52 — évaluer les retours haptiques pour la PWA](https://github.com/Stretcho299/SportNutritionApp/issues/52) est **CLOSED / not planned** pour la PWA actuelle. WebKit sur iPhone ne fournit pas la Web Vibration API standard utilisée par l’expérimentation : `navigator.vibrate` est absent dans le WebKit local et l’essai physique de la PWA standalone n’a produit aucune vibration.

La [PR #54](https://github.com/Stretcho299/SportNutritionApp/pull/54) a été fermée sans merge ; son code n’appartient pas à `main`. Les haptics sont reportés à une future véritable application ou couche native. Aucun retour haptique n’est simulé dans la PWA actuelle.

[Issue #55 — synchroniser le compte à rebours du repos au démarrage](https://github.com/Stretcho299/SportNutritionApp/issues/55) est **livrée** dans `main` via la [PR #56](https://github.com/Stretcho299/SportNutritionApp/pull/56), merge `8d73232a18f45f8049ac10f019142a89fb0dcccf`. Le bug avait été observé physiquement sur iPhone avec un repos de 2 secondes : l’affichage pouvait commencer à 3, puis passer à 2 et 1 avant la fin. `Math.ceil` n’était pas intrinsèquement fautif : le `clock` d’affichage pouvait être ancien de plusieurs centaines de millisecondes lorsque `restEndsAt` était créé au clic, ce qui faisait calculer plus que la durée réellement restante.

La correction capture un timestamp unique dans `startRest`, synchronise immédiatement le `clock` avec lui et transmet ce même instant à `startExecutedSetRest`, qui conserve la deadline absolue persistée `restEndsAt`. La durée réelle et la transition à l’échéance restent inchangées. Les resynchronisations foreground, `pageshow`, `visibilitychange`, le verrouillage, le reload et la reprise continuent de s’appuyer sur la deadline persistée existante. La Web CI #105 sur la PR #56 réussit, Vitest passe 125/125 et les scénarios E2E ciblés du compteur et de persistance/reload passent dans Chromium et WebKit. La suite complète #56 termine à 132/134 : deux crashes de cible WebKit hors timer réussissent chacun au rejeu isolé sans changement de timeout. La validation physique iPhone est terminée et acceptée, avec la réserve de 2 secondes décrite ci-dessus.

[Issue #57 — unifier le mouvement des écrans et la continuité visuelle](https://github.com/Stretcho299/SportNutritionApp/issues/57) et #58 sont livrées dans `main@99c2a5230914818741da5d0e96528eef84af1806`.

[Issue #59 — fondation catalogue d'exercices](https://github.com/Stretcho299/SportNutritionApp/issues/59) et sa [PR #60](https://github.com/Stretcho299/SportNutritionApp/pull/60) sont livrées dans `main@d0c53bf611e5c7173ad31d5f985726af509c084d`. Elles ajoutent un catalogue officiel local de 69 exercices consultables, un registre d'exercices personnalisés créables/modifiables/supprimables et deux niveaux de taxonomie musculaire. Les occurrences dans les templates et snapshots de sessions embarquent une copie de la définition au moment de l'ajout; les anciennes occurrences libres restent sans association automatique. La base IndexedDB reste en version 2 avec un champ optionnel `customDefinitions` dans l'enveloppe. Voir `docs/exercise-catalog-sources.md` pour les références et licences.

La sélection catalogue distingue explicitement l’ajout et le remplacement. En préparation, remplacer un officiel conserve l’occurrence, sa position, ses séries et leurs repos, et efface ses anciennes charges/répétitions et notes. Modifier une définition custom propage son nom et son snapshot vers les occurrences de tous les templates, sans réécrire les sessions historiques. Les exercices officiels portent aussi un identifiant d’illustration local optionnel ; l’icône haltère reste le fallback jusqu’à une passe dédiée aux assets et licences.

Pendant une séance active, un exercice peut être remplacé tant qu’aucune de ses séries n’est `performed`, `skipped` ou `resting`. Une fois du travail terminal enregistré, son identité est figée afin de préserver l’intégrité historique. Les occurrences legacy restent non modifiables pendant l’exécution.

Le catalogue présente désormais les exercices personnels et officiels dans deux sections filtrées indépendamment par la même recherche. Chaque résultat réserve un emplacement visuel réutilisable avec l’icône haltère en fallback ; les assets réels restent reportés à une passe dédiée aux illustrations et licences.

Les issues #61/#62 sont livrées dans `main@f48d837cbc40caa968f8262aa94c33417edff292`. Le swipe d’une séance révèle « Supprimer » sans supprimer automatiquement; le tap supprime immédiatement sans confirmation. Le dépassement élastique reste visuel pendant le drag, avec une position ouverte logique de 102 px. Le reorder de la timeline peut atteindre les éléments hors viewport en un seul maintien avec auto-scroll.

Les issues #63/#64 sont livrées dans `main@4563b9c8e4fde204d38da2439243b4aab4f1a031` : la palette sombre + orange est centralisée dans des primitives et des rôles sémantiques, avec le rendu de référence préservé. La personnalisation utilisateur Sombre/Clair + accent reste future. `docs/theme-tokens.md` décrit le contrat des tokens.

L’issue #65 est active : le Catalogue 2.0 devient une page mobile plein écran et dense. La sélection conserve les règles d’ajout/remplacement et les feuilles de configuration et formulaires custom existantes. Favoris/Récents restent futurs.

### Étapes futures

Après le Catalogue 2.0, la personnalisation utilisateur Sombre/Clair + accent reste une passe ultérieure. Les autres axes ci-dessous restent futurs; aucun ordre après le Catalogue 2.0 n’est confirmé :

- Favoris et exercices récents dans le catalogue.
- Résumé enrichi de fin de séance et consultation UI de l’historique. L’écran
  affiche déjà « Séance terminée », mais les données de sessions n’ont pas
  encore de bilan détaillé ni d’expérience d’historique dédiée.
- Statistiques agrégées et progression dans le temps. La progression de la
  séance en cours existe déjà.
- Calendrier et trophées.
- Bilan et historique enrichis, carte musculaire, Preview enrichie et Performances
  à partir des snapshots autonomes.
- Supersets, trisets et circuits.
- Module Nutrition. Aucune recherche alimentaire n’est intégrée; les documents
  Ciqual/Open Food Facts sont des spikes exploratoires.

### Legacy — hors travail PWA actif

- L’issue [#29](https://github.com/Stretcho299/SportNutritionApp/issues/29) et
  la PR [#30](https://github.com/Stretcho299/SportNutritionApp/pull/30), encore
  ouvertes sur `ci/29-record-workout-flow`, concernent la CI SwiftUI/XCUITest et
  l’enregistrement vidéo du prototype pré-pivot. Elles ne sont pas le travail
  actif de l’application PWA. Ne pas fermer ni supprimer ces éléments dans une
  tâche sans lien.
- Le prototype iOS historique est conservé dans
  `archive/ios-swiftui-prototype-2026-09-14`. Les branches
  `feature/7-ios-swiftui-ci` et `feature/9-workout-swiftdata` sont aussi des
  branches historiques. Ne pas les supprimer au titre d’une tâche documentaire.
- `docs/visual-redesign.md` conserve le contrat de la refonte #38 et son ancien
  état IndexedDB v1; `docs/codex-tooling-audit.md` conserve l’audit machine du
  13 septembre, y compris les anciennes références SwiftUI/macOS. Ils sont
  explicitement historiques, pas l’état actuel.

## Vérifications

À lancer selon le périmètre de l’Issue :

```bash
npm run format:check
npm run lint
npm test -- --run
npm run build
git diff --check
npm run test:e2e -- --workers=1
```

Vitest utilise jsdom et inclut `src/**/*.test.{ts,tsx}`. Playwright utilise une
preview du build, un worker, timeout 30 s et les projets Chromium/WebKit avec
appareil iPhone 13. Il n’est pas lancé par le workflow GitHub; cibler les specs
et dimensions pertinentes, puis lancer la suite complète lorsqu’exigé par
l’Issue. Des tests E2E ciblés et une validation iPhone physique restent
distincts.

## Pour un nouveau chat Codex

1. Lire `AGENTS.md`, puis ce `PROJECT_STATUS.md` pour connaître les règles, la
   baseline, les invariants et la prochaine étape.
2. Lire intégralement l’Issue demandée et les commentaires pertinents.
3. Pour une tâche locale, lire uniquement les fichiers source, tests et config
   concernés; pour une tâche globale, suivre les références des sections
   ci-dessus et ne relire que les documents historiques pertinents.
4. Vérifier `git status`, branche et `origin/main`; créer une branche liée à
   l’Issue depuis `main` à jour avant toute modification.
5. Exécuter les vérifications adaptées, relire le diff complet, mettre à jour
   ce fichier si l’état, la roadmap ou un invariant change substantiellement,
   puis ouvrir une PR liée à l’Issue. Ne jamais merger sans autorisation
   explicite.
