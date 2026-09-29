# État du projet SportNutritionApp

Dernière mise à jour : 29 septembre 2026

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
- État : `main` inclut les PRs [#47](https://github.com/Stretcho299/SportNutritionApp/pull/47) et [#50](https://github.com/Stretcho299/SportNutritionApp/pull/50), au 29 septembre 2026.
- Commit de référence de `main` avant l’issue #48 : `690548745d3c71e33bef03432a6db62120204f7d` — merge de la documentation projet #50, après le jalon fonctionnel #47 (`875c68735f55b1c9a417322f8da21f17c81a04e4`).
- Dernière exécution CI connue sur le jalon #47 : [Web CI réussie](https://github.com/Stretcho299/SportNutritionApp/actions/runs/36541064838). Le job Ubuntu / Node 20 exécute format, lint, Vitest et build; il ne lance pas Playwright. Consulter l’historique Actions pour le statut du commit courant.
- Référence Vitest : 108 tests passent. `npm run lint` conserve un avertissement Fast Refresh préexistant dans `src/OrientationGuard.tsx`, sans erreur.
- Historique Playwright de #47 : les scénarios ciblés ont été validés. Une exécution complète rapportée a fini à 102/104, avec deux problèmes WebKit décrits dans [la PR #47](https://github.com/Stretcho299/SportNutritionApp/pull/47) : fermeture de page/timeout sur le scrub de navigation à 390 px et différence de géométrie de 0,86 px sur une préparation dense. Le second a passé en relance isolée; le premier a été reproduit isolément. Ce sont des observations historiques de test, pas des régressions établies sur chaque commit de `main`.

## Stack et points d’entrée

- `src/main.tsx` : montage React et enregistrement du service worker.
- `src/App.tsx` : shell, écrans de bibliothèque/préparation/exécution et orchestration UI.
- `src/storage/database.ts` : modèles, transitions métier et persistance.
- `src/BottomSheet.tsx`, `src/SetValuePicker.tsx`, `src/ConfirmationDialog.tsx` : feuilles, pickers et confirmations.
- `src/BottomNavigation.tsx`, `src/ExerciseNavigator.tsx`, `src/WorkoutProgress.tsx`, `src/ActiveRestTimer.tsx` : navigation, navigation des exercices, progression et repos.
- `src/ActiveWorkoutCapsule.tsx` (issue #48 en cours) : reprise visuelle de la session active, sans stockage propre.
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
- BottomSheets avec backdrop sans fermeture au tap, fermeture par glissement
  vers le bas de la poignée, gestion du focus et contenu défilant.
- Gestion iPhone du clavier via `visualViewport`; `useBodyScrollLock` verrouille
  le fond et restaure les positions et styles mémorisés, y compris les
  conteneurs imbriqués.
- Navigation basse flottante glass/lens avec scrub/hold-slide, capture du
  pointeur, minimisation à la descente et retour à l’approche du haut; respecte
  `prefers-reduced-motion`. Musculation est active, Nutrition désactivée.
- L’issue #48 est en cours sur une branche dédiée : header sticky visuellement
  compacté au scroll sans changement de géométrie, second tap sur Musculation
  pour remonter au dashboard, et capsule de reprise de séance au-dessus de la
  navigation. La capsule utilise l’horloge globale issue de `startedAt`, se
  cache dans le détail de sa session et sous les overlays, et augmente la réserve
  de scroll uniquement lorsqu’elle est visible. Cette passe n’est pas encore
  mergée dans `main`.
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
- Notes permanentes et notes de session ont des portées distinctes; une note de
  séance ne doit pas se retrouver sur le template.
- Les valeurs manquantes (`null`) et les zéros explicites sont différents.

### Stockage

IndexedDB : base `sport-nutrition`, version 2, object store `data`, clé
`sport-nutrition-workouts`. `WorkoutStore` est versionné et contient
`templates` et `sessions`. Les tableaux d’anciens objets Workout sont migrés
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
- Le header normal suit le scroll du document; dans le détail, son état visuel
  suit exclusivement `.planned-sets`, sans changer les fixed zones, le scroll
  local, la géométrie du header ou les safe areas. L’onglet Musculation conserve
  le retour depuis les sous-vues; sur le dashboard actif, il remonte le document
  en haut et respecte reduced-motion.
- ExerciseNavigator : conserver les gestes touch/pointer, long press,
  auto-scroll et restrictions de reorder selon l’exécution. La sélection d’un
  exercice n’active pas son avancement.
- Les feuilles et pickers gardent leur backdrop NO-OP au tap; ne pas remplacer
  le drag de poignée par une fermeture au clic.

## État actuel et roadmap

### Travail fonctionnel en cours : issue #48

[Issue #48 — moderniser la navigation iOS et la continuité de la séance active](https://github.com/Stretcho299/SportNutritionApp/issues/48) est **OPEN** et constitue la passe active sur la branche dédiée `feat/48-ios-navigation-continuity`. Les changements attendent review et ne sont pas présentés comme mergés. Son périmètre confirmé :

1. Compacter le header et ajouter une séparation de bord haute discrète sans
   saut de layout ni changement de safe area/viewport.
2. Sur le dashboard Musculation déjà actif, un second tap sur son onglet
   remonte en haut; depuis une sous-vue, le tap continue de revenir au dashboard.
3. Ajouter au-dessus de la navigation une capsule de reprise seulement pour
   `inProgress`/`readyToFinish`, cachée dans le détail actif et sous tout modal.
   Elle réutilise `formatSessionDuration` et `startedAt` sans créer de session.
4. Ajouter des motions d’entrée/sortie et états actifs contenus, en respectant
   reduced-motion.

L’issue #48 gèle explicitement BottomSheet, clavier/visualViewport,
`useBodyScrollLock`, backdrop, ExerciseNavigator/reorder, set pickers, timers,
lifecycle, stockage, cascade KG/REPS/REPOS, glass/lens, offsets et
`100lvh`/`100dvh`, sauf nécessité directement démontrée. Ajouter cette passe
sans réécrire les interactions tactiles déjà validées.

### Étapes futures

Après validation de #48, la prochaine passe prévue poursuit le polish iOS avec
les haptics/vibrations. Les autres axes ci-dessous restent futurs; aucun ordre
au-delà de cette prochaine passe n’est confirmé :

- Motion, transitions et continuité visuelle plus larges.
- Haptique/vibrations dans une issue dédiée, après validation de #48.
- Résumé enrichi de fin de séance et consultation UI de l’historique. L’écran
  affiche déjà « Séance terminée », mais les données de sessions n’ont pas
  encore de bilan détaillé ni d’expérience d’historique dédiée.
- Statistiques agrégées et progression dans le temps. La progression de la
  séance en cours existe déjà.
- Calendrier et trophées.
- Catalogue/gestion globale d’exercices; les exercices sont actuellement gérés
  dans les templates.
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
