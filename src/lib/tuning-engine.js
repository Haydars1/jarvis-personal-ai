// ECU Tuning Engine
// File detection, vehicle identification, proposal generation, binary tuning

const te = new TextEncoder();
const td = new TextDecoder();

function hexToBytes(hex) {
  hex = hex.replace(/\s/g, '');
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function bytesEq(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

async function sha256(data) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', data));
}

function crc32(data) {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Vehicle signature database
const vehicleSignatures = {
  'bosch_me7': {
    name: 'Bosch ME7',
    patterns: [
      { offset: 0x2000, sig: 'B3010000', desc: 'ME7 Header' },
      { offset: 0x2004, sig: '00050000', desc: 'ME7 Version' }
    ],
    fileSize: 262144,
    tuningRules: {
      stage1: {
        name: 'Stage 1 Tuning',
        description: 'Boost pressure +0.2 bar, fuel timing +2°',
        patches: [
          { offset: 0x2A00, pattern: 'FFD0', replacement: 'FFE0' }
        ]
      },
      egr_off: {
        name: 'EGR Disable',
        description: 'Disable EGR system',
        patches: [
          { offset: 0x3200, pattern: '01', replacement: '00' }
        ]
      }
    }
  },
  'siemens_mse7': {
    name: 'Siemens MSE7',
    patterns: [
      { offset: 0x0000, sig: 'D5A1', desc: 'MSE7 Header' }
    ],
    fileSize: 262144,
    tuningRules: {
      stage1: {
        name: 'Stage 1 Tuning',
        description: 'Power +25hp, Torque +50nm',
        patches: [
          { offset: 0x1F00, pattern: '8080', replacement: '9090' }
        ]
      },
      egr_off: {
        name: 'EGR Disable',
        description: 'Disable EGR',
        patches: [
          { offset: 0x2800, pattern: '01', replacement: '00' }
        ]
      }
    }
  }
};

export async function detectFileFormat(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  
  // Try HEX format first
  try {
    const text = td.decode(bytes);
    if (/^[0-9A-Fa-f\s:]+$/.test(text.slice(0, 100))) {
      return { format: 'hex', size: bytes.length, text };
    }
  } catch {}
  
  // Binary format
  return { format: 'bin', size: bytes.length };
}

export async function identifyVehicle(fileData) {
  const bytes = fileData instanceof Uint8Array ? fileData : new Uint8Array(fileData);
  const results = [];
  
  for (const [vehicleId, vehicleInfo] of Object.entries(vehicleSignatures)) {
    let matched = 0;
    for (const pattern of vehicleInfo.patterns) {
      if (bytes.length > pattern.offset + pattern.sig.length / 2) {
        const sigBytes = hexToBytes(pattern.sig);
        const offset = pattern.offset;
        const regionBytes = bytes.slice(offset, offset + sigBytes.length);
        
        if (bytesEq(regionBytes, sigBytes)) {
          matched++;
        }
      }
    }
    
    if (matched > 0) {
      results.push({
        vehicleId,
        name: vehicleInfo.name,
        confidence: (matched / vehicleInfo.patterns.length) * 100,
        fileSize: bytes.length,
        expectedSize: vehicleInfo.fileSize
      });
    }
  }
  
  return results.sort((a, b) => b.confidence - a.confidence);
}

export function generateProposals(vehicleId, fileData) {
  const vehicleInfo = vehicleSignatures[vehicleId];
  if (!vehicleInfo) return [];
  
  const proposals = [];
  for (const [ruleId, ruleInfo] of Object.entries(vehicleInfo.tuningRules)) {
    proposals.push({
      ruleId,
      name: ruleInfo.name,
      description: ruleInfo.description,
      patches: ruleInfo.patches,
      selected: false,
      riskLevel: ruleId === 'stage1' ? 'medium' : 'low'
    });
  }
  
  return proposals;
}

export async function applyTuning(originalData, selectedProposals, vehicleId) {
  const vehicleInfo = vehicleSignatures[vehicleId];
  if (!vehicleInfo) throw new Error('VEHICLE_NOT_SUPPORTED');
  
  let tuned = new Uint8Array(originalData instanceof Uint8Array ? originalData : new Uint8Array(originalData));
  const appliedPatches = [];
  
  for (const proposalId of selectedProposals) {
    for (const [ruleId, ruleInfo] of Object.entries(vehicleInfo.tuningRules)) {
      if (ruleId === proposalId) {
        for (const patch of ruleInfo.patches) {
          try {
            const patternBytes = hexToBytes(patch.pattern);
            const replacementBytes = hexToBytes(patch.replacement);
            
            // Find and replace pattern
            let found = false;
            for (let i = 0; i <= tuned.length - patternBytes.length; i++) {
              if (bytesEq(tuned.slice(i, i + patternBytes.length), patternBytes)) {
                tuned.set(replacementBytes, i);
                appliedPatches.push({
                  offset: i,
                  pattern: patch.pattern,
                  replacement: patch.replacement,
                  ruleId
                });
                found = true;
                break;
              }
            }
            
            if (!found) {
              console.warn(`Pattern not found for ${ruleId}: ${patch.pattern}`);
            }
          } catch (e) {
            console.error(`Patch error for ${ruleId}:`, e.message);
          }
        }
      }
    }
  }
  
  // Refresh checksums if applicable
  await refreshChecksums(tuned, vehicleId);
  
  return {
    tuned,
    appliedPatches,
    hash: bytesToHex(await sha256(tuned)),
    size: tuned.length,
    crc32: crc32(tuned)
  };
}

export async function refreshChecksums(data, vehicleId) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  
  // Bosch ME7: CRC at 0x1FFC
  if (vehicleId === 'bosch_me7' || vehicleId.includes('me7')) {
    const crcValue = crc32(bytes.slice(0, 0x1FFC));
    const crcBytes = new Uint8Array(4);
    new DataView(crcBytes.buffer).setUint32(0, crcValue, true);
    bytes.set(crcBytes, 0x1FFC);
  }
  
  // Siemens MSE7: CRC at end of first block
  if (vehicleId === 'siemens_mse7' || vehicleId.includes('mse7')) {
    const crcValue = crc32(bytes.slice(0, 0x1FFC));
    const crcBytes = new Uint8Array(4);
    new DataView(crcBytes.buffer).setUint32(0, crcValue, true);
    bytes.set(crcBytes, 0x1FFC);
  }
}

export async function validateTunedFile(originalData, tunedData, vehicleId) {
  if (originalData.length !== tunedData.length) {
    return { valid: false, error: 'SIZE_MISMATCH' };
  }
  
  const vehicleInfo = vehicleSignatures[vehicleId];
  if (!vehicleInfo || vehicleInfo.fileSize !== tunedData.length) {
    return { valid: false, error: 'INVALID_FILE_SIZE' };
  }
  
  return { valid: true };
}
