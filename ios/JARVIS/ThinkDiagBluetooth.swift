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
    @Published private(set) var decodedFrames: [ThinkDiagVciFrame] = []
    @Published private(set) var preferredServiceDetected = false
    @Published private(set) var writableCharacteristic: String?
    @Published private(set) var notifyCharacteristic: String?
    @Published private(set) var passiveObservations: [ThinkDiagPassiveObservation] = []
    @Published private(set) var streamStats = ThinkDiagStreamStats()
    @Published private(set) var protocolProfile: ThinkDiagProtocolProfile? = ThinkDiagProtocolProfileStore.load()
    @Published private(set) var probeAttempts: [ThinkDiagProbeAttempt] = []
    @Published private(set) var probeRunning = false
    @Published private(set) var livePolling = false
    @Published private(set) var genericDtcScanRunning = false
    @Published private(set) var packetEvents: [ThinkDiagPacketEvent] = []
    @Published private(set) var maxWriteWithResponse = 0
    @Published private(set) var maxWriteWithoutResponse = 0

    private var central: CBCentralManager!
    private var peripherals: [UUID: CBPeripheral] = [:]
    private var active: CBPeripheral?
    private var writeCBCharacteristic: CBCharacteristic?
    private var notifyCBCharacteristic: CBCharacteristic?
    private var assembler = ThinkDiagFrameAssembler()
    private var livePollTask: Task<Void, Never>?
    private let lastPeripheralKey = "jarvis.thinkdiag.lastPeripheral"
    private let autoReconnectKey = "jarvis.thinkdiag.autoReconnect"
    private var writeCharacteristicScore = Int.min
    private var notifyCharacteristicScore = Int.min

    override init() {
        super.init()
        central = CBCentralManager(delegate: self, queue: nil)
    }

    var autoReconnectEnabled: Bool {
        get {
            if UserDefaults.standard.object(forKey: autoReconnectKey) == nil { return true }
            return UserDefaults.standard.bool(forKey: autoReconnectKey)
        }
        set {
            UserDefaults.standard.set(newValue, forKey: autoReconnectKey)
        }
    }

    func reconnectLastDevice() {
        guard central.state == .poweredOn,
              autoReconnectEnabled,
              let raw = UserDefaults.standard.string(forKey: lastPeripheralKey),
              let id = UUID(uuidString: raw) else { return }

        let matches = central.retrievePeripherals(withIdentifiers: [id])
        guard let peripheral = matches.first else { return }
        active = peripheral
        peripherals[id] = peripheral
        peripheral.delegate = self
        state = .connecting(peripheral.name ?? "Son ThinkDiag")
        central.connect(peripheral, options: nil)
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
        stopLivePolling()
        guard let active else { return }
        central.cancelPeripheralConnection(active)
    }

    var isThinkDiagTransportReady: Bool {
        guard case .connected = state else { return false }
        return !discoveredServices.isEmpty
    }

    var canWrite: Bool {
        active != nil && writeCBCharacteristic != nil
    }

    @discardableResult
    func sendVCIFrame(opcode: UInt16, payload: Data = Data(), header: [UInt8]? = nil) -> Bool {
        guard let peripheral = active, let characteristic = writeCBCharacteristic else { return false }
        let selectedHeader = header ?? protocolProfile?.header ?? [0x55, 0xAA]
        let data = ThinkDiagVciFrame.build(header: selectedHeader, opcode: opcode, payload: payload)
        let type: CBCharacteristicWriteType = characteristic.properties.contains(.writeWithoutResponse) ? .withoutResponse : .withResponse
        peripheral.writeValue(data, for: characteristic, type: type)
        packetEvents.append(.init(
            timestamp: Date(),
            direction: .tx,
            characteristic: writableCharacteristic ?? characteristic.uuid.uuidString,
            data: data
        ))
        trimPacketEvents()
        return true
    }

    @discardableResult
    func sendReadOnlyDtcProbe(header: [UInt8]? = nil) -> Bool {
        sendVCIFrame(opcode: 0x0103, header: header)
    }

    @discardableResult
    func sendReadOnlyPendingDtcProbe() -> Bool {
        guard protocolProfile != nil else { return false }
        return sendVCIFrame(opcode: 0x0107)
    }

    @discardableResult
    func sendReadOnlyPermanentDtcProbe() -> Bool {
        guard protocolProfile != nil else { return false }
        return sendVCIFrame(opcode: 0x010A)
    }

    func scanGenericDtcStates() async {
        guard protocolProfile != nil, canWrite, !genericDtcScanRunning else { return }
        genericDtcScanRunning = true
        defer { genericDtcScanRunning = false }

        _ = sendReadOnlyDtcProbe()
        try? await Task.sleep(nanoseconds: 500_000_000)
        _ = sendReadOnlyPendingDtcProbe()
        try? await Task.sleep(nanoseconds: 500_000_000)
        _ = sendReadOnlyPermanentDtcProbe()
        try? await Task.sleep(nanoseconds: 700_000_000)
    }

    @discardableResult
    func sendReadOnlyPid(_ pid: UInt8) -> Bool {
        guard protocolProfile != nil else { return false }
        return sendVCIFrame(opcode: 0x0101, payload: Data([pid]))
    }

    func startLivePolling() {
        guard protocolProfile != nil, canWrite, livePollTask == nil else { return }
        livePolling = true
        let pids: [UInt8] = [0x0C, 0x0B, 0x10, 0x05, 0x0D, 0x42]
        livePollTask = Task { [weak self] in
            while !Task.isCancelled {
                guard let self else { break }
                for pid in pids {
                    if Task.isCancelled { break }
                    _ = self.sendReadOnlyPid(pid)
                    try? await Task.sleep(nanoseconds: 180_000_000)
                }
                try? await Task.sleep(nanoseconds: 350_000_000)
            }
            await MainActor.run {
                self?.livePolling = false
                self?.livePollTask = nil
            }
        }
    }

    func stopLivePolling() {
        livePollTask?.cancel()
        livePollTask = nil
        livePolling = false
    }

    func runReadOnlyHeaderSweep(timeoutNanoseconds: UInt64 = 1_200_000_000) async {
        guard canWrite, !probeRunning else { return }
        probeRunning = true
        probeAttempts.removeAll()
        defer { probeRunning = false }

        let candidates: [[UInt8]] = [
            [0x55, 0xAA],
            [0xAA, 0x55],
            [0xFE, 0x01],
            [0x40, 0xC8],
        ]

        for header in candidates {
            var confirmations = 0

            for _ in 0..<2 {
                let startFrameCount = decodedFrames.count
                guard sendReadOnlyDtcProbe(header: header) else { break }
                try? await Task.sleep(nanoseconds: timeoutNanoseconds)

                let newFrames = Array(decodedFrames.dropFirst(min(startFrameCount, decodedFrames.count)))
                let valid = newFrames.contains { frame in
                    frame.checksumValid
                        && frame.header == header
                        && Self.isStructurallyValidMode03(frame)
                }
                if valid {
                    confirmations += 1
                } else {
                    break
                }
            }

            let success = confirmations >= 2
            let detail = success
                ? "2/2 checksum-geçerli Mode 03 cevabı"
                : "\(confirmations)/2 doğrulama; header kaydedilmedi"

            probeAttempts.append(.init(header: header, success: success, detail: detail))

            if success {
                let profile = ThinkDiagProtocolProfile(
                    header0: header[0],
                    header1: header[1],
                    confirmedAt: Date(),
                    evidence: detail
                )
                protocolProfile = profile
                ThinkDiagProtocolProfileStore.save(profile)
                break
            }
        }
    }

    private static func isStructurallyValidMode03(_ frame: ThinkDiagVciFrame) -> Bool {
        let bytes = [UInt8](frame.payload)

        if frame.opcode == 0x0143 {
            return true
        }

        guard let index = bytes.firstIndex(of: 0x43) else { return false }
        let suffix = Array(bytes.dropFirst(index + 1))

        // Empty positive response is valid when the ECU has no stored DTC.
        if suffix.isEmpty { return true }

        // Some responses include a DTC-count byte after 0x43.
        if suffix.count >= 1, suffix.count % 2 == 1 {
            let count = Int(suffix[0])
            let dtcBytes = suffix.count - 1
            return count * 2 <= dtcBytes && dtcBytes % 2 == 0
        }

        return suffix.count % 2 == 0
    }

    func requestVCI(
        opcode: UInt16,
        payload: Data,
        expectedPayloadPrefix: Data? = nil,
        timeoutNanoseconds: UInt64 = 1_500_000_000
    ) async -> Data? {
        guard protocolProfile != nil, canWrite else { return nil }
        let startIndex = decodedFrames.count
        guard sendVCIFrame(opcode: opcode, payload: payload) else { return nil }

        let step: UInt64 = 80_000_000
        var waited: UInt64 = 0
        while waited < timeoutNanoseconds {
            try? await Task.sleep(nanoseconds: step)
            waited += step

            let newFrames = Array(decodedFrames.dropFirst(min(startIndex, decodedFrames.count)))
            for frame in newFrames.reversed() {
                if let prefix = expectedPayloadPrefix {
                    if frame.payload.starts(with: prefix) { return frame.payload }
                } else if !frame.payload.isEmpty {
                    return frame.payload
                }
            }
        }
        return nil
    }

    func clearProtocolProfile() {
        protocolProfile = nil
        ThinkDiagProtocolProfileStore.clear()
    }

    var protocolFingerprint: ThinkDiagProtocolFingerprint {
        ThinkDiagProtocolAnalyzer.fingerprint(decodedFrames)
    }

    private func trimPacketEvents() {
        if packetEvents.count > 1000 {
            packetEvents.removeFirst(packetEvents.count - 1000)
        }
    }

    var transportNotice: String {
        if preferredServiceDetected {
            return "Launch/ThinkDiag BLE servis imzası bulundu. JARVIS bildirimleri dinliyor ve bilinen VCI çerçeve yapısını pasif olarak çözüyor."
        }
        return "Bluetooth bağlantısı kuruldu. JARVIS servis/karakteristikleri keşfediyor; FFF0 veya ISSC imzası bulunursa ThinkDiag VCI modu otomatik seçilir."
    }
}

extension ThinkDiagBluetooth: CBCentralManagerDelegate {
    nonisolated func centralManagerDidUpdateState(_ central: CBCentralManager) {
        Task { @MainActor in
            if central.state != .poweredOn {
                state = .failed("Bluetooth kullanılamıyor")
            } else {
                if case .failed = state { state = .idle }
                reconnectLastDevice()
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
            UserDefaults.standard.set(peripheral.identifier.uuidString, forKey: lastPeripheralKey)
            discoveredServices.removeAll()
            notificationFrames.removeAll()
            decodedFrames.removeAll()
            packetEvents.removeAll()
            preferredServiceDetected = false
            writableCharacteristic = nil
            notifyCharacteristic = nil
            writeCBCharacteristic = nil
            notifyCBCharacteristic = nil
            writeCharacteristicScore = Int.min
            notifyCharacteristicScore = Int.min
            maxWriteWithResponse = peripheral.maximumWriteValueLength(for: .withResponse)
            maxWriteWithoutResponse = peripheral.maximumWriteValueLength(for: .withoutResponse)
            passiveObservations.removeAll()
            assembler.reset()
            streamStats = assembler.stats
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
            stopLivePolling()
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
                if ThinkDiagKnownBle.isPreferredService(uuid) { preferredServiceDetected = true }
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

                let props = characteristic.properties
                let preferred = ThinkDiagKnownBle.isPreferredService(service.uuid.uuidString)

                if props.contains(.write) || props.contains(.writeWithoutResponse) {
                    let score = (preferred ? 100 : 0)
                        + (props.contains(.writeWithoutResponse) ? 20 : 0)
                        + (props.contains(.write) ? 10 : 0)
                    if score > writeCharacteristicScore {
                        writeCharacteristicScore = score
                        writableCharacteristic = marker
                        writeCBCharacteristic = characteristic
                    }
                }

                if props.contains(.notify) || props.contains(.indicate) {
                    let score = (preferred ? 100 : 0)
                        + (props.contains(.notify) ? 20 : 0)
                        + (props.contains(.indicate) ? 10 : 0)
                    if score > notifyCharacteristicScore {
                        notifyCharacteristicScore = score
                        notifyCharacteristic = marker
                        notifyCBCharacteristic = characteristic
                    }
                }
                if props.contains(.notify) || props.contains(.indicate) {
                    peripheral.setNotifyValue(true, for: characteristic)
                }
                if props.contains(.read) {
                    peripheral.readValue(for: characteristic)
                }
            }
        }
    }

    nonisolated func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        Task { @MainActor in
            guard error == nil, let data = characteristic.value, !data.isEmpty else { return }
            notificationFrames.append(data)
            packetEvents.append(.init(
                timestamp: Date(),
                direction: .rx,
                characteristic: "\(characteristic.service?.uuid.uuidString ?? "-")/\(characteristic.uuid.uuidString)",
                data: data
            ))
            trimPacketEvents()
            let frames = assembler.append(data)
            streamStats = assembler.stats
            for frame in frames {
                decodedFrames.append(frame)
                passiveObservations.append(contentsOf: ThinkDiagPassiveDecoder.observations(from: frame))
            }
            if decodedFrames.count > 500 {
                decodedFrames.removeFirst(decodedFrames.count - 500)
            }
            if passiveObservations.count > 300 {
                passiveObservations.removeFirst(passiveObservations.count - 300)
            }
            if notificationFrames.count > 200 {
                notificationFrames.removeFirst(notificationFrames.count - 200)
            }
        }
    }
}
