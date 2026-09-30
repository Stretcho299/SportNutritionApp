# Issue #52 — audit et expérimentation haptique

Audit du 29 septembre 2026, depuis `main` après #53
(`f9481143160db8c5abc1882e4a22efee7ec96903`).

## Capacité vérifiée avant intégration

Un script Playwright a interrogé les navigateurs installés, sans mock, avec
le profil iPhone 13 (émulation de viewport/user agent, aucun matériel iPhone).

| Navigateur local | `typeof navigator` | `typeof navigator.vibrate` | Mode |
| --- | --- | --- | --- |
| Chromium 153.0.8010.12 | `object` | `function` | navigateur |
| WebKit 26.6 | `object` | `undefined` | navigateur |

Les tests E2E vérifient également l’absence réelle de cette API dans WebKit
sur l’application construite et l’absence de crash dans le parcours complet.
Le mock Chromium vérifie les appels et leurs motifs, **pas le moteur physique**.

La [spécification W3C](https://www.w3.org/TR/vibration/) indique une
implémentation Chromium et une position WebKit opposée. La demande
[WebKit #288846](https://bugs.webkit.org/show_bug.cgi?id=288846) reste `NEW`
lors de l’audit. Aucun haptique Web standard n’est donc attendu sur la cible
Safari/iPhone/PWA. Le mode standalone n’ajoute aucune API native au code.
**Aucun iPhone physique ni mode standalone réel n’a été testé ici.**

La présence de l’API ne garantit ni matériel, ni autorisation, ni vibration.
Le navigateur requiert une activation utilisateur préalable (« sticky
activation »), une page visible et peut refuser l’appel. Les réglages système
(silence, vibrations, DND) dépendent du navigateur/matériel et restent à tester.
Aucun résultat sur ces réglages n’est déduit des mocks.

## Primitive progressive retenue

`src/haptics.ts` expose `triggerHaptic(kind): void`. C’est l’unique fichier
produit appelant `navigator.vibrate`. La détection de `navigator` puis d’une
fonction `vibrate` se fait à chaque appel. Une page cachée est silencieuse.
Une API absente, un retour `false` ou une exception n’interrompt aucune action.
Aucun retry, stockage, dépendance, réglage ajouté, ni association automatique
avec `prefers-reduced-motion`.

| Profil | Motif en millisecondes |
| --- | --- |
| `light` | `20` |
| `medium` | `50` |
| `success` | `[25, 35, 45]` (vibration, pause, vibration) |

Ces constantes règlent des durées, pas la puissance. La primitive est conservée
pour sa valeur progressive sur les plateformes Chromium compatibles : trois
profils dans un fichier, quelques hooks locaux, aucun changement de stockage
ou d’architecture PWA. Elle peut être désactivée ou ajustée depuis ce fichier.
Aucun hack iOS, checkbox, audio, focus artificiel, DOM trick, API privée,
wrapper, dépendance native ou animation simulant la vibration.

## Événements et priorités

| Événement réel | Retour |
| --- | --- |
| Montage de `ConfirmationDialog` | `medium`, une fois ; ref contre rerender/StrictMode |
| Nouveau démarrage de séance accepté | `light`, dans le handler, jamais à la reprise |
| Validation directe d’une série en `performed` | `light`, remplacé par `medium` si cette action termine l’exercice |
| Expiration naturelle du repos observée au premier plan | `light`, une fois |
| Fin de séance confirmée, transition `completed` et sauvegarde résolue | `success` |
| Prise du reorder après seuil du long press touch/pointer | `light`, une fois |

Le modèle existant marque normalement une série `resting` au clic « Lancer le
repos », puis `performed` seulement à la fin du repos. **Le début du repos est
silencieux.** La dernière série globale devient directement `performed` sans
repos final : son `medium` remplace le `light` de série.

Les priorités absolues du repos et des confirmations évitent les doublons :

- Expiration naturelle : un seul `light`, même si elle termine également la
  série et l’exercice. Aucun deuxième feedback d’exercice.
- Arrêt manuel : la confirmation « Mettre fin au repos ? » annonce un seul
  `medium`, comme tout `ConfirmationDialog`. Le clic « Mettre fin » et la fin
  manuelle du timer n’ajoutent aucun feedback, même s’ils terminent série/exercice.
- Fin explicite d’exercice : le dialogue annonce `medium`; son bouton qui
  ignore les séries restantes ne répète pas le retour.
- Suppression séance/exercice/série et abandon : dialogue `medium`, confirmation
  et annulation silencieuses. Aucun effet observant globalement les statuts.
- Fin de séance : dialogue `medium`, puis `success` après sauvegarde réussie.
  Aucune réussite tactile si la transition est refusée ou la sauvegarde rejette.
  L’erreur de sauvegarde est journalisée ; le lifecycle optimiste existant
  n’est pas refondu dans cette issue (pas de rollback ajouté).

Navigation basse/Musculation, scrub/hold-slide, scroll, sélection simple
d’exercice, BottomSheets, pickers (ouverture, défilement, sauvegarde), ticks,
début de repos, capsule, header, animations et retour en haut restent silencieux.
Le reorder ne vibre ni au mouvement, ni à l’autoscroll, ni au drop.

## Repos, arrière-plan et reprise

Les timestamps `startedAt`, `restEndsAt`, la persistance et les transitions
métier restent identiques. Le timer existant continue de régler un repos échu.
Seule l’éligibilité du feedback est transitoire, locale à l’effet :

1. Il faut avoir observé le repos **avant** son échéance avec la page visible.
2. Le tick d’expiration doit être visible et suivre cette observation d’au plus
   **1 500 ms** (intervalle existant de 1 s, tolérance de 500 ms).
3. Le retard sur l’échéance doit être au plus **1 500 ms**.
4. `visibilitychange`, `pagehide`, `pageshow` et `focus` désarment cette
   observation. Un tick visible avant une échéance future peut la réarmer.
5. Une garde locale empêche de traiter deux fois le même effet à zéro.
   Un nouvel effet sur une échéance déjà passée n’est pas armé.
6. Exception pour le repos de 0 s demandé à l’instant : une ref éphémère
   identifie exactement la série `resting` créée par ce clic. Elle autorise le
   `light` à son passage réel en `performed`, sous la même limite de retard de
   1 500 ms. Elle est consommée une fois et désarmée par les mêmes événements ;
   elle n’existe jamais au reload.

Au premier plan, une échéance suivie normalement produit un `light`. Un blocage
long de la boucle JS supprime prudemment le feedback, même sans événement de
lifecycle. Cachée, la page ne vibre pas. Écran verrouillé ou autre application,
JavaScript peut être suspendu : aucun code exécuté à temps, aucune garantie
ni tentative de notification tactile. Au retour après expiration, le modèle
se règle comme auparavant, sans rattrapage haptique. Un reload avec un repos
anciennement expiré reste silencieux. Aucun backend/Web Push ajouté.

Les tests avec fausse horloge et événements de lifecycle prouvent ces règles
logiques ; ils ne reproduisent pas les politiques de suspension d’un OS réel.

## Validation physique à réaliser sur la preview

1. Sur Safari iPhone puis la PWA standalone, relever modèle, version iOS et
   `typeof navigator !== "undefined"` / `typeof navigator.vibrate` via
   l’inspecteur distant si disponible ; noter séparément chaque mode.
2. Vérifier qu’une absence d’API laisse démarrage, séries, confirmations,
   clôture et reorder entièrement fonctionnels et sans vibration attendue.
3. Vérifier repos au premier plan, passage dans une autre app, écran verrouillé
   et retour après échéance : aucune vibration tardive à la réouverture.
4. Sur un appareil Chromium avec moteur et API disponibles, essayer les trois
   profils et les points listés ; noter autorisation et réglages système,
   puis tester silence/DND. Un retour API `true` ne prouve pas une vibration.
5. Rapporter les retours à conserver/supprimer après ressenti réel. Ne jamais
   remplacer le no-op iPhone par un contournement.
