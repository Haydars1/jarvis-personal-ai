import Foundation

struct ManufacturerFeaturePackManifest: Codable {
    let schemaVersion: Int
    let brand: VehicleBrand
    let packVersion: String
    let recipes: [CodingRecipe]
}

enum ManufacturerFeaturePackLoader {
    static func load(
        data: Data,
        persistOffline: Bool = true
    ) throws -> ManufacturerFeaturePackManifest {
        let manifest = try JSONDecoder().decode(ManufacturerFeaturePackManifest.self, from: data)
        guard manifest.schemaVersion == 1 else {
            throw NSError(
                domain: "JARVIS.FeaturePack",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Desteklenmeyen özellik paketi şeması"]
            )
        }

        for recipe in manifest.recipes {
            guard recipe.brand == manifest.brand else {
                throw NSError(
                    domain: "JARVIS.FeaturePack",
                    code: 2,
                    userInfo: [NSLocalizedDescriptionKey: "Paket marka bilgisi ile reçete uyuşmuyor"]
                )
            }
            CodingRecipeRegistry.shared.register(recipe)
        }
        if persistOffline {
            OfflineVehicleDataStore.saveFeaturePack(data, brand: manifest.brand)
        }
        return manifest
    }
}
