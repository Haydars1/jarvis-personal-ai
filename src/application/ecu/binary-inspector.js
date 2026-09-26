const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_DIFF_RANGES = 24;

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

async function readJson(req) {
  try { return await req.clone().json(); } catch { return {}; }
}

function b64Bytes(value = '') {
  const raw = atob(String(value || ''));
  if (raw.length > MAX_FILE_BYTES) throw new Error('ECU_FILE_TOO_LARGE');
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function sha256(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join('');
}

function hex(bytes, start = 0, length = 32) {
  const end = Math.min(bytes.length, start + length);
  const parts = [];
  for (let i = start; i < end; i++) parts.push(bytes[i].toString(16).padStart(2, '0').toUpperCase());
  return parts.join(' ');
}

function ascii(bytes, start = 0, length = 64) {
  const end = Math.min(bytes.length, start + length);
  let out = '';
  for (let i = start; i < end; i++) {
    const v = bytes[i];
    out += v >= 32 && v <= 126 ? String.fromCharCode(v) : '.';
  }
  return out;
}

function stats(bytes) {
  if (!bytes.length) return { zeroPct: 0, ffPct: 0, entropy: 0 };
  let zeros = 0, ffs = 0;
  const freq = new Uint32Array(256);
  for (const b of bytes) {
    freq[b]++;
    if (b === 0) zeros++;
    if (b === 255) ffs++;
  }
  let entropy = 0;
  for (const n of freq) {
    if (!n) continue;
    const p = n / bytes.length;
    entropy -= p * Math.log2(p);
  }
  return {
    zeroPct: +(zeros * 100 / bytes.length).toFixed(2),
    ffPct: +(ffs * 100 / bytes.length).toFixed(2),
    entropy: +entropy.toFixed(3)
  };
}

function compare(a, b) {
  const min = Math.min(a.length, b.length);
  let changed = Math.abs(a.length - b.length);
  let first = -1, last = -1;
  const ranges = [];
  let rangeStart = -1;
  for (let i = 0; i < min; i++) {
    const diff = a[i] !== b[i];
    if (diff) {
      changed++;
      if (first < 0) first = i;
      last = i;
      if (rangeStart < 0) rangeStart = i;
    } else if (rangeStart >= 0) {
      if (ranges.length < MAX_DIFF_RANGES) ranges.push({ start: rangeStart, end: i - 1 });
      rangeStart = -1;
    }
  }
  if (rangeStart >= 0 && ranges.length < MAX_DIFF_RANGES) ranges.push({ start: rangeStart, end: min - 1 });
  if (a.length !== b.length) {
    const start = min;
    const end = Math.max(a.length, b.length) - 1;
    if (first < 0) first = start;
    last = end;
    if (ranges.length < MAX_DIFF_RANGES) ranges.push({ start, end });
  }
  const total = Math.max(a.length, b.length, 1);
  return {
    changed,
    changedPct: +(changed * 100 / total).toFixed(4),
    first,
    last,
    ranges,
    truncatedRanges: ranges.length >= MAX_DIFF_RANGES
  };
}

function sampleRange(a, b, range) {
  const start = Math.max(0, range.start - 8);
  const len = Math.min(32, Math.max(a.length, b.length) - start);
  return {
    offset: start,
    before: hex(a, start, len),
    after: hex(b, start, len)
  };
}

function chatPayload(text, reply, trace = []) {
  return {
    reply,
    provider: 'JARVIS ECU Binary Inspector',
    history: [
      { role: 'user', content: text },
      { role: 'assistant', content: reply, provider: 'JARVIS ECU Binary Inspector' }
    ],
    trace: [{ kind: 'tool', label: 'ECU Binary Inspector', value: 'Gerçek BIN byte analizi' }, ...trace]
  };
}

function classifyPair(files) {
  if (files.length < 2) return files;
  const ori = files.find(f => /(^|[^a-z])(ori|original|stock)([^a-z]|$)/i.test(String(f.name || '')));
  const mod = files.find(f => /(^|[^a-z])(mod|tuned|stage|modified|off)([^a-z]|$)/i.test(String(f.name || '')));
  if (ori && mod && ori !== mod) return [ori, mod];
  return files.slice(0, 2);
}

function isBinaryAttachment(file) {
  const name = String(file?.name || '');
  const type = String(file?.type || '');
  return /\.(bin|ori|hex|rom)$/i.test(name) || /octet-stream|macbinary/i.test(type);
}

export function createEcuBinaryInspector(core) {
  if (!core?.fetch) throw new Error('ECU_BINARY_CORE_REQUIRED');
  return {
    async fetch(req, env, ctx) {
      const url = new URL(req.url);
      if (url.pathname !== '/api/chat/send' || req.method !== 'POST') return core.fetch(req, env, ctx);

      const body = await readJson(req);
      if (String(body?.channel || '').toLowerCase() !== 'ecu') return core.fetch(req, env, ctx);

      const text = String(body?.text || '').trim() || 'ECU dosyasını analiz et.';
      const files = (Array.isArray(body?.attachments) ? body.attachments : []).filter(isBinaryAttachment);
      if (!files.length) return core.fetch(req, env, ctx);

      try {
        if (files.length >= 2) {
          const [oriFile, modFile] = classifyPair(files);
          const ori = b64Bytes(oriFile.base64);
          const mod = b64Bytes(modFile.base64);
          const [oriHash, modHash] = await Promise.all([sha256(ori), sha256(mod)]);
          const diff = compare(ori, mod);
          const samples = diff.ranges.slice(0, 6).map(r => sampleRange(ori, mod, r));

          const rangeLines = diff.ranges.slice(0, 12).map((r, i) =>
            `${i + 1}. 0x${r.start.toString(16).toUpperCase()}–0x${r.end.toString(16).toUpperCase()} (${r.end - r.start + 1} byte)`
          );
          const sampleLines = samples.map(s =>
            `0x${s.offset.toString(16).toUpperCase()}\nORI: ${s.before}\nMOD: ${s.after}`
          );

          const reply = [
            'Dosyaları gerçekten byte olarak okudum ve ORI ↔ MOD karşılaştırması yaptım.',
            `ORI: ${oriFile.name} — ${ori.length.toLocaleString('tr-TR')} byte — SHA256 ${oriHash}`,
            `MOD: ${modFile.name} — ${mod.length.toLocaleString('tr-TR')} byte — SHA256 ${modHash}`,
            '',
            `Değişen byte: ${diff.changed.toLocaleString('tr-TR')} (%${diff.changedPct})`,
            diff.first >= 0 ? `İlk fark: 0x${diff.first.toString(16).toUpperCase()} • Son fark: 0x${diff.last.toString(16).toUpperCase()}` : 'İki dosya byte düzeyinde aynı.',
            diff.ranges.length ? `Değişiklik bölgeleri:\n${rangeLines.join('\n')}${diff.truncatedRanges ? '\n… daha fazla bölge var.' : ''}` : '',
            sampleLines.length ? `\nİlk farklardan hexdump örnekleri:\n${sampleLines.join('\n\n')}` : '',
            '',
            'Not: Sadece byte farkından “bu kesin Stage 1 / DTC OFF” diye etiket koymak güvenilir değildir. Bunun için ECU/HW/SW eşleşmesi ve doğrulanmış map/rulepack gerekir. Ama yukarıdaki offset ve byte farkları gerçek dosya farkıdır.'
          ].filter(Boolean).join('\n');

          return json(chatPayload(text, reply, [
            { kind: 'binary-diff', label: 'Değişen byte', value: String(diff.changed) },
            { kind: 'binary-diff', label: 'Fark oranı', value: `%${diff.changedPct}` }
          ]));
        }

        const file = files[0];
        const bytes = b64Bytes(file.base64);
        const digest = await sha256(bytes);
        const s = stats(bytes);
        const reply = [
          'Dosyayı gerçekten açıp byte içeriğini okudum.',
          `Dosya: ${file.name}`,
          `Boyut: ${bytes.length.toLocaleString('tr-TR')} byte`,
          `SHA256: ${digest}`,
          `Entropy: ${s.entropy} bit/byte • 00 oranı: %${s.zeroPct} • FF oranı: %${s.ffPct}`,
          `İlk 32 byte: ${hex(bytes, 0, 32)}`,
          `ASCII önizleme: ${ascii(bytes, 0, 64)}`,
          '',
          'Bu tek dosyanın içeriğini okuyabiliyorum; fakat “neyi değiştirmişler?” sorusunu kesin cevaplamak için aynı ECU’nun ORI/orijinal dosyasını da yükle. ORI + MOD birlikte gelince byte-byte farkı, offset aralıklarını ve hexdump öncesi/sonrası değerlerini çıkaracağım.',
          'Dosya adında Stage 1 veya DTC OFF yazması tek başına kanıt değildir; içeriği görmeden o etiketi gerçekmiş gibi kabul etmeyeceğim.'
        ].join('\n');
        return json(chatPayload(text, reply, [
          { kind: 'binary', label: 'SHA256', value: digest },
          { kind: 'binary', label: 'Boyut', value: String(bytes.length) }
        ]));
      } catch (error) {
        const message = error?.message === 'ECU_FILE_TOO_LARGE'
          ? 'ECU dosyası 12 MB sınırını aşıyor.'
          : `ECU dosyası okunamadı: ${error?.message || String(error)}`;
        return json(chatPayload(text, message), 400);
      }
    },
    scheduled(event, env, ctx) {
      return core.scheduled?.(event, env, ctx);
    }
  };
}
