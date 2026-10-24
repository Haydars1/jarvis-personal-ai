// ECU Protocol Analyzer
// CAN bus frame parsing, UDS/KWP2000 service decoding, ISO-TP transport

// ─── CAN Bus Frame Parser ─────────────────────────────────────────────────

/**
 * Parse raw CAN frame from hex string
 * @param {string} frame - Hex string e.g. "7E8 06 41 0C 1A F8 00 00"
 * @returns {object} Parsed CAN frame
 */
export function parseCANFrame(frame) {
  const parts = frame.trim().split(/\s+/);
  if (parts.length < 2) return { error: 'Too few fields' };

  const arbId = parseInt(parts[0], 16);
  const isExtended = arbId > 0x7FF;
  const dataBytes = parts.slice(1).map(b => parseInt(b, 16));

  // Determine if this is an OBD-II response
  const isOBD = (arbId >= 0x7E8 && arbId <= 0x7EF) || (arbId >= 0x700 && arbId <= 0x7FF);
  const ecuIndex = isOBD ? arbId - 0x7E8 : null;

  let decoded = null;
  if (isOBD && dataBytes.length >= 3) {
    decoded = decodeOBDResponse(dataBytes);
  }

  return {
    arbitrationId: '0x' + arbId.toString(16).toUpperCase(),
    arbitrationIdDec: arbId,
    isExtended,
    dlc: dataBytes.length,
    data: dataBytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')),
    dataHex: dataBytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' '),
    isOBD,
    ecuIndex,
    decoded,
  };
}

function decodeOBDResponse(data) {
  const len = data[0];
  if (len < 2) return null;
  const serviceResp = data[1];
  const service = serviceResp - 0x40; // Response = Request + 0x40

  if (service === 0x01 || service === 0x02) {
    const pid = data[2];
    const pidData = data.slice(3, 3 + len - 2);
    return { type: 'OBD', service: '0x' + service.toString(16).toUpperCase().padStart(2, '0'), pid: '0x' + pid.toString(16).toUpperCase().padStart(2, '0'), pidData: pidData.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')) };
  }
  if (service === 0x03 || service === 0x07 || service === 0x0A) {
    const dtcCount = data[2];
    const dtcs = [];
    for (let i = 3; i < data.length - 1; i += 2) {
      if (i + 1 < data.length) {
        const dtcRaw = (data[i] << 8) | data[i + 1];
        if (dtcRaw !== 0) dtcs.push(decodeDTCBytes(dtcRaw));
      }
    }
    return { type: 'DTC', service: '0x' + service.toString(16).toUpperCase().padStart(2, '0'), dtcCount, dtcs };
  }
  if (service === 0x09) {
    return { type: 'VEHICLE_INFO', service: '0x09', infotype: '0x' + data[2].toString(16).toUpperCase().padStart(2, '0') };
  }

  return { type: 'OBD', service: '0x' + service.toString(16).toUpperCase().padStart(2, '0'), rawData: data.slice(2).map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')) };
}

function decodeDTCBytes(raw) {
  const firstChar = ['P', 'C', 'B', 'U'][(raw >> 14) & 0x03];
  const second = ((raw >> 12) & 0x03).toString();
  const rest = (raw & 0x0FFF).toString(16).toUpperCase().padStart(3, '0');
  return firstChar + second + rest;
}


// ─── UDS (Unified Diagnostic Services) ISO 14229 ─────────────────────────

export const UDS_SERVICES = {
  0x10: { name: 'DiagnosticSessionControl', description: 'Oturum değiştir', subFunctions: {
    0x01: 'defaultSession', 0x02: 'programmingSession', 0x03: 'extendedDiagnosticSession', 0x60: 'ecuSpecific'
  }},
  0x11: { name: 'ECUReset', description: 'ECU reset', subFunctions: {
    0x01: 'hardReset', 0x02: 'keyOffOnReset', 0x03: 'softReset'
  }},
  0x14: { name: 'ClearDiagnosticInformation', description: 'DTC sil' },
  0x19: { name: 'ReadDTCInformation', description: 'DTC oku', subFunctions: {
    0x01: 'reportNumberOfDTCByStatusMask', 0x02: 'reportDTCByStatusMask',
    0x04: 'reportDTCSnapshotRecordByDTCNumber', 0x06: 'reportDTCExtDataRecordByDTCNumber',
    0x09: 'reportSeverityInfoOfDTC', 0x0A: 'reportSupportedDTC',
    0x0B: 'reportFirstTestFailedDTC', 0x0C: 'reportFirstConfirmedDTC',
    0x0D: 'reportMostRecentTestFailedDTC', 0x0E: 'reportMostRecentConfirmedDTC'
  }},
  0x22: { name: 'ReadDataByIdentifier', description: 'DID ile veri oku' },
  0x23: { name: 'ReadMemoryByAddress', description: 'Adresten oku' },
  0x24: { name: 'ReadScalingDataByIdentifier', description: 'Ölçekli veri oku' },
  0x27: { name: 'SecurityAccess', description: 'Güvenlik erişimi', subFunctions: {
    0x01: 'requestSeed_L1', 0x02: 'sendKey_L1',
    0x03: 'requestSeed_L2', 0x04: 'sendKey_L2',
    0x11: 'requestSeed_L9', 0x12: 'sendKey_L9',
    0x61: 'requestSeed_L49', 0x62: 'sendKey_L49'
  }},
  0x28: { name: 'CommunicationControl', description: 'İletişim kontrol', subFunctions: {
    0x00: 'enableRxAndTx', 0x01: 'enableRxAndDisableTx',
    0x02: 'disableRxAndEnableTx', 0x03: 'disableRxAndTx'
  }},
  0x2E: { name: 'WriteDataByIdentifier', description: 'DID ile veri yaz' },
  0x2F: { name: 'InputOutputControlByIdentifier', description: 'I/O kontrol' },
  0x31: { name: 'RoutineControl', description: 'Rutin kontrol', subFunctions: {
    0x01: 'startRoutine', 0x02: 'stopRoutine', 0x03: 'requestRoutineResults'
  }},
  0x34: { name: 'RequestDownload', description: 'Flash download başlat' },
  0x35: { name: 'RequestUpload', description: 'Flash upload başlat' },
  0x36: { name: 'TransferData', description: 'Veri transfer' },
  0x37: { name: 'RequestTransferExit', description: 'Transfer bitir' },
  0x3D: { name: 'WriteMemoryByAddress', description: 'Adrese yaz' },
  0x3E: { name: 'TesterPresent', description: 'Tester bağlı sinyali', subFunctions: {
    0x00: 'sendResponse', 0x80: 'noResponse'
  }},
  0x85: { name: 'ControlDTCSetting', description: 'DTC kayıt kontrol', subFunctions: {
    0x01: 'on', 0x02: 'off'
  }},
  0x86: { name: 'ResponseOnEvent', description: 'Olay bazlı yanıt' },
  0x87: { name: 'LinkControl', description: 'Bağlantı kontrol' },
};

export const UDS_NRC = {
  0x10: 'generalReject',
  0x11: 'serviceNotSupported',
  0x12: 'subFunctionNotSupported',
  0x13: 'incorrectMessageLengthOrInvalidFormat',
  0x14: 'responseTooLong',
  0x21: 'busyRepeatRequest',
  0x22: 'conditionsNotCorrect',
  0x24: 'requestSequenceError',
  0x25: 'noResponseFromSubnetComponent',
  0x26: 'failurePreventsExecutionOfRequestedAction',
  0x31: 'requestOutOfRange',
  0x33: 'securityAccessDenied',
  0x35: 'invalidKey',
  0x36: 'exceededNumberOfAttempts',
  0x37: 'requiredTimeDelayNotExpired',
  0x70: 'uploadDownloadNotAccepted',
  0x71: 'transferDataSuspended',
  0x72: 'generalProgrammingFailure',
  0x73: 'wrongBlockSequenceCounter',
  0x78: 'requestCorrectlyReceivedResponsePending',
  0x7E: 'subFunctionNotSupportedInActiveSession',
  0x7F: 'serviceNotSupportedInActiveSession',
};

/**
 * Decode a UDS message
 * @param {number[]} data - Message bytes (after ISO-TP reassembly)
 * @returns {object}
 */
export function decodeUDS(data) {
  if (!data || data.length === 0) return { error: 'Empty message' };

  const sid = data[0];

  // Negative response
  if (sid === 0x7F) {
    const rejectedSid = data[1];
    const nrc = data[2];
    const svcInfo = UDS_SERVICES[rejectedSid];
    return {
      type: 'NEGATIVE_RESPONSE',
      rejectedService: svcInfo ? svcInfo.name : '0x' + rejectedSid.toString(16).toUpperCase(),
      nrc: '0x' + nrc.toString(16).toUpperCase(),
      nrcName: UDS_NRC[nrc] || 'unknown',
      description: svcInfo ? `${svcInfo.description} reddedildi: ${UDS_NRC[nrc] || 'bilinmeyen hata'}` : `Service 0x${rejectedSid.toString(16)} rejected`,
    };
  }

  // Positive response (SID + 0x40)
  const isResponse = sid > 0x40;
  const requestSid = isResponse ? sid - 0x40 : sid;
  const svcInfo = UDS_SERVICES[requestSid];

  if (!svcInfo) {
    return { type: isResponse ? 'POSITIVE_RESPONSE' : 'REQUEST', sid: '0x' + sid.toString(16).toUpperCase(), raw: data.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')) };
  }

  const result = {
    type: isResponse ? 'POSITIVE_RESPONSE' : 'REQUEST',
    service: svcInfo.name,
    sid: '0x' + requestSid.toString(16).toUpperCase(),
    description: svcInfo.description,
  };

  // Service-specific decoding
  if (requestSid === 0x10 || requestSid === 0x11 || requestSid === 0x27 || requestSid === 0x28 || requestSid === 0x31 || requestSid === 0x3E || requestSid === 0x85) {
    if (data.length > 1) {
      const sf = data[1] & 0x7F;
      const suppressPosResp = !!(data[1] & 0x80);
      result.subFunction = '0x' + sf.toString(16).toUpperCase();
      result.subFunctionName = svcInfo.subFunctions?.[sf] || 'unknown';
      result.suppressPositiveResponse = suppressPosResp;
    }
  }

  if (requestSid === 0x22 || requestSid === 0x2E || requestSid === 0x2F) {
    if (data.length >= 3) {
      const did = (data[1] << 8) | data[2];
      result.did = '0x' + did.toString(16).toUpperCase().padStart(4, '0');
      result.didName = COMMON_DIDS[did] || null;
      if (data.length > 3) result.didData = data.slice(3).map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0'));
    }
  }

  if (requestSid === 0x23 || requestSid === 0x3D) {
    if (data.length >= 2) {
      const addrAndLenFormat = data[1];
      const memSizeLen = (addrAndLenFormat >> 4) & 0x0F;
      const addrLen = addrAndLenFormat & 0x0F;
      let addr = 0, size = 0;
      for (let i = 0; i < addrLen && 2 + i < data.length; i++) addr = (addr << 8) | data[2 + i];
      for (let i = 0; i < memSizeLen && 2 + addrLen + i < data.length; i++) size = (size << 8) | data[2 + addrLen + i];
      result.memoryAddress = '0x' + addr.toString(16).toUpperCase();
      result.memorySize = size;
    }
  }

  if (requestSid === 0x34 || requestSid === 0x35) {
    if (data.length >= 2) {
      const compressionMethod = (data[1] >> 4) & 0x0F;
      const encryptingMethod = data[1] & 0x0F;
      result.compressionMethod = compressionMethod;
      result.encryptingMethod = encryptingMethod;
      if (data.length >= 3) {
        const addrAndLenFormat = data[2];
        const memSizeLen = (addrAndLenFormat >> 4) & 0x0F;
        const addrLen = addrAndLenFormat & 0x0F;
        let addr = 0, size = 0;
        for (let i = 0; i < addrLen && 3 + i < data.length; i++) addr = (addr << 8) | data[3 + i];
        for (let i = 0; i < memSizeLen && 3 + addrLen + i < data.length; i++) size = (size << 8) | data[3 + addrLen + i];
        result.memoryAddress = '0x' + addr.toString(16).toUpperCase();
        result.memorySize = size;
      }
    }
  }

  if (requestSid === 0x36) {
    if (data.length >= 2) {
      result.blockSequenceCounter = data[1];
      result.transferDataSize = data.length - 2;
    }
  }

  if (requestSid === 0x19 && data.length >= 2) {
    const sf = data[1];
    result.subFunction = '0x' + sf.toString(16).toUpperCase();
    result.subFunctionName = svcInfo.subFunctions?.[sf] || 'unknown';
  }

  return result;
}


// ─── Common DIDs (Data Identifiers) ──────────────────────────────────────

export const COMMON_DIDS = {
  0xF180: 'bootSoftwareIdentification',
  0xF181: 'applicationSoftwareIdentification',
  0xF182: 'applicationDataIdentification',
  0xF186: 'activeDiagnosticSession',
  0xF187: 'vehicleManufacturerSparePartNumber',
  0xF188: 'vehicleManufacturerECUSoftwareNumber',
  0xF189: 'vehicleManufacturerECUSoftwareVersionNumber',
  0xF18A: 'systemSupplierIdentifier',
  0xF18B: 'ecuManufacturingDate',
  0xF18C: 'ecuSerialNumber',
  0xF190: 'VIN',
  0xF191: 'vehicleManufacturerECUHardwareNumber',
  0xF192: 'systemSupplierECUHardwareNumber',
  0xF193: 'systemSupplierECUHardwareVersionNumber',
  0xF194: 'systemSupplierECUSoftwareNumber',
  0xF195: 'systemSupplierECUSoftwareVersionNumber',
  0xF197: 'systemNameOrEngineType',
  0xF199: 'programmingDate',
  0xF19E: 'testerSerialNumber',
  0xF1A0: 'repairShopCodeOrTesterSerialNumber',
  0x0100: 'ecuIdentification',
  0x0110: 'ecuCalibrationNumber',
  0x0200: 'vehicleSpeed',
  0x0201: 'engineSpeed',
  0x0202: 'engineCoolantTemp',
  0x0203: 'intakeAirTemp',
  0x0204: 'manifoldAbsolutePressure',
  0x0205: 'throttlePosition',
  0x0206: 'batteryVoltage',
  0x0300: 'dpfSootLoad',
  0x0301: 'dpfRegenerationStatus',
  0x0302: 'dpfDifferentialPressure',
  0x0400: 'egrValvePosition',
  0x0401: 'egrMassAirFlow',
  0x0500: 'turboBoostPressure',
  0x0501: 'turboWastegatePosition',
};


// ─── KWP2000 (ISO 14230) Legacy Protocol ─────────────────────────────────

export const KWP2000_SERVICES = {
  0x10: { name: 'startDiagnosticSession', modes: { 0x81: 'default', 0x85: 'programming', 0x86: 'development', 0x89: 'adjustmentSession' }},
  0x11: { name: 'ecuReset', modes: { 0x01: 'powerOnReset', 0x82: 'nonVolatileMemoryReset' }},
  0x14: { name: 'clearDiagnosticInformation' },
  0x17: { name: 'readStatusOfDTC' },
  0x18: { name: 'readDTCByStatus' },
  0x1A: { name: 'readECUIdentification', modes: {
    0x86: 'hardwareVersion', 0x87: 'repairShopCode', 0x88: 'systemName',
    0x90: 'VIN', 0x91: 'hardwareNumber', 0x92: 'softwareNumber',
    0x94: 'calNumber', 0x97: 'systemType', 0x9A: 'ecuAddress', 0x9B: 'ecuName'
  }},
  0x21: { name: 'readDataByLocalIdentifier' },
  0x22: { name: 'readDataByCommonIdentifier' },
  0x23: { name: 'readMemoryByAddress' },
  0x27: { name: 'securityAccess' },
  0x2C: { name: 'dynamicallyDefineLocalIdentifier' },
  0x2E: { name: 'writeDataByCommonIdentifier' },
  0x30: { name: 'inputOutputControlByLocalIdentifier' },
  0x31: { name: 'startRoutineByLocalIdentifier' },
  0x32: { name: 'stopRoutineByLocalIdentifier' },
  0x33: { name: 'requestRoutineResultsByLocalIdentifier' },
  0x34: { name: 'requestDownload' },
  0x35: { name: 'requestUpload' },
  0x36: { name: 'transferData' },
  0x37: { name: 'requestTransferExit' },
  0x3D: { name: 'writeMemoryByAddress' },
  0x3E: { name: 'testerPresent' },
  0x82: { name: 'stopDiagnosticSession' },
  0x84: { name: 'readDataByIdentifier' },
  0x85: { name: 'controlDTCSetting' },
  0x86: { name: 'responseOnEvent' },
};

export function decodeKWP2000(data) {
  if (!data || data.length === 0) return { error: 'Empty message' };
  const sid = data[0];

  if (sid === 0x7F) {
    const rejSid = data[1];
    const errCode = data[2];
    const svc = KWP2000_SERVICES[rejSid];
    return { type: 'NEGATIVE_RESPONSE', rejectedService: svc ? svc.name : '0x' + rejSid.toString(16).toUpperCase(), errorCode: '0x' + errCode.toString(16).toUpperCase() };
  }

  const isResp = sid > 0x40 && sid !== 0x82;
  const reqSid = isResp ? sid - 0x40 : sid;
  const svc = KWP2000_SERVICES[reqSid];

  const result = {
    type: isResp ? 'POSITIVE_RESPONSE' : 'REQUEST',
    protocol: 'KWP2000',
    sid: '0x' + reqSid.toString(16).toUpperCase(),
    service: svc ? svc.name : 'unknown',
  };

  if (data.length > 1 && svc?.modes) {
    const mode = data[1];
    result.mode = '0x' + mode.toString(16).toUpperCase();
    result.modeName = svc.modes[mode] || 'unknown';
  }

  if (data.length > (svc?.modes ? 2 : 1)) {
    result.payload = data.slice(svc?.modes ? 2 : 1).map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0'));
  }

  return result;
}


// ─── ISO-TP (ISO 15765-2) Transport Protocol ─────────────────────────────

export const ISOTP_FRAME_TYPES = {
  0: 'SINGLE',           // SF — complete message in one frame
  1: 'FIRST',            // FF — first frame of multi-frame message
  2: 'CONSECUTIVE',      // CF — continuation frames
  3: 'FLOW_CONTROL',     // FC — flow control
};

/**
 * Parse ISO-TP frame
 * @param {number[]} data - CAN frame data bytes (up to 8)
 * @returns {object}
 */
export function parseISOTP(data) {
  if (!data || data.length === 0) return { error: 'Empty frame' };

  const pciType = (data[0] >> 4) & 0x0F;
  const frameType = ISOTP_FRAME_TYPES[pciType] || 'UNKNOWN';

  switch (pciType) {
    case 0: { // Single Frame
      const len = data[0] & 0x0F;
      const payload = data.slice(1, 1 + len);
      return { frameType: 'SINGLE', dataLength: len, payload, payloadHex: payload.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ') };
    }
    case 1: { // First Frame
      const len = ((data[0] & 0x0F) << 8) | data[1];
      const payload = data.slice(2);
      return { frameType: 'FIRST', totalLength: len, firstPayload: payload, payloadHex: payload.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ') };
    }
    case 2: { // Consecutive Frame
      const seqNum = data[0] & 0x0F;
      const payload = data.slice(1);
      return { frameType: 'CONSECUTIVE', sequenceNumber: seqNum, payload, payloadHex: payload.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ') };
    }
    case 3: { // Flow Control
      const flowStatus = data[0] & 0x0F;
      const blockSize = data[1];
      const stMin = data[2];
      const fsNames = { 0: 'ContinueToSend', 1: 'Wait', 2: 'Overflow' };
      return {
        frameType: 'FLOW_CONTROL',
        flowStatus,
        flowStatusName: fsNames[flowStatus] || 'unknown',
        blockSize,
        separationTimeMin: stMin <= 127 ? stMin + 'ms' : stMin >= 0xF1 && stMin <= 0xF9 ? ((stMin - 0xF0) * 100) + 'us' : stMin + 'ms',
      };
    }
    default:
      return { frameType: 'UNKNOWN', pciType, raw: data.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ') };
  }
}

/**
 * Reassemble ISO-TP multi-frame message
 * @param {number[][]} frames - Array of CAN frame data (first frame + consecutive frames)
 * @returns {{data: number[], complete: boolean, error?: string}}
 */
export function reassembleISOTP(frames) {
  if (!frames || frames.length === 0) return { data: [], complete: false, error: 'No frames' };

  const first = frames[0];
  const pciType = (first[0] >> 4) & 0x0F;

  // Single frame
  if (pciType === 0) {
    const len = first[0] & 0x0F;
    return { data: Array.from(first.slice(1, 1 + len)), complete: true };
  }

  // Multi-frame
  if (pciType !== 1) return { data: [], complete: false, error: 'First frame is not FF or SF' };

  const totalLen = ((first[0] & 0x0F) << 8) | first[1];
  const result = Array.from(first.slice(2));
  let expectedSeq = 1;

  for (let i = 1; i < frames.length; i++) {
    const cf = frames[i];
    const cfType = (cf[0] >> 4) & 0x0F;
    if (cfType === 3) continue; // Skip flow control frames
    if (cfType !== 2) continue; // Skip non-CF frames

    const seqNum = cf[0] & 0x0F;
    if (seqNum !== (expectedSeq & 0x0F)) {
      return { data: result, complete: false, error: `Sequence gap: expected ${expectedSeq & 0x0F}, got ${seqNum}` };
    }
    expectedSeq++;

    result.push(...cf.slice(1));
    if (result.length >= totalLen) break;
  }

  return { data: result.slice(0, totalLen), complete: result.length >= totalLen };
}


// ─── CAN Bus Diagnostics ─────────────────────────────────────────────────

/**
 * Parse a CAN bus log (multiple frames)
 */
export function parseCANLog(logText, options = {}) {
  const { filterArbitrationId, filterOBD = false } = options;
  const lines = logText.split(/\r?\n/).filter(l => l.trim().length > 0);
  const frames = [];

  for (const line of lines) {
    // Try common log formats:
    // candump: (1234567890.123456)  can0  7E8   [8]  06 41 0C 1A F8 00 00 00
    // simple:  7E8 06 41 0C 1A F8 00 00
    // timestamped: 0.000  7E8  06 41 0C 1A F8 00 00 00

    let match;

    // candump format
    match = line.match(/\([\d.]+\)\s+\w+\s+([0-9A-Fa-f]+)\s+\[\d+\]\s+((?:[0-9A-Fa-f]{2}\s*)+)/);
    if (!match) {
      // simple format
      match = line.match(/^([0-9A-Fa-f]{3,8})\s+((?:[0-9A-Fa-f]{2}\s*)+)/);
    }
    if (!match) {
      // timestamped format
      match = line.match(/[\d.]+\s+([0-9A-Fa-f]{3,8})\s+((?:[0-9A-Fa-f]{2}\s*)+)/);
    }

    if (match) {
      const arbId = parseInt(match[1], 16);
      const dataBytes = match[2].trim().split(/\s+/).map(b => parseInt(b, 16));

      if (filterArbitrationId && arbId !== filterArbitrationId) continue;
      if (filterOBD && !(arbId >= 0x7E8 && arbId <= 0x7EF)) continue;

      const frame = parseCANFrame(`${match[1]} ${match[2].trim()}`);
      frames.push(frame);
    }
  }

  return {
    totalFrames: frames.length,
    uniqueArbitrationIds: [...new Set(frames.map(f => f.arbitrationId))],
    obdFrames: frames.filter(f => f.isOBD).length,
    frames: frames.slice(0, 500), // Cap at 500
  };
}


// ─── Diagnostic Session Sequences ────────────────────────────────────────

export const FLASH_SEQUENCES = {
  standard_uds: {
    name: 'Standard UDS Flash Sequence',
    description: 'ISO 14229 standart flash sıralaması',
    steps: [
      { step: 1, service: '0x10', subFunction: '0x02', name: 'Enter Programming Session' },
      { step: 2, service: '0x27', subFunction: '0x01', name: 'Security Access - Request Seed' },
      { step: 3, service: '0x27', subFunction: '0x02', name: 'Security Access - Send Key' },
      { step: 4, service: '0x85', subFunction: '0x02', name: 'Disable DTC Setting' },
      { step: 5, service: '0x28', subFunction: '0x03', name: 'Disable Communication' },
      { step: 6, service: '0x31', subFunction: '0x01', name: 'Erase Memory Routine' },
      { step: 7, service: '0x34', subFunction: null, name: 'Request Download' },
      { step: 8, service: '0x36', subFunction: null, name: 'Transfer Data (blocks)' },
      { step: 9, service: '0x37', subFunction: null, name: 'Request Transfer Exit' },
      { step: 10, service: '0x31', subFunction: '0x01', name: 'Verify Checksum Routine' },
      { step: 11, service: '0x28', subFunction: '0x00', name: 'Enable Communication' },
      { step: 12, service: '0x85', subFunction: '0x01', name: 'Enable DTC Setting' },
      { step: 13, service: '0x11', subFunction: '0x01', name: 'ECU Hard Reset' },
    ],
  },
  bosch_med17: {
    name: 'Bosch MED17/EDC17 Flash',
    description: 'Bosch MED17 ve EDC17 serisi OBD flash prosedürü',
    steps: [
      { step: 1, service: '0x10', subFunction: '0x03', name: 'Extended Diagnostic Session' },
      { step: 2, service: '0x27', subFunction: '0x01', name: 'Security Access L1 - Seed Request' },
      { step: 3, service: '0x27', subFunction: '0x02', name: 'Security Access L1 - Key Send' },
      { step: 4, service: '0x10', subFunction: '0x02', name: 'Programming Session' },
      { step: 5, service: '0x27', subFunction: '0x11', name: 'Security Access L9 - Seed Request' },
      { step: 6, service: '0x27', subFunction: '0x12', name: 'Security Access L9 - Key Send' },
      { step: 7, service: '0x31', subFunction: '0x01', name: 'Erase Flash (Routine 0xFF00)' },
      { step: 8, service: '0x34', subFunction: null, name: 'Request Download' },
      { step: 9, service: '0x36', subFunction: null, name: 'Transfer Data' },
      { step: 10, service: '0x37', subFunction: null, name: 'Request Transfer Exit' },
      { step: 11, service: '0x31', subFunction: '0x01', name: 'Check Programming Dependencies' },
      { step: 12, service: '0x11', subFunction: '0x01', name: 'Hard Reset' },
    ],
  },
  kwp2000_flash: {
    name: 'KWP2000 Flash Sequence',
    description: 'Eski ECUler icin KWP2000 bazli flash',
    steps: [
      { step: 1, service: '0x10', mode: '0x85', name: 'Start Programming Session' },
      { step: 2, service: '0x27', mode: '0x01', name: 'Security Access - Seed' },
      { step: 3, service: '0x27', mode: '0x02', name: 'Security Access - Key' },
      { step: 4, service: '0x34', mode: null, name: 'Request Download' },
      { step: 5, service: '0x36', mode: null, name: 'Transfer Data' },
      { step: 6, service: '0x37', mode: null, name: 'Request Transfer Exit' },
      { step: 7, service: '0x31', mode: null, name: 'Checksum Verification Routine' },
      { step: 8, service: '0x11', mode: '0x01', name: 'ECU Reset' },
    ],
  },
};

export function getFlashSequence(name) { return FLASH_SEQUENCES[name] || null; }
export function listFlashSequences() { return Object.entries(FLASH_SEQUENCES).map(([id, s]) => ({ id, name: s.name, description: s.description, steps: s.steps.length })); }
export function listUDSServices() { return Object.entries(UDS_SERVICES).map(([sid, s]) => ({ sid: '0x' + parseInt(sid).toString(16).toUpperCase(), ...s })); }
export function getUDSService(sid) {
  const num = typeof sid === 'string' ? parseInt(sid, 16) : sid;
  return UDS_SERVICES[num] || null;
}
export function listDIDs() { return Object.entries(COMMON_DIDS).map(([did, name]) => ({ did: '0x' + parseInt(did).toString(16).toUpperCase().padStart(4, '0'), name })); }
export function getDID(did) {
  const num = typeof did === 'string' ? parseInt(did, 16) : did;
  return COMMON_DIDS[num] || null;
}
export function listKWP2000Services() { return Object.entries(KWP2000_SERVICES).map(([sid, s]) => ({ sid: '0x' + parseInt(sid).toString(16).toUpperCase(), ...s })); }
