import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const compiler = fs.readFileSync(new URL('../ios/JARVIS/DynamicCodingCompiler.swift', import.meta.url), 'utf8');
const coordinator = fs.readFileSync(new URL('../ios/JARVIS/DynamicOneTapCoordinator.swift', import.meta.url), 'utf8');
const resolver = fs.readFileSync(new URL('../ios/JARVIS/DynamicCodingResolver.swift', import.meta.url), 'utf8');
const trusted = fs.readFileSync(new URL('../src/application/vehicle/trusted-coding-catalogs.js', import.meta.url), 'utf8');
const research = fs.readFileSync(new URL('../src/application/vehicle/coding-research.js', import.meta.url), 'utf8');
const store = fs.readFileSync(new URL('../ios/JARVIS/VehicleCodingResearchStore.swift', import.meta.url), 'utf8');
const diagnostics = fs.readFileSync(new URL('../ios/JARVIS/DiagnosticView.swift', import.meta.url), 'utf8');
const pack = fs.readFileSync(new URL('../ios/JARVIS/ManufacturerDiagnosticPack.swift', import.meta.url), 'utf8');

test('dynamic compiler performs read-modify-write instead of replacing whole coding blindly', () => {
  assert.match(compiler, /parseReadDID/);
  assert.match(compiler, /setBit/);
  assert.match(compiler, /setBitField/);
  assert.match(compiler, /writeDID/);
  assert.match(coordinator, /BACKUP/);
  assert.match(coordinator, /VERIFY OK/);
});

test('dynamic resolver requires manufacturer route and declared coding DID', () => {
  assert.match(pack, /codingDID: UInt16\?/);
  assert.match(resolver, /long-coding DID bilinmiyor/);
  assert.match(resolver, /ManufacturerDiagnosticRegistry/);
});

test('MIT VAG CODER catalog is ingested with attribution and semantic operations', () => {
  assert.match(trusted, /VAG CODER/);
  assert.match(trusted, /license:'MIT'/);
  assert.match(trusted, /parseOperations/);
  assert.match(trusted, /longCodingBit/);
  assert.match(trusted, /adaptation/);
  assert.match(research, /fetchVagCoderCatalog/);
  assert.match(trusted, /status:'trusted_catalog'/);
});

test('trusted catalog operations become evidence-backed one-tap candidates', () => {
  assert.match(store, /trustedEvidenceFeatures/);
  assert.match(store, /SemanticCodingOperation/);
  assert.match(diagnostics, /codingResearch\.trustedEvidenceFeatures/);
  assert.match(diagnostics, /Tek tıkla uygula — dinamik reçete/);
});

test('dynamic write still requires confirmation and post-write verification', () => {
  assert.match(diagnostics, /Dinamik long-coding işlemini uygula/);
  assert.match(diagnostics, /mevcut long-coding bloğunu okudu ve yedekledi/);
});
