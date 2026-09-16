# Refonte visuelle Stitch

## Audit avant modification

Référence fonctionnelle : `feat/37-workout-execution`, commit `c846040` (PR #38,
issue #37). Le dépôt est une PWA React/TypeScript/Vite, malgré la description
SwiftUI historique de AGENTS.md. Les 36 tests Vitest passent avant modification.

Contrat de non-régression :

- Création, renommage, suppression confirmée et swipe des séances ; préparation
  des exercices, sélection indépendante, réordonnancement et suppression.
- Séries initiales vierges, distinction entre valeur absente et charge zéro,
  roues tactiles reps (0–24), charge (0–300 kg par 0,5 kg), repos (0–6 min,
  0–59 s) et repos hérité de la dernière série (y compris zéro).
- IndexedDB `sport-nutrition`, version 1, store `data`, clé
  `sport-nutrition-workouts` ; fallback localStorage. Aucun changement de schéma.
- Données prévues et exécutées séparées. États des séries : upcoming, active,
  resting, performed, skipped ; exercices : upcoming, active, completed.
- Seule la série active est modifiable pendant l’exécution. Repos fondé sur
  `restEndsAt`, conservé au rechargement, fin automatique ou anticipée, sans pause.
- Consulter un exercice ne l’active pas. Les progressions restent indépendantes.
  Ajout de séries/exercices pendant l’exécution, suppression des seules séries à
  venir, aucune activation incidente après suppression.
- Fin d’exercice : séries restantes skippées. Dernière série sans repos inutile,
  puis validation explicite et définitive de la séance.
- La série active peut être modifiée selon les règles existantes ; série traitée
  verrouillée, repos modifiable avant lancement seulement. Le carré ouvre une
  confirmation d’arrêt ; annuler laisse courir le même échéancier, confirmer
  appelle la transition existante de fin anticipée (jamais une pause).
- Confirmation commune pour suppression d’une séance, données non vierges,
  exercice ignoré et clôture. Suppression vierge et navigation vers la liste ne
  demandent pas de confirmation ; la progression est persistée automatiquement.
- Zones fixes (commandes, rail d’exercices, exercice sélectionné) distinctes de
  la liste verticale défilante des séries. Menus avec restauration du focus.

Limites existantes conservées : Nutrition renvoie à la liste ; options avancées
non implémentées ; ni statistiques, profil, calendrier ou historique distinct.
La couche de persistance n’attend pas la fin de transaction dans saveWorkouts ;
ce comportement préexistant ne fait pas partie de cette refonte.

## Stratégie

Remplacer la feuille de styles cumulative par des tokens globaux et des styles
de composants. Noir presque pur, surfaces charbon, orange vif et ambre,
Bebas Neue pour les titres, Plus Jakarta Sans pour l’interface. Pas de hero
photographique, données de démonstration ou nouvelles fonctionnalités.

Cartes compactes à trois mesures (répétitions, kg, secondes) et picker vertical
à inertie/snap natif, roues secondes/minutes, état textuel et
signal graphique. Rail de cercles reliés conservé, sélection distincte de
l’état d’exécution. Résumé de progression dérivé des états existants, avec
repos circulaire visible même en parcourant les séries ou un autre exercice.
La progression compte les séries traitées (effectuées ou skippées), sans
présenter les séries skippées comme des performances réalisées.

Validation : tests existants, contrôles de format/lint/build, parcours réels
Chromium et WebKit en 390×844 et 320 px, captures et mesures de géométrie,
défilement des séries et du rail, menus, reprise du chrono, clôture et reload.
PR dédiée basée sur la branche fonctionnelle ; aucun merge.

## Résultat et vérification

Les règles de transition métier, la base IndexedDB, le service worker et les
tests existants restent inchangés. Les titres, cartes, menus, navigation, icône et couleurs PWA
partagent le même design system. Polices locales sous licence OFL (environ
236 Ko au total), cache par le service worker existant après chargement.

Les 39 tests unitaires passent. Les parcours navigateur couvrent création,
sélection et persistance des valeurs, ajout de séries,
rail horizontal, noms longs, états, fin anticipée du repos, reprise après reload,
fin d’exercice, clôture et rechargement final. La géométrie est vérifiée en plus
des interactions : absence de débordement horizontal, zones fixes stables,
dernier bouton accessible au-dessus de la navigation, snap centré après swipe
sur Chromium, navigation clavier sur WebKit, chrono visible pendant
le défilement. Captures : accueil vide, bibliothèque, préparation, nom long,
liste défilée, repos, états, feuille en hauteur réduite, séance terminée.

Un passage sur le serveur de développement a été interrompu par une perte de
connexion Vite suivie d’un reload (confirmé par la trace). Les vérifications
finales utilisent le build de production ; Playwright lance désormais la preview
du build par défaut pour éviter cette interférence.

La CI accepte les PR vers une branche fonctionnelle pour vérifier cette PR
empilée sur #38. Les moteurs Chromium et WebKit sont explicitement sélectionnés.

Limite : WebKit avec dimensions et interactions mobiles constitue une émulation,
pas un iPhone physique. Le clavier iOS, les barres Safari et les safe areas
doivent également être validés humainement sur la preview. La hauteur 480 px
vérifie l’accès aux commandes et le scroll dans un espace réduit.
