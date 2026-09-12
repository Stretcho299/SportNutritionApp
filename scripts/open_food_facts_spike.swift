import Foundation

#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

let endpoint = URL(string: "https://world.openfoodfacts.org/cgi/search.pl")!
let queries = ["poulet", "riz", "skyr", "Nutella"]
let resultLimit = 5
let userAgent = "SportNutritionApp-spike/0.1 (local MVP evaluation)"

func display(_ value: Any?, unit: String = "") -> String {
    guard let value else { return "non renseigné" }
    return "\(value)\(unit)"
}

func nutriment(_ nutriments: [String: Any], _ key: String) -> Any? {
    nutriments[key]
}

func search(for query: String) async throws {
    var components = URLComponents(url: endpoint, resolvingAgainstBaseURL: false)!
    components.queryItems = [
        URLQueryItem(name: "search_terms", value: query),
        URLQueryItem(name: "search_simple", value: "1"),
        URLQueryItem(name: "action", value: "process"),
        URLQueryItem(name: "json", value: "1"),
        URLQueryItem(name: "page_size", value: String(resultLimit)),
        URLQueryItem(name: "fields", value: "product_name,brands,nutriments,serving_size,nutrition_data_per")
    ]

    var request = URLRequest(url: components.url!)
    request.setValue(userAgent, forHTTPHeaderField: "User-Agent")

    let (data, response) = try await URLSession.shared.data(for: request)
    guard let httpResponse = response as? HTTPURLResponse,
          (200...299).contains(httpResponse.statusCode) else {
        throw URLError(.badServerResponse)
    }

    guard let payload = try JSONSerialization.jsonObject(with: data) as? [String: Any],
          let products = payload["products"] as? [[String: Any]] else {
        throw NSError(domain: "OpenFoodFactsSpike", code: 1, userInfo: [NSLocalizedDescriptionKey: "Réponse inattendue"])
    }

    print("\nRecherche : \(query) — \(payload[\"count\"] ?? "?") résultats au total, \(products.count) affichés")
    for (index, product) in products.enumerated() {
        let nutriments = product["nutriments"] as? [String: Any] ?? [:]
        print("\n  \(index + 1). \(display(product[\"product_name\"]))")
        print("     Marque : \(display(product[\"brands\"]))")
        print("     Pour 100 g/ml — calories : \(display(nutriment(nutriments, "energy-kcal_100g"), unit: " kcal")), protéines : \(display(nutriment(nutriments, "proteins_100g"), unit: " g")), glucides : \(display(nutriment(nutriments, "carbohydrates_100g"), unit: " g")), lipides : \(display(nutriment(nutriments, "fat_100g"), unit: " g"))")
        print("     Portion : \(display(product[\"serving_size\"])), base : \(display(product[\"nutrition_data_per\"]))")
        print("     Par portion — calories : \(display(nutriment(nutriments, "energy-kcal_serving"), unit: " kcal")), protéines : \(display(nutriment(nutriments, "proteins_serving"), unit: " g")), glucides : \(display(nutriment(nutriments, "carbohydrates_serving"), unit: " g")), lipides : \(display(nutriment(nutriments, "fat_serving"), unit: " g"))")
    }
}

print("Open Food Facts — prototype de recherche texte")
print("Endpoint : \(endpoint.absoluteString)")

let completion = DispatchSemaphore(value: 0)
Task {
    for query in queries {
        do {
            try await search(for: query)
        } catch {
            print("\nRecherche : \(query) — échec : \(error.localizedDescription)")
        }
    }
    completion.signal()
}
completion.wait()
