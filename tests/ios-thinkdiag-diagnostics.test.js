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
  assert.match(assembler, /append\(_ chunk: Data\)/);
  assert.match(assembler, /payloadLength/);
  assert.match(assembler, /checksumValid/);
  assert.match(bluetooth, /assembler\.append\(data\)/);
});

test('passive decoder recognizes standard read-only OBD responses', () => {
  assert.match(passive, /case 0x41/);
  assert.match(passive, /case 0x43/);
  assert.match(passive, /case 0x47/);
  assert.match(passive, /case 0x49/);
  assert.match(passive, /Motor devri/);
  assert.match(passive, /Manifold basıncı/);
  assert.match(bluetooth, /passiveObservations/);
});

test('captured frames are fingerprinted without sending vehicle commands', () => {
  assert.match(analyzer, /dominantHeader/);
  assert.match(analyzer, /checksumValidCount/);
  assert.match(diagnostics, /protocolFingerprint\.summary/);
});

test('direct ThinkDiag path exposes a read-only DTC probe', () => {
  assert.match(bluetooth, /sendReadOnlyDtcProbe/);
  assert.match(bluetooth, /opcode: 0x0103/);
  assert.match(diagnostics, /DTC oku — deneysel salt-okuma/);
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
  assert.match(bluetooth, /0x0C, 0x0B, 0x10, 0x05, 0x0D, 0x42/);
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

test('iOS declares Bluetooth privacy usage descriptions', () => {
  assert.match(project, /NSBluetoothAlwaysUsageDescription/);
  assert.match(project, /NSBluetoothPeripheralUsageDescription/);
});
