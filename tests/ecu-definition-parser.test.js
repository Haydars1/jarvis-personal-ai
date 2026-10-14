import test from 'node:test';
import assert from 'node:assert/strict';

// Direct import — Workers-compatible module, no Node.js APIs
import {
  parseA2L,
  parseXDF,
  parseDefinitionFile,
  matchDefinitions,
  definitionsToRegions
} from '../src/lib/ecu-definition-parser.js';

// ─── Minimal A2L snippet ───
// ASAP2 CHARACTERISTIC formatı: name "longId" type address recordLayout maxDiff compuMethod lowerLimit upperLimit
const MINIMAL_A2L = `
ASAP2_VERSION 1 71
/begin PROJECT TestProject ""
/begin MODULE TestModule ""

/begin COMPU_METHOD CM_EGR_Rate "" LINEAR "%8.4" "%"
  COEFFS_LINEAR 0 0.1
/end COMPU_METHOD

/begin RECORD_LAYOUT RL_UWORD
  FNC_VALUES 1 UWORD ROW_DIR DIRECT
/end RECORD_LAYOUT

/begin RECORD_LAYOUT RL_FLOAT32
  FNC_VALUES 1 FLOAT32_IEEE ROW_DIR DIRECT
/end RECORD_LAYOUT

/begin RECORD_LAYOUT RL_UBYTE
  FNC_VALUES 1 UBYTE ROW_DIR DIRECT
/end RECORD_LAYOUT

/begin CHARACTERISTIC EGR_Rate_Limit "EGR rate limit"
  VALUE 0x80100 RL_UWORD 0 CM_EGR_Rate 0 100
/end CHARACTERISTIC

/begin CHARACTERISTIC DPF_Regen_Soot "Soot threshold for DPF regen"
  VALUE 0x80200 RL_FLOAT32 0 CM_EGR_Rate 0 10
/end CHARACTERISTIC

/begin CHARACTERISTIC Lambda_Target "Lambda target value"
  VALUE 0x80300 RL_UBYTE 0 CM_EGR_Rate 0 255
/end CHARACTERISTIC

/end MODULE
/end PROJECT
`;

// ─── Minimal XDF snippet ───
const MINIMAL_XDF = `<?xml version="1.0"?>
<XDFFORMAT version="1.70">
  <XDFHEADER>
    <deftitle>TestXDF EDC17</deftitle>
  </XDFHEADER>
  <XDFTABLE uniqueid="0x1234" flags="0x0">
    <title>EGR_Flow_Limit</title>
    <description>EGR flow limit table</description>
    <XDFAXIS id="x" uniqueid="0x0">
      <units>RPM</units>
      <indexcount>8</indexcount>
      <embedinfo type="1" />
      <datatype>0</datatype>
      <unittype>0</unittype>
      <DALINK index="0" />
    </XDFAXIS>
    <XDFAXIS id="y" uniqueid="0x0">
      <units>%</units>
      <indexcount>1</indexcount>
    </XDFAXIS>
    <XDFAXIS id="z">
      <units>mg/str</units>
      <MATH equation="X*0.1">
        <VAR id="X" />
      </MATH>
      <embeddeddata mmedaddress="0x50100" mmedelementsizebits="16" mmedcolcount="8" mmedmajorstridebits="0" />
    </XDFAXIS>
  </XDFTABLE>
  <XDFTABLE uniqueid="0x5678" flags="0x0">
    <title>Boost_Pressure_Max</title>
    <description>Maximum boost pressure limit</description>
    <XDFAXIS id="z">
      <units>mbar</units>
      <MATH equation="X*1">
        <VAR id="X" />
      </MATH>
      <embeddeddata mmedaddress="0x50200" mmedelementsizebits="16" mmedcolcount="1" mmedmajorstridebits="0" />
    </XDFAXIS>
  </XDFTABLE>
</XDFFORMAT>
`;

// ─── A2L Parser Tests ───

test('parseA2L extracts CHARACTERISTIC definitions from A2L text', () => {
  const result = parseA2L(MINIMAL_A2L);
  assert.ok(result.definitions.length >= 2, 'Should find at least 2 CHARACTERISTICs');
  assert.ok(result.meta, 'Should have meta');

  const egr = result.definitions.find(d => d.name === 'EGR_Rate_Limit');
  assert.ok(egr, 'Should find EGR_Rate_Limit');
  assert.equal(egr.datatype, 'UWORD');
  assert.equal(egr.dataSize, 2);
  assert.equal(egr.system, 'EGR');
  assert.equal(egr.upperLimit, 100);

  const dpf = result.definitions.find(d => d.name === 'DPF_Regen_Soot');
  assert.ok(dpf, 'Should find DPF_Regen_Soot');
  assert.equal(dpf.system, 'DPF');
});

test('parseA2L classifies systems correctly', () => {
  const result = parseA2L(MINIMAL_A2L);
  const systems = result.definitions.map(d => d.system).filter(Boolean);
  assert.ok(systems.includes('EGR'), 'Should classify EGR');
  assert.ok(systems.includes('DPF'), 'Should classify DPF');
  assert.ok(systems.includes('Lambda'), 'Should classify Lambda');
});

// ─── XDF Parser Tests ───

test('parseXDF extracts table definitions from XDF XML', () => {
  const result = parseXDF(MINIMAL_XDF);
  assert.ok(result.definitions.length >= 2, 'Should find at least 2 tables');
  assert.ok(result.meta, 'Should have meta');

  const egr = result.definitions.find(d => d.name === 'EGR_Flow_Limit');
  assert.ok(egr, 'Should find EGR_Flow_Limit');
  assert.equal(egr.system, 'EGR');
  assert.equal(egr.source, 'xdf');

  const boost = result.definitions.find(d => d.name === 'Boost_Pressure_Max');
  assert.ok(boost, 'Should find Boost_Pressure_Max');
  assert.equal(boost.system, 'Boost');
});

// ─── parseDefinitionFile auto-detect ───

test('parseDefinitionFile auto-detects A2L format', () => {
  const result = parseDefinitionFile(MINIMAL_A2L);
  assert.equal(result.format, 'a2l');
  assert.ok(result.definitions.length > 0);
});

test('parseDefinitionFile auto-detects XDF format', () => {
  const result = parseDefinitionFile(MINIMAL_XDF);
  assert.equal(result.format, 'xdf');
  assert.ok(result.definitions.length > 0);
});

test('parseDefinitionFile throws on unsupported format', () => {
  assert.throws(() => parseDefinitionFile('random binary data that is not A2L or XDF'), /UNSUPPORTED_FORMAT/);
});

// ─── matchDefinitions ───

test('matchDefinitions validates definitions against a binary and reads current values', () => {
  // 1MB binary dolumu
  const bytes = new Uint8Array(0x100000);
  // EGR_Rate_Limit @ 0x80100, UWORD = 2 bytes
  bytes[0x80100] = 0x64; // 100 decimal (little-endian low byte)
  bytes[0x80101] = 0x00;
  // Lambda_Target @ 0x80300, UBYTE = 1 byte
  bytes[0x80300] = 0xAF;

  const defs = [
    { name: 'EGR_Rate_Limit', description: 'EGR rate limit', displayId: 'EGR_Rate_Limit',
      address: 0x80100, rawAddress: 0x80100, datatype: 'UWORD', dataSize: 2,
      type: 'scalar', system: 'EGR', unit: '%', math: 'X*0.1',
      lowerLimit: 0, upperLimit: 100, axes: [], elementCount: 1, totalBytes: 2, source: 'a2l' },
    { name: 'Lambda_Target', description: 'Lambda target value', displayId: 'Lambda_Target',
      address: 0x80300, rawAddress: 0x80300, datatype: 'UBYTE', dataSize: 1,
      type: 'scalar', system: 'Lambda', unit: '', math: 'X',
      lowerLimit: 0, upperLimit: 255, axes: [], elementCount: 1, totalBytes: 1, source: 'a2l' },
    { name: 'OutOfBounds', description: 'Beyond binary', displayId: 'OutOfBounds',
      address: 0xFFFFF0, rawAddress: 0xFFFFF0, datatype: 'UWORD', dataSize: 2,
      type: 'scalar', system: 'DPF', unit: '', math: 'X',
      lowerLimit: 0, upperLimit: 100, axes: [], elementCount: 1, totalBytes: 2, source: 'a2l' }
  ];

  const matched = matchDefinitions(bytes, defs);
  assert.equal(matched.length, 2, 'Out-of-bounds def should be excluded');

  const egr = matched.find(d => d.name === 'EGR_Rate_Limit');
  assert.ok(egr, 'Should match EGR');
  assert.equal(egr.verified, true);
  assert.equal(egr.currentValue, 100); // 0x64 little-endian
  assert.ok(egr.windowHex, 'Should have windowHex');
  assert.ok(egr.offsetHex.startsWith('0x'), 'Should have 0x-prefixed offsetHex');

  const lambda = matched.find(d => d.name === 'Lambda_Target');
  assert.equal(lambda.currentValue, 0xAF);
});

// ─── definitionsToRegions ───

test('definitionsToRegions generates scanRegions-compatible regions with toggle actions', () => {
  const matchedDefs = [
    { name: 'EGR_Sw', description: 'EGR switch', displayId: 'EGR_Sw',
      address: 0x1000, datatype: 'UBYTE', dataSize: 1, type: 'scalar',
      system: 'EGR', unit: '', math: 'X', lowerLimit: 0, upperLimit: 1,
      axes: [], elementCount: 1, totalBytes: 1, source: 'a2l',
      verified: true, windowHex: '01', currentValue: 0x01,
      offsetHex: '0x001000' }
  ];

  const regions = definitionsToRegions(matchedDefs);
  assert.equal(regions.length, 1);
  const r = regions[0];
  assert.equal(r.system, 'EGR');
  assert.ok(r.source.startsWith('imported-'), 'Source should be imported-*');
  assert.ok(r.actions.length > 0, 'Should generate toggle action for 1-byte switch');
  assert.equal(r.actions[0].newByte, 0x00, 'Toggle action should flip 0x01 → 0x00');
  assert.ok(r.definitionMeta, 'Should have definitionMeta');
  assert.equal(r.definitionMeta.name, 'EGR_Sw');
});

test('definitionsToRegions generates info regions for limit values', () => {
  const matchedDefs = [
    { name: 'Boost_Limit_Max', description: 'Maximum boost limit', displayId: 'Boost_Limit_Max',
      address: 0x2000, datatype: 'UWORD', dataSize: 2, type: 'scalar',
      system: 'Boost', unit: 'mbar', math: 'X', lowerLimit: 0, upperLimit: 3000,
      axes: [], elementCount: 1, totalBytes: 2, source: 'xdf',
      verified: true, windowHex: 'e8 03', currentValue: 1000,
      offsetHex: '0x002000' }
  ];

  const regions = definitionsToRegions(matchedDefs);
  assert.equal(regions.length, 1);
  const r = regions[0];
  assert.equal(r.system, 'Boost');
  assert.ok(r.actions.some(a => a.risk === 'info'), 'Should have an info action for limit');
});

test('definitionsToRegions skips defs without system classification', () => {
  const matchedDefs = [
    { name: 'Unknown_Param', description: 'Generic param', displayId: 'Unknown_Param',
      address: 0x3000, datatype: 'UWORD', dataSize: 2, type: 'scalar',
      system: null, unit: '', math: 'X', lowerLimit: 0, upperLimit: 100,
      axes: [], elementCount: 1, totalBytes: 2, source: 'a2l',
      verified: true, windowHex: '00 00', currentValue: 0,
      offsetHex: '0x003000' }
  ];

  const regions = definitionsToRegions(matchedDefs);
  assert.equal(regions.length, 0, 'Should skip unclassified defs');
});

// ─── Edge cases ───

test('parseA2L handles empty or minimal input', () => {
  const result = parseA2L('/begin PROJECT X "" /begin MODULE M "" /end MODULE /end PROJECT');
  assert.ok(Array.isArray(result.definitions));
  assert.equal(result.definitions.length, 0);
});

test('matchDefinitions handles empty definitions array', () => {
  const bytes = new Uint8Array(100);
  const result = matchDefinitions(bytes, []);
  assert.deepEqual(result, []);
});

test('matchDefinitions handles null address', () => {
  const bytes = new Uint8Array(100);
  const result = matchDefinitions(bytes, [{ address: null, totalBytes: 2 }]);
  assert.deepEqual(result, []);
});

test('definitionsToRegions handles empty input', () => {
  assert.deepEqual(definitionsToRegions([]), []);
});
