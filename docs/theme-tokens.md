# Tokens de thème

`src/theme.css` est l’unique source des couleurs. Il est importé avant les
styles de base et de composants. La palette livrée reste sombre et orange ;
aucun réglage utilisateur n’est encore exposé.

## Deux niveaux

- Les primitives `--palette-*` représentent les valeurs de teinte exactes de la
  référence sombre + orange, regroupées par famille : neutres, accent, tons
  terre, succès, danger et tons froids.
- Les rôles sémantiques (`--background`, `--surface`, `--line`, `--text`,
  `--accent`, `--success`, `--danger` et `--chrome`) donnent aux couleurs
  principales un nom indépendant de leur usage dans un composant.
- Les gradients, ombres et compositions propres à un élément restent dans ses
  règles CSS ; leurs couleurs utilisent les primitives génériques au lieu de
  variables nommées d’après le composant.
- Les couleurs alpha dérivent du RGB de la primitive avec `rgb(from …)` afin
  de conserver les valeurs exactes de la baseline sans multiplier les tons par
  opacité. Cette syntaxe est vérifiée dans Chromium et WebKit.

Danger reste rouge (`#ff5258`, `#351719`, `#8c3035`) et succès reste vert,
indépendamment de l’accent. Les valeurs noires des ombres et masques restent des
effets visuels. Les valeurs structurelles de navigation et de viewport restent
dans `redesign-v2.css`.

## Taille et fidélité

La palette contient 237 primitives et 36 rôles sémantiques, soit 273 tokens,
contre 323 auparavant. Aucun token ne porte un nom de composant. Le total reste
au-dessus de la cible indicative de 120–140 parce que la baseline contient 237
valeurs RGB distinctes. Les représenter par moins de primitives exigerait de
fusionner des nuances, de changer leur rendu ou de laisser des couleurs hors de
la source centrale. Les valeurs actuelles sont conservées pour garder zéro
différence de couleur effective avec la baseline.

Un futur accent pourra remplacer la petite famille `--palette-accent-*` et ses
rôles sémantiques sans modifier les noms des composants. Danger et succès ont
leurs propres familles. Le mode clair et les préférences utilisateur restent
hors de cette passe.
