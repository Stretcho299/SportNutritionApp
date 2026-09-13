# AGENTS.md

## Projet

Application iPhone Sport & Nutrition développée en Swift et SwiftUI.

## Principes

- Respecter le périmètre du MVP.
- Préférer de petits changements ciblés.
- Ne pas ajouter de dépendances sans justification.
- Ne jamais ajouter de clé API, token ou secret au dépôt.

## Prise en charge autonome d'une Issue

Avant toute modification, lire l'Issue dans son intégralité, puis inspecter le code et la configuration concernés. Respecter strictement son périmètre et ne réaliser aucun changement sans rapport.

En cas d'ambiguïté bloquante, ou lorsqu'une décision fonctionnelle ou architecturale importante n'est pas couverte par l'Issue, la signaler et demander une décision plutôt que d'en inventer une. Les problèmes techniques découverts peuvent être corrigés de manière autonome s'ils restent dans le périmètre de l'Issue.

## Workflow Git

- Ne jamais travailler directement sur `main`.
- Vérifier l'état du dépôt avant de commencer et avant de terminer.
- Créer une branche dédiée, nommée de façon explicite et liée à l'Issue.
- Produire des commits compréhensibles et limités au périmètre de l'Issue.
- Inspecter le diff final avant le commit et le push.
- Pousser la branche et ouvrir une Pull Request liée à l'Issue.
- Ne jamais merger une Pull Request sans autorisation explicite.

## Qualité et vérifications

- Ajouter ou adapter les tests pertinents lorsque le changement le nécessite.
- Exécuter les tests et vérifications disponibles avant de terminer.
- Ne jamais masquer, ignorer ou désactiver silencieusement un test en échec ; rapporter le problème et sa cause connue.
- Mettre à jour la documentation lorsque le changement le nécessite.

## Pull Request

La Pull Request doit relier l'Issue concernée et décrire les changements effectués, les tests et vérifications exécutés, ainsi que les limites et problèmes connus éventuels.

## Multi-agent

Lorsque la tâche le justifie et que les outils disponibles le permettent, des sous-tâches indépendantes peuvent être déléguées à plusieurs agents. Ne pas utiliser le multi-agent lorsqu'un seul agent suffit raisonnablement. L'agent principal reste responsable de l'intégration, des vérifications finales et du respect du périmètre de l'Issue.
