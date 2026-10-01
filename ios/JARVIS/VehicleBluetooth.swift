import SwiftUI
import CoreBluetooth

struct VehiclePeripheral: Identifiable {
    let id: UUID
    let name: String
    let rssi: Int
}

// Discovery only: GATT connectivity does not establish a THINKDIAG vehicle session.
// No guessed UUIDs, authentication packets, characteristic writes or vehicle commands.
final class VehicleBluetooth: NSObject, ObservableObject, CBCentralManagerDelegate, CBPeripheralDelegate {
    @Published private(set) var devices: [VehiclePeripheral] = []
    @Published private(set) var status = "Bluetooth başlatılmadı"
    @Published private(set) var scanning = false
    @Published private(set) var busy = false
    @Published private(set) var connected = false
    @Published private(set) var inventory: [String] = []
    private var central: CBCentralManager?
    private var peripherals: [UUID: CBPeripheral] = [:]
    private var selected: CBPeripheral?
    private var timer: Timer?
    private var pendingServices = 0
    private var scanRequested = false

    func startScan() {
        guard !busy, !connected else { return }
        scanRequested = true
        if central == nil {
            status = "Bluetooth izni ve durumu bekleniyor"
            central = CBCentralManager(delegate: self, queue: .main)
            return
        }
        guard central?.state == .poweredOn else { refreshStatus(); return }
        devices = []; peripherals = [:]; inventory = []
        scanning = true; status = "Yakındaki BLE cihazları aranıyor"
        central?.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey: false])
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 15, repeats: false) { [weak self] _ in
            self?.stopScan()
        }
    }

    func stopScan() {
        central?.stopScan(); timer?.invalidate(); timer = nil
        if scanning { status = devices.isEmpty ? "BLE cihazı bulunamadı; cihazın enerjisini ve ThinkDiag+ bağlantısını kontrol et" : "Cihazı listeden seç" }
        scanning = false
        scanRequested = false
    }

    func connect(_ id: UUID) {
        guard central?.state == .poweredOn, !busy, !connected,
              let peripheral = peripherals[id] else { return }
        stopScan(); selected = peripheral; peripheral.delegate = self
        inventory = []; busy = true; status = "BLE bağlantısı kuruluyor"
        central?.connect(peripheral, options: nil)
        armTimeout("BLE bağlantısı zaman aşımına uğradı")
    }

    private func armTimeout(_ message: String) {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 12, repeats: false) { [weak self] _ in
            self?.disconnect()
            self?.status = message
        }
    }

    func disconnect() {
        stopScan()
        let old = selected
        selected = nil; busy = false; connected = false; pendingServices = 0
        if let old { old.delegate = nil; central?.cancelPeripheralConnection(old) }
        status = "Bağlantı kapatıldı"
    }

    private func refreshStatus() {
        switch central?.state {
        case .poweredOn: status = "Bluetooth hazır"
        case .poweredOff: status = "iPhone Bluetooth kapalı"
        case .unauthorized: status = "Bluetooth izni kapalı; iPhone ayarlarından JARVIS iznini aç"
        case .unsupported: status = "Bu cihaz BLE bağlantısını desteklemiyor"
        default: status = "Bluetooth durumu bekleniyor"
        }
    }

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        if central.state != .poweredOn {
            disconnect(); refreshStatus()
        } else if scanRequested { startScan() }
        else { refreshStatus() }
    }

    func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral,
                        advertisementData: [String: Any], rssi RSSI: NSNumber) {
        guard scanning, peripherals.count < 128 || peripherals[peripheral.identifier] != nil else { return }
        peripherals[peripheral.identifier] = peripheral
        let name = advertisementData[CBAdvertisementDataLocalNameKey] as? String ?? peripheral.name ?? "Adsız BLE cihazı"
        let row = VehiclePeripheral(id: peripheral.identifier, name: name, rssi: RSSI.intValue)
        devices.removeAll { $0.id == row.id }; devices.append(row)
        devices.sort { $0.rssi > $1.rssi }
    }

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        guard selected === peripheral else { central.cancelPeripheralConnection(peripheral); return }
        connected = true; status = "BLE bağlı; servisler keşfediliyor"
        armTimeout("GATT servis keşfi zaman aşımına uğradı")
        peripheral.discoverServices(nil)
    }

    func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        guard selected === peripheral else { return }
        disconnect(); status = "Bağlantı kurulamadı: \(error?.localizedDescription ?? "Cihaz yanıt vermedi")"
    }

    func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        guard selected === peripheral else { return }
        disconnect(); status = "BLE bağlantısı kesildi: \(error?.localizedDescription ?? "Cihaz bağlantıyı kapattı")"
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        guard selected === peripheral, connected else { return }
        if let error { inventory.append("Servis keşfi hatası: \(error.localizedDescription)"); finishDiscovery(); return }
        let services = peripheral.services ?? []
        pendingServices = services.count
        if services.isEmpty { finishDiscovery() }
        for service in services {
            inventory.append("Servis \(service.uuid.uuidString)")
            peripheral.discoverCharacteristics(nil, for: service)
        }
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        guard selected === peripheral, connected else { return }
        if let error { inventory.append("\(service.uuid.uuidString): \(error.localizedDescription)") }
        for characteristic in service.characteristics ?? [] {
            let p = characteristic.properties
            var flags: [String] = []
            if p.contains(.read) { flags.append("read") }
            if p.contains(.write) { flags.append("write") }
            if p.contains(.writeWithoutResponse) { flags.append("writeWithoutResponse") }
            if p.contains(.notify) { flags.append("notify") }
            if p.contains(.indicate) { flags.append("indicate") }
            inventory.append("\(service.uuid.uuidString) / \(characteristic.uuid.uuidString): \(flags.joined(separator: ", "))")
        }
        pendingServices -= 1
        if pendingServices <= 0 { finishDiscovery() }
    }

    private func finishDiscovery() {
        timer?.invalidate(); timer = nil; busy = false
        status = "BLE bağlı; araç komut protokolü henüz doğrulanmadı"
    }
}

struct VehicleBluetoothView: View {
    @StateObject private var bluetooth = VehicleBluetooth()
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        NavigationStack {
            List {
                Section("THINKDIAG2 bağlantısı") {
                    Text(bluetooth.status)
                    Text("Cihazı OBD soketine tak. ThinkDiag+ içindeki bağlantıyı kapat, ardından burada cihazını seç. Listede başka BLE cihazları da görünebilir.")
                        .font(.footnote).foregroundStyle(.secondary)
                    Button(bluetooth.scanning ? "Aramayı durdur" : "Cihaz ara") {
                        if bluetooth.scanning { bluetooth.stopScan() } else { bluetooth.startScan() }
                    }.disabled(bluetooth.busy || bluetooth.connected)
                    if bluetooth.connected || bluetooth.busy {
                        Button("Bağlantıyı kes") { bluetooth.disconnect() }
                    }
                }
                Section("Yakındaki cihazlar") {
                    ForEach(bluetooth.devices) { device in
                        Button { bluetooth.connect(device.id) } label: {
                            VStack(alignment: .leading) {
                                Text(device.name)
                                Text("\(device.rssi) dBm · \(device.id.uuidString.prefix(8))").font(.caption).foregroundStyle(.secondary)
                            }
                        }.disabled(bluetooth.busy || bluetooth.connected)
                    }
                }
                Section("Araç işlemleri") {
                    Text("Hata okuma/silme, kodlama, adaptasyon ve servis sıfırlama: henüz kullanılamıyor. BLE bağlantısı tek başına araç oturumu değildir; THINKDIAG2 protokol sürücüsü eksik.")
                }
                if !bluetooth.inventory.isEmpty {
                    Section("Bağlantı özellikleri") {
                        ShareLink(item: "JARVIS BLE GATT keşfi — araç oturumu kurulmadı\n" + bluetooth.inventory.joined(separator: "\n")) {
                            Label("Bağlantı bilgisini paylaş", systemImage: "square.and.arrow.up")
                        }
                        ForEach(Array(bluetooth.inventory.enumerated()), id: \.offset) { _, line in
                            Text(line).font(.caption).textSelection(.enabled)
                        }
                    }
                }
            }
            .navigationTitle("OBD cihazı")
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Kapat") { dismiss() } } }
        }
        .onDisappear { bluetooth.disconnect() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .background { bluetooth.disconnect() }
        }
    }
}
