// JARVIS ECU — v2: dosya → bölge taraması → tıklanabilir aksiyonlar + AI karşılaştırma
(() => {
  const state = {
    uploadId: null,
    fileName: '',
    fileSize: 0,
    regions: [],
    systems: [],
    stats: null,
    selectedActions: new Map(), // id → action
    tunedId: null,
    aiLoading: false,
    aiSuggestions: [],
    aiProvider: ''
  };

  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>'"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  const fmtSize = n => n >= 1048576 ? (n/1048576).toFixed(2)+' MB' : (n/1024).toFixed(1)+' KB';
  const hex2 = n => Number(n).toString(16).padStart(2, '0').toUpperCase();
  const toast = t => { const e = $('#toast'); if (!e) return; e.textContent = t; e.classList.remove('hidden'); clearTimeout(toast._t); toast._t = setTimeout(() => e.classList.add('hidden'), 3200); };

  const riskColor = r => ({ low: '#35df9a', medium: '#ffbe55', high: '#ff5578' }[r] || '#8ba4b7');

  function init() {
    const drop = $('#ecuDrop');
    if (!drop) { setTimeout(init, 200); return; }
    rebindDrop();
    $('#ecuReset').addEventListener('click', resetAll);
    $('#ecuAgain').addEventListener('click', resetAll);
    $('#ecuGo').addEventListener('click', applySelected);
    $('#ecuDownload').addEventListener('click', downloadTuned);
    $('#ecuDeviceBtn').addEventListener('click', openDeviceSheet);
    $('#ecuDeviceClose').addEventListener('click', closeDeviceSheet);
    $('#ecuDeviceRefresh').addEventListener('click', loadBridges);
    $('#ecuDeviceNewToken').addEventListener('click', newBridgeToken);
    loadBridges(true);
  }

  function rebindDrop() {
    const drop = $('#ecuDrop');
    const file = $('#ecuFile');
    if (!drop._bound) {
      drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
      drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('drag'); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
      drop._bound = true;
    }
    drop.onclick = () => file.click();
    file.onchange = e => { if (e.target.files[0]) handleFile(e.target.files[0]); };
  }

  async function handleFile(f) {
    if (f.size > 20 * 1024 * 1024) { toast('Dosya 20 MB sınırını aşıyor'); return; }
    const drop = $('#ecuDrop');
    state.fileName = f.name;
    state.fileSize = f.size;
    drop.classList.add('has');
    drop.innerHTML = `
      <div class="ecuDropIcon" style="color:#35df9a">✓</div>
      <b>${esc(f.name)}</b>
      <p>${fmtSize(f.size)} · bölge taranıyor...</p>
      <input type="file" id="ecuFile" accept=".bin,.hex,.ori,.mod,.rom,.ecu,application/octet-stream" style="display:none">
    `;
    rebindDrop();

    try {
      const buf = await f.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const CHUNK = 0x8000;
      let bin = '';
      for (let i = 0; i < bytes.length; i += CHUNK) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
      }
      const b64 = btoa(bin);

      const res = await fetch('/api/ecu/upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ filename: f.name, fileData: b64 })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.detail || ('HTTP ' + res.status));

      state.uploadId = data.uploadId || data.upload_id;
      state.regions = data.regions || [];
      state.systems = data.systems || [];
      state.stats = data.stats || null;
      state.rulepackMatches = data.rulepackMatches || [];
      state.selectedActions.clear();

      const rpInfo = state.rulepackMatches.length ? ` · ✓ ${state.rulepackMatches[0].familyName}` : '';
      drop.querySelector('p').textContent = `${fmtSize(f.size)} · ${state.regions.length} bölge${rpInfo}`;
      renderStep2();
      // AI arka planda başlasın
      requestAISuggestions();
    } catch (err) {
      drop.classList.remove('has');
      drop.innerHTML = `
        <div class="ecuDropIcon" style="color:#ff5578">!</div>
        <b>Yüklenemedi</b>
        <p>${esc(err.message)} · tekrar dene</p>
        <input type="file" id="ecuFile" accept=".bin,.hex,.ori,.mod,.rom,.ecu,application/octet-stream" style="display:none">
      `;
      rebindDrop();
      toast(err.message);
    }
  }

  function renderStep2() {
    const step2 = $('#step2');
    step2.classList.remove('hidden');

    // Önce step2'nin içeriğini sıfırdan yaz
    const rpBanner = state.rulepackMatches && state.rulepackMatches.length ? `
      <div class="ecuRulepackHit">
        <div class="ecuRulepackHead">
          <b>✓ ${esc(state.rulepackMatches[0].familyName)}</b>
          <small>${esc(state.rulepackMatches[0].description || '')}</small>
        </div>
        ${state.rulepackMatches[0].firmware ? `<div class="ecuFirmwareHit">◉ Firmware eşleşmesi: <b>${esc(state.rulepackMatches[0].firmware.name)}</b></div>` : ''}
        <div class="ecuRulepackSources">
          Kaynaklar: ${(state.rulepackMatches[0].sources || []).slice(0,3).map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>`).join(' · ')}
        </div>
        ${state.rulepackMatches[0].notes ? `<div class="ecuRulepackNotes">${esc(state.rulepackMatches[0].notes)}</div>` : ''}
      </div>
    ` : '';

    step2.innerHTML = `
      <div class="stepHead"><span class="stepNum">2</span><h2>Bölgeler ve öneriler</h2></div>

      ${rpBanner}

      ${state.stats ? `<div class="ecuStatRow">
        <span>Boyut: <b>${fmtSize(state.stats.size)}</b></span>
        <span>Entropi: <b>${state.stats.entropy.toFixed(2)}</b></span>
        <span>0 oranı: <b>${state.stats.zeroPct.toFixed(1)}%</b></span>
        <span>FF oranı: <b>${state.stats.ffPct.toFixed(1)}%</b></span>
      </div>` : ''}

      <div class="ecuTabs">
        <button class="ecuTab active" data-tab="manual">✎ Manuel (bulunan bölgeler)</button>
        <button class="ecuTab" data-tab="ai">⚡ AI önerisi</button>
      </div>

      <div id="ecuTabManual" class="ecuTabPanel">
        ${state.regions.length ? renderRegionsHTML() : '<div class="muted" style="padding:14px">Bu dosyada bilinen sistem stringi bulunamadı. Gelişmiş panelden HEX inceleyebilirsin.</div>'}
      </div>

      <div id="ecuTabAI" class="ecuTabPanel hidden">
        <div id="ecuAIBody"><div class="muted">AI önerileri hazırlanıyor...</div></div>
      </div>

      <div class="ecuWarn">⚠ Her değişikliği uygulamadan önce dosyanı yedekle. Önerilen offset'ler string'in yakınındaki heuristik konumlardır — doğru map adresi değil. İlk denemeyi test bench'te yap.</div>

      <div class="stepActions">
        <button id="ecuReset" class="softBtn">BAŞA DÖN</button>
        <button id="ecuGo" class="primaryBig">SEÇİLİ AKSİYONLARI UYGULA (<span id="ecuGoCount">0</span>)</button>
      </div>
    `;

    // Tab geçişi
    step2.querySelectorAll('.ecuTab').forEach(t => t.addEventListener('click', () => {
      step2.querySelectorAll('.ecuTab').forEach(x => x.classList.toggle('active', x === t));
      $('#ecuTabManual').classList.toggle('hidden', t.dataset.tab !== 'manual');
      $('#ecuTabAI').classList.toggle('hidden', t.dataset.tab !== 'ai');
    }));

    // Buton bağla
    $('#ecuReset').addEventListener('click', resetAll);
    $('#ecuGo').addEventListener('click', applySelected);

    // Checkbox'ları bağla
    step2.querySelectorAll('.ecuActionCheck').forEach(cb => {
      cb.addEventListener('change', e => {
        const id = e.target.dataset.id;
        const action = findActionById(id);
        if (!action) return;
        if (e.target.checked) state.selectedActions.set(id, action);
        else state.selectedActions.delete(id);
        $('#ecuGoCount').textContent = state.selectedActions.size;
      });
    });

    step2.scrollIntoView({ behavior: 'smooth', block: 'start' });
    renderAITab();
  }

  function renderRegionsHTML() {
    // Sisteme göre grupla
    const bySystem = {};
    state.regions.forEach(r => {
      if (!bySystem[r.system]) bySystem[r.system] = [];
      bySystem[r.system].push(r);
    });

    return Object.entries(bySystem).map(([sys, regs]) => `
      <div class="ecuSysGroup">
        <div class="ecuSysHead">
          <b>${esc(sys)}</b>
          <small>${esc(regs[0].desc || '')} · ${regs.length} konum</small>
        </div>
        ${regs.map(r => `
          <div class="ecuRegion">
            <div class="ecuRegionMeta">
              <span class="ecuRegionAddr">${esc(r.offsetHex)}</span>
              <span class="ecuRegionStr">"${esc(r.foundString.slice(0,32))}"</span>
            </div>
            <div class="ecuRegionBytes">${esc(r.windowHex)}</div>
            ${r.actions.length ? r.actions.map(a => {
              const isRulepack = a.source && a.source.startsWith('rulepack:');
              const srcLabel = isRulepack ? '✓ Doğrulanmış' : '⚠ Heuristik';
              const srcColor = isRulepack ? '#35df9a' : '#ffbe55';
              return `
              <label class="ecuActionRow">
                <input type="checkbox" class="ecuActionCheck" data-id="${esc(a.id)}">
                <div class="ecuActionBody">
                  <div class="ecuActionHead">
                    <b>${esc(a.label)}</b>
                    <span class="ecuRiskPill" style="background:${srcColor}22;color:${srcColor}">${srcLabel}</span>
                    <span class="ecuRiskPill" style="background:${riskColor(a.risk)}22;color:${riskColor(a.risk)}">${esc(a.risk||'?')}</span>
                  </div>
                  <small>${esc(a.detail)}</small>
                  ${a.sourceUrl ? `<small style="margin-top:4px"><a href="${esc(a.sourceUrl)}" target="_blank" rel="noopener" style="color:#9fb6c9">→ kaynak</a></small>` : ''}
                </div>
              </label>
            `;}).join('') : '<div class="muted" style="padding:8px;font-size:11px">Bu bölge için otomatik aksiyon yok</div>'}
          </div>
        `).join('')}
      </div>
    `).join('');
  }

  function findActionById(id) {
    for (const r of state.regions) {
      for (const a of r.actions) if (a.id === id) return a;
    }
    return null;
  }

  async function requestAISuggestions() {
    state.aiLoading = true;
    try {
      const res = await fetch('/api/ecu/ai-suggest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ uploadId: state.uploadId })
      });
      const data = await res.json().catch(() => ({}));
      state.aiSuggestions = data.suggestions || [];
      state.aiProvider = data.provider || '';
    } catch (err) {
      state.aiSuggestions = [{ system: 'Hata', action: err.message, result: '', risk: 'unknown' }];
    } finally {
      state.aiLoading = false;
      renderAITab();
    }
  }

  function renderAITab() {
    const el = $('#ecuAIBody');
    if (!el) return;
    if (state.aiLoading) {
      el.innerHTML = '<div class="muted" style="padding:14px">AI önerileri hazırlanıyor... (bağlı sağlayıcıya göre 5-15 saniye)</div>';
      return;
    }
    if (!state.aiSuggestions.length) {
      el.innerHTML = '<div class="muted" style="padding:14px">AI henüz öneri döndürmedi. Ayarlar → AI Sağlayıcı Anahtarları\'ndan en az bir sağlayıcı ekle.</div>';
      return;
    }

    el.innerHTML = `
      <div class="muted" style="font-size:11px;margin-bottom:10px">Sağlayıcı: <b>${esc(state.aiProvider)}</b></div>
      ${state.aiSuggestions.map(s => `
        <div class="ecuAISugg">
          <div class="ecuAISuggHead">
            <b>${esc(s.system||'?')}</b>
            <span class="ecuRiskPill" style="background:${riskColor(s.risk)}22;color:${riskColor(s.risk)}">${esc(s.risk||'?')}</span>
          </div>
          <div class="ecuAISuggBody">
            <div><small>Offset:</small> <code>${esc(s.offset||'-')}</code></div>
            <div><small>Değer:</small> <code>${esc(s.currentByte||'-')}</code> → <code>${esc(s.newByte||'-')}</code></div>
            <div><small>Yapılacak:</small> ${esc(s.action||'-')}</div>
            <div><small>Sonuç:</small> ${esc(s.result||'-')}</div>
          </div>
        </div>
      `).join('')}
    `;
  }

  async function applySelected() {
    if (!state.uploadId) { toast('Önce dosya yükle'); return; }
    if (!state.selectedActions.size) { toast('En az bir aksiyon seç'); return; }

    const btn = $('#ecuGo');
    btn.disabled = true;
    const origTxt = btn.innerHTML;
    btn.innerHTML = 'UYGULANIYOR...';

    try {
      const res = await fetch('/api/ecu/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          uploadId: state.uploadId,
          actionIds: [...state.selectedActions.keys()]
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.detail || ('HTTP ' + res.status));

      state.tunedId = data.tunedId || data.tuned_id;

      const outName = state.fileName.replace(/(\.[^.]+)$/, '_tuned$1');
      $('#ecuDoneName').textContent = outName;
      $('#ecuDoneInfo').textContent = `${fmtSize(data.size || state.fileSize)} · ${data.applied?.length || state.selectedActions.size} yama uygulandı`;

      $('#step2').classList.add('hidden');
      $('#step3').classList.remove('hidden');
      $('#step3').scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast('✓ Hazır');
    } catch (err) {
      toast('Hata: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = origTxt;
    }
  }

  function downloadTuned() {
    if (!state.tunedId) return;
    const a = document.createElement('a');
    a.href = `/api/ecu/download?tunedId=${encodeURIComponent(state.tunedId)}`;
    a.download = $('#ecuDoneName').textContent || 'tuned.bin';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function resetAll() {
    state.uploadId = null;
    state.fileName = '';
    state.fileSize = 0;
    state.regions = [];
    state.systems = [];
    state.stats = null;
    state.selectedActions.clear();
    state.tunedId = null;
    state.aiSuggestions = [];

    const drop = $('#ecuDrop');
    drop.classList.remove('has');
    drop.innerHTML = `
      <div class="ecuDropIcon">⬆</div>
      <b>ECU dosyasını buraya bırak</b>
      <p>veya tıkla · .bin / .hex / .ori / .rom · maks 20 MB</p>
      <input type="file" id="ecuFile" accept=".bin,.hex,.ori,.mod,.rom,.ecu,application/octet-stream" style="display:none">
    `;
    drop._bound = false;
    rebindDrop();
    $('#step2').classList.add('hidden');
    $('#step3').classList.add('hidden');
    $('#step1').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ===== KT200 bridge =====
  function openDeviceSheet() { $('#ecuDevicePanel').classList.remove('hidden'); loadBridges(); }
  function closeDeviceSheet() { $('#ecuDevicePanel').classList.add('hidden'); }

  async function loadBridges(silent) {
    try {
      const res = await fetch('/api/ecu/device/bridges');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const bridges = data.bridges || [];
      const online = bridges.filter(b => b.online || (b.last_seen_at && Date.now() - new Date(b.last_seen_at).getTime() < 60000));
      const s = $('#ecuDeviceStatus');
      if (online.length) { s.textContent = `KT200 · ${online.length} bridge bağlı`; s.style.color = '#35df9a'; }
      else if (bridges.length) { s.textContent = `KT200 · ${bridges.length} kayıtlı · çevrimdışı`; s.style.color = '#ffbe55'; }
      else { s.textContent = 'KT200 bridge yok · Cihaz butonundan ekle'; s.style.color = '#8ba4b7'; }

      const el = $('#ecuDeviceBridges');
      if (!bridges.length) { el.innerHTML = '<div class="muted">Henüz bridge yok.</div>'; return; }
      el.innerHTML = bridges.map(b => {
        const on = b.online || (b.last_seen_at && Date.now() - new Date(b.last_seen_at).getTime() < 60000);
        return `<div class="item"><b>${esc(b.name || b.id || 'bridge')}</b><small>${on ? '● çevrimiçi' : '○ çevrimdışı'} · ${esc(b.last_seen_at || 'hiç bağlanmadı')}</small></div>`;
      }).join('');
    } catch (err) {
      if (!silent) toast('Bridge: ' + err.message);
      $('#ecuDeviceStatus').textContent = 'KT200 · bağlantı yok';
      $('#ecuDeviceStatus').style.color = '#8ba4b7';
    }
  }

  async function newBridgeToken() {
    try {
      const res = await fetch('/api/ecu/device/bridges', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'KT200-' + Date.now().toString(36) }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.detail || ('HTTP ' + res.status));
      const token = data.token || data.bridgeToken || data.secret || '(token yok)';
      const box = $('#ecuDeviceTokenBox');
      box.classList.remove('hidden');
      box.innerHTML = `<b style="color:#9df0c5;display:block;margin-bottom:6px">Yeni token (sadece bir kez gösterilir):</b><div style="user-select:all">${esc(token)}</div>`;
      loadBridges();
    } catch (err) { toast('Token: ' + err.message); }
  }

  async function loadRulepackList() {
    const el = $('#rulepackList');
    if (!el) return;
    try {
      const res = await fetch('/api/ecu/rulepacks');
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'FAILED');
      el.innerHTML = data.packs.map(p => `
        <div class="rulepackItem">
          <b>${esc(p.familyName)}</b>
          <small>${esc(p.description)}</small>
          <div class="meta">${p.sourceCount} kaynak · ${p.firmwareCount} firmware tanımı · ${p.mapCount} harita</div>
          ${p.notes ? `<small style="margin-top:6px">${esc(p.notes)}</small>` : ''}
        </div>
      `).join('') + `
        <div class="rulepackItem" style="border-color:#31dfff44">
          <b>Tüm kaynaklar</b>
          <div class="rulepackSourceList">
            ${data.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)} <small style="color:#8ba4b7">· ${esc(s.family)}${s.license ? ' · ' + esc(s.license) : ''}</small></a>`).join('')}
          </div>
        </div>
      `;
    } catch (err) {
      el.innerHTML = '<div class="muted">Rulepack listesi yüklenemedi: ' + esc(err.message) + '</div>';
    }
  }

  // Ayarlar açıldığında rulepack listesini yükle
  const settingsBtn = document.querySelector('[data-page="settings"]');
  if (settingsBtn) settingsBtn.addEventListener('click', () => setTimeout(loadRulepackList, 300));

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
