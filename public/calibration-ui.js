import { validateDefinition, readMap, writeMapCell, parseIntelHex } from './lib/calibration.js';

function mount() {
  const host = document.querySelector('#ecu .ecuShell'); if (!host || !window.jarvisEcuStudio) return;
  const card = document.createElement('div'); card.className = 'card';
  card.innerHTML = '<h3>Kalibrasyon Projesi · ORI / MOD</h3><p>Önce ORI dosyasını yükle. Mevcut MOD dosyanı karşılaştırabilir veya aynı ORI için hazırlanmış JSON map tanımını kullanabilirsin.</p><label>MOD karşılaştırma <input id="calibrationMod" type="file" accept=".bin,.ori,.mod,.rom,.hex,.ecu"></label><label>Map tanımı <input id="calibrationDefinition" type="file" accept=".json"></label><p id="calibrationStatus" role="status">Map tanımı bekleniyor. ECU checksum doğrulaması yapılmadı.</p><select id="calibrationMap" disabled></select><div id="calibrationCells" style="overflow:auto;max-height:360px"></div><button id="calibrationExport" disabled>PROJE / DEĞİŞİKLİK RAPORU İNDİR</button>';
  host.append(card); let definition;
  const status = document.querySelector('#calibrationStatus'), select = document.querySelector('#calibrationMap'), cells = document.querySelector('#calibrationCells');
  const getState = () => window.jarvisEcuStudio.getState();
  async function hash(bytes) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join(''); }
  const originalMatches = async () => definition && getState().original && definition.original_sha256.toLowerCase() === await hash(getState().original);
  function renderMap() {
    cells.replaceChildren(); const map = definition.maps.find(item => item.id === select.value); if (!map) return;
    const table = document.createElement('table'); const values = readMap(getState().bytes, map);
    for (let row = 0; row < map.rows; row++) { const tr = table.insertRow(); for (let col = 0; col < map.columns; col++) {
      const index = row * map.columns + col, input = document.createElement('input'); input.type = 'number'; input.value = values[index]; input.step = Math.abs(map.factor); input.min = map.min; input.max = map.max; input.style.width = '100px'; input.setAttribute('aria-label', `${map.name || map.id} ${row + 1},${col + 1}`);
      input.onchange = async () => { try { if (!(await originalMatches())) throw new Error('ORI dosyası değişti; tanımı yeniden yükle'); const state = getState(); state.bytes = writeMapCell(state.bytes, map, index, Number(input.value)); state.undo = []; state.redo = []; window.jarvisEcuStudio.render(); status.textContent = 'Map hücresi güncellendi. ECU checksum doğrulaması yapılmadı.'; } catch (error) { input.value = readMap(getState().bytes, map)[index]; status.textContent = error.message; } };
      tr.insertCell().append(input);
    } } cells.append(table);
  }
  document.querySelector('#calibrationDefinition').onchange = async event => {
    definition = null; select.disabled = true; cells.replaceChildren(); document.querySelector('#calibrationExport').disabled = true;
    try { const file = event.target.files?.[0], state = getState(); if (!file) return; if (!state.original) throw new Error('Önce ORI dosyasını yükle'); if (file.size > 2 * 1024 * 1024) throw new Error('Map tanımı 2 MB sınırını aşıyor');
      definition = validateDefinition(JSON.parse(await file.text()), state.bytes.length, await hash(state.original)); select.replaceChildren();
      for (const map of definition.maps) { const option = document.createElement('option'); option.value = map.id; option.textContent = `${map.name || map.id} · ${map.rows}×${map.columns} · ${map.unit || ''}`; select.append(option); }
      select.disabled = false; document.querySelector('#calibrationExport').disabled = false; status.textContent = `${definition.maps.length} map · ORI SHA-256 eşleşti · ECU checksum doğrulanmadı.`; renderMap();
    } catch (error) { status.textContent = 'Tanım yüklenemedi: ' + error.message; }
  };
  select.onchange = renderMap;
  document.querySelector('#calibrationMod').onchange = async event => {
    try { const file = event.target.files?.[0], state = getState(); if (!file) return; if (!state.original) throw new Error('Önce ORI dosyasını yükle'); if (file.size > 12 * 1024 * 1024) throw new Error('12 MB sınırı');
      let bytes = new Uint8Array(await file.arrayBuffer()), base = 0;
      if (/\.hex$/i.test(file.name) && bytes[0] === 58) { const parsed = parseIntelHex(new TextDecoder().decode(bytes)); bytes = parsed.bytes; base = parsed.base_address; }
      if (bytes.length !== state.original.length || base !== (state.baseAddress || 0)) throw new Error('ORI/MOD boyutu veya HEX başlangıç adresi farklı');
      state.bytes = bytes; state.undo = []; state.redo = []; window.jarvisEcuStudio.render(); status.textContent = 'MOD yüklendi. ORI / MOD kanalında byte farklarını görebilirsin.'; document.querySelector('#calibrationExport').disabled = false;
      if (await originalMatches()) renderMap();
    } catch (error) { status.textContent = 'MOD karşılaştırılamadı: ' + error.message; }
  };
  document.querySelector('#calibrationExport').onclick = async () => {
    const state = getState(); if (!state.original) return;
    const changes = []; for (let i = 0; i < state.bytes.length; i++) if (state.original[i] !== state.bytes[i]) changes.push({ offset: i, original: state.original[i], modified: state.bytes[i] });
    const report = { version: 1, name: state.name, base_address: state.baseAddress || 0, original_sha256: await hash(state.original), modified_sha256: await hash(state.bytes), changed_bytes: changes.length, checksum_status: 'not-verified', definition: await originalMatches() ? definition : null, changes };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = state.name + '.project.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
