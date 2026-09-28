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
        brand: VehicleBrand,
        hasManufacturerPack: Bool,
        hasCodingCache: Bool
    ) -> [VehicleRuntimeCapability] {
        [
            .init(
                name: "Hata kodu okuma",
                available: true,
                tier: .local,
                detail: "ThinkDiag ↔ araç Bluetooth bağlantısı; internet gerekmez."
            ),
            .init(
                name: "Genel OBD canlı veri",
                available: true,
                tier: .local,
                detail: "RPM, MAP, MAF, sıcaklık, hız ve desteklenen PID'ler yerel çalışır."
            ),
            .init(
                name: "Yerel DTC açıklaması",
                available: true,
                tier: .local,
                detail: "Uygulama içindeki DTC veritabanından çalışır."
            ),
            .init(
                name: "Üretici modül taraması",
                available: hasManufacturerPack,
                tier: hasManufacturerPack ? .cached : .onlineEnhanced,
                detail: hasManufacturerPack
                    ? "\(brand.rawValue) teşhis paketi telefonda mevcut."
                    : "Bu marka için üretici paketi önce çevrimiçiyken indirilmelidir."
            ),
            .init(
                name: "Kodlama / gizli özellikler",
                available: hasCodingCache || online,
                tier: hasCodingCache ? .cached : .onlineEnhanced,
                detail: hasCodingCache
                    ? "Daha önce indirilen doğrulanmış reçeteler internet olmadan kullanılabilir."
                    : "Yeni reçete/katalog için internet gerekir."
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
