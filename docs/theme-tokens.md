# Tokens de thème

`src/theme.css` est l’unique source des couleurs de thème. Il est importé avant
les styles de base et les styles de composants. La palette livrée reste sombre
et orange; aucun réglage utilisateur n’est encore exposé.

## Responsabilités

- `--background`, `--surface*`, `--line*`, `--text*` et `--muted*` décrivent les
  plans de fond, surfaces, séparateurs et niveaux de texte.
- `--accent*` couvre les actions, sélections, états actifs et leurs surfaces,
  bordures et glows. Les variantes orange restent groupées dans la palette pour
  qu’un futur choix d’accent puisse les adapter ensemble.
- `--danger*` reste rouge et `--success*` reste vert, indépendamment de
  l’accent.
- `--chrome*` décrit les surfaces translucides, reflets et scrims de la
  navigation, de la capsule et des couches fixes.
- Les valeurs noires utilisées uniquement pour les ombres, masques et
  assombrissements génériques ne sont pas des couleurs de thème.

Les valeurs structurelles de navigation et de viewport restent dans
`redesign-v2.css`; elles ne font pas partie de la palette.
