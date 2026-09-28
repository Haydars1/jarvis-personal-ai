import Foundation
import CoreBluetooth
import Combine

@MainActor
final class ThinkDiagBluetooth: NSObject, ObservableObject {
    struct Device: Identifiable, Hashable {
        let id: UUID
        let name: String
        let rssi: Int
    }

    @Published private(set) var state: DiagnosticConnectionState = .idle
    @Published private(set) var devices: [Device] = []
    @Published private(set) var discoveredServices: [String] = []
    @Published private(set) var notificationFrames: [Data] = []

    private var central: CBCentralManager!
    private var peripherals: [UUID: CBPeripheral] = [:]
    private var active: CBPeripheral?

    override init() {
        super.init()
        central = CBCentralManager(delegate: self, queue: nil)
    }

    func scan() {
        guard central.state == .poweredOn else {
            state = .failed("Bluetooth açık değil veya izin verilmedi")
            return
        }
        devices.removeAll()
        peripherals.removeAll()
        state = .scanning
        central.scanForPeripherals(withServices: nil, options: [
            CBCentralManagerScanOptionAllowDuplicatesKey: false
        ])
        DispatchQueue.main.asyncAfter(deadline: .now() + 8) { [weak self] in
            guard let self, self.state == .scanning else { return }
            self.central.stopScan()
            self.state = .idle
        }
    }

    func stopScan() {
        central.stopScan()
        if state == .scanning { state = .idle }
    }

    func connect(_ device: Device) {
        guard let peripheral = peripherals[device.id] else { return }
        stopScan()
        active = peripheral
        peripheral.delegate = self
        state = .connecting(device.name)
        central.connect(peripheral, options: nil)
    }

    func disconnect() {
        guard let active else { return }
        central.cancelPeripheralConnection(active)
    }

    var isThinkDiagTransportReady: Bool {
        guard case .connected = state else { return false }
        return !discoveredServices.isEmpty
    }

    var transportNotice: String {
        "ThinkDiag/DBScar teşhis protokolü üreticiye özeldir. JARVIS şu anda Bluetooth cihazını bulur, bağlanır ve GATT servislerini/ham bildirimleri keşfeder; araçtan canlı PID/DTC okumak için protokol köprüsü ayrıca doğrulanmalıdır."
    }
}

extension ThinkDiagBluetooth: CBCentralManagerDelegate {
    nonisolated func centralManagerDidUpdateState(_ central: CBCentralManager) {
        Task { @MainActor in
            if central.state != .poweredOn {
                state = .failed("Bluetooth kullanılamıyor")
            } else if case .failed = state {
                state = .idle
            }
        }
    }

    nonisolated func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String : Any], rssi RSSI: NSNumber) {
        Task { @MainActor in
            let name = peripheral.name
                ?? (advertisementData[CBAdvertisementDataLocalNameKey] as? String)
                ?? "Bluetooth OBD"
            peripherals[peripheral.identifier] = peripheral
            let item = Device(id: peripheral.identifier, name: name, rssi: RSSI.intValue)
            if let index = devices.firstIndex(where: { $0.id == item.id }) {
                devices[index] = item
            } else {
                devices.append(item)
                devices.sort { $0.rssi > $1.rssi }
            }
        }
    }

    nonisolated func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        Task { @MainActor in
            state = .connected(peripheral.name ?? "ThinkDiag")
            discoveredServices.removeAll()
            notificationFrames.removeAll()
            peripheral.discoverServices(nil)
        }
    }

    nonisolated func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        Task { @MainActor in
            state = .failed(error?.localizedDescription ?? "Bağlantı kurulamadı")
        }
    }

    nonisolated func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        Task { @MainActor in
            state = error == nil ? .disconnected : .failed(error!.localizedDescription)
        }
    }
}

extension ThinkDiagBluetooth: CBPeripheralDelegate {
    nonisolated func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        Task { @MainActor in
            if let error {
                state = .failed(error.localizedDescription)
                return
            }
            for service in peripheral.services ?? [] {
                let uuid = service.uuid.uuidString
                if !discoveredServices.contains(uuid) { discoveredServices.append(uuid) }
                peripheral.discoverCharacteristics(nil, for: service)
            }
        }
    }

    nonisolated func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        Task { @MainActor in
            guard error == nil else { return }
            for characteristic in service.characteristics ?? [] {
                let marker = "\(service.uuid.uuidString)/\(characteristic.uuid.uuidString)"
                if !discoveredServices.contains(marker) { discoveredServices.append(marker) }
                if characteristic.properties.contains(.notify) || characteristic.properties.contains(.indicate) {
                    peripheral.setNotifyValue(true, for: characteristic)
                }
            }
        }
    }

    nonisolated func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        Task { @MainActor in
            guard error == nil, let data = characteristic.value, !data.isEmpty else { return }
            notificationFrames.append(data)
            if notificationFrames.count > 200 {
                notificationFrames.removeFirst(notificationFrames.count - 200)
            }
        }
    }
}
