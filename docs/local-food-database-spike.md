# Spike — base alimentaire locale pour le MVP

## Décision

**Recommandation : approche hybride.** Embarquer un index dérivé de **Ciqual
2020 (Anses)** pour les aliments génériques, et conserver Open Food Facts (OFF)
pour les produits de marque et, plus tard, le code-barres. Cette séparation
répond aux deux usages sans créer de backend ni dépendre du réseau pour la
recherche générique.

La base brute n'est pas versionnée. Le futur index dérivé doit être généré à
partir d'une version Ciqual figée, avec attribution et licence jointes à la
release de l'application.

## Sources étudiées

| Source | Pertinence et contenu | Licence | Taille / décision |
| --- | --- | --- | --- |
| [Ciqual 2020 — Anses](https://www.data.gouv.fr/datasets/table-de-composition-nutritionnelle-des-aliments-ciqual-2020) | Référence française : 3 185 aliments, 67 constituants ; énergie, protéines, glucides et lipides pour 100 g de partie comestible. | [Licence Ouverte / Open Licence 2.0](https://www.etalab.gouv.fr/licence-ouverte-open-licence/) indiquée par data.gouv.fr. Compatible avec un embarquement, sous réserve de l'attribution. | Archive XML officielle 3,6 Mo mesurée ; 100,7 Mo extraits (inclut les sources détaillées). **Candidat retenu** pour l'index dérivé. |
| [Ciqual 2025 — Anses](https://ciqual.anses.fr/cms/fr/la-table-ciqual-2025) | Version affichée par l'Anses : 3 484 aliments et 74 constituants. | La licence et le fichier téléchargeable précis doivent être reverifiés au moment de remplacer la version 2020. | Candidat de mise à jour, non utilisé par le prototype : pas de donnée 2025 ajoutée au dépôt. |
| [USDA FoodData Central](https://fdc.nal.usda.gov/download-datasets/) | Données génériques riches et téléchargeables ; Foundation Foods 04/2026 : 3,7 Mo ZIP JSON / 32 Mo décompressé. Les produits et libellés ne sont pas orientés France. | [CC0 1.0](https://fdc.nal.usda.gov/index.html). | Licence simple, mais pertinence française inférieure ; non retenu comme base principale. Les exports Branded et complets sont trop volumineux (428 Mo et 3,1 Go ZIP). |
| [Open Food Facts](https://world.openfoodfacts.org/data) | Produits de marque, communautaires, étiquettes et codes-barres ; moins adapté aux aliments génériques. | [ODbL 1.0](https://world.openfoodfacts.org/data) pour la base ; conditions distinctes pour les images. | Ne pas embarquer l'export complet. À garder en accès réseau, tel qu'évalué dans le spike existant. |

Ciqual indique que les valeurs sont des teneurs pour 100 g de partie comestible
et que les valeurs manquantes ne doivent pas être assimilées à zéro dans sa
[documentation officielle](https://ciqual.anses.fr/cms/sites/default/files/inline-files/Table%20Ciqual%202020_doc_Excel_FR_2020%2007%2007.pdf).

## Prototype reproductible

Le prototype isolé [`scripts/ciqual_local_spike.py`](../scripts/ciqual_local_spike.py)
télécharge l'archive XML Ciqual 2020 dans un répertoire temporaire, la supprime
à la fin, construit en mémoire l'index minimal et effectue les dix recherches
requises. Il ne touche ni à SwiftUI, ni à SwiftData, ni au code de l'application.
Il utilise uniquement la bibliothèque standard Python 3.

```bash
python3 scripts/ciqual_local_spike.py
```

Le XML officiel distribué contient quelques caractères non échappés. Le script
les échappe **en mémoire uniquement** avant de passer le XML au parseur strict ;
il conserve les valeurs et la traçabilité de l'archive source. `--archive
/chemin/vers/XML_2020_07_07.zip` permet de rejouer le test sans réseau.

### Mesures du 13 septembre 2026

Machine de travail : Python 3.12.3. Mesures à froid incluant le téléchargement :

| Mesure | Résultat |
| --- | ---: |
| Archive téléchargée | 3,6 Mo ; 1,03 s |
| Fichiers XML extraits | 100,7 Mo |
| Projection JSON minimale de 1 802 entrées (id, nom, 4 macros) | 0,24 Mo |
| Aliments lus | 3 185 |
| Entrées ayant kcal, protéines, glucides et lipides **numériques** | 1 802 |
| Chargement et indexation en mémoire | 1,71 s |
| Dix recherches locales par sous-chaîne normalisée | 90,0 ms |

Les dix termes demandés ont chacun au moins une correspondance à quatre macros
numériques : poulet, riz, banane, pomme, œuf, saumon, pâtes, avoine, lait et
yaourt. Les résultats affichent nom, code Ciqual, calories, protéines, glucides,
lipides et la base « 100 g de partie comestible ».

La recherche par sous-chaîne est volontairement minimale : elle rend par
exemple `pomme de terre` pour `pomme`. Le futur index doit prévoir un rang
métier (synonymes, type d'aliment et préférence pour le libellé exact) ; ce
constat n'empêche pas la faisabilité du stockage local.

## Qualité nutritionnelle, portions et limites

Ciqual est une table de composition, pas une base de portions. Elle ne fournit
pas d'unité usuelle exploitable de façon homogène dans les fichiers testés : le
MVP doit afficher et enregistrer une quantité en grammes, avec les nutriments
normalisés pour 100 g. Des portions par défaut ne doivent pas être inventées à
partir de Ciqual.

La validation stricte du prototype exclut les valeurs manquantes (`-`), les
traces et les bornes (`< 0,5`) : les transformer en zéro ou en une valeur
moyenne altérerait la donnée. Cela explique les 1 802 entrées retenues plutôt
que les 3 185 aliments. Exemple important : la banane crue a une valeur de
lipides `< 0,5`; elle est présente dans Ciqual, mais n'est pas sélectionnable
avec cette règle stricte. Avant le développement produit, il faudra définir une
politique explicite pour l'affichage des bornes (par exemple « < 0,5 g ») ou
exclure ces aliments du MVP.

La documentation Ciqual décrit une sélection, agrégation, vérification et
ajustement des données ; elle précise également l'existence de valeurs
manquantes. Les quatre macros sont donc adaptées au MVP **lorsqu'elles sont
numériques**, mais la date de la table (2020) et sa couverture des aliments
préparés restent des limites à exposer.

## Stockage et recherche iPhone

Pour le MVP, générer hors application un **SQLite** compact à partir de Ciqual :
une table `foods(id, normalized_name, display_name, kcal_100g,
protein_100g, carbs_100g, fat_100g, source_version)` et un index sur
`normalized_name`. SQLite est déjà disponible sur iOS, ne requiert pas de
migration SwiftData pour un référentiel immuable et permet recherche préfixe,
classement et pagination sans charger toute la table. La base peut être livrée
lecture seule dans le bundle, puis interrogée en arrière-plan.

Un JSON prétraité serait aussi raisonnable à ce volume et suffirait au premier
prototype, mais impose un chargement complet et un filtrage maison. CSV ne
fournit pas d'index ; SwiftData augmenterait inutilement l'architecture du MVP
pour une donnée de référence immuable. FTS SQLite n'est à ajouter que si la
recherche par préfixe et les synonymes deviennent insuffisants.

L'indexation mesurée en Python est de l'ordre de 1,7 s pour le XML complet ;
une base SQLite préconstruite évite ce coût au lancement. Avec seulement
quelques milliers de lignes, une recherche indexée doit rester instantanée ; la
mesure iPhone reste à réaliser lors de l'intégration, hors périmètre de ce
spike.

## Comparaison avec Open Food Facts

| Critère | Ciqual local | Open Food Facts (spike existant) |
| --- | --- | --- |
| Aliments génériques | Très bon, libellés français et valeurs normalisées. | Possible mais résultats parfois dominés par des produits transformés. |
| Produits de marque | Non, ce n'est pas son rôle. | Oui, principal avantage. |
| Complétude | Forte pour les quatre macros sur l'index strict (1 802/3 185), mais valeurs manquantes ou bornées à gérer. | Variable, communautaire ; le spike impose les quatre macros avant sélection. |
| Recherche | Locale, prévisible, sans réseau ; rang métier à construire. | Endpoint texte legacy, 503 observés dans le spike OFF. |
| Réseau et disponibilité | Aucun réseau à l'usage. | Réseau requis ; disponibilité dépendante du service. |
| Performance | Index local très petit et recherche immédiate attendue. | Latence, débit et erreurs réseau. |
| Taille locale | 0,24 Mo mesuré pour un JSON minimal de l’index strict ; archive source 3,6 Mo. | Export complet non adapté au bundle. |
| Maintenance | Régénération lors d'une publication Ciqual, attribution et contrôle de licence. | API/endpoint à isoler et migrer si nécessaire. |
| Licence | Licence Ouverte, attribution. | ODbL, obligations de partage à l'identique de la base dérivée à analyser avant embarquement. |
| Évolutivité | Stable pour le générique ; ajouter synonymes et politique de bornes. | Naturel pour marques et code-barres, mais dépendance au réseau. |

Le détail de l'évaluation OFF est conservé dans
[`docs/open-food-facts-spike.md`](open-food-facts-spike.md). Les deux sources
sont complémentaires, pas interchangeables.

## Suite proposée (hors périmètre de cette Issue)

1. Vérifier la licence et l'archive exacte de la version Ciqual la plus récente,
   puis écrire un convertisseur reproductible vers SQLite avec attribution.
2. Décider la représentation produit des valeurs `<` et `traces`, sans les
   remplacer silencieusement par zéro.
3. Mesurer sur iPhone un index dérivé, le temps de première recherche et le
   rang des synonymes avant intégration au MVP.
