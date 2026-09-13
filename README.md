# SportNutritionApp

Application iPhone de suivi de musculation et de nutrition.

## État du projet

Projet en cours de développement.

MVP :
- suivi d'une séance de musculation ;
- suivi nutritionnel quotidien ;
- stockage local ;
- recherche alimentaire via une base externe.

## Stack prévue

- Swift
- SwiftUI
- SwiftData

## Initialisation iOS

Le projet Xcode `SportNutritionApp.xcodeproj` cible uniquement l’iPhone
(`TARGETED_DEVICE_FAMILY = 1`) et iOS 17 ou ultérieur. Le squelette SwiftUI
présente les deux domaines du MVP documenté : **Séances** et **Nutrition**.
Il ne contient volontairement ni données, ni stockage, ni fonctionnalité métier.

Le développement quotidien se fait sous Ubuntu : Xcode et le simulateur iOS ne
sont donc pas disponibles localement. La vérification de référence est la
GitHub Action [iOS CI](.github/workflows/ios.yml), qui exécute réellement :

```bash
xcodebuild test -project SportNutritionApp.xcodeproj -scheme SportNutritionApp \
  -destination 'platform=iOS Simulator,id=<UDID_D_UN_IPHONE_DISPONIBLE>' \
  CODE_SIGNING_ALLOWED=NO
```

Elle choisit automatiquement un simulateur iPhone présent sur le runner `macos-15`.
Le dépôt public n’exige aucun secret, compte de signature ou service macOS payant.

## Capture visuelle de la CI

Les UI tests exécutent le parcours Séances sur le simulateur iPhone avec un
conteneur SwiftData en mémoire, activé uniquement par l’argument XCUITest
`-ui-testing`. Le stockage est donc vide et déterministe, sans créer de données
de test dans l’application normale. Les tests conservent des captures PNG de
l’état vide, de la liste, du détail de séance, du détail d’exercice et du
formulaire d’ajout de série.

La CI les exporte dans l’artifact unique
**`iphone-simulator-workout-screenshots`** ; aucune image n’est ajoutée au dépôt
Git. Pour le récupérer depuis GitHub, ouvrez l’onglet **Actions**, sélectionnez
une exécution du workflow **iOS CI**, puis téléchargez
**`iphone-simulator-workout-screenshots`** dans la section **Artifacts**, en bas
de la page de l’exécution. L’archive contient les PNG nommés par le UI test.
