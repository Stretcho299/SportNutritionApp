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

Après les tests, la CI démarre le simulateur iPhone, installe et lance
l’application, puis produit une capture PNG réelle. Elle est publiée sous le nom
exact d’artifact **`iphone-simulator-screenshot`** ; aucune image n’est ajoutée au
dépôt Git.

Pour la récupérer depuis GitHub : ouvrez l’onglet **Actions**, sélectionnez une
exécution du workflow **iOS CI**, puis, au bas de la page de l’exécution, ouvrez
la section **Artifacts** et téléchargez **`iphone-simulator-screenshot`**.
L’archive téléchargée contient le fichier `sport-nutrition-app.png`.
