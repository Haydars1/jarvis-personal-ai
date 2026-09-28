import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const contentView = fs.readFileSync(new URL('../ios/JARVIS/ContentView.swift', import.meta.url), 'utf8');
const diagnostics = fs.readFileSync(new URL('../ios/JARVIS/DiagnosticView.swift', import.meta.url), 'utf8');
const bluetooth = fs.readFileSync(new URL('../ios/JARVIS/ThinkDiagBluetooth.swift', import.meta.url), 'utf8');
const importer = fs.readFileSync(new URL('../ios/JARVIS/ThinkCarImport.swift', import.meta.url), 'utf8');
const project = fs.readFileSync(new URL('../ios/project.yml', import.meta.url), 'utf8');
const vciFrame = fs.readFileSync(new URL('../ios/JARVIS/ThinkDiagVciFrame.swift', import.meta.url), 'utf8');
const assembler = fs.readFileSync(new URL('../ios/JARVIS/ThinkDiagFrameAssembler.swift', import.meta.url), 'utf8');
const passive = fs.readFileSync(new URL('../ios/JARVIS/ThinkDiagPassiveDecoder.swift', import.meta.url), 'utf8');
const analyzer = fs.readFileSync(new URL('../ios/JARVIS/ThinkDiagProtocolAnalyzer.swift', import.meta.url), 'utf8');
const profile = fs.readFileSync(new URL('../ios/JARVIS/ThinkDiagProtocolProfile.swift', import.meta.url), 'utf8');
const vehicleSupport = fs.readFileSync(new URL('../ios/JARVIS/VehicleSupport.swift', import.meta.url), 'utf8');
const dtcCatalog = fs.readFileSync(new URL('../ios/JARVIS/DiagnosticDtcCatalog.swift', import.meta.url), 'utf8');
const codingCatalog = fs.readFileSync(new URL('../ios/JARVIS/CodingFeatureCatalog.swift', import.meta.url), 'utf8');
const codingCoordinator = fs.readFileSync(new URL('../ios/JARVIS/VehicleCodingCoordinator.swift', import.meta.url), 'utf8');
const diagnosticAI = fs.readFileSync(new URL('../ios/JARVIS/VehicleDiagnosticAI.swift', import.meta.url), 'utf8');
const moduleCatalog = fs.readFileSync(new URL('../ios/JARVIS/VehicleModuleCatalog.swift', import.meta.url), 'utf8');
const uds = fs.readFileSync(new URL('../ios/JARVIS/UDSCodec.swift', import.meta.url), 'utf8');
const manufacturerPack = fs.readFileSync(new URL('../ios/JARVIS/ManufacturerDiagnosticPack.swift', import.meta.url), 'utf8');
const moduleScanner = fs.readFileSync(new URL('../ios/JARVIS/ManufacturerModuleScanner.swift', import.meta.url), 'utf8');
const transportCodec = fs.readFileSync(new URL('../ios/JARVIS/ManufacturerTransportCodec.swift', import.meta.url), 'utf8');
const manufacturerLive = fs.readFileSync(new URL('../ios/JARVIS/ManufacturerLiveDataController.swift', import.meta.url), 'utf8');
const protocolLearner = fs.readFileSync(new URL('../ios/JARVIS/ManufacturerProtocolLearner.swift', import.meta.url), 'utf8');
const packCandidate = fs.readFileSync(new URL('../ios/JARVIS/ManufacturerPackCandidateGenerator.swift', import.meta.url), 'utf8');
const evidenceModels = fs.readFileSync(new URL('../ios/JARVIS/EvidenceCodingModels.swift', import.meta.url), 'utf8');
const applicability = fs.readFileSync(new URL('../ios/JARVIS/FeatureApplicabilityEngine.swift', import.meta.url), 'utf8');
const evidenceCatalog = fs.readFileSync(new URL('../ios/JARVIS/EvidenceBackedFeatureCatalog.swift', import.meta.url), 'utf8');
const oneTapResolver = fs.readFileSync(new URL('../ios/JARVIS/OneTapCodingResolver.swift', import.meta.url), 'utf8');
const oneTapCoordinator = fs.readFileSync(new URL('../ios/JARVIS/OneTapCodingCoordinator.swift', import.meta.url), 'utf8');
const semanticRegistry = fs.readFileSync(new URL('../ios/JARVIS/SemanticCodingRegistry.swift', import.meta.url), 'utf8');
const researchRegistry = fs.readFileSync(new URL('../ios/JARVIS/VehicleCodingResearchRegistry.swift', import.meta.url), 'utf8');
const allBrandResearch = fs.readFileSync(new URL('../ios/JARVIS/AllBrandCodingResearchCatalog.swift', import.meta.url), 'utf8');
const researchPaging = fs.readFileSync(new URL('../ios/JARVIS/ResearchPaginationPolicy.swift', import.meta.url), 'utf8');
const genericObd = fs.readFileSync(new URL('../ios/JARVIS/GenericObdLiveData.swift', import.meta.url), 'utf8');
const genericPanel = fs.readFileSync(new URL('../ios/JARVIS/GenericObdLivePanel.swift', import.meta.url), 'utf8');
const boostAnalyzer = fs.readFileSync(new URL('../ios/JARVIS/GenericBoostAnalyzer.swift', import.meta.url), 'utf8');
const driveLogger = fs.readFileSync(new URL('../ios/JARVIS/DriveLogRecorder.swift', import.meta.url), 'utf8');

test('native sidebar exposes vehicle diagnostics workspace', () => {
  assert.match(contentView, /Label\("Araç Teşhis"/);
  assert.match(contentView, /DiagnosticView\(\)/);
});

test('diagnostics workspace can scan and connect Bluetooth OBD devices', () => {
  assert.match(diagnostics, /Bluetooth Tara/);
  assert.match(bluetooth, /CBCentralManager/);
  assert.match(bluetooth, /discoverServices\(nil\)/);
  assert.match(bluetooth, /setNotifyValue\(true/);
});

test('ThinkCar exports can be imported for DTC and live-data extraction', () => {
  assert.match(diagnostics, /Rapor veya canlı veri dosyası içe aktar/);
  assert.match(importer, /\\b\[PCBU\]/);
  assert.match(importer, /Turbo basıncı/);
  assert.match(importer, /DPF diferansiyel basınç/);
  assert.match(importer, /LSX8/);
  assert.match(importer, /parseTCStrings/);
});

test('ThinkDiag transport fingerprints Launch BLE services and decodes VCI frames', () => {
  assert.match(bluetooth, /preferredServiceDetected/);
  assert.match(bluetooth, /ThinkDiagVciFrame\.decode/);
  assert.match(vciFrame, /0000FFF0-0000-1000-8000-00805F9B34FB/);
  assert.match(vciFrame, /49535343-FE7D-4AE5-8FA9-9FAFD205E455/);
  assert.match(vciFrame, /checksumValid/);
  assert.match(vciFrame, /static func build/);
});

test('ThinkDiag stream assembler handles fragmented notifications', () => {
  assert.match(assembler, /preferredHeader/);
  assert.match(assembler, /payloadLength/);
  assert.match(assembler, /checksumValid/);
  assert.match(bluetooth, /assembler\.append\(data, preferredHeader: protocolProfile\?\.header\)/);
});

test('passive decoder recognizes standard read-only OBD responses', () => {
  assert.match(passive, /case 0x41/);
  assert.match(passive, /case 0x43/);
  assert.match(passive, /case 0x47/);
  assert.match(passive, /case 0x49/);
  assert.match(passive, /Motor devri/);
  assert.match(passive, /Manifold basıncı/);
  assert.match(bluetooth, /passiveObservations/);
  assert.match(passive, /case 0x42/);
});

test('captured frames are fingerprinted without sending vehicle commands', () => {
  assert.match(analyzer, /dominantHeader/);
  assert.match(analyzer, /checksumValidCount/);
  assert.match(diagnostics, /protocolFingerprint\.summary/);
});

test('direct ThinkDiag path exposes a read-only DTC probe', () => {
  assert.match(bluetooth, /sendReadOnlyDtcProbe/);
  assert.match(bluetooth, /opcode: 0x0103/);
  assert.match(diagnostics, /Hata kodlarını tara/);
});

test('ThinkDiag protocol profile is learned and persisted from read-only sweep', () => {
  assert.match(profile, /ThinkDiagProtocolProfileStore/);
  assert.match(bluetooth, /runReadOnlyHeaderSweep/);
  assert.match(bluetooth, /\[0x55, 0xAA\]/);
  assert.match(bluetooth, /\[0xAA, 0x55\]/);
  assert.match(bluetooth, /\[0xFE, 0x01\]/);
  assert.match(bluetooth, /\[0x40, 0xC8\]/);
  assert.match(diagnostics, /Salt-okuma protokol taraması/);
});

test('confirmed ThinkDiag profile unlocks read-only live PID polling', () => {
  assert.match(bluetooth, /sendReadOnlyPid/);
  assert.match(bluetooth, /opcode: 0x0101/);
  assert.match(bluetooth, /startLivePolling/);
  assert.match(bluetooth, /supportedPids/);
  assert.match(bluetooth, /discoverGenericCapabilities/);
  assert.match(diagnostics, /Canlı veriyi başlat/);
});

test('cross-brand diagnostics model covers major vehicle brands and VIN detection', () => {
  assert.match(vehicleSupport, /case volkswagen/);
  assert.match(vehicleSupport, /case mercedes/);
  assert.match(vehicleSupport, /case bmw/);
  assert.match(vehicleSupport, /case toyota/);
  assert.match(vehicleSupport, /case hyundai/);
  assert.match(vehicleSupport, /detect\(fromVIN/);
  assert.match(diagnostics, /Picker\("Marka"/);
});

test('DTC results are explained locally and can be interpreted by JARVIS AI', () => {
  assert.match(dtcCatalog, /"P0299"/);
  assert.match(dtcCatalog, /"P0401"/);
  assert.match(dtcCatalog, /"P2002"/);
  assert.match(diagnosticAI, /vehicle-diagnostics/);
  assert.match(diagnostics, /JARVIS teşhis yorumu/);
});

test('coding workspace is recipe-driven with backup and confirmation gates', () => {
  assert.match(codingCatalog, /CodingFeatureDescriptor/);
  assert.match(codingCatalog, /Konfor sinyal sayısı/);
  assert.match(codingCatalog, /Kilitlerken aynaları katla/);
  assert.match(codingCoordinator, /stageBackup/);
  assert.match(codingCoordinator, /awaitingConfirmation/);
  assert.match(codingCoordinator, /CodingRecipeRegistry/);
  assert.match(diagnostics, /Kodlama \/ Adaptasyon \/ Gizli Özellikler/);
});

test('cross-brand module catalog includes engine transmission ABS SRS and body systems', () => {
  assert.match(moduleCatalog, /case engine/);
  assert.match(moduleCatalog, /case transmission/);
  assert.match(moduleCatalog, /case abs/);
  assert.match(moduleCatalog, /case airbag/);
  assert.match(moduleCatalog, /case body/);
});

test('generic DTC scan reads stored pending and permanent states', () => {
  assert.match(bluetooth, /scanGenericDtcStates/);
  assert.match(bluetooth, /opcode: 0x0107/);
  assert.match(bluetooth, /opcode: 0x010A/);
  assert.match(passive, /case 0x4A/);
  assert.match(passive, /PERMANENT_DTC/);
  assert.match(diagnostics, /Hata kodlarını tara/);
});

test('diagnostic UI exposes cross-brand control-unit coverage', () => {
  assert.match(diagnostics, /Kontrol Üniteleri/);
  assert.match(diagnostics, /VehicleModuleCatalog\.modules/);
});

test('manufacturer diagnostics engine supports UDS DTC DID and session primitives', () => {
  assert.match(uds, /readDataByIdentifier/);
  assert.match(uds, /readDTCInformation/);
  assert.match(uds, /diagnosticSessionControl/);
  assert.match(uds, /writeDataByIdentifier/);
  assert.match(uds, /parseDTCResponse/);
});

test('manufacturer packs define module routes live DIDs and coding recipes', () => {
  assert.match(manufacturerPack, /ManufacturerModuleRecipe/);
  assert.match(manufacturerPack, /vciOpcode/);
  assert.match(manufacturerPack, /liveDataDIDs/);
  assert.match(manufacturerPack, /codingRecipes/);
  assert.match(manufacturerPack, /schemaVersion == 2/);
});

test('full-system scan iterates manufacturer modules and reads identity plus DTCs', () => {
  assert.match(moduleScanner, /func scan/);
  assert.match(moduleScanner, /identificationDIDs/);
  assert.match(moduleScanner, /readDtcHex/);
  assert.match(diagnostics, /Tüm modülleri tara/);
});

test('coding execution requires backup confirmation write and verify phases', () => {
  assert.match(codingCoordinator, /prepareAndBackup/);
  assert.match(codingCoordinator, /executeConfirmed/);
  assert.match(codingCoordinator, /state = \.writing/);
  assert.match(codingCoordinator, /state = \.verifying/);
  assert.match(diagnostics, /confirmationDialog/);
});

test('manufacturer transport prefixes are data-driven by pack routes', () => {
  assert.match(transportCodec, /wrapRequest/);
  assert.match(transportCodec, /unwrapResponse/);
  assert.match(transportCodec, /requestPrefixHex/);
  assert.match(transportCodec, /responsePrefixHex/);
  assert.match(moduleScanner, /ManufacturerTransportCodec\.wrapRequest/);
  assert.match(codingCoordinator, /ManufacturerTransportCodec\.wrapRequest/);
});

test('manufacturer live data polls configured DIDs through direct ThinkDiag', () => {
  assert.match(manufacturerLive, /liveDataDIDs/);
  assert.match(manufacturerLive, /UDSCodec\.readDID/);
  assert.match(manufacturerLive, /decodeNumeric/);
  assert.match(diagnostics, /Üretici Canlı Verileri/);
  assert.match(diagnostics, /Üretici canlı verilerini başlat/);
});

test('coding workspace exposes an execution audit trail', () => {
  assert.match(codingCoordinator, /executionLog/);
  assert.match(diagnostics, /Kodlama işlem kaydı/);
});

test('protocol learner observes UDS services and DIDs from ThinkDiag traffic', () => {
  assert.match(protocolLearner, /case 0x59/);
  assert.match(protocolLearner, /case 0x62/);
  assert.match(protocolLearner, /case 0x67/);
  assert.match(protocolLearner, /case 0x6E/);
  assert.match(protocolLearner, /case 0x7F/);
  assert.match(diagnostics, /Protokol Öğrenme/);
});

test('protocol learning can export a candidate manufacturer pack without guessed writes', () => {
  assert.match(packCandidate, /makeCandidate/);
  assert.match(packCandidate, /codingRecipes: \[\]/);
  assert.match(diagnostics, /Aday üretici paketi oluştur/);
});

test('evidence-backed feature model stores applicability operations and provenance', () => {
  assert.match(evidenceModels, /CodingEvidenceSource/);
  assert.match(evidenceModels, /VehicleApplicabilityRule/);
  assert.match(evidenceModels, /SemanticCodingOperation/);
  assert.match(evidenceModels, /ConnectedVehicleInventory/);
  assert.match(evidenceCatalog, /vw\.passat-b8\.comfort-turn-signals/);
  assert.match(evidenceCatalog, /Spiegelabsenkung bei Rueckwaertsfahrt/);
});

test('feature applicability uses brand model platform modules part software and equipment', () => {
  assert.match(applicability, /brands\.contains/);
  assert.match(applicability, /modelContains/);
  assert.match(applicability, /platformContains/);
  assert.match(applicability, /requiredModules/);
  assert.match(applicability, /requiredPartPrefixes/);
  assert.match(applicability, /requiredSoftwareContains/);
  assert.match(applicability, /requiredEquipmentTokens/);
});

test('one-tap coding only executes exact semantic mappings for connected ECU identity', () => {
  assert.match(semanticRegistry, /supportedPartPrefixes/);
  assert.match(semanticRegistry, /supportedSoftwareContains/);
  assert.match(oneTapResolver, /SemanticCodingRegistry\.shared\.mapping/);
  assert.match(oneTapCoordinator, /BACKUP/);
  assert.match(oneTapCoordinator, /WRITE/);
  assert.match(oneTapCoordinator, /VERIFY/);
  assert.match(diagnostics, /Araç İçin Tek-Tık Kodlamalar/);
  assert.match(diagnostics, /Tek tıkla uygula/);
});

test('research registry tracks public sources without blindly bulk-copying datasets', () => {
  assert.match(researchRegistry, /github-delphi-obd/);
  assert.match(researchRegistry, /github-vagcan/);
  assert.match(researchRegistry, /ross-tech-wiki/);
  assert.match(researchRegistry, /allowedForDataImport: false/);
});

test('coding research covers all major manufacturer ecosystems instead of VAG only', () => {
  assert.match(allBrandResearch, /bmw-mini/);
  assert.match(allBrandResearch, /mercedes/);
  assert.match(allBrandResearch, /ford-mazda/);
  assert.match(allBrandResearch, /toyota-lexus/);
  assert.match(allBrandResearch, /hyundai-kia/);
  assert.match(allBrandResearch, /renault-dacia/);
  assert.match(allBrandResearch, /psa-stellantis/);
  assert.match(allBrandResearch, /volvo/);
  assert.match(allBrandResearch, /honda/);
  assert.match(allBrandResearch, /nissan/);
  assert.match(allBrandResearch, /mitsubishi/);
  assert.match(allBrandResearch, /jaguar-landrover/);
  assert.match(allBrandResearch, /chevrolet-gm/);
});

test('research pagination removes the single top-50 ceiling', () => {
  assert.match(researchPaging, /perQueryPageSize: 30/);
  assert.match(researchPaging, /maxPagesPerQuery: 10/);
  assert.match(researchPaging, /theoreticalMaxResultsPerQuery/);
});

test('research registry includes non-VAG community ecosystems', () => {
  assert.match(researchRegistry, /forscan-forum-asbuilt/);
  assert.match(researchRegistry, /mbworld-variant-coding/);
  assert.match(researchRegistry, /clublexus-techstream/);
  assert.match(researchRegistry, /reddit-bmw-bimmercode/);
});

test('generic OBD capability discovery reads supported PIDs VIN and freeze frame', () => {
  assert.match(bluetooth, /sendReadOnlySupportedPidBlock/);
  assert.match(bluetooth, /opcode: 0x0109/);
  assert.match(bluetooth, /opcode: 0x0102/);
  assert.match(genericObd, /supportedPids/);
  assert.match(genericObd, /decodeMode02/);
  assert.match(genericObd, /freezeFrame/);
});

test('generic live data is stored and shown with charts plus P0299 analysis', () => {
  assert.match(bluetooth, /liveSamples/);
  assert.match(genericPanel, /import Charts/);
  assert.match(genericPanel, /P0299 sürüş verisi analizi/);
  assert.match(boostAnalyzer, /Generic OBD MAP gerçek manifold basıncıdır/);
  assert.match(diagnostics, /GenericObdLivePanel/);
});

test('VCI stream rejects bad checksum alignment instead of consuming whole frames', () => {
  assert.match(assembler, /guard frame\.checksumValid else/);
  assert.match(assembler, /buffer\.removeFirst\(\)/);
  assert.match(assembler, /frame\.header != preferredHeader/);
});

test('workshop drive logger persists VIN-aware live data and exports CSV', () => {
  assert.match(driveLogger, /DriveLogRecord/);
  assert.match(driveLogger, /drive-logs\.json/);
  assert.match(driveLogger, /csvURL/);
  assert.match(driveLogger, /p0299Assessment/);
  assert.match(diagnostics, /Sürüş kaydı başlat/);
  assert.match(diagnostics, /Son sürüş kaydını paylaş/);
});

test('iOS declares Bluetooth privacy usage descriptions', () => {
  assert.match(project, /NSBluetoothAlwaysUsageDescription/);
  assert.match(project, /NSBluetoothPeripheralUsageDescription/);
});
