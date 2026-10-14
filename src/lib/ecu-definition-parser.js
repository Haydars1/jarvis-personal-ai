// JARVIS ECU Definition Parser
// A2L (ASAP2/MCD-2MC) ve XDF (TunerPro) dosyalarını parse eder,
// kalibrasyon parametrelerini normalize eder.
//
// Hafif, Workers-uyumlu — Node.js bağımlılığı yok.
// A2L: regex/state-machine tabanlı CHARACTERISTIC çıkarıcı
// XDF: regex tabanlı XML çıkarıcı

// ─── Ortak sabitler ───

const DATA_SIZES = {
  UBYTE: 1, SBYTE: 1, UWORD: 2, SWORD: 2,
  ULONG: 4, SLONG: 4, FLOAT32_IEEE: 4, FLOAT64_IEEE: 8,
  A_UINT64: 8, A_INT64: 8
};

const SIGNED_TYPES = new Set(['SBYTE','SWORD','SLONG','A_INT64']);
const FLOAT_TYPES  = new Set(['FLOAT32_IEEE','FLOAT64_IEEE']);

// Parametre adından sistem tespiti — tuning-engine.js SYSTEM_KEYWORDS ile uyumlu
const SYSTEM_CLASSIFIERS = [
  { system: 'EGR',          re: /\b(EGR|AGR|ExhGas|EGR_V|AGR_V|EGR_Rate)\b/i },
  { system: 'DPF',          re: /\b(DPF|FAP|Regen|Soot|PartFilter|RussMen|DiffPres)\b/i },
  { system: 'AdBlue/SCR',   re: /\b(AdBlue|SCR|Urea|Harnstoff|DeNOx|BlueTec)\b/i },
  { system: 'Lambda',       re: /\b(Lambda|O2S|LSU|Sonde|HEGO|KatDiag|Vorkat)\b/i },
  { system: 'Boost',        re: /\b(Boost|LDR|Ladedruck|P2Soll|Turbo|VTG|Wastegate|LadeDr)\b/i },
  { system: 'Torque',       re: /\b(Torque|Drehmoment|M_Soll|MomentLim|MomFahr)\b/i },
  { system: 'Injection',    re: /\b(Inj_Q|QNFLM|Einspritz|RailDr|InjVol|MengSoll)\b/i },
  { system: 'MAF/MAP',      re: /\b(MAF|MAP|HFM|MLHFM|Luftmasse|Saugrohr)\b/i },
  { system: 'Hız sınırı',   re: /\b(Vmax|V_Max|SpeedLim|GeschBeg)\b/i },
  { system: 'RPM sınırı',   re: /\b(RPM|Drehzahl|nLim|N_Lim|nMax)\b/i },
  { system: 'Pedal',        re: /\b(Pedal|FahrPed|APP_|Gaspedal|AccPedal)\b/i },
  { system: 'Immobilizer',  re: /\b(Immo|IMMO|WFS|Wegfahr)\b/i },
  { system: 'DTC',          re: /\b(DTC|FehlerSp|DiagErr|CEL_|MIL_)\b/i },
  { system: 'Vuruntu',      re: /\b(Knock|Klopf|KFZW|ZW_|Zuend)\b/i },
  { system: 'Soğuk marş',   re: /\b(ColdStart|Kaltstart|WarmUp|STMN)\b/i }
];

function classifySystem(name, description) {
  const text = (name || '') + ' ' + (description || '');
  for (const c of SYSTEM_CLASSIFIERS) {
    if (c.re.test(text)) return c.system;
  }
  return null;
}

// ─── A2L Parser ───

/**
 * A2L dosyasından CHARACTERISTIC, COMPU_METHOD, AXIS_PTS ve MEMORY_SEGMENT çıkarır.
 * Tam ASAP2 spec yerine gerçek dosyalarda karşılaşılan desenlere odaklanır.
 *
 * @param {string} text — A2L dosya içeriği
 * @returns {{ definitions: Array, baseOffset: number, meta: object }}
 */
export function parseA2L(text) {
  // 1) BASE_OFFSET — MemorySegment "_ROM" adresinden
  const baseOffset = extractBaseOffset(text);

  // 2) COMPU_METHOD'ları topla (isim → {unit, coeffs, type})
  const compuMethods = extractCompuMethods(text);

  // 3) RECORD_LAYOUT'ları topla (isim → datatype)
  const recordLayouts = extractRecordLayouts(text);

  // 4) AXIS_PTS'leri topla (isim → {address, datatype, compuMethod, maxAxisPoints})
  const axisPts = extractAxisPts(text, baseOffset, compuMethods);

  // 5) CHARACTERISTIC'leri çıkar
  const definitions = extractCharacteristics(text, baseOffset, compuMethods, recordLayouts, axisPts);

  // Meta bilgi
  const projectMatch = text.match(/\/begin\s+PROJECT\s+(\S+)\s+"([^"]*)"/);
  const moduleMatch  = text.match(/\/begin\s+MODULE\s+(\S+)\s+"([^"]*)"/);

  return {
    definitions,
    baseOffset,
    meta: {
      project: projectMatch ? { name: projectMatch[1], desc: projectMatch[2] } : null,
      module:  moduleMatch  ? { name: moduleMatch[1],  desc: moduleMatch[2]  } : null,
      compuMethodCount: Object.keys(compuMethods).length,
      axisPtsCount: Object.keys(axisPts).length,
      characteristicCount: definitions.length
    }
  };
}

function extractBaseOffset(text) {
  // /begin MEMORY_SEGMENT _ROM ... address ...
  const re = /\/begin\s+MEMORY_SEGMENT\s+\S*_?ROM\S*\s+"[^"]*"\s+\w+\s+\w+\s+\w+\s+(0x[0-9A-Fa-f]+|\d+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    return parseInt(m[1], m[1].startsWith('0x') ? 16 : 10);
  }
  // Fallback: herhangi bir MEMORY_SEGMENT ile FLASH/ROM/EPROM
  const re2 = /\/begin\s+MEMORY_SEGMENT\s+(\S+)\s+"[^"]*"\s+\w+\s+\w+\s+\w+\s+(0x[0-9A-Fa-f]+|\d+)/g;
  while ((m = re2.exec(text)) !== null) {
    if (/ROM|FLASH|EPROM/i.test(m[1])) {
      return parseInt(m[2], m[2].startsWith('0x') ? 16 : 10);
    }
  }
  return 0;
}

function extractCompuMethods(text) {
  const methods = {};
  // /begin COMPU_METHOD name longIdentifier conversionType format unit [coeffs...]
  const re = /\/begin\s+COMPU_METHOD\s+(\S+)\s+"([^"]*)"\s+(\S+)\s+"([^"]*)"\s+"([^"]*)"/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const [, name, desc, convType, format, unit] = m;
    const entry = { name, desc, convType, format, unit, coeffs: null };

    // COEFFS veya COEFFS_LINEAR bloğunu bul
    const blockEnd = text.indexOf('/end COMPU_METHOD', m.index);
    if (blockEnd > 0) {
      const block = text.substring(m.index, blockEnd);

      // RAT_FUNC coefficients
      const coeffsMatch = block.match(/COEFFS\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/);
      if (coeffsMatch) {
        entry.coeffs = {
          a: parseFloat(coeffsMatch[1]),
          b: parseFloat(coeffsMatch[2]),
          c: parseFloat(coeffsMatch[3]),
          d: parseFloat(coeffsMatch[4]),
          e: parseFloat(coeffsMatch[5]),
          f: parseFloat(coeffsMatch[6])
        };
      }

      // LINEAR coefficients
      const linMatch = block.match(/COEFFS_LINEAR\s+([-\d.eE+]+)\s+([-\d.eE+]+)/);
      if (linMatch) {
        entry.coeffs = { a: parseFloat(linMatch[1]), b: parseFloat(linMatch[2]) };
        entry.convType = 'LINEAR';
      }
    }

    methods[name] = entry;
  }
  return methods;
}

function extractRecordLayouts(text) {
  const layouts = {};
  const re = /\/begin\s+RECORD_LAYOUT\s+(\S+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const name = m[1];
    const blockEnd = text.indexOf('/end RECORD_LAYOUT', m.index);
    if (blockEnd < 0) continue;
    const block = text.substring(m.index, blockEnd);

    // FNC_VALUES position datatype
    const fncMatch = block.match(/FNC_VALUES\s+\d+\s+(\S+)/);
    if (fncMatch) {
      layouts[name] = { datatype: fncMatch[1] };
    }
    // AXIS_PTS_X/Y
    const axisXMatch = block.match(/AXIS_PTS_X\s+\d+\s+(\S+)/);
    if (axisXMatch) {
      layouts[name] = layouts[name] || {};
      layouts[name].axisXType = axisXMatch[1];
    }
  }
  return layouts;
}

function extractAxisPts(text, baseOffset, compuMethods) {
  const pts = {};
  // /begin AXIS_PTS name longIdentifier address inputQuantity deposit maxAxisPoints lowerLimit upperLimit
  const re = /\/begin\s+AXIS_PTS\s+(\S+)\s+"([^"]*)"\s+(0x[0-9A-Fa-f]+|\d+)\s+(\S+)\s+(\S+)\s+(\d+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const [, name, desc, addrStr, inputQuantity, deposit, maxAxisPoints, lower, upper] = m;
    const rawAddr = parseInt(addrStr, addrStr.startsWith('0x') ? 16 : 10);
    const cm = compuMethods[inputQuantity] || compuMethods[deposit] || null;

    pts[name] = {
      name,
      desc,
      address: rawAddr - baseOffset,
      rawAddress: rawAddr,
      maxAxisPoints: parseInt(maxAxisPoints, 10),
      lowerLimit: parseFloat(lower),
      upperLimit: parseFloat(upper),
      deposit,
      unit: cm?.unit || '',
      math: cm ? buildMathEquation(cm) : 'X',
      datatype: null // resolved from deposit/RECORD_LAYOUT
    };

    // Datatype'ı blok içinden almaya çalış
    const blockEnd = text.indexOf('/end AXIS_PTS', m.index);
    if (blockEnd > 0) {
      const block = text.substring(m.index, blockEnd);
      const dtMatch = block.match(/DEPOSIT\s+(\S+)/);
      if (dtMatch) pts[name].depositRef = dtMatch[1];
    }
  }
  return pts;
}

function extractCharacteristics(text, baseOffset, compuMethods, recordLayouts, axisPts) {
  const defs = [];
  // /begin CHARACTERISTIC name longIdentifier type address deposit maxDiff compuMethod lowerLimit upperLimit
  const re = /\/begin\s+CHARACTERISTIC\s+(\S+)\s+"([^"]*)"\s+(\S+)\s+(0x[0-9A-Fa-f]+|\d+)\s+(\S+)\s+([-\d.eE+]+)\s+(\S+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
  let m;

  while ((m = re.exec(text)) !== null) {
    const [, name, longId, charType, addrStr, deposit, maxDiff, compuMethodRef, lower, upper] = m;
    const rawAddr = parseInt(addrStr, addrStr.startsWith('0x') ? 16 : 10);
    const adjustedAddr = rawAddr - baseOffset;

    // Blok sonu bul
    const blockStart = m.index;
    const blockEnd = findBlockEnd(text, blockStart, 'CHARACTERISTIC');
    if (blockEnd < 0) continue;
    const block = text.substring(blockStart, blockEnd);

    // COMPU_METHOD çöz
    const cm = compuMethods[compuMethodRef];
    const unit = cm?.unit || '';
    const math = cm ? buildMathEquation(cm) : 'X';

    // Datatype — RECORD_LAYOUT'tan
    const rl = recordLayouts[deposit];
    const datatype = rl?.datatype || 'UWORD';
    const dataSize = DATA_SIZES[datatype] || 2;

    // Tip dönüşümü
    let type = 'scalar';
    if (/^(CURVE|COM_AXIS)$/i.test(charType)) type = 'curve';
    else if (/^(MAP|CUBOID)$/i.test(charType)) type = 'map';
    else if (/^VAL_BLK$/i.test(charType)) type = 'array';

    // Axis'leri çıkar
    const axes = extractAxisDescriptions(block, baseOffset, compuMethods, axisPts);

    // Toplam eleman sayısı ve boyut
    let elementCount = 1;
    for (const ax of axes) {
      elementCount *= ax.length || 1;
    }
    const totalBytes = elementCount * dataSize;

    // Sistem sınıflandırması
    const system = classifySystem(name, longId);

    // DISPLAY_IDENTIFIER
    const dispMatch = block.match(/DISPLAY_IDENTIFIER\s+(\S+)/);

    defs.push({
      name,
      description: longId,
      displayId: dispMatch?.[1] || name,
      address: adjustedAddr,
      rawAddress: rawAddr,
      datatype,
      dataSize,
      type,
      system,
      unit,
      math,
      lowerLimit: parseFloat(lower),
      upperLimit: parseFloat(upper),
      axes,
      elementCount,
      totalBytes,
      source: 'a2l'
    });
  }

  return defs;
}

function extractAxisDescriptions(block, baseOffset, compuMethods, axisPts) {
  const axes = [];
  const re = /\/begin\s+AXIS_DESCR\s+(\S+)\s+(\S+)\s+(\S+)\s+(\d+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
  let m;

  while ((m = re.exec(block)) !== null) {
    const [, axisType, inputQuantity, compuMethodRef, maxAxisPoints, lower, upper] = m;
    const cm = compuMethods[compuMethodRef];
    const length = parseInt(maxAxisPoints, 10);

    const axis = {
      type: axisType, // STD_AXIS, COM_AXIS, FIX_AXIS, etc.
      length,
      lowerLimit: parseFloat(lower),
      upperLimit: parseFloat(upper),
      unit: cm?.unit || '',
      math: cm ? buildMathEquation(cm) : 'X',
      name: inputQuantity,
      address: null,
      datatype: null,
      dataSize: null
    };

    // AXIS_PTS_REF — dış eksen noktaları referansı
    const axDescEnd = findBlockEnd(block, m.index, 'AXIS_DESCR');
    if (axDescEnd > 0) {
      const axBlock = block.substring(m.index, axDescEnd);
      const refMatch = axBlock.match(/AXIS_PTS_REF\s+(\S+)/);
      if (refMatch && axisPts[refMatch[1]]) {
        const ref = axisPts[refMatch[1]];
        axis.address = ref.address;
        axis.name = ref.name;
        axis.unit = ref.unit || axis.unit;
        axis.math = ref.math || axis.math;
      }
    }

    axes.push(axis);
  }

  return axes;
}

function findBlockEnd(text, startIndex, blockType) {
  // Nested /begin ... /end çiftlerini takip et
  let depth = 0;
  let i = startIndex;
  const beginRe = new RegExp(`/begin\\s+${blockType}`, 'g');
  const endRe   = new RegExp(`/end\\s+${blockType}`, 'g');

  // İlk /begin'i bul
  beginRe.lastIndex = i;
  const firstBegin = beginRe.exec(text);
  if (!firstBegin || firstBegin.index !== startIndex) {
    // startIndex'ten /begin bul
    const searchFrom = text.indexOf('/begin', startIndex);
    if (searchFrom < 0) return -1;
  }

  // Basit yaklaşım: /end blockType'ı bul (nested olmayan durum)
  const endStr = `/end ${blockType}`;
  const pos = text.indexOf(endStr, startIndex + 10);
  return pos >= 0 ? pos + endStr.length : -1;
}

function buildMathEquation(cm) {
  if (!cm) return 'X';

  if (cm.convType === 'IDENTICAL') return 'X';

  if (cm.convType === 'LINEAR' && cm.coeffs) {
    const { a, b } = cm.coeffs;
    if (a === 0 && b === 1) return 'X';
    if (a === 0) return `X * ${b}`;
    return `(X * ${b}) + ${a}`;
  }

  if (cm.convType === 'RAT_FUNC' && cm.coeffs) {
    const { a, b, c, d, e, f } = cm.coeffs;
    // Standart: physical = ((f * X) - c) / (b - (e * X))
    // Basit durumlar
    if (a === 0 && d === 0 && e === 0) {
      // physical = (f * X - c) / b
      if (c === 0 && b === 1) return `${f} * X`;
      if (c === 0) return `(${f} * X) / ${b}`;
      return `((${f} * X) - ${c}) / ${b}`;
    }
    if (a === 0 && d === 0) {
      return `((${f} * X) - ${c}) / (${b} - (${e} * X))`;
    }
    return `RAT_FUNC(${[a,b,c,d,e,f].join(',')})`;
  }

  // TAB_*, FORM vs. — denklem çıkarılamaz
  return cm.convType || 'X';
}


// ─── XDF Parser ───

/**
 * XDF (TunerPro definition) dosyasını parse eder.
 * XML-based — Workers'ta DOMParser yok, regex tabanlı çıkarım.
 *
 * @param {string} xml — XDF dosya içeriği
 * @returns {{ definitions: Array, meta: object }}
 */
export function parseXDF(xml) {
  const definitions = [];

  // Header bilgisi
  const titleMatch = xml.match(/<deftitle>([^<]*)<\/deftitle>/);
  const descMatch  = xml.match(/<description>([^<]*)<\/description>/);
  const baseMatch  = xml.match(/<BASEOFFSET\s+offset="([^"]*)"[^/]*\/?>/i);
  const baseOffset = baseMatch ? parseInt(baseMatch[1], 10) : 0;

  // Kategorileri topla
  const categories = {};
  const catRe = /<CATEGORY\s+index="([^"]*)"\s+name="([^"]*)"\s*\/?>/gi;
  let cm;
  while ((cm = catRe.exec(xml)) !== null) {
    categories[cm[1]] = cm[2];
  }

  // XDFTABLE'ları çıkar
  const tableRe = /<XDFTABLE\b[^>]*>([\s\S]*?)<\/XDFTABLE>/gi;
  let tm;
  while ((tm = tableRe.exec(xml)) !== null) {
    const tableXml = tm[1];
    const def = parseXdfTableBlock(tableXml, categories, baseOffset);
    if (def) definitions.push(def);
  }

  // XDFCONSTANT'ları çıkar
  const constRe = /<XDFCONSTANT\b[^>]*>([\s\S]*?)<\/XDFCONSTANT>/gi;
  while ((tm = constRe.exec(xml)) !== null) {
    const constXml = tm[0];
    const def = parseXdfConstantBlock(constXml, categories, baseOffset);
    if (def) definitions.push(def);
  }

  return {
    definitions,
    meta: {
      title: titleMatch?.[1] || 'Unknown',
      description: descMatch?.[1] || '',
      baseOffset,
      categoryCount: Object.keys(categories).length,
      tableCount: definitions.filter(d => d.type !== 'scalar').length,
      constantCount: definitions.filter(d => d.type === 'scalar').length
    }
  };
}

function parseXdfTableBlock(tableXml, categories, baseOffset) {
  const title = extractXmlText(tableXml, 'title');
  const desc  = extractXmlText(tableXml, 'description');
  if (!title) return null;

  // Kategoriler
  const catMems = [];
  const catRe = /<CATEGORYMEM\s+[^>]*category="(\d+)"[^>]*\/?>/gi;
  let m;
  while ((m = catRe.exec(tableXml)) !== null) {
    const idx = parseInt(m[1], 10) - 1;
    if (categories[`0x${idx.toString(16)}`]) catMems.push(categories[`0x${idx.toString(16)}`]);
    else if (categories[String(idx)]) catMems.push(categories[String(idx)]);
  }

  // Z-axis (ana veri) — XDFAXIS id="z"
  const zAxis = parseXdfAxis(tableXml, 'z');
  if (!zAxis) return null;

  // X ve Y axis'leri
  const xAxis = parseXdfAxis(tableXml, 'x');
  const yAxis = parseXdfAxis(tableXml, 'y');

  const axes = [];
  if (xAxis?.address != null || xAxis?.length > 1) axes.push(xAxis);
  if (yAxis?.address != null || yAxis?.length > 1) axes.push(yAxis);

  let type = 'scalar';
  if (axes.length === 1) type = 'curve';
  else if (axes.length >= 2) type = 'map';

  const system = classifySystem(title, desc);

  // Eleman sayısı
  const cols = zAxis.cols || 1;
  const rows = zAxis.rows || 1;
  const elementCount = cols * rows;
  const dataSize = zAxis.dataSize || 2;

  return {
    name: title.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_]/g, ''),
    description: desc || title,
    displayId: title,
    address: zAxis.address != null ? zAxis.address - baseOffset : null,
    rawAddress: zAxis.address,
    datatype: zAxis.datatype || 'UWORD',
    dataSize,
    type,
    system,
    unit: zAxis.unit || '',
    math: zAxis.math || 'X',
    lowerLimit: zAxis.min ?? 0,
    upperLimit: zAxis.max ?? 65535,
    axes: axes.map(a => ({
      name: a.name || '',
      address: a.address != null ? a.address - baseOffset : null,
      length: a.length || 1,
      datatype: a.datatype,
      dataSize: a.dataSize || 2,
      unit: a.unit || '',
      math: a.math || 'X'
    })),
    elementCount,
    totalBytes: elementCount * dataSize,
    categories: catMems,
    source: 'xdf'
  };
}

function parseXdfConstantBlock(constXml, categories, baseOffset) {
  const title = extractXmlText(constXml, 'title');
  const desc  = extractXmlText(constXml, 'description');
  if (!title) return null;

  // EMBEDDEDDATA
  const ed = parseEmbeddedData(constXml);
  if (!ed) return null;

  // MATH
  const mathMatch = constXml.match(/<MATH\s+equation="([^"]*)"[^>]*\/?>/i)
                 || constXml.match(/<MATH\s+equation="([^"]*)"/i);
  const math = mathMatch?.[1] || 'X';

  const system = classifySystem(title, desc);

  return {
    name: title.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_]/g, ''),
    description: desc || title,
    displayId: title,
    address: ed.address != null ? ed.address - baseOffset : null,
    rawAddress: ed.address,
    datatype: ed.datatype || 'UWORD',
    dataSize: ed.dataSize || 2,
    type: 'scalar',
    system,
    unit: '',
    math,
    lowerLimit: 0,
    upperLimit: 65535,
    axes: [],
    elementCount: 1,
    totalBytes: ed.dataSize || 2,
    categories: [],
    source: 'xdf'
  };
}

function parseXdfAxis(tableXml, axisId) {
  // İlgili XDFAXIS bloğunu bul
  const re = new RegExp(`<XDFAXIS[^>]*\\bid="${axisId}"[^>]*>([\\s\\S]*?)</XDFAXIS>`, 'i');
  const m = tableXml.match(re);
  if (!m) return null;
  const axisXml = m[1];

  // EMBEDDEDDATA
  const ed = parseEmbeddedData(axisXml);

  // indexcount
  const icMatch = axisXml.match(/<indexcount>(\d+)<\/indexcount>/i);
  const length = icMatch ? parseInt(icMatch[1], 10) : 1;

  // units
  const unitMatch = axisXml.match(/<units>([^<]*)<\/units>/i);

  // min/max
  const minMatch = axisXml.match(/<min>([-\d.eE+]+)<\/min>/i);
  const maxMatch = axisXml.match(/<max>([-\d.eE+]+)<\/max>/i);

  // MATH equation
  const mathMatch = axisXml.match(/<MATH\s+equation="([^"]*)"[^>]*\/?>/i)
                 || axisXml.match(/<MATH\s+equation="([^"]*)"/i);

  return {
    name: '',
    address: ed?.address ?? null,
    length,
    datatype: ed?.datatype || 'UWORD',
    dataSize: ed?.dataSize || 2,
    unit: unitMatch?.[1] || '',
    math: mathMatch?.[1] || 'X',
    min: minMatch ? parseFloat(minMatch[1]) : null,
    max: maxMatch ? parseFloat(maxMatch[1]) : null,
    cols: ed?.cols || length,
    rows: ed?.rows || 1
  };
}

function parseEmbeddedData(xml) {
  const m = xml.match(/<EMBEDDEDDATA\s+([^>]+)\/?>/i);
  if (!m) return null;
  const attrs = m[1];

  const address = extractAttr(attrs, 'mmedaddress');
  const sizeBits = extractAttr(attrs, 'mmedelementsizebits');
  const cols = extractAttr(attrs, 'mmedcolcount');
  const rows = extractAttr(attrs, 'mmedrowcount');
  const typeFlags = extractAttr(attrs, 'mmedtypeflags');

  const dataSize = sizeBits ? Math.ceil(parseInt(sizeBits, 10) / 8) : 2;

  // Datatype tahmini
  let datatype = 'UWORD';
  const flagVal = typeFlags ? parseInt(typeFlags, 16) : 0;
  if (flagVal & 0x10000) datatype = 'FLOAT32_IEEE';
  else if (dataSize === 1) datatype = (flagVal & 0x01) ? 'SBYTE' : 'UBYTE';
  else if (dataSize === 4) datatype = (flagVal & 0x01) ? 'SLONG' : 'ULONG';
  else if (dataSize === 2) datatype = (flagVal & 0x01) ? 'SWORD' : 'UWORD';

  return {
    address: address != null ? parseInt(address, 10) : null,
    dataSize,
    datatype,
    cols: cols ? parseInt(cols, 10) : 1,
    rows: rows ? parseInt(rows, 10) : 1
  };
}

function extractAttr(attrStr, name) {
  const re = new RegExp(`${name}="([^"]*)"`, 'i');
  const m = attrStr.match(re);
  return m ? m[1] : null;
}

function extractXmlText(xml, tag) {
  const re = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i');
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}


// ─── Otomatik format algılama ───

/**
 * Dosya içeriğinden format algıla ve uygun parser çağır.
 * @param {string} text — dosya içeriği (UTF-8 text)
 * @returns {{ format: string, definitions: Array, meta: object, baseOffset?: number }}
 */
export function parseDefinitionFile(text) {
  // A2L tespiti: /begin ve CHARACTERISTIC veya ASAP2_VERSION keyword'leri
  if (/\/begin\s+(PROJECT|MODULE|CHARACTERISTIC|ASAP2_VERSION)/i.test(text)) {
    const result = parseA2L(text);
    return { format: 'a2l', ...result };
  }

  // XDF tespiti: XDFFORMAT root element
  if (/<XDFFORMAT/i.test(text)) {
    const result = parseXDF(text);
    return { format: 'xdf', ...result };
  }

  throw new Error('UNSUPPORTED_FORMAT: Dosya A2L veya XDF formatında değil');
}


// ─── Scanner entegrasyonu: tanımları binary'ye uygula ───

/**
 * Import edilmiş tanımları binary üzerinde doğrula ve eşleştir.
 * Her tanımın address'inin binary sınırları içinde olduğunu kontrol eder
 * ve mevcut byte değerlerini okur.
 *
 * @param {Uint8Array} bytes — ECU binary
 * @param {Array} definitions — parseDefinitionFile çıktısı
 * @returns {Array} — doğrulanmış ve zenginleştirilmiş tanımlar
 */
export function matchDefinitions(bytes, definitions) {
  const matched = [];

  for (const def of definitions) {
    if (def.address == null || def.address < 0) continue;
    if (def.address >= bytes.length) continue;
    if (def.address + def.totalBytes > bytes.length) continue;

    // Mevcut değeri oku
    const currentBytes = bytes.slice(def.address, def.address + Math.min(def.totalBytes, 32));
    const windowHex = Array.from(currentBytes).map(b => b.toString(16).padStart(2, '0')).join(' ');

    // İlk değeri oku (datatype'a göre)
    let currentValue = null;
    if (def.dataSize === 1) {
      currentValue = bytes[def.address];
    } else if (def.dataSize === 2) {
      // Little-endian
      currentValue = bytes[def.address] | (bytes[def.address + 1] << 8);
    } else if (def.dataSize === 4 && def.datatype !== 'FLOAT32_IEEE') {
      currentValue = bytes[def.address] | (bytes[def.address + 1] << 8) |
                     (bytes[def.address + 2] << 16) | (bytes[def.address + 3] << 24);
      currentValue = currentValue >>> 0; // unsigned
    }

    matched.push({
      ...def,
      verified: true,
      windowHex,
      currentValue,
      offsetHex: '0x' + def.address.toString(16).padStart(6, '0')
    });
  }

  return matched;
}


// ─── Tanımlardan tuning aksiyonları üret ───

/**
 * Eşleşen tanımlardan bilinen sistemler için otomatik aksiyon önerileri üret.
 * Sadece sistemi tespit edilmiş ve değeri anlamlı olan tanımlar için.
 *
 * @param {Array} matchedDefs — matchDefinitions çıktısı
 * @returns {Array} — scanRegions() formatında region'lar
 */
export function definitionsToRegions(matchedDefs) {
  const regions = [];

  for (const def of matchedDefs) {
    if (!def.system || !def.verified) continue;

    const actions = [];

    // Basit switch/flag tespiti — 1-byte değer 0x00 veya 0x01 ise
    if (def.type === 'scalar' && def.dataSize === 1 && def.currentValue != null) {
      if (def.currentValue === 0x01 || def.currentValue === 0x00) {
        const isEnabled = def.currentValue === 0x01;
        actions.push({
          id: `def_${def.name}_toggle`,
          label: `${def.displayId} — ${isEnabled ? 'Devre dışı bırak' : 'Etkinleştir'}`,
          detail: `${def.description} (${def.source.toUpperCase()} tanımlı, adres: ${def.offsetHex})`,
          offset: def.address,
          expectedByte: def.currentValue,
          newByte: isEnabled ? 0x00 : 0x01,
          risk: 'medium',
          confidence: 'high',
          source: `imported-${def.source}`
        });
      }
    }

    // Limit değer tespiti — 2-byte değer, limit artırma/azaltma
    if (def.type === 'scalar' && def.dataSize === 2 && def.currentValue != null) {
      if (/limit|grenze|max|min|soll/i.test(def.name + ' ' + def.description)) {
        actions.push({
          id: `def_${def.name}_info`,
          label: `${def.displayId} — Mevcut: ${def.currentValue} ${def.unit}`,
          detail: `${def.description} — sınırlar: ${def.lowerLimit}..${def.upperLimit} (${def.source.toUpperCase()})`,
          offset: def.address,
          expectedByte: null,
          newByte: null, // Kullanıcı AI-suggest ile belirler
          risk: 'info',
          confidence: 'high',
          source: `imported-${def.source}`
        });
      }
    }

    regions.push({
      id: `def_${def.name}_${def.address.toString(16)}`,
      system: def.system,
      desc: `${def.description} (${def.source.toUpperCase()} tanımlı)`,
      foundString: def.displayId,
      offset: def.address,
      offsetHex: def.offsetHex,
      windowHex: def.windowHex,
      windowStart: def.address,
      source: `imported-${def.source}`,
      actions,
      definitionMeta: {
        name: def.name,
        type: def.type,
        datatype: def.datatype,
        unit: def.unit,
        math: def.math,
        axes: def.axes,
        elementCount: def.elementCount
      }
    });
  }

  return regions;
}
