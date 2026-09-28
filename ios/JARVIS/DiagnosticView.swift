import SwiftUI
import UniformTypeIdentifiers

struct DiagnosticView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var bluetooth = ThinkDiagBluetooth()
    @StateObject private var codingCoordinator = VehicleCodingCoordinator()
    @StateObject private var diagnosticAI = VehicleDiagnosticAI()
    @StateObject private var moduleScanner = ManufacturerModuleScanner()
    @StateObject private var manufacturerLive = ManufacturerLiveDataController()
    @StateObject private var protocolLearner = ManufacturerProtocolLearner()
    @StateObject private var oneTapCoordinator = OneTapCodingCoordinator()
    @State private var selectedBrand: VehicleBrand = .generic
    @State private var snapshot: DiagnosticSnapshot?
    @State private var showImporter = false
    @State private var showFeaturePackImporter = false
    @State private var showManufacturerPackImporter = false
    @State private var showCodingConfirmation = false
    @State private var showOneTapConfirmation = false
    @State private var featurePackStatus = ""
    @State private var message = ""
    @State private var captureURL: URL?
    @State private var learnedPackURL: URL?

    var body: some View {
        NavigationStack {
            List {
                Section("ThinkDiag Plus / OBD") {
                    LabeledContent("Durum", value: bluetooth.state.label)
                    HStack {
                        Button {
                            bluetooth.scan()
                        } label: {
                            Label("Bluetooth Tara", systemImage: "dot.radiowaves.left.and.right")
                        }
                        Spacer()
                        if case .connected = bluetooth.state {
                            Button("Ayır") { bluetooth.disconnect() }
                        }
                    }
                    ForEach(bluetooth.devices.prefix(12)) { device in
                        Button {
                            bluetooth.connect(device)
                        } label: {
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(device.name)
                                    Text(device.id.uuidString)
                                        .font(.caption2.monospaced())
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text("\(device.rssi) dBm")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    if bluetooth.isThinkDiagTransportReady {
                        Text("\(bluetooth.discoveredServices.count) servis/karakteristik • \(bluetooth.notificationFrames.count) ham paket • \(bluetooth.decodedFrames.count) VCI frame")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(bluetooth.protocolFingerprint.summary)
                            .font(.caption2.monospaced())
                            .foregroundStyle(.secondary)
                        if bluetooth.preferredServiceDetected {
                            Label("ThinkDiag/Launch BLE imzası bulundu", systemImage: "checkmark.seal.fill")
                                .font(.caption)
                        }
                        if let write = bluetooth.writableCharacteristic {
                            Text("WRITE: \(write)").font(.caption2.monospaced()).textSelection(.enabled)
                        }
                        if let notify = bluetooth.notifyCharacteristic {
                            Text("NOTIFY: \(notify)").font(.caption2.monospaced()).textSelection(.enabled)
                        }
                    }
                    Text(bluetooth.transportNotice)
                        .font(.caption2)
                        .foregroundStyle(.secondary)

                    if bluetooth.isThinkDiagTransportReady {
                        if bluetooth.canWrite {
                            if let profile = bluetooth.protocolProfile {
                                LabeledContent("Doğrulanmış header", value: profile.headerHex)
                                    .font(.caption)
                            }

                            Button {
                                Task {
                                    message = "Kayıtlı, bekleyen ve kalıcı OBD hata kodları taranıyor…"
                                    await bluetooth.scanGenericDtcStates()
                                    message = "Genel OBD hata kodu taraması tamamlandı."
                                }
                            } label: {
                                Label(
                                    bluetooth.genericDtcScanRunning ? "Hata kodları taranıyor…" : "Hata kodlarını tara",
                                    systemImage: "stethoscope"
                                )
                            }
                            .disabled(bluetooth.genericDtcScanRunning)

                            Button {
                                Task {
                                    message = "Salt-okuma protokol taraması çalışıyor…"
                                    await bluetooth.runReadOnlyHeaderSweep()
                                    if let profile = bluetooth.protocolProfile {
                                        message = "ThinkDiag header doğrulandı: \(profile.headerHex)"
                                    } else {
                                        message = "Header taraması tamamlandı; doğrulanmış Mode 03 cevabı bulunamadı."
                                    }
                                }
                            } label: {
                                Label(bluetooth.probeRunning ? "Protokol taranıyor…" : "Salt-okuma protokol taraması", systemImage: "waveform.badge.magnifyingglass")
                            }
                            .disabled(bluetooth.probeRunning)

                            if bluetooth.protocolProfile != nil {
                                Button {
                                    if bluetooth.livePolling {
                                        bluetooth.stopLivePolling()
                                        message = "Canlı veri okuma durduruldu."
                                    } else {
                                        bluetooth.startLivePolling()
                                        message = "RPM, MAP, MAF, sıcaklık, hız ve modül voltajı okunuyor…"
                                    }
                                } label: {
                                    Label(
                                        bluetooth.livePolling ? "Canlı veriyi durdur" : "Canlı veriyi başlat",
                                        systemImage: bluetooth.livePolling ? "stop.circle" : "waveform.path.ecg"
                                    )
                                }
                            }

                            if !bluetooth.probeAttempts.isEmpty {
                                DisclosureGroup("Protokol testleri") {
                                    ForEach(bluetooth.probeAttempts) { attempt in
                                        HStack {
                                            Text(attempt.headerHex).font(.caption.monospaced())
                                            Spacer()
                                            Text(attempt.success ? "OK" : attempt.detail)
                                                .font(.caption2)
                                                .foregroundStyle(attempt.success ? .green : .secondary)
                                        }
                                    }
                                }
                            }
                        }

                        Button {
                            captureURL = makeCaptureFile()
                        } label: {
                            Label("ThinkDiag bağlantı kaydını hazırla", systemImage: "square.and.arrow.up")
                        }
                    }

                    if let captureURL {
                        ShareLink(item: captureURL) {
                            Label("Bağlantı kaydını paylaş / kaydet", systemImage: "doc.text")
                        }
                    }

                    if !bluetooth.passiveObservations.isEmpty {
                        DisclosureGroup("Araçtan algılanan veriler") {
                            ForEach(bluetooth.passiveObservations.suffix(30)) { observation in
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(observation.title).font(.caption.weight(.semibold))
                                    Text("\(observation.kind) • \(observation.detail) • op \(String(format: "%04X", observation.sourceOpcode))")
                                        .font(.caption2.monospaced())
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }

                    if !bluetooth.decodedFrames.isEmpty {
                        DisclosureGroup("Çözülen VCI çerçeveleri") {
                            ForEach(bluetooth.decodedFrames.suffix(20)) { frame in
                                Text(frame.hex)
                                    .font(.caption2.monospaced())
                                    .textSelection(.enabled)
                            }
                        }
                    }

                    if !bluetooth.discoveredServices.isEmpty {
                        DisclosureGroup("Bluetooth servisleri") {
                            ForEach(bluetooth.discoveredServices, id: \.self) { item in
                                Text(item).font(.caption2.monospaced()).textSelection(.enabled)
                            }
                        }
                    }
                }

                Section("Araç") {
                    Picker("Marka", selection: $selectedBrand) {
                        ForEach(VehicleBrand.allCases) { brand in
                            Text(brand.rawValue).tag(brand)
                        }
                    }

                    if let vin = detectedVIN {
                        LabeledContent("VIN", value: vin)
                        if selectedBrand == .generic {
                            let detected = VehicleBrand.detect(fromVIN: vin)
                            if detected != .generic {
                                Button("Markayı VIN'den seç: \(detected.rawValue)") {
                                    selectedBrand = detected
                                }
                            }
                        }
                    }

                    ForEach([VehicleCapability.readDtcs, .liveData, .moduleScan, .coding, .adaptations, .hiddenFeatures]) { capability in
                        LabeledContent(
                            capability.rawValue,
                            value: VehicleCapabilityMatrix.support(
                                for: capability,
                                brand: selectedBrand,
                                protocolConfirmed: bluetooth.protocolProfile != nil
                            ).rawValue
                        )
                        .font(.caption)
                    }
                }

                Section("Kontrol Üniteleri") {
                    if ManufacturerDiagnosticRegistry.shared.pack(for: effectiveBrand) != nil {
                        Button {
                            Task {
                                message = "Tüm üretici modülleri taranıyor…"
                                await moduleScanner.scan(brand: effectiveBrand) { opcode, request in
                                    await bluetooth.requestVCI(opcode: opcode, payload: request)
                                }
                                message = "Üretici modül taraması tamamlandı."
                            }
                        } label: {
                            Label(
                                moduleScanner.running ? "Modüller taranıyor…" : "Tüm modülleri tara",
                                systemImage: "square.grid.3x3.square"
                            )
                        }
                        .disabled(moduleScanner.running || bluetooth.protocolProfile == nil)

                        if moduleScanner.running && !moduleScanner.currentModule.isEmpty {
                            HStack {
                                ProgressView()
                                Text(moduleScanner.currentModule)
                                    .font(.caption)
                            }
                        }

                        ForEach(moduleScanner.results) { result in
                            DisclosureGroup {
                                if let error = result.error {
                                    Text(error)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                ForEach(result.identification.keys.sorted(), id: \.self) { key in
                                    LabeledContent(key, value: result.identification[key] ?? "")
                                        .font(.caption2)
                                }
                                if result.dtcs.isEmpty && result.error == nil {
                                    Text("DTC yok")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                } else {
                                    ForEach(result.dtcs) { dtc in
                                        Text("\(dtc.hexCode) • status 0x\(String(format: "%02X", dtc.status))")
                                            .font(.caption2.monospaced())
                                    }
                                }
                            } label: {
                                Text("\(result.moduleName) • \(result.address)")
                            }
                        }
                    } else if effectiveBrand != .generic {
                        Button {
                            showManufacturerPackImporter = true
                        } label: {
                            Label("\(effectiveBrand.rawValue) teşhis paketi yükle", systemImage: "shippingbox")
                        }
                    }

                    ForEach(VehicleModuleCatalog.modules(for: effectiveBrand)) { module in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(module.kind.rawValue)
                                Text(module.logicalName + " • " + module.protocolFamily.rawValue)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(module.manufacturerPackRequired ? "Üretici paketi" : "Genel OBD")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                }

                if ManufacturerDiagnosticRegistry.shared.pack(for: effectiveBrand) != nil {
                    Section("Üretici Canlı Verileri") {
                        Button {
                            if manufacturerLive.running {
                                manufacturerLive.stop()
                                message = "Üretici canlı verileri durduruldu."
                            } else {
                                manufacturerLive.start(brand: effectiveBrand) { opcode, request, expected in
                                    await bluetooth.requestVCI(
                                        opcode: opcode,
                                        payload: request,
                                        expectedPayloadPrefix: expected
                                    )
                                }
                                message = "Üretici canlı verileri okunuyor…"
                            }
                        } label: {
                            Label(
                                manufacturerLive.running ? "Üretici canlı verilerini durdur" : "Üretici canlı verilerini başlat",
                                systemImage: manufacturerLive.running ? "stop.circle" : "waveform.path.ecg"
                            )
                        }
                        .disabled(bluetooth.protocolProfile == nil)

                        if let error = manufacturerLive.error {
                            Text(error)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }

                        ForEach(manufacturerLive.values) { item in
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(item.label)
                                    Text("\(item.moduleName) • DID 0x\(String(format: "%04X", item.did))")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text(item.unit.map { "\(item.textValue) \($0)" } ?? item.textValue)
                                    .font(.caption.monospaced())
                            }
                        }
                    }
                }

                let dtcExplanations = currentDtcExplanations
                if !dtcExplanations.isEmpty {
                    Section("Hata Kodları ve Açıklamalar") {
                        ForEach(dtcExplanations) { item in
                            DisclosureGroup {
                                Text(item.meaning)
                                    .font(.caption)
                                if !item.likelyCauses.isEmpty {
                                    Text("Olası nedenler: " + item.likelyCauses.joined(separator: " • "))
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                                if !item.checks.isEmpty {
                                    Text("Kontroller: " + item.checks.joined(separator: " • "))
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                            } label: {
                                VStack(alignment: .leading) {
                                    Text("\(item.code) — \(item.title)")
                                        .font(.headline)
                                    Text("Önem: \(item.severity)")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }

                        if diagnosticAI.loading {
                            HStack {
                                ProgressView()
                                Text("JARVIS hata kodlarını yorumluyor…")
                                    .font(.caption)
                            }
                        } else if !diagnosticAI.explanation.isEmpty {
                            DisclosureGroup("JARVIS teşhis yorumu") {
                                Text(diagnosticAI.explanation)
                                    .font(.caption)
                                    .textSelection(.enabled)
                            }
                        }
                    }
                }

                let recommendedFeatures = evidenceFeatureAvailability.filter {
                    switch $0.state {
                    case .available, .maybeAvailable: return true
                    case .unavailable: return false
                    }
                }

                if !recommendedFeatures.isEmpty {
                    Section("Araç İçin Tek-Tık Kodlamalar") {
                        ForEach(recommendedFeatures) { availability in
                            let plan = OneTapCodingResolver.resolve(
                                feature: availability.feature,
                                brand: effectiveBrand,
                                inventory: connectedInventory
                            )

                            VStack(alignment: .leading, spacing: 7) {
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(availability.feature.title)
                                            .font(.headline)
                                        Text(availability.feature.description)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    Text(availability.state.label)
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }

                                Text("Risk: \(availability.feature.risk.rawValue) • Kanıt: \(availability.matchedEvidenceCount) kaynak • Eşleşme: \(Int(availability.score * 100))%")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)

                                switch availability.state {
                                case .available:
                                    if plan.executable {
                                        Button {
                                            Task {
                                                await oneTapCoordinator.prepare(
                                                    feature: availability.feature,
                                                    inventory: connectedInventory,
                                                    transportReady: bluetooth.canWrite && bluetooth.protocolProfile != nil
                                                ) { opcode, request, expected in
                                                    await bluetooth.requestVCI(
                                                        opcode: opcode,
                                                        payload: request,
                                                        expectedPayloadPrefix: expected
                                                    )
                                                }
                                                message = oneTapCoordinator.state.label
                                                if case .awaitingConfirmation = oneTapCoordinator.state {
                                                    showOneTapConfirmation = true
                                                }
                                            }
                                        } label: {
                                            Label("Tek tıkla uygula", systemImage: "bolt.circle.fill")
                                        }
                                        .disabled(bluetooth.protocolProfile == nil)
                                    } else {
                                        Text("Araç bu özellik için uygun görünüyor; fakat bağlı ECU parça/yazılım sürümü için exact yazma reçetesi henüz doğrulanmadı.")
                                            .font(.caption2)
                                            .foregroundStyle(.secondary)
                                    }
                                case .maybeAvailable(let reasons):
                                    Text(reasons.joined(separator: " • "))
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                case .unavailable:
                                    EmptyView()
                                }

                                DisclosureGroup("Kaynaklar ve doğrulama") {
                                    ForEach(availability.feature.evidence) { source in
                                        VStack(alignment: .leading, spacing: 3) {
                                            if let url = URL(string: source.url) {
                                                Link(source.title, destination: url)
                                                    .font(.caption)
                                            } else {
                                                Text(source.title).font(.caption)
                                            }
                                            Text("\(source.kind.rawValue) • güven \(Int(source.confidence * 100))%")
                                                .font(.caption2)
                                                .foregroundStyle(.secondary)
                                        }
                                    }
                                }
                            }
                            .padding(.vertical, 4)
                        }

                        Text(oneTapCoordinator.state.label)
                            .font(.caption2)
                            .foregroundStyle(.secondary)

                        if !oneTapCoordinator.log.isEmpty {
                            DisclosureGroup("Tek-tık işlem kaydı") {
                                ForEach(Array(oneTapCoordinator.log.enumerated()), id: \.offset) { _, line in
                                    Text(line)
                                        .font(.caption2.monospaced())
                                        .textSelection(.enabled)
                                }
                            }
                        }
                    }
                }

                Section("Kodlama / Adaptasyon / Gizli Özellikler") {
                    let pack = CodingFeatureCatalog.pack(for: selectedBrand)
                    if selectedBrand == .generic {
                        Text("Önce marka seç veya VIN okununca JARVIS markayı belirlesin.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } else if pack.features.isEmpty {
                        Text("\(selectedBrand.rawValue) için üretici özellik paketi altyapısı hazır; doğrulanmış modül/reçeteler eklendikçe burada açılacak.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(pack.features) { feature in
                            Button {
                                Task {
                                    await codingCoordinator.prepareAndBackup(
                                        feature,
                                        vin: detectedVIN,
                                        transportReady: bluetooth.canWrite && bluetooth.protocolProfile != nil
                                    ) { opcode, request, expected in
                                        await bluetooth.requestVCI(
                                            opcode: opcode,
                                            payload: request,
                                            expectedPayloadPrefix: expected
                                        )
                                    }
                                    message = codingCoordinator.state.label
                                    if case .awaitingConfirmation = codingCoordinator.state {
                                        showCodingConfirmation = true
                                    }
                                }
                            } label: {
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(feature.title)
                                    Text("\(feature.module) • \(feature.kind.rawValue) • Risk: \(feature.risk.rawValue)")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                    Text(feature.description)
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                            }
                        }
                    }

                    HStack {
                        Button {
                            showFeaturePackImporter = true
                        } label: {
                            Label("Kodlama paketi", systemImage: "slider.horizontal.3")
                        }

                        Button {
                            showManufacturerPackImporter = true
                        } label: {
                            Label("Teşhis paketi", systemImage: "shippingbox.and.arrow.backward")
                        }
                    }

                    if !featurePackStatus.isEmpty {
                        Text(featurePackStatus)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }

                    Text(codingCoordinator.state.label)
                        .font(.caption2)
                        .foregroundStyle(.secondary)

                    if !codingCoordinator.executionLog.isEmpty {
                        DisclosureGroup("Kodlama işlem kaydı") {
                            ForEach(Array(codingCoordinator.executionLog.enumerated()), id: \.offset) { _, line in
                                Text(line)
                                    .font(.caption2.monospaced())
                                    .textSelection(.enabled)
                            }
                        }
                    }

                    Text("Kodlama işlemleri yalnızca araç/modül için doğrulanmış üretici reçetesi bulunduğunda açılır; mevcut değer önce yedeklenir ve yazma öncesi ayrıca onay gerekir.")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }

                Section("Protokol Öğrenme") {
                    Button {
                        if protocolLearner.active {
                            protocolLearner.stop()
                            message = "Protokol öğrenme durduruldu."
                        } else {
                            protocolLearner.start(currentFrameCount: bluetooth.decodedFrames.count)
                            message = "Protokol öğrenme başladı; JARVIS gelen UDS servislerini ve DID'leri kaydediyor."
                        }
                    } label: {
                        Label(
                            protocolLearner.active ? "Öğrenmeyi durdur" : "Protokol öğrenmeyi başlat",
                            systemImage: protocolLearner.active ? "stop.circle" : "brain.head.profile"
                        )
                    }

                    if !protocolLearner.observations.isEmpty {
                        Text("\(protocolLearner.observations.count) protokol gözlemi bulundu")
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        DisclosureGroup("Bulunan servisler / DID'ler") {
                            ForEach(protocolLearner.observations) { item in
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(item.detail)
                                        .font(.caption)
                                    Text("VCI op \(String(format: "%04X", item.opcode)) • \(item.rawHex)")
                                        .font(.caption2.monospaced())
                                        .foregroundStyle(.secondary)
                                        .textSelection(.enabled)
                                }
                            }
                        }

                        Button {
                            learnedPackURL = makeLearnedPackFile()
                        } label: {
                            Label("Aday üretici paketi oluştur", systemImage: "wand.and.stars")
                        }

                        if let learnedPackURL {
                            ShareLink(item: learnedPackURL) {
                                Label("Öğrenilen paketi paylaş / kaydet", systemImage: "square.and.arrow.up")
                            }
                        }
                    }

                    Text("Öğrenme modu yalnızca gözlem yapar. Yakalanan opcode, UDS servisleri ve DID'lerden aday paket üretir; bilinmeyen kodlama yazma komutları otomatik oluşturulmaz.")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }

                Section("ThinkDiag Kayıt / Rapor") {
                    Button {
                        showImporter = true
                    } label: {
                        Label("Rapor veya canlı veri dosyası içe aktar", systemImage: "doc.badge.plus")
                    }
                    Text("CSV, JSON ve metin raporlarından DTC kodlarını; ThinkCar .TC kayıtlarından parametre adları, birimler ve son canlı değerleri çıkarır.")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }

                if let snapshot {
                    Section("Canlı Veriler") {
                        if snapshot.metrics.isEmpty {
                            Text("Tanımlanan canlı değer bulunamadı").foregroundStyle(.secondary)
                        }
                        ForEach(snapshot.metrics) { metric in
                            LabeledContent(metric.label, value: format(metric))
                        }
                    }

                    Section("Teşhis Özeti") {
                        Text("Kaynak: \(snapshot.sourceName)")
                        ForEach(snapshot.notes, id: \.self) { note in
                            Text(note).font(.caption).foregroundStyle(.secondary)
                        }
                        if let boost = snapshot.metrics.first(where: { $0.key.contains("turbo") || $0.key.contains("manifold") }) {
                            Text("Turbo verisi bulundu: \(format(boost)). P0299 için sonraki sürümde requested/actual basınç farkı otomatik grafiklenecek.")
                                .font(.caption)
                        }
                    }
                }

                if !message.isEmpty {
                    Section("Durum") { Text(message).font(.caption) }
                }
            }
            .navigationTitle("Araç Teşhis")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Kapat") { dismiss() }
                }
            }
            .sheet(isPresented: $showImporter) {
                UniversalDocumentPicker(allowsMultipleSelection: false) { urls in
                    showImporter = false
                    guard let url = urls.first else { return }
                    load(url)
                } onCancel: {
                    showImporter = false
                }
                .ignoresSafeArea()
            }
            .sheet(isPresented: $showFeaturePackImporter) {
                UniversalDocumentPicker(allowsMultipleSelection: false) { urls in
                    showFeaturePackImporter = false
                    guard let url = urls.first else { return }
                    loadFeaturePack(url)
                } onCancel: {
                    showFeaturePackImporter = false
                }
                .ignoresSafeArea()
            }
            .sheet(isPresented: $showManufacturerPackImporter) {
                UniversalDocumentPicker(allowsMultipleSelection: false) { urls in
                    showManufacturerPackImporter = false
                    guard let url = urls.first else { return }
                    loadManufacturerPack(url)
                } onCancel: {
                    showManufacturerPackImporter = false
                }
                .ignoresSafeArea()
            }
            .confirmationDialog(
                "Tek-tık kodlamayı uygula?",
                isPresented: $showOneTapConfirmation,
                titleVisibility: .visible
            ) {
                Button("Uygula") {
                    Task {
                        await oneTapCoordinator.execute { opcode, request, expected in
                            await bluetooth.requestVCI(
                                opcode: opcode,
                                payload: request,
                                expectedPayloadPrefix: expected
                            )
                        }
                        message = oneTapCoordinator.state.label
                    }
                }
                Button("İptal", role: .cancel) {
                    oneTapCoordinator.cancel()
                }
            } message: {
                Text("JARVIS araçtaki mevcut değerleri yedekledi. Yalnızca bu ECU parça/yazılım sürümüyle eşleşen doğrulanmış reçete uygulanacak ve sonuç tekrar okunarak kontrol edilecek.")
            }
            .confirmationDialog(
                "Kodlama işlemini uygula?",
                isPresented: $showCodingConfirmation,
                titleVisibility: .visible
            ) {
                Button("Uygula") {
                    Task {
                        await codingCoordinator.executeConfirmed { opcode, request, expected in
                            await bluetooth.requestVCI(
                                opcode: opcode,
                                payload: request,
                                expectedPayloadPrefix: expected
                            )
                        }
                        message = codingCoordinator.state.label
                    }
                }
                Button("İptal", role: .cancel) {
                    codingCoordinator.cancel()
                }
            } message: {
                Text("Mevcut değer yedeklendi. Doğrulanmış reçete araca yazılacak ve ardından tekrar okunarak kontrol edilecek.")
            }
            .onChange(of: bluetooth.decodedFrames.count) { _, _ in
                protocolLearner.ingest(bluetooth.decodedFrames)
            }
            .onChange(of: dtcCodeKey) { _, _ in
                Task {
                    await diagnosticAI.explainIfNeeded(
                        codes: currentDtcExplanations.map(\.code),
                        brand: effectiveBrand,
                        vin: detectedVIN,
                        observations: bluetooth.passiveObservations
                    )
                }
            }
            .onDisappear {
                bluetooth.stopLivePolling()
                manufacturerLive.stop()
            }
            .onChange(of: detectedVIN) { _, newVIN in
                guard selectedBrand == .generic, let newVIN else { return }
                let detected = VehicleBrand.detect(fromVIN: newVIN)
                if detected != .generic { selectedBrand = detected }
            }
        }
    }

    private var connectedInventory: ConnectedVehicleInventory {
        let identities = moduleScanner.results.map { result in
            let part = firstIdentificationValue(
                result.identification,
                matching: ["part", "teil", "hardware", "hw", "spare"]
            )
            let software = firstIdentificationValue(
                result.identification,
                matching: ["software", "sw", "version"]
            )
            return ConnectedModuleIdentity(
                address: result.address,
                name: result.moduleName,
                partNumber: part,
                softwareVersion: software
            )
        }

        var equipment = Set<String>()
        let names = identities.map { $0.name.lowercased() }
        if names.contains(where: { $0.contains("door") || $0.contains("tür") }) {
            equipment.insert("electric_mirror")
        }
        if names.contains(where: { $0.contains("camera") || $0.contains("a5") }) {
            equipment.insert("front_camera")
        }

        return ConnectedVehicleInventory(
            vin: detectedVIN,
            brand: effectiveBrand,
            modelName: inferredModelName,
            platform: inferredPlatform,
            modelYear: vinModelYear(detectedVIN),
            modules: identities,
            equipmentTokens: equipment
        )
    }

    private var evidenceFeatureAvailability: [FeatureAvailability] {
        FeatureApplicabilityEngine.availableFeatures(
            catalog: EvidenceBackedFeatureCatalog.all,
            inventory: connectedInventory
        )
    }

    private var inferredModelName: String? {
        for result in moduleScanner.results {
            if let value = firstIdentificationValue(
                result.identification,
                matching: ["model", "vehicle", "fahrzeug", "type"]
            ) {
                return value
            }
        }
        if effectiveBrand == .volkswagen, detectedVIN?.hasPrefix("WVW") == true {
            return "Passat"
        }
        return nil
    }

    private var inferredPlatform: String? {
        for result in moduleScanner.results {
            if let value = firstIdentificationValue(
                result.identification,
                matching: ["platform", "odx", "ev_", "mqb", "mlb", "meb"]
            ) {
                return value
            }
        }
        return nil
    }

    private func firstIdentificationValue(
        _ values: [String:String],
        matching needles: [String]
    ) -> String? {
        for key in values.keys.sorted() {
            let lower = key.lowercased()
            if needles.contains(where: { lower.contains($0.lowercased()) }),
               let value = values[key],
               !value.isEmpty {
                return value
            }
        }
        return nil
    }

    private func vinModelYear(_ vin: String?) -> Int? {
        guard let vin, vin.count == 17 else { return nil }
        let index = vin.index(vin.startIndex, offsetBy: 9)
        let code = vin[index]
        let table: [Character:Int] = [
            "A": 2010, "B": 2011, "C": 2012, "D": 2013, "E": 2014,
            "F": 2015, "G": 2016, "H": 2017, "J": 2018, "K": 2019,
            "L": 2020, "M": 2021, "N": 2022, "P": 2023, "R": 2024,
            "S": 2025, "T": 2026, "V": 2027, "W": 2028, "X": 2029,
            "Y": 2030, "1": 2031, "2": 2032, "3": 2033, "4": 2034,
            "5": 2035, "6": 2036, "7": 2037, "8": 2038, "9": 2039
        ]
        return table[code]
    }

    private var effectiveBrand: VehicleBrand {
        if selectedBrand != .generic { return selectedBrand }
        if let vin = detectedVIN {
            return VehicleBrand.detect(fromVIN: vin)
        }
        return .generic
    }

    private var dtcCodeKey: String {
        currentDtcExplanations.map(\.code).sorted().joined(separator: "|")
    }

    private var detectedVIN: String? {
        bluetooth.passiveObservations
            .last(where: { $0.kind == "VIN" })?
            .detail
    }

    private var currentDtcExplanations: [DtcExplanation] {
        var codes = Set<String>()

        for observation in bluetooth.passiveObservations
            where observation.kind == "DTC"
                || observation.kind == "PENDING_DTC"
                || observation.kind == "PERMANENT_DTC" {
            codes.insert(observation.title.uppercased())
        }

        for dtc in snapshot?.dtcs ?? [] {
            codes.insert(dtc.code.uppercased())
        }

        return codes.sorted().map(DiagnosticDtcCatalog.explain)
    }

    private func loadManufacturerPack(_ url: URL) {
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }

        do {
            let data = try Data(contentsOf: url)
            let manifest = try ManufacturerDiagnosticPackLoader.load(data: data)
            featurePackStatus = "\(manifest.brand.rawValue) teşhis paketi \(manifest.packVersion) yüklendi • \(manifest.modules.count) modül • \(manifest.codingRecipes.count) kodlama reçetesi"
            if selectedBrand == .generic {
                selectedBrand = manifest.brand
            }
        } catch {
            featurePackStatus = "Teşhis paketi yüklenemedi: \(error.localizedDescription)"
        }
    }

    private func loadFeaturePack(_ url: URL) {
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }

        do {
            let data = try Data(contentsOf: url)
            let manifest = try ManufacturerFeaturePackLoader.load(data: data)
            featurePackStatus = "\(manifest.brand.rawValue) özellik paketi \(manifest.packVersion) yüklendi • \(manifest.recipes.count) reçete"
            if selectedBrand == .generic {
                selectedBrand = manifest.brand
            }
        } catch {
            featurePackStatus = "Özellik paketi yüklenemedi: \(error.localizedDescription)"
        }
    }

    private func load(_ url: URL) {
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        do {
            let data = try Data(contentsOf: url)
            snapshot = ThinkCarImport.parse(data: data, filename: url.lastPathComponent)
            message = "Dosya analiz edildi"
        } catch {
            message = "Dosya açılamadı: \(error.localizedDescription)"
        }
    }

    private func makeLearnedPackFile() -> URL? {
        do {
            let data = try ManufacturerPackCandidateGenerator.exportCandidate(
                brand: effectiveBrand,
                observations: protocolLearner.observations
            )
            let safeBrand = effectiveBrand.rawValue.replacingOccurrences(of: " ", with: "-")
            let url = FileManager.default.temporaryDirectory
                .appendingPathComponent("JARVIS-\(safeBrand)-learned-pack.json")
            try data.write(to: url, options: .atomic)
            message = "Aday üretici paketi oluşturuldu."
            return url
        } catch {
            message = "Aday paket oluşturulamadı: \(error.localizedDescription)"
            return nil
        }
    }

    private func makeCaptureFile() -> URL? {
        var lines: [String] = []
        lines.append("JARVIS ThinkDiag capture")
        lines.append("state=\(bluetooth.state.label)")
        lines.append("preferredServiceDetected=\(bluetooth.preferredServiceDetected)")
        lines.append("write=\(bluetooth.writableCharacteristic ?? "-")")
        lines.append("notify=\(bluetooth.notifyCharacteristic ?? "-")")
        lines.append("bytesSeen=\(bluetooth.streamStats.bytesSeen)")
        lines.append("framesDecoded=\(bluetooth.streamStats.framesDecoded)")
        lines.append("checksumValid=\(bluetooth.streamStats.checksumValid)")
        lines.append("discardedBytes=\(bluetooth.streamStats.discardedBytes)")
        lines.append("fingerprint=\(bluetooth.protocolFingerprint.summary)")
        lines.append("protocolProfile=\(bluetooth.protocolProfile?.headerHex ?? "-")")
        lines.append(contentsOf: bluetooth.probeAttempts.map { "probe|\($0.headerHex)|\($0.success)|\($0.detail)" })
        lines.append("--- services ---")
        lines.append(contentsOf: bluetooth.discoveredServices)
        lines.append("--- passive observations ---")
        lines.append(contentsOf: bluetooth.passiveObservations.map {
            "\($0.kind)|\($0.title)|\($0.detail)|op=\(String(format: "%04X", $0.sourceOpcode))"
        })
        lines.append("--- decoded frames ---")
        lines.append(contentsOf: bluetooth.decodedFrames.map(\.hex))
        lines.append("--- raw notifications ---")
        lines.append(contentsOf: bluetooth.notificationFrames.map { data in
            data.map { String(format: "%02X", $0) }.joined()
        })
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("JARVIS-ThinkDiag-\(Int(Date().timeIntervalSince1970)).txt")
        do {
            try lines.joined(separator: "\n").write(to: url, atomically: true, encoding: .utf8)
            message = "ThinkDiag bağlantı kaydı hazır"
            return url
        } catch {
            message = "Kayıt hazırlanamadı: \(error.localizedDescription)"
            return nil
        }
    }

    private func format(_ metric: DiagnosticLiveMetric) -> String {
        let value = metric.value.rounded() == metric.value
            ? String(Int(metric.value))
            : String(format: "%.2f", metric.value)
        return metric.unit.isEmpty ? value : "\(value) \(metric.unit)"
    }
}
