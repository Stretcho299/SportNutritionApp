# Spike — Open Food Facts pour la recherche alimentaire du MVP

## Endpoint et prototype

Recherche texte testée :

```text
GET https://world.openfoodfacts.org/cgi/search.pl
```

Paramètres :
`search_terms=<terme>&search_simple=1&action=process&json=1&page_size=5&fields=product_name,brands,nutriments,serving_size,nutrition_data_per`.

Le prototype `scripts/open_food_facts_spike.swift` effectue les recherches
`poulet`, `riz`, `skyr` et `Nutella`, avec un `User-Agent` identifiable. Il
affiche les cinq premiers résultats : nom, marque, calories, protéines, glucides
et lipides par 100 g/ml et par portion, `serving_size`, `nutrition_data_per` et
`non renseigné` pour toute valeur absente.

Exécution attendue sur un poste équipé de Swift :

```bash
swift scripts/open_food_facts_spike.swift
```

Les valeurs `*_100g` sont privilégiées car elles sont normalisées ; les valeurs
`*_serving` sont affichées seulement lorsqu'elles existent.

## Résultats observés le 12 septembre 2026

L'environnement de travail ne contient pas l'exécutable `swift`. Les quatre
requêtes HTTP équivalentes au prototype ont néanmoins été exécutées contre la
production `.org`.

| Terme | Total | Observations sur les cinq premiers résultats |
| --- | ---: | --- |
| `poulet` | 40 237 | Les cinq résultats reçus sont complets. Exemple : « Blanc de Poulet » Fleury Michon : 101,58 kcal, 21 g protéines, 0,5 g glucides, 1,6 g lipides / 100 g ; portion 40 g et macros par portion disponibles. |
| `riz` | — | La production a répondu HTTP 503. |
| `skyr` | — | La production a répondu HTTP 503, y compris après une seconde tentative espacée. |
| `Nutella` | — | La production a répondu HTTP 503, y compris après une seconde tentative espacée. |

## Limites et décision

`/cgi/search.pl` est un endpoint historique : la documentation officielle classe
les API v1/v0 comme *legacy*. L'API v3 recommandée pour les nouvelles intégrations
ne propose pas encore de recherche, et v2 ne propose que la recherche structurée ;
la recherche texte est prévue à terme via Search-a-licious. Une intégration future
devra donc isoler cet endpoint et prévoir sa migration ou son remplacement.

La base est contributive, sans garantie d'exactitude ni de complétude. Les résultats
observés confirment les données manquantes, un classement imprécis et une disponibilité
instable. L'utilisateur peut modifier la quantité consommée, mais jamais les calories,
protéines, glucides ou lipides provenant de la base. Si l'une de ces données
nutritionnelles nécessaires est absente ou insuffisante, le produit est non exploitable
pour le MVP : l'application ne demande pas à l'utilisateur de compléter ou corriger
ses valeurs.

**Décision : Go conditionnel.** Open Food Facts peut préremplir un produit dont les
quatre macros nécessaires sont disponibles, mais la dépendance à un endpoint legacy
et les réponses HTTP 503 observées en production imposent une gestion d'indisponibilité
et une validation stricte avant de rendre un produit sélectionnable.

Open Food Facts reste utilisable comme candidat pour le MVP, mais la recherche plein texte actuelle repose sur un endpoint legacy soumis à des limites de disponibilité. L’intégration devra isoler ce service, gérer proprement les erreurs réseau/503, éviter la recherche à chaque frappe et rester remplaçable lorsque Search-a-licious ou une autre solution sera retenue.
