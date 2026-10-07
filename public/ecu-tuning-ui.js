// JARVIS ECU Tuning UI — v3: araç seçimi + zengin aksiyon kartları + Stage 1 + AI önerisi
(() => {
  const state = {
    uploadId: null,
    fileName: '',
    fileSize: 0,
    regions: [],
    systems: [],
    systemInfos: [],
    stage1: null,
    stats: null,
    vehicle: { make: '', model: '', year: '', ecuType: '' },
    vehicleDB: null,
    selectedActions: new Map(),
    tunedId: null,
    aiLoading: false,
    aiSuggestions: [],
    aiProvider: '',
    rulepackMatches: []
  };

  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>'"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[m]));
  const fmtSize = n => n >= 1048576 ? (n / 1048576).toFixed(2) + ' MB' : (n / 1024).toFixed(1) + ' KB';
  const hex2 = n => Number(n).toString(16).padStart(2, '0').toUpperCase();
  const toast = t => { const e = $('#toast'); if (!e) return; e.textContent = t; e.classList.remove('hidden'); clearTimeout(toast._t); toast._t = setTimeout(() => e.classList.add('hidden'), 3200); };
  const riskColor = r => ({ low: '#35df9a', medium: '#ffbe55', high: '#ff5578', info: '#31dfff' }[r] || '#8ba4b7');
  const riskLabel = r => ({ low: 'Düşük Risk', medium: 'Orta Risk', high: 'Yüksek Risk', info: 'Bilgi' }[r] || r || '?');

  // ===== HİZMET KATALOĞU (dosya yüklemeden önce görünür) =====
  const TUNING_SERVICES = [
    { id: 'stage1', name: 'Stage 1 Performans Paketi', icon: '🏁', tag: 'POPÜLER', tagColor: '#35df9a',
      desc: 'Boost basıncı artırma, tork limiti yükseltme, enjeksiyon optimizasyonu — tek pakette.',
      detail: 'Turbo basıncını %15-25 artırır, tork limitlerini yükseltir, enjeksiyon miktarını optimize eder. EGR ve DPF kapatmayla birlikte en etkili sonucu verir.',
      hp: '+40-90 HP', risk: 'medium', systems: ['Boost','Torque','Injection','EGR','DPF'] },
    { id: 'egr', name: 'EGR OFF', icon: '🔄', tag: 'EN YAYGIN', tagColor: '#31dfff',
      desc: 'Egzoz gazı resirkülasyonunu devre dışı bırakır.',
      detail: 'EGR valfini kapatır → egzoz gazı emişe geri gitmez → intake manifold temiz kalır, motor daha rahat nefes alır. Karbon birikimi durur.',
      hp: '+5-15 HP', risk: 'low', systems: ['EGR'] },
    { id: 'dpf', name: 'DPF OFF', icon: '🔥', tag: '', tagColor: '',
      desc: 'Dizel partikül filtre rejenerasyonunu kapatır.',
      detail: 'Rejenerasyon döngüsünü devre dışı bırakır → yakıt tasarrufu. Contra basınç düşer → güç artar. DPF fiziksel olarak da çıkarılmalı.',
      hp: '+10-20 HP', risk: 'medium', systems: ['DPF'] },
    { id: 'adblue', name: 'AdBlue / SCR OFF', icon: '💧', tag: '', tagColor: '',
      desc: 'AdBlue (üre) enjeksiyon sistemini tamamen devre dışı bırakır.',
      detail: 'AdBlue tankı boşaltılabilir. "Seviye düşük" uyarıları ve limp mode (güç kısıtlaması) riski ortadan kalkar.',
      hp: '0-5 HP', risk: 'high', systems: ['AdBlue/SCR'] },
    { id: 'lambda', name: 'Lambda OFF', icon: '📊', tag: '', tagColor: '',
      desc: 'O2 sensör verilerini ECU hesaplamasından çıkarır.',
      detail: 'EGR/DPF kapatıldıktan sonra P0420/P0430 gibi hata kodlarını önler. Genelde EGR+DPF off ile birlikte uygulanır.',
      hp: '', risk: 'low', systems: ['Lambda'] },
    { id: 'vmax', name: 'Hız Sınırı Kaldırma', icon: '🏎️', tag: '', tagColor: '',
      desc: 'Elektronik hız sınırını (Vmax limiter) kaldırır.',
      detail: 'Araç mekanik/aerodinamik limitine kadar hızlanabilir. Lastik ve fren kapasitesi kontrol edilmeli.',
      hp: '', risk: 'medium', systems: ['Hız sınırı'] },
    { id: 'immo', name: 'Immobilizer OFF', icon: '🔑', tag: '', tagColor: '',
      desc: 'Anahtar eşleşme kontrolünü devre dışı bırakır.',
      detail: 'ECU swap veya yedek ECU durumlarında kullanılır. Motor herhangi bir anahtarla çalışır.',
      hp: '', risk: 'high', systems: ['Immobilizer'] },
    { id: 'pedal', name: 'Pedal Haritası', icon: '🦶', tag: '', tagColor: '',
      desc: 'Gaz pedalı yanıtını daha agresif yapar.',
      detail: 'İlk %30 pedalda daha fazla kelebek açıklığı. Gerçek güç artışı yok ama sübjektif hız hissi artar.',
      hp: '', risk: 'low', systems: ['Pedal'] }
  ];

  function renderServicesCatalog() {
    const el = $('#ecuServicesCatalog');
    if (!el) return;

    el.innerHTML = `
      <div class="ecuServicesWrap">
        <div class="ecuServicesHead">
          <span class="stepNum">⚙</span>
          <div>
            <h2 style="margin:0;font-size:16px">Tuning Hizmetleri</h2>
            <small class="muted">Dosya yükledikten sonra tespit edilen sistemler aktif olur</small>
          </div>
        </div>
        <div class="ecuServicesList">
          ${TUNING_SERVICES.map(s => `
            <div class="ecuServiceCard" data-svc="${esc(s.id)}">
              <div class="ecuServiceTop">
                <span class="ecuServiceIcon">${s.icon}</span>
                <div class="ecuServiceInfo">
                  <div class="ecuServiceName">
                    <b>${esc(s.name)}</b>
                    ${s.tag ? `<span class="ecuServiceTag" style="background:${s.tagColor}22;color:${s.tagColor}">${esc(s.tag)}</span>` : ''}
                    ${s.hp ? `<span class="ecuHpPill">${esc(s.hp)}</span>` : ''}
                  </div>
                  <div class="ecuServiceDesc">${esc(s.desc)}</div>
                </div>
                <span class="ecuServiceArrow">›</span>
              </div>
              <div class="ecuServiceDetail hidden">
                <p>${esc(s.detail)}</p>
                <div class="ecuServiceMeta">
                  <span class="ecuRiskPill" style="background:${riskColor(s.risk)}22;color:${riskColor(s.risk)}">${riskLabel(s.risk)}</span>
                  <span class="muted" style="font-size:11px">Sistemler: ${s.systems.join(', ')}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Toggle detail on card click
    el.querySelectorAll('.ecuServiceCard').forEach(card => {
      card.querySelector('.ecuServiceTop').addEventListener('click', () => {
        const det = card.querySelector('.ecuServiceDetail');
        const arrow = card.querySelector('.ecuServiceArrow');
        const wasOpen = !det.classList.contains('hidden');
        // Close all
        el.querySelectorAll('.ecuServiceDetail').forEach(d => d.classList.add('hidden'));
        el.querySelectorAll('.ecuServiceArrow').forEach(a => a.textContent = '›');
        if (!wasOpen) {
          det.classList.remove('hidden');
          arrow.textContent = '⌄';
        }
      });
    });
  }

  // ===== INIT =====
  function init() {
    const drop = $('#ecuDrop');
    if (!drop) { setTimeout(init, 200); return; }
    rebindDrop();
    $('#ecuReset')?.addEventListener('click', resetAll);
    $('#ecuAgain')?.addEventListener('click', resetAll);
    $('#ecuGo')?.addEventListener('click', applySelected);
    $('#ecuDownload')?.addEventListener('click', downloadTuned);
    $('#ecuDeviceBtn')?.addEventListener('click', openDeviceSheet);
    $('#ecuDeviceClose')?.addEventListener('click', closeDeviceSheet);
    $('#ecuDeviceRefresh')?.addEventListener('click', loadBridges);
    $('#ecuDeviceNewToken')?.addEventListener('click', newBridgeToken);
    loadBridges(true);
    renderServicesCatalog();
    loadVehicleDB().then(() => {
      const vSel = $('#ecuVehicleSelect');
      if (vSel && state.vehicleDB) {
        vSel.innerHTML = '<label class="muted">Araç Bilgisi (opsiyonel)</label>' + renderVehicleSelect();
        bindVehicleSelects();
      }
    });
  }

  // ===== VEHICLE DB =====
  async function loadVehicleDB() {
    try {
      const res = await fetch('/api/ecu/vehicle-db');
      const data = await res.json();
      if (data.ok !== false) {
        state.vehicleDB = data;
      }
    } catch { /* silent */ }
  }

  function renderVehicleSelect() {
    const db = state.vehicleDB;
    if (!db) return '<div class="muted" style="padding:8px;font-size:12px">Araç veritabanı yüklenemedi</div>';

    const makes = db.makes || [];
    const ecuTypes = db.ecuTypes || [];
    const years = db.years || [];

    return `
      <div class="ecuVehicleGrid">
        <div class="ecuField">
          <label>Marka</label>
          <select id="vMake" class="ecuSelect">
            <option value="">Seç...</option>
            ${makes.map(m => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('')}
          </select>
        </div>
        <div class="ecuField">
          <label>Model</label>
          <select id="vModel" class="ecuSelect" disabled>
            <option value="">Önce marka seç</option>
          </select>
        </div>
        <div class="ecuField">
          <label>Yıl</label>
          <select id="vYear" class="ecuSelect">
            <option value="">Seç...</option>
            ${years.map(y => `<option value="${esc(y)}">${esc(y)}</option>`).join('')}
          </select>
        </div>
        <div class="ecuField">
          <label>ECU Tipi</label>
          <select id="vEcu" class="ecuSelect">
            <option value="">Bilinmiyor</option>
            ${ecuTypes.map(e => `<option value="${esc(e)}">${esc(e)}</option>`).join('')}
          </select>
        </div>
      </div>
    `;
  }

  function bindVehicleSelects() {
    const mkSel = $('#vMake');
    const mdSel = $('#vModel');
    if (!mkSel || !mdSel) return;

    mkSel.addEventListener('change', () => {
      const makeId = mkSel.value;
      state.vehicle.make = mkSel.options[mkSel.selectedIndex]?.text || '';
      const db = state.vehicleDB;
      const found = db?.makes?.find(m => m.id === makeId);
      if (found) {
        mdSel.disabled = false;
        mdSel.innerHTML = '<option value="">Seç...</option>' + found.models.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
      } else {
        mdSel.disabled = true;
        mdSel.innerHTML = '<option value="">Önce marka seç</option>';
      }
      state.vehicle.model = '';
    });
    mdSel.addEventListener('change', () => { state.vehicle.model = mdSel.value; });
    $('#vYear')?.addEventListener('change', e => { state.vehicle.year = e.target.value; });
    $('#vEcu')?.addEventListener('change', e => { state.vehicle.ecuType = e.target.value; });
  }

  // ===== FILE DROP =====
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
    if (f.size > 12 * 1024 * 1024) { toast('Dosya 12 MB sınırını aşıyor'); return; }
    const drop = $('#ecuDrop');
    state.fileName = f.name;
    state.fileSize = f.size;
    drop.classList.add('has');
    drop.innerHTML = `
      <div class="ecuDropIcon" style="color:#35df9a">⏳</div>
      <b>${esc(f.name)}</b>
      <p>${fmtSize(f.size)} · yükleniyor ve taranıyor...</p>
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
        body: JSON.stringify({
          filename: f.name, fileData: b64,
          make: state.vehicle.make, model: state.vehicle.model,
          year: state.vehicle.year, ecuType: state.vehicle.ecuType
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.detail || ('HTTP ' + res.status));

      state.uploadId = data.uploadId || data.upload_id;
      state.regions = data.regions || [];
      state.systems = data.systems || [];
      state.systemInfos = data.systemInfos || [];
      state.stage1 = data.stage1 || null;
      state.stats = data.stats || null;
      state.rulepackMatches = data.rulepackMatches || [];
      state.selectedActions.clear();

      drop.querySelector('.ecuDropIcon').textContent = '✓';
      drop.querySelector('.ecuDropIcon').style.color = '#35df9a';
      const rpInfo = state.rulepackMatches.length ? ` · ✓ ${state.rulepackMatches[0].familyName}` : '';
      drop.querySelector('p').textContent = `${fmtSize(f.size)} · ${state.regions.length} bölge · ${state.systems.length} sistem${rpInfo}`;
      renderStep2();
      requestAISuggestions();
    } catch (err) {
      drop.classList.remove('has');
      drop.innerHTML = `
        <div class="ecuDropIcon" style="color:#ff5578">✗</div>
        <b>Yüklenemedi</b>
        <p>${esc(err.message)}</p>
        <input type="file" id="ecuFile" accept=".bin,.hex,.ori,.mod,.rom,.ecu,application/octet-stream" style="display:none">
      `;
      rebindDrop();
      toast(err.message);
    }
  }

  // ===== STEP 2: REGIONS + ACTIONS =====
  function renderStep2() {
    const step2 = $('#step2');
    step2.classList.remove('hidden');
    // Hizmet kataloğunu gizle — artık gerçek sonuçlar var
    const catalog = $('#ecuServicesCatalog');
    if (catalog) catalog.classList.add('hidden');

    const vehicleLabel = [state.vehicle.make, state.vehicle.model, state.vehicle.year].filter(Boolean).join(' ');
    const ecuLabel = state.vehicle.ecuType || '';
    const vehicleBanner = vehicleLabel ? `
      <div class="ecuVehicleBanner">
        <span class="ecuVehicleIcon">🚗</span>
        <div>
          <b>${esc(vehicleLabel)}</b>
          ${ecuLabel ? `<small>${esc(ecuLabel)}</small>` : ''}
        </div>
      </div>
    ` : '';

    const rpBanner = state.rulepackMatches?.length ? `
      <div class="ecuRulepackHit">
        <b>✓ ${esc(state.rulepackMatches[0].familyName)}</b>
        <small>${esc(state.rulepackMatches[0].description || '')}</small>
        ${state.rulepackMatches[0].firmware ? `<div class="ecuFirmwareHit">◉ Firmware: <b>${esc(state.rulepackMatches[0].firmware.name)}</b></div>` : ''}
      </div>
    ` : '';

    const stage1Html = renderStage1Banner();

    step2.innerHTML = `
      <div class="stepHead"><span class="stepNum">2</span><h2>Tuning Seçenekleri</h2></div>

      ${vehicleBanner}
      ${rpBanner}

      ${state.stats ? `<div class="ecuStatRow">
        <span>📦 ${fmtSize(state.stats.size)}</span>
        <span>🔢 Entropi: ${state.stats.entropy.toFixed(2)}</span>
        <span>Ø ${state.stats.zeroPct.toFixed(1)}%</span>
        <span>FF ${state.stats.ffPct.toFixed(1)}%</span>
      </div>` : ''}

      ${stage1Html}

      <div class="ecuTabs">
        <button class="ecuTab active" data-tab="manual">🔧 Bulunan Sistemler</button>
        <button class="ecuTab" data-tab="ai">🤖 AI Önerisi</button>
      </div>

      <div id="ecuTabManual" class="ecuTabPanel">
        ${state.regions.length ? renderRegionsHTML() : '<div class="muted" style="padding:14px">Bu dosyada bilinen sistem stringi bulunamadı.</div>'}
      </div>

      <div id="ecuTabAI" class="ecuTabPanel hidden">
        <div id="ecuAIBody"><div class="muted" style="padding:14px">🤖 AI önerileri hazırlanıyor...</div></div>
      </div>

      <div class="ecuWarn">⚠ Her değişikliği uygulamadan önce dosyanı yedekle. Offset'ler heuristik konumlardır — ilk denemeyi test bench'te yap.</div>

      <div class="stepActions">
        <button id="ecuReset" class="softBtn">BAŞA DÖN</button>
        <button id="ecuGo" class="primaryBig">SEÇİLİ AKSİYONLARI UYGULA (<span id="ecuGoCount">0</span>)</button>
      </div>
    `;

    // Tab switching
    step2.querySelectorAll('.ecuTab').forEach(t => t.addEventListener('click', () => {
      step2.querySelectorAll('.ecuTab').forEach(x => x.classList.toggle('active', x === t));
      $('#ecuTabManual').classList.toggle('hidden', t.dataset.tab !== 'manual');
      $('#ecuTabAI').classList.toggle('hidden', t.dataset.tab !== 'ai');
    }));

    $('#ecuReset').addEventListener('click', resetAll);
    $('#ecuGo').addEventListener('click', applySelected);

    // Bind action cards
    bindActionCards();

    // Stage 1 quick-select
    const s1Btn = $('#ecuStage1Btn');
    if (s1Btn) s1Btn.addEventListener('click', selectStage1Actions);

    step2.scrollIntoView({ behavior: 'smooth', block: 'start' });
    renderAITab();
  }

  function renderStage1Banner() {
    const s1 = state.stage1;
    if (!s1 || !s1.features || !s1.features.length) return '';

    return `
      <div class="ecuStage1">
        <div class="ecuStage1Head">
          <div>
            <b>🏁 ${esc(s1.name)}</b>
            ${s1.totalHpGain ? `<span class="ecuHpBadge">+${esc(s1.totalHpGain)}</span>` : ''}
          </div>
          <button id="ecuStage1Btn" class="ecuStage1Apply">STAGE 1 UYGULA</button>
        </div>
        <div class="ecuStage1Features">
          ${s1.features.map(f => `
            <div class="ecuStage1Feature">
              <span class="ecuStage1Sys">${esc(f.system)}</span>
              <span>${esc(f.text)}</span>
              ${f.hp ? `<span class="ecuHpSmall">${esc(f.hp)}</span>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderRegionsHTML() {
    const bySystem = {};
    state.regions.forEach(r => {
      if (!bySystem[r.system]) bySystem[r.system] = [];
      bySystem[r.system].push(r);
    });

    return Object.entries(bySystem).map(([sys, regs]) => {
      const info = state.systemInfos.find(s => s.system === sys) || {};
      const isStage1 = info.stage1;

      return `
        <div class="ecuSysGroup">
          <div class="ecuSysHead">
            <div class="ecuSysTitle">
              <span class="ecuSysIcon">${esc(info.icon || '⚙')}</span>
              <b>${esc(sys)}</b>
              ${isStage1 ? '<span class="ecuStage1Tag">Stage 1</span>' : ''}
              ${info.hpGain ? `<span class="ecuHpSmall">+${esc(info.hpGain)} HP</span>` : ''}
            </div>
            <small>${regs.length} konum bulundu</small>
          </div>

          ${info.explain ? `<div class="ecuSysExplain">
            <div class="ecuExplainWhat"><b>Ne yapar:</b> ${esc(info.explain)}</div>
            ${info.offExplain ? `<div class="ecuExplainOff"><b>Kapatınca:</b> ${esc(info.offExplain)}</div>` : ''}
          </div>` : ''}

          ${regs.map(r => `
            <div class="ecuRegion">
              <div class="ecuRegionMeta">
                <code class="ecuAddr">${esc(r.offsetHex)}</code>
                <span class="ecuRegionStr">"${esc(r.foundString.slice(0, 32))}"</span>
              </div>
              ${r.actions.length ? r.actions.map(a => {
                const isRulepack = a.source && a.source.startsWith('rulepack:');
                const srcLabel = isRulepack ? '✓ Doğrulanmış' : '⚠ Heuristik';
                const srcColor = isRulepack ? '#35df9a' : '#ffbe55';
                return `
                <div class="ecuActionCard" data-id="${esc(a.id)}">
                  <div class="ecuActionTop">
                    <label class="ecuActionLabel">
                      <input type="checkbox" class="ecuActionCheck" data-id="${esc(a.id)}">
                      <b>${esc(a.label)}</b>
                    </label>
                    <div class="ecuActionBadges">
                      <span class="ecuRiskPill" style="background:${srcColor}22;color:${srcColor}">${srcLabel}</span>
                      <span class="ecuRiskPill" style="background:${riskColor(a.risk)}22;color:${riskColor(a.risk)}">${riskLabel(a.risk)}</span>
                      ${a.hpGain ? `<span class="ecuHpPill">${esc(a.hpGain)}</span>` : ''}
                    </div>
                  </div>
                  ${a.explain ? `<div class="ecuActionExplain">${esc(a.explain)}</div>` : ''}
                  ${a.effect ? `<div class="ecuActionEffect">→ ${esc(a.effect)}</div>` : ''}
                  <div class="ecuActionDetail">
                    <code>${esc(a.detail)}</code>
                  </div>
                  ${a.sourceUrl ? `<a href="${esc(a.sourceUrl)}" target="_blank" rel="noopener" class="ecuActionSource">→ kaynak</a>` : ''}
                </div>
              `;
              }).join('') : '<div class="muted" style="padding:8px;font-size:11px">Bu bölge için otomatik aksiyon yok</div>'}
            </div>
          `).join('')}
        </div>
      `;
    }).join('');
  }

  function bindActionCards() {
    $$('.ecuActionCheck').forEach(cb => {
      cb.addEventListener('change', e => {
        const aid = e.target.dataset.id;
        const action = findActionById(aid);
        if (!action) return;
        const card = e.target.closest('.ecuActionCard');
        if (e.target.checked) {
          state.selectedActions.set(aid, action);
          card?.classList.add('selected');
        } else {
          state.selectedActions.delete(aid);
          card?.classList.remove('selected');
        }
        updateGoCount();
      });
    });
  }

  function updateGoCount() {
    const el = $('#ecuGoCount');
    if (el) el.textContent = state.selectedActions.size;
  }

  function selectStage1Actions() {
    // Select all actions belonging to stage1 systems
    const s1Systems = new Set((state.stage1?.features || []).map(f => f.system));
    let count = 0;
    $$('.ecuActionCheck').forEach(cb => {
      const aid = cb.dataset.id;
      const action = findActionById(aid);
      if (action && s1Systems.has(action.system || findSystemForAction(aid))) {
        cb.checked = true;
        state.selectedActions.set(aid, action);
        cb.closest('.ecuActionCard')?.classList.add('selected');
        count++;
      }
    });
    updateGoCount();
    toast(`Stage 1: ${count} aksiyon seçildi`);
  }

  function findSystemForAction(actionId) {
    for (const r of state.regions) {
      for (const a of r.actions) if (a.id === actionId) return r.system;
    }
    return '';
  }

  function findActionById(aid) {
    for (const r of state.regions) {
      for (const a of r.actions) if (a.id === aid) return { ...a, system: r.system };
    }
    return null;
  }

  // ===== AI SUGGESTIONS =====
  async function requestAISuggestions() {
    state.aiLoading = true;
    renderAITab();
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
      el.innerHTML = `
        <div style="padding:20px;text-align:center">
          <div style="font-size:24px;margin-bottom:8px">🤖</div>
          <div class="muted">AI analiz ediyor... (5-15 sn)</div>
          <div class="ecuAIProgress"></div>
        </div>
      `;
      return;
    }

    if (!state.aiSuggestions.length) {
      el.innerHTML = `
        <div style="padding:20px;text-align:center">
          <div class="muted">AI şu anda öneri döndüremedi. Cloudflare AI ücretsiz tier kullanılıyor — tekrar deneyin.</div>
          <button class="softBtn" style="margin-top:12px" onclick="document.querySelector('.ecuTab[data-tab=manual]')?.click()">Manuel Seçeneklere Dön</button>
        </div>
      `;
      return;
    }

    el.innerHTML = `
      <div class="ecuAIProviderTag">🤖 ${esc(state.aiProvider)}</div>
      <div class="ecuAISuggList">
        ${state.aiSuggestions.map(s => `
          <div class="ecuAICard">
            <div class="ecuAICardHead">
              <b>${esc(s.system || '?')}</b>
              <div>
                <span class="ecuRiskPill" style="background:${riskColor(s.risk)}22;color:${riskColor(s.risk)}">${riskLabel(s.risk)}</span>
                ${s.hpGain ? `<span class="ecuHpPill">${esc(s.hpGain)}</span>` : ''}
              </div>
            </div>
            <div class="ecuAICardBody">
              <div class="ecuAIAction"><b>Yapılacak:</b> ${esc(s.action || '-')}</div>
              <div class="ecuAIResult"><b>Sonuç:</b> ${esc(s.result || '-')}</div>
              ${s.explain ? `<div class="ecuAIExplain">${esc(s.explain)}</div>` : ''}
              <div class="ecuAIAddr">
                <code>Offset: ${esc(s.offset || '-')}</code>
                <code>${esc(s.currentByte || '-')} → ${esc(s.newByte || '-')}</code>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="muted" style="font-size:11px;padding:8px;text-align:center">AI önerileri referans amaçlıdır. Manuel sekmeden doğrulanmış aksiyonları uygulayın.</div>
    `;
  }

  // ===== APPLY + DOWNLOAD =====
  async function applySelected() {
    if (!state.uploadId) { toast('Önce dosya yükle'); return; }
    if (!state.selectedActions.size) { toast('En az bir aksiyon seç'); return; }

    const btn = $('#ecuGo');
    btn.disabled = true;
    const origTxt = btn.innerHTML;
    btn.innerHTML = '⏳ UYGULANIYOR...';

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
      toast('✓ Tuned dosya hazır');
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
    a.download = $('#ecuDoneName')?.textContent || 'tuned.bin';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // ===== RESET =====
  function resetAll() {
    Object.assign(state, {
      uploadId: null, fileName: '', fileSize: 0, regions: [], systems: [],
      systemInfos: [], stage1: null, stats: null, tunedId: null,
      aiSuggestions: [], aiProvider: '', rulepackMatches: []
    });
    state.selectedActions.clear();

    const drop = $('#ecuDrop');
    drop.classList.remove('has');
    drop.innerHTML = `
      <div class="ecuDropIcon">⬆</div>
      <b>ECU dosyasını buraya bırak</b>
      <p>veya tıkla · .bin / .hex / .ori / .rom · maks 12 MB</p>
      <input type="file" id="ecuFile" accept=".bin,.hex,.ori,.mod,.rom,.ecu,application/octet-stream" style="display:none">
    `;
    drop._bound = false;
    rebindDrop();
    $('#step2').classList.add('hidden');
    $('#step3').classList.add('hidden');
    const catalog = $('#ecuServicesCatalog');
    if (catalog) catalog.classList.remove('hidden');
    $('#step1').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ===== KT200 BRIDGE =====
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
      else { s.textContent = 'KT200 bridge yok'; s.style.color = '#8ba4b7'; }

      const el = $('#ecuDeviceBridges');
      if (!bridges.length) { el.innerHTML = '<div class="muted">Henüz bridge yok.</div>'; return; }
      el.innerHTML = bridges.map(b => {
        const on = b.online || (b.last_seen_at && Date.now() - new Date(b.last_seen_at).getTime() < 60000);
        return `<div class="item"><b>${esc(b.name || b.id || 'bridge')}</b><small>${on ? '● çevrimiçi' : '○ çevrimdışı'} · ${esc(b.last_seen_at || 'hiç bağlanmadı')}</small></div>`;
      }).join('');
    } catch (err) {
      if (!silent) toast('Bridge: ' + err.message);
      const s = $('#ecuDeviceStatus');
      if (s) { s.textContent = 'KT200 · bağlantı yok'; s.style.color = '#8ba4b7'; }
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
      box.innerHTML = `<b style="color:#9df0c5;display:block;margin-bottom:6px">Token (sadece bir kez):</b><div style="user-select:all">${esc(token)}</div>`;
      loadBridges();
    } catch (err) { toast('Token: ' + err.message); }
  }

  // ===== RULEPACK + REPO LISTS (settings page) =====
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
          <div class="meta">${p.sourceCount} kaynak · ${p.firmwareCount} firmware · ${p.mapCount} harita</div>
        </div>
      `).join('');
    } catch (err) {
      el.innerHTML = '<div class="muted">Rulepack listesi yüklenemedi: ' + esc(err.message) + '</div>';
    }
  }

  async function loadEcuRepoList() {
    const el = $('#ecuRepoList');
    if (!el) return;
    try {
      const res = await fetch('/api/ecu/related-repos');
      const data = await res.json();
      const accepted = data.accepted || [];
      el.innerHTML = `
        <div class="rulepackItem" style="border-color:#35df9a44">
          <b>✓ Accepted (${accepted.length})</b>
          <div style="margin-top:8px;display:grid;gap:6px">
            ${accepted.slice(0, 30).map(r => `
              <div style="padding:8px;background:#060a15;border:1px solid #203653;border-radius:8px">
                <a href="https://github.com/${esc(r.repo)}" target="_blank" rel="noopener" style="color:#9fe3ff;font-weight:700;font-size:12px">${esc(r.repo)}</a>
                <small style="display:block;color:#9fb6c9;margin-top:3px;font-size:11px">${esc(r.purpose || '')}</small>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } catch (err) {
      el.innerHTML = '<div class="muted">Repo listesi yüklenemedi: ' + esc(err.message) + '</div>';
    }
  }

  const settingsBtn = document.querySelector('[data-page="settings"]');
  if (settingsBtn) settingsBtn.addEventListener('click', () => setTimeout(() => { loadRulepackList(); loadEcuRepoList(); }, 300));

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
