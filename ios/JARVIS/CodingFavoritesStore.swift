import Foundation
import Combine

@MainActor
final class CodingFavoritesStore: ObservableObject {
    @Published private(set) var ids: Set<String>

    private let key = "jarvis.vehicle.coding.favorites"

    init() {
        ids = Set(UserDefaults.standard.stringArray(forKey: key) ?? [])
    }

    func toggle(_ id: String) {
        if ids.contains(id) {
            ids.remove(id)
        } else {
            ids.insert(id)
        }
        UserDefaults.standard.set(Array(ids).sorted(), forKey: key)
    }

    func contains(_ id: String) -> Bool {
        ids.contains(id)
    }
}
