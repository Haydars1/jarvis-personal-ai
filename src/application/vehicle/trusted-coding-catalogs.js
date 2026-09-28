import { fetchWithTimeout } from '../../lib/runtime.js';

const VAG_CODER_RAW =
  'https://raw.githubusercontent.com/hsandhu01/Vag-Coder/main/index.html';

const ATTRIBUTION = Object.freeze({
  source:'VAG CODER',
  repository:'https://github.com/hsandhu01/Vag-Coder',
  license:'MIT',
  copyright:'Copyright (c) 2026 VAG CODER Contributors'
});

function unescapeJs(value='') {
  return String(value)
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\\\/g, '\\');
}

function field(line, name) {
  const rx = new RegExp(name + ':\\s*"((?:\\\\.|[^"])*)"');
  const m = String(line).match(rx);
  return m ? unescapeJs(m[1]) : '';
}

function parseOperations(coding='') {
  const operations = [];
  const text = String(coding || '');

  const byteBit = /Byte\s*0*(\d+)\s*,?\s*Bit\s*0*(\d+)\s*(?:→|->|=)?\s*(?:check|1|on|active)?/ig;
  let match;
  while ((match = byteBit.exec(text))) {
    operations.push({
      kind:'longCodingBit',
      byte:Number(match[1]),
      bit:Number(match[2]),
      enabled:true
    });
  }

  const byteBitOff = /Byte\s*0*(\d+)\s*,?\s*Bit\s*0*(\d+)[^.;]*(?:uncheck|0|off|not[_ ]active)/ig;
  while ((match = byteBitOff.exec(text))) {
    const key = `${match[1]}:${match[2]}`;
    if (!operations.some(op => `${op.byte}:${op.bit}` === key)) {
      operations.push({
        kind:'longCodingBit',
        byte:Number(match[1]),
        bit:Number(match[2]),
        enabled:false
      });
    }
  }

  const adaptation = text.match(/Adaptation:\s*([^→]+?)\s*→\s*([^.;]+)/i);
  if (adaptation) {
    operations.push({
      kind:'adaptation',
      channel:adaptation[1].trim(),
      value:adaptation[2].trim()
    });
  }

  return operations;
}

export function parseVagCoderIndex(html='') {
  const rows = [];
  const lines = String(html).split(/\r?\n/);
  for (const line of lines) {
    if (!/\{\s*id:\s*"/.test(line) || !/coding:\s*"/.test(line)) continue;
    const id = field(line,'id');
    const name = field(line,'name');
    const desc = field(line,'desc');
    const module = field(line,'module');
    const coding = field(line,'coding');
    const type = field(line,'type');
    const risk = field(line,'risk');
    const compat = field(line,'compat');
    if (!id || !module || !coding) continue;
    rows.push({
      id:`vag-coder:${id}`,
      brand:'Audi',
      vehicle:'2019 Audi RS5 B9 US',
      platform:'B9 / MLB Evo',
      feature:name,
      description:desc,
      module,
      coding,
      type,
      risk,
      compat,
      operations:parseOperations(coding),
      sourceUrl:'https://github.com/hsandhu01/Vag-Coder/blob/main/index.html',
      sourceTitle:'VAG CODER — 2019 Audi RS5 B9',
      sourceKind:'GitHub',
      confidence:0.9,
      status:'trusted_catalog',
      attribution:ATTRIBUTION
    });
  }
  return rows;
}

export async function fetchVagCoderCatalog() {
  const response = await fetchWithTimeout(
    VAG_CODER_RAW,
    { headers:{accept:'text/plain','user-agent':'JARVIS-Coding-Catalog/1.0'} },
    8000
  );
  if (!response.ok) throw new Error(`VAG_CODER_${response.status}`);
  return parseVagCoderIndex(await response.text());
}

export { ATTRIBUTION as VAG_CODER_ATTRIBUTION };
