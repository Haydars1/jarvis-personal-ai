import Foundation
import Combine

struct VehicleIdentity: Hashable {
    let brand: VehicleBrand
    let vin: String?
    let model: String?
    let modelYear: Int?
}

struct ResolvedVehicleCapability: Identifiable, Hashable {
    var id: String { capability.rawValue }
    let capability: VehicleCapability
    let support: CapabilitySupport
    let detail: String
}

@MainActor
final class VehicleCapabilityResolver: ObservableObject {
    @Published private(set) var capabilities: [ResolvedVehicleCapability] = []

    func resolve(identity: VehicleIdentity, transportReady: Bool) {
        let manufacturerPack = ManufacturerDiagnosticRegistry.shared.pack(for: identity.brand)
        let modules = manufacturerPack?.modules ?? []
        let coding = CodingFeatureCatalog.pack(for: identity.brand).features
        let registered = Set(CodingRecipeRegistry.shared.registeredFeatureIDs)
        let verifiedCodingCount = coding.filter { registered.contains($0.id) && CodingSafetyPolicy.isAllowed($0) }.count

        func item(_ capability: VehicleCapability, _ support: CapabilitySupport, _ detail: String) -> ResolvedVehicleCapability {
            .init(capability: capability, support: support, detail: detail)
        }

        capabilities = [
            item(.vin, transportReady ? .supported : .experimental, "Standart OBD/VCI üzerinden VIN algılama"),
            item(.readDtcs, transportReady ? .supported : .experimental, manufacturerPack == nil ? "Genel OBD motor DTC" : "Genel OBD + \(modules.count) üretici modülü"),
            item(.freezeFrame, transportReady ? .supported : .experimental, "Genel OBD freeze-frame; üretici verileri paketle genişletilir"),
            item(.liveData, transportReady ? .supported : .experimental, manufacturerPack == nil ? "Genel OBD PID" : "Genel OBD PID + üretici DID"),
            item(.moduleScan, manufacturerPack == nil ? .requiresPack : .supported, manufacturerPack == nil ? "Doğrulanmış üretici teşhis paketi gerekli" : "\(modules.count) kontrol ünitesi reçetesi yüklü"),
            item(.coding, verifiedCodingCount == 0 ? .requiresPack : .supported, verifiedCodingCount == 0 ? "Araç/ECU varyantına ait doğrulanmış yazma reçetesi gerekli" : "\(verifiedCodingCount) doğrulanmış kodlama"),
            item(.adaptations, verifiedCodingCount == 0 ? .requiresPack : .supported, "Kodlama reçetesi ve ECU desteğine göre"),
            item(.hiddenFeatures, verifiedCodingCount == 0 ? .requiresPack : .supported, "Donanım + ECU + doğrulanmış reçeteye göre"),
            item(.serviceFunctions, manufacturerPack == nil ? .requiresPack : .supported, "Araç/modül üretici paketine göre"),
            item(.clearDtcs, manufacturerPack == nil ? (transportReady ? .experimental : .unavailable) : .supported, "Silme komutu yalnızca ilgili modülün doğrulanmış rotasında çalıştırılır")
        ]
    }

    func result(for capability: VehicleCapability) -> ResolvedVehicleCapability? {
        capabilities.first(where: { $0.capability == capability })
    }
}
