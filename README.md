# SportNutritionApp

PWA personnelle de suivi des séances de musculation et de la nutrition. Le prototype SwiftUI est préservé dans la branche `archive/ios-swiftui-prototype-2026-09-14`.

## Ubuntu

Node.js 20+ et npm sont les seuls prérequis :

```bash
npm install
npm run dev
```

Pour un iPhone sur le même réseau : `npm run dev -- --host`.

## Vérifications

```bash
npm run format:check
npm run lint
npm test
npm run build
```

Le build est dans `dist/`. La CI Linux exécute ces commandes sur les PR.

## iPhone et hébergement

Après déploiement HTTPS, ouvrir dans Safari, **Partager** → **Sur l’écran d’accueil** → **Ajouter**. Le manifest et le service worker préparent le cache offline. Cloudflare Pages est compatible sans backend ni secret : commande `npm run build`, dossier `dist`.

## Structure

- `src/App.tsx` : shell Séances / Nutrition ;
- `src/storage` : frontière pour la future persistance IndexedDB ;
- `public/manifest.webmanifest` et `public/sw.js` : PWA.
- `src/index.css` : tokens visuels et polices locales ; `src/App.css` : composants ;
- `src/WorkoutProgress.tsx` : affichage de la progression et du repos, dérivé des états métier.

## Design et contrôles mobiles

Le [contrat de non-régression et la stratégie visuelle](docs/visual-redesign.md)
documentent la refonte sombre/orange. Les polices Bebas Neue et Plus Jakarta Sans
sont incluses dans `public/fonts` avec leurs licences OFL, sans requête tierce.

`npm run test:e2e` vérifie les parcours sur Chromium et WebKit (installer les
navigateurs avec `npx playwright install --with-deps chromium webkit`). Les tests
du redesign couvrent 390×844, 320×844 et une hauteur réduite à 480 px ; leurs
captures et traces sont disponibles dans `test-results/`. Les noms utilisés
dans ces tests sont uniquement des fixtures et ne sont pas injectés dans l’app.

La base alimentaire restera une ressource distante/API et ne sera jamais téléchargée intégralement sur l’appareil.
