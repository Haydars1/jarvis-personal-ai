import { mkdir, readFile, writeFile } from 'node:fs/promises';

function extractObject(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Marker not found: ${marker}`);
  const open = source.indexOf('{', markerIndex + marker.length);
  if (open < 0) throw new Error(`Object start not found after: ${marker}`);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = open; i < source.length; i += 1) {
    const c = source[i];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '{') depth += 1;
    if (c === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  throw new Error(`Unclosed object after: ${marker}`);
}

const faultSource = await readFile('fault-data.js', 'utf8');
const localizationSource = await readFile('js/fault-localization.mjs', 'utf8');
const faultObject = extractObject(faultSource, 'window.faultData =');
const trObject = extractObject(localizationSource, 'const tr=');
const enObject = extractObject(localizationSource, 'const en=');

await mkdir('src/domain', { recursive: true });
await writeFile('src/domain/fault-data.generated.ts', `// Generated from fault-data.js. Do not hand-edit.\nimport type { FaultEntry } from './faults.types';\nexport const faultData = ${faultObject} satisfies Record<string, FaultEntry>;\n`);
await writeFile('src/domain/fault-localizations.generated.ts', `// Generated from js/fault-localization.mjs. Do not hand-edit.\nimport type { FaultTranslation } from './faults.types';\nexport const faultTranslations = { tr: ${trObject}, en: ${enObject} } satisfies Record<'tr' | 'en', Record<string, FaultTranslation>>;\n`);
console.log('Generated TypeScript fault data and localization packs.');
