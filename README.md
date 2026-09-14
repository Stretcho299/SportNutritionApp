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

La base alimentaire restera une ressource distante/API et ne sera jamais téléchargée intégralement sur l’appareil.
