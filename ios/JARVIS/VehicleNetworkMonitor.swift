import Foundation
import Network
import Combine

@MainActor
final class VehicleNetworkMonitor: ObservableObject {
    @Published private(set) var isOnline = true
    @Published private(set) var interfaceName = "Bilinmiyor"

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "jarvis.vehicle.network")

    init() {
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                guard let self else { return }
                self.isOnline = path.status == .satisfied
                if path.usesInterfaceType(.wifi) {
                    self.interfaceName = "Wi‑Fi"
                } else if path.usesInterfaceType(.cellular) {
                    self.interfaceName = "Mobil veri"
                } else if path.usesInterfaceType(.wiredEthernet) {
                    self.interfaceName = "Ethernet"
                } else if path.status == .satisfied {
                    self.interfaceName = "Ağ"
                } else {
                    self.interfaceName = "Çevrimdışı"
                }
            }
        }
        monitor.start(queue: queue)
    }

    deinit {
        monitor.cancel()
    }
}

enum VehicleOperationTier: String {
    case local = "Yerel"
    case cached = "Önbellekten"
    case onlineEnhanced = "Çevrimiçi zenginleştirme"
}

struct VehicleRuntimeCapability: Identifiable, Hashable {
    var id: String { name }
    let name: String
    let available: Bool
    let tier: VehicleOperationTier
    let detail: String
}

enum VehicleRuntimeCapabilities {
    static func list(
        online: Bool,
        transportReady: Bool,
        protocolConfirmed: Bool,
        brand: VehicleBrand,
        hasManufacturerPack: Bool,
        hasCodingCache: Bool
    ) -> [VehicleRuntimeCapability] {
        let genericReady = transportReady && protocolConfirmed
        let manufacturerReady = genericReady && hasManufacturerPack
        let codingReady = genericReady && hasCodingCache

        return [
            .init(
                name: "Hata kodu okuma",
                available: genericReady,
                tier: .local,
                detail: !transportReady
                    ? "ThinkDiag bağlı değil."
                    : (protocolConfirmed
                        ? "ThinkDiag ↔ araç OBD bağlantısı doğrulandı; internet gerekmez."
                        : "ThinkDiag bağlı; OBD protokolü henüz doğrulanmadı.")
            ),
            .init(
                name: "Genel OBD canlı veri",
                available: genericReady,
                tier: .local,
                detail: !transportReady
                    ? "ThinkDiag bağlı değil."
                    : (protocolConfirmed
                        ? "RPM, MAP, MAF, sıcaklık, hız ve desteklenen PID'ler yerel çalışır."
                        : "Canlı veri için OBD protokolünün doğrulanması gerekiyor.")
            ),
            .init(
                name: "Yerel DTC açıklaması",
                available: true,
                tier: .local,
                detail: "Okunan veya içe aktarılan DTC'ler uygulama içindeki veritabanından açıklanır."
            ),
            .init(
                name: "Üretici modül taraması",
                available: manufacturerReady,
                tier: hasManufacturerPack ? .cached : .onlineEnhanced,
                detail: !transportReady
                    ? "Önce ThinkDiag bağlantısını kur."
                    : (!protocolConfirmed
                        ? "Önce OBD protokolünü doğrula."
                        : (hasManufacturerPack
                            ? "\(brand.rawValue) teşhis paketi telefonda mevcut."
                            : "Bu marka için üretici paketi önce çevrimiçiyken indirilmelidir."))
            ),
            .init(
                name: "Kodlama / gizli özellikler",
                available: codingReady,
                tier: hasCodingCache ? .cached : .onlineEnhanced,
                detail: !transportReady
                    ? "Önce ThinkDiag bağlantısını kur."
                    : (!protocolConfirmed
                        ? "Önce araç protokolünü doğrula."
                        : (hasCodingCache
                            ? "Doğrulanmış reçeteler telefonda mevcut."
                            : (online
                                ? "İnternet var; ancak doğrulanmış kodlama reçetesi henüz telefonda yok."
                                : "Doğrulanmış kodlama reçetesi telefonda yok.")))
            ),
            .init(
                name: "AI teşhis yorumu",
                available: online,
                tier: .onlineEnhanced,
                detail: online
                    ? "Yerel teşhisin üstüne ek yorum yapabilir."
                    : "İnternet yok; yerel açıklama kullanılacak."
            )
        ]
    }
}
