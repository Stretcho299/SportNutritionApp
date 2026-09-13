# Audit de l’environnement Codex

Date de l’audit : 13 septembre 2026. Ce document décrit l’installation locale
réellement observée pour SportNutritionApp. Il ne modifie ni la configuration
globale Codex, ni les plugins, MCP ou permissions.

## Résumé exécutif

Le socle actuel est sain : Ubuntu, Codex CLI, Git/GitHub, `gh`, `AGENTS.md` et
la CI `macos-15` qui valide SwiftUI et le simulateur. La première amélioration
utile est un **review Codex indépendant et en lecture seule avant la review
humaine**.

Il ne faut pas ajouter de MCP, plugin ni automatisation de merge. La machine
permet déjà des sessions non interactives, sous-agents et worktrees, mais les
écritures parallèles augmenteraient conflits et consommation de tokens sans
bénéfice pour le MVP.

## Méthode et périmètre

Inventaire réalisé en lecture seule avec `codex --version`, `codex features`,
les aides demandées, `codex doctor --summary`, `gh`, la configuration expurgée
et le manuel officiel Codex récupéré le jour de l’audit. Les constats « local »
viennent de la machine ; « documenté » renvoie à OpenAI et ne prouve pas une
activation locale. Aucun secret n’est reproduit.

## Inventaire actuel

| Élément | Constat local | Implication |
| --- | --- | --- |
| CLI | `codex-cli 0.154.0`, Linux x86_64 | Les commandes auditées sont exposées par cette version. |
| Modèle | `gpt-5.6-terra`, effort `medium` | Bon défaut général ; le conserver faute de métriques coût/qualité. |
| Projet | SportNutritionApp est `trusted` | Une future config projet peut être chargée si le projet reste de confiance. |
| Diagnostic | 19 OK, 0 avertissement/échec | Installation, état, authentification et connectivité sains. |
| Sandbox | Système de fichiers et réseau restreints ; approbation `OnRequest` | Frontière sûre ; `--approve-for-me` est aussi disponible avec `workspace-write`. |
| Profils | Aucun `*.config.toml` de profil trouvé | Aucun profil alternatif configuré. |
| Features | `multi_agent`, `plugins`, `goals`, `hooks`, `apps` stables/actifs ; `worktrees` expérimental/inactif | Aucun flag global n’est modifié par cet audit. |
| MCP | `list`, `get`, `add`, `remove`, `login`, `logout` disponibles ; aucun serveur configuré | Aucun besoin externe non couvert actuellement. |
| Plugins | GitHub, OpenAI Templates, Deep Research Work et Plugin Management activés | GitHub est déjà connecté ; aucun plugin iOS n’est installé. |
| GitHub | `gh` authentifié avec notamment `repo` et `workflow`, sans extension listée | Issues, branches, PR et CI sont déjà automatisables. |
| Plugin GitHub | Activé ; permission globale « actions à faible risque » | Alternative contextuelle à `gh`, avec garde-fou de permission. |
| App server | Non démarré, mode éphémère | Agents persistants et remote control non validés en production. |

Le catalogue distant de plugins est configuré. La présence d’un plugin dans ce
catalogue ne signifie ni qu’il est installé, ni qu’il doit l’être.

## Capacités évaluées

| Capacité | Disponible localement | Usage concret | Valeur | Risques/coûts | Priorité |
| --- | --- | --- | --- | --- | --- |
| `codex review` | Oui | `codex review --base origin/main` | Regard indépendant avant l’humain | Tokens, faux positifs | A |
| `codex exec` | Oui | Tâche non interactive, JSONL, sortie structurée | Triage de logs et rapports | Tokens, automatisation mal bornée | A, read-only |
| Sous-agents | Oui, `multi_agent` stable | Explorer/tests/logs en parallèle | Rapidité sur tâches indépendantes | Tokens et conflits d’écritures | B |
| Worktrees | Git oui ; `--worktree` exposé mais flag expérimental inactif | Un répertoire par Issue | Isolation du parallèle | Disque, nettoyage, confusion | B avec Git |
| Skills | Oui, `SKILL.md` système/plugins | Protocole répétitif réutilisable | Conventions fiables | Règles prématurées ou trop larges | B plus tard |
| MCP | CLI oui, aucun serveur | Service externe authentifié | Aucun manque actuel | OAuth, accès, maintenance | C |
| Plugins | Oui, 4 activés | Skills/outils/connecteurs groupés | GitHub déjà couvert | Permissions et dépendances tierces | C |
| Profils | `--profile` oui, aucun profil | Permissions par contexte | Utile si usages divergents | Erreur de configuration | B plus tard |
| `resume`/`fork`/`queue` | Oui | Reprendre, bifurquer, notifier une session | Évite de répéter le contexte | Contexte long, coût | C |
| `remote-control` | Oui, expérimental | App server distant et appairage | Aucun besoin sur poste unique | Surface réseau | À éviter |
| `cloud` | Oui, expérimental | Soumettre/appliquer tâche cloud | Déport ponctuel possible | Accès, coût, données | À éviter |
| `--search` | Oui | Documentation/faits instables | Sources actuelles Apple/OpenAI | Recherche inutile ou non vérifiée | A à la demande |
| Hooks | Feature stable, non configurée | Contrôles mécaniques | Plus tard si règle répétée | Complexité/blocage | C |

### Review indépendant avant merge

`codex review` accepte une base (`--base`), un commit (`--commit`) ou les
changements locaux (`--uncommitted`) et ne modifie pas le code. Il complète les
tests GitHub Actions et la review humaine, sans les remplacer.

```bash
git fetch origin main
codex review --base origin/main \
  "Review this Swift/SwiftUI change. Report only actionable regressions, test gaps,\
   security or data-persistence risks. Do not edit files and do not approve or merge the PR."
```

Processus : CI verte, review Codex, correction éventuelle, puis review et merge
humains. « Aucun problème » n’est jamais une approbation de merge.

### Tâches longues avec `codex exec`

`codex exec` convient aux scripts, CI et rapports longs. Il propose `--json`,
`--output-schema`, `--output-last-message`, `--ephemeral`, reprise et fork.
Commencer par des tâches sans écriture :

```bash
codex exec --sandbox read-only --json \
  "Inspect this repository and list only the commands that can validate the iOS CI from Ubuntu." \
  > /tmp/codex-ci-audit.jsonl

gh run view <run-id> --log | codex exec --sandbox read-only \
  "Summarize the failing iOS CI in five bullets and propose the smallest next diagnostic step."
```

Ne pas placer un jeton OpenAI dans un job qui exécute le code du dépôt. La
documentation conseille l’action dédiée et une séparation entre génération de
patch et droits d’écriture ; ce n’est pas justifié tant que les échecs à trier
ne sont pas récurrents.

### Sous-agents, sessions et file

La feature `multi_agent` est stable et active. Les sous-agents conviennent à
l’exploration, aux logs et aux vérifications indépendantes. Dans la CLI, la
délégation doit être demandée explicitement et `/agent` permet d’inspecter les
threads ; `codex agents` concerne l’app server partagé. `resume`, `fork` et
`queue` servent à poursuivre, bifurquer et notifier une session.

Règle proposée : un intégrateur seul écrit et commite ; au plus deux
sous-agents font une analyse read-only. Pour une Issue courte, un agent est
moins cher et plus rapide.

### Worktrees

La CLI expose `--worktree`, mais `worktrees` est expérimental et inactif : son
comportement n’est pas validé ici. Git fournit l’isolation fiable dès maintenant :

```bash
git fetch origin main
git worktree add ../SportNutritionApp-issue-42 \
  -b feature/42-example origin/main
codex -C ../SportNutritionApp-issue-42 --approve-for-me
```

Les réserver aux tâches parallèles ou investigations longues. Après fermeture
de PR, seulement après vérification d’un arbre propre :

```bash
git worktree remove ../SportNutritionApp-issue-42
git branch -d feature/42-example
```

Ne jamais supprimer un worktree contenant des changements non commités. Tester
le flag Codex natif plus tard dans un dépôt jetable, après validation humaine.

### Skills et découverte des `SKILL.md`

Une skill est un paquet d’instructions réutilisables avec un `SKILL.md` et,
éventuellement, des références/scripts. L’installation découvre les skills
système `openai-docs`, `review-agent`, `skill-creator`, `skill-installer`,
`plugin-creator` et `imagegen`, ainsi que celles des plugins actifs. Une skill
applicable est annoncée dans la session et doit être lue entièrement avant son
emploi.

Ne pas créer de skill maintenant : `AGENTS.md` couvre le flux et le MVP évolue.
Après au moins cinq Issues suivant le même protocole, créer une skill
repository-scoped minimale « GitHub issue to iOS PR » : lecture complète de
l’Issue, branche depuis `origin/main`, tests, diff, PR liée et aucun merge.
Elle ne doit contenir ni secret, ni commande destructive, ni autorisation large.

### MCP, plugins et GitHub

MCP fournit des outils externes authentifiés ; aucun serveur MCP n’est déclaré.
Le plugin GitHub est installé/activé et suit la permission globale faible risque.
Il peut manipuler dépôts, Issues et PR. `gh` est aussi authentifié et possède
les scopes utiles au flux actuel.

Continuer `gh` pour le flux terminal. Employer le plugin GitHub si son contexte
agent est plus pratique, par exemple pour lire/commenter une PR. Ne pas ajouter
un MCP GitHub redondant : il dupliquerait un accès couvert. Toute nouvelle
connexion MCP doit répondre à un manque précis et obtenir les droits minimaux.

## Architecture cible

```text
Humain : priorise / décide du produit / merge
        |
        v
Issue -> branche dédiée -> Codex intégrateur (workspace-write)
        |                       |
        |                       +-> sous-agents read-only si indépendants
        v
tests disponibles -> push -> CI macOS : build, tests, simulateur, capture
        |                                |
        v                                v
codex review (read-only) ----------> artifact + checks verts
        |
        v
PR liée, résumé, limites -> review humaine -> merge humain
```

Codex prépare/vérifie, GitHub Actions valide ce qu’Ubuntu ne peut pas exécuter,
et l’humain contrôle le merge.

## Plan d’adoption progressif

### Priorité A — intégrer rapidement

1. Mettre `codex review --base origin/main` dans la checklist de PR, manuellement.
2. Employer `--search` seulement pour des sources externes actuelles et conserver
   les liens utiles dans la PR/documentation.
3. Utiliser `codex exec --sandbox read-only` pour un log CI long ou rapport sans
   modification ; ne pas en faire un écrivain automatique.
4. Garder le modèle/effort par défaut ; borner les prompts, nommer les fichiers
   et demander un diff minimal avant de déléguer ou augmenter l’effort.

### Priorité B — lorsque le projet grandira

1. Utiliser `git worktree` pour le travail réellement simultané ; un intégrateur
   seul applique les résultats.
2. Limiter à deux sous-agents read-only, avec question et synthèse explicites.
3. Créer une skill repository-scoped seulement après répétition avérée, puis
   l’évaluer sur une Issue non critique.
4. Créer un profil seulement si des usages divergents sont devenus stables.

### Priorité C — intéressant mais inutile maintenant

- `resume`, `fork`, `queue` pour les investigations longues ; nouvelle session
  pour les petites Issues afin d’éviter du contexte inutile.
- Hooks lorsqu’une règle mécanique se répète et qu’un test/script ne suffit pas.
- MCP/plugin supplémentaire pour un service d’équipe indispensable non couvert
  par Git, `gh` ou la documentation.

### À éviter pour l’instant

- `--dangerously-bypass-approvals-and-sandbox`, `danger-full-access` et
  `approval_policy = "never"` hors environnement jetable isolé.
- Remote control et Codex Cloud sans validation de l’accès, des données et coût.
- MCP GitHub ou plugin iOS redondant.
- Merge/approbation de PR automatisés, ou droits GitHub plus larges que nécessaire.
- Plusieurs agents écrivant dans la même branche ou le même worktree.

## Réduire les tokens/crédits sans réduire la qualité

- Préférer une Issue précise avec périmètre et critères d’acceptation.
- Commencer par un agent ; déléguer seulement du travail vraiment indépendant.
- Limiter `--search` aux faits instables et exiger des sources utiles.
- Utiliser `--output-schema` ou `--output-last-message` plutôt que réinjecter
  des logs entiers dans une nouvelle session.
- Passer des logs ciblés (`gh run view <run-id> --log`), pas tout le dépôt ou
  l’historique Git.
- Réserver effort/modèle plus élevés aux décisions complexes et échecs difficiles.

## Commandes de référence

```bash
# Inventaire en lecture seule
codex --version
codex features list
codex doctor --summary
codex mcp list
codex plugin list

# Développement local encadré
codex --approve-for-me --search -C /home/bryan/projets/appSportNutri/SportNutritionApp

# Review indépendante
git fetch origin main
codex review --base origin/main "Review only; do not edit, approve, merge or push."

# Triage CI non interactif
gh run view <run-id> --log | codex exec --sandbox read-only \
  "Summarize the root cause and the smallest next diagnostic action."

# Worktree Git pour travail parallèle
git worktree add ../SportNutritionApp-issue-<n> \
  -b feature/<n>-short-name origin/main
```

## Actions qui exigent une validation humaine

- Modifier `~/.codex/config.toml`, créer un profil ou activer un feature flag.
- Installer/activer/supprimer un plugin, modifier sa permission ou connecter un MCP/OAuth.
- Ajouter une automatisation GitHub avec Codex, secret OpenAI, droit d’écriture ou patch.
- Démarrer remote control, employer Cloud ou transmettre le code à un nouveau service.
- Élargir sandbox, désactiver approbations ou employer plein accès.
- Créer une skill durable ou modifier `AGENTS.md` pour instituer une règle d’équipe.

## Références officielles OpenAI

- [Sandbox et approbations Codex](https://learn.chatgpt.com/docs/sandboxing.md)
- [Référence de configuration](https://learn.chatgpt.com/docs/config-file/config-reference.md)
- [Mode non interactif `codex exec`](https://learn.chatgpt.com/docs/non-interactive-mode.md)
- [Personnalisation et `AGENTS.md`](https://learn.chatgpt.com/docs/agent-configuration/agents-guidance.md)
- [Skills Codex](https://learn.chatgpt.com/docs/agent-configuration/skills.md)
- [Model Context Protocol](https://learn.chatgpt.com/docs/extend/mcp.md)
- [Plugins Codex](https://learn.chatgpt.com/docs/plugins.md)
- [Code review Codex](https://learn.chatgpt.com/docs/code-review.md)
- [Worktrees](https://learn.chatgpt.com/docs/worktrees.md)
