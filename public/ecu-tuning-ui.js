// JARVIS ECU — tek controller, 3-adım akış: dosya → araç + tune → indir
// Backend: /api/ecu/upload, /api/ecu/generate, /api/ecu/download, /api/ecu/device/*
(() => {
  const state = {
    uploadId: null,
    fileName: '',
    fileSize: 0,
    vehicles: [],
    selectedVehicle: null,
    tunes: [],
    selectedTunes: new Set(),
    tunedId: null,
    tunedSize: 0,
    bridges: []
  };

  const $ = s => document.querySelector(s);
  const toast = t => { const e = $('#toast'); if (!e) return; e.textContent = t; e.classList.remove('hidden'); clearTimeout(toast._t); toast._t = setTimeout(() => e.classList.add('hidden'), 3200); };
  const esc = s => String(s == null ? '' : s).replace(/[&<>'"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  const fmtSize = n => n >= 1048576 ? (n/1048576).toFixed(2)+' MB' : (n/1024).toFixed(1)+' KB';

  function init() {
    const drop = $('#ecuDrop');
    if (!drop) { setTimeout(init, 200); return; }

    const file = $('#ecuFile');
    drop.addEventListener('click', () => file.click());
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
    drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('drag'); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
    file.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });

    $('#ecuReset').addEventListener('click', resetAll);
    $('#ecuAgain').addEventListener('click', resetAll);
    $('#ecuGo').addEventListener('click', applyTunes);
    $('#ecuDownload').addEventListener('click', downloadTuned);

    $('#ecuDeviceBtn').addEventListener('click', openDeviceSheet);
    $('#ecuDeviceClose').addEventListener('click', closeDeviceSheet);
    $('#ecuDeviceRefresh').addEventListener('click', loadBridges);
    $('#ecuDeviceNewToken').addEventListener('click', newBridgeToken);

    // İlk device status
    loadBridges(true);
  }

  async function handleFile(f) {
    if (f.size > 12 * 1024 * 1024) { toast('Dosya 12 MB sınırını aşıyor'); return; }
    const drop = $('#ecuDrop');
    state.fileName = f.name;
    state.fileSize = f.size;
    drop.classList.add('has');
    drop.innerHTML = `
      <div class="ecuDropIcon" style="color:#35df9a">✓</div>
      <b>${esc(f.name)}</b>
      <p>${fmtSize(f.size)} · yükleniyor...</p>
      <input type="file" id="ecuFile" accept=".bin,.hex,.ori,.mod,.rom,.ecu,application/octet-stream" style="display:none">
    `;
    rebindDrop();

    try {
      const buf = await f.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = '';
      const chunk = 32768;
      for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      const b64 = btoa(bin);

      const res = await fetch('/api/ecu/upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ filename: f.name, fileData: b64 })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.detail || ('HTTP ' + res.status));

      state.uploadId = data.uploadId;
      state.vehicles = data.detections || data.vehicles || [];

      drop.querySelector('p').textContent = `${fmtSize(f.size)} · ✓ yüklendi`;

      renderStep2();
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

  function rebindDrop() {
    const drop = $('#ecuDrop');
    const file = $('#ecuFile');
    drop.onclick = () => file.click();
    file.onchange = e => { if (e.target.files[0]) handleFile(e.target.files[0]); };
  }

  function renderStep2() {
    const step2 = $('#step2');
    const vBox = $('#ecuVehicles');
    const tBox = $('#ecuTunes');
    vBox.innerHTML = '';
    tBox.innerHTML = '';

    if (!state.vehicles.length) {
      vBox.innerHTML = '<div class="muted" style="padding:12px;grid-column:1/-1">Araç otomatik tespit edilemedi · dosya bilinmeyen format. Yine de deneyebilirsin — jenerik tuning uygulanır.</div>';
      renderTunes([{ id: 'stage1', label: 'Stage 1 (jenerik)', description: 'Jenerik güç/moment artırımı.' }, { id: 'egr_off', label: 'EGR Off (jenerik)', description: 'EGR devre dışı.' }]);
      state.selectedVehicle = 'generic';
      return;
    }

    state.vehicles.forEach((v, i) => {
      const el = document.createElement('div');
      el.className = 'ecuVehicle';
      const name = v.type || v.id || v.name || 'Bilinmeyen';
      const conf = v.confidence != null ? ` · ${(v.confidence * 100).toFixed(0)}%` : '';
      el.innerHTML = `<b>${esc(name)}</b><small>Güven${conf}</small>`;
      el.addEventListener('click', () => selectVehicle(v, el));
      vBox.appendChild(el);
    });

    // En yüksek güvenlikli ilk aracı otomatik seç
    selectVehicle(state.vehicles[0], vBox.firstChild);
    step2.classList.remove('hidden');
    step2.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function selectVehicle(v, el) {
    document.querySelectorAll('.ecuVehicle').forEach(x => x.classList.remove('selected'));
    el.classList.add('selected');
    state.selectedVehicle = v.type || v.id || v.name || 'generic';
    const tunes = v.proposals || v.tunes || [
      { id: 'stage1', label: 'Stage 1', description: 'Güç + moment artırımı. OEM güvenlik marjını daraltır.' },
      { id: 'egr_off', label: 'EGR Off', description: 'EGR vanasını yazılım tarafında devre dışı bırakır. Donanım kapatma ayrı.' }
    ];
    state.tunes = tunes;
    state.selectedTunes.clear();
    renderTunes(tunes);
  }

  function renderTunes(tunes) {
    const tBox = $('#ecuTunes');
    tBox.innerHTML = '';
    tunes.forEach(t => {
      const row = document.createElement('label');
      row.className = 'ecuTune';
      row.innerHTML = `
        <input type="checkbox" data-id="${esc(t.id)}">
        <div><b>${esc(t.label || t.id)}</b><small>${esc(t.description || '')}</small></div>
      `;
      row.querySelector('input').addEventListener('change', e => {
        if (e.target.checked) state.selectedTunes.add(t.id);
        else state.selectedTunes.delete(t.id);
      });
      tBox.appendChild(row);
    });
    $('#step2').classList.remove('hidden');
  }

  async function applyTunes() {
    if (!state.uploadId) { toast('Önce dosya yükle'); return; }
    if (!state.selectedTunes.size) { toast('En az bir tuning seç'); return; }

    const btn = $('#ecuGo');
    btn.disabled = true;
    btn.textContent = 'OLUŞTURULUYOR...';

    try {
      const res = await fetch('/api/ecu/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          uploadId: state.uploadId,
          vehicleId: state.selectedVehicle,
          proposals: [...state.selectedTunes]
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.detail || ('HTTP ' + res.status));

      state.tunedId = data.tunedId;
      state.tunedSize = data.size || state.fileSize;

      const outName = state.fileName.replace(/\.(bin|hex|rom|ori)$/i, '_tuned.$1').replace(/^(.*)$/, m => m.includes('_tuned.') ? m : (m.replace(/(\.[^.]+)$/, '_tuned$1')));
      $('#ecuDoneName').textContent = outName;
      $('#ecuDoneInfo').textContent = `${fmtSize(state.tunedSize)} · ${[...state.selectedTunes].join(', ')}`;

      $('#step2').classList.add('hidden');
      $('#step3').classList.remove('hidden');
      $('#step3').scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast('✓ Hazır');
    } catch (err) {
      toast('Hata: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'TUNED DOSYAYI OLUŞTUR';
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
    state.vehicles = [];
    state.selectedVehicle = null;
    state.tunes = [];
    state.selectedTunes.clear();
    state.tunedId = null;

    const drop = $('#ecuDrop');
    drop.classList.remove('has');
    drop.innerHTML = `
      <div class="ecuDropIcon">⬆</div>
      <b>ECU dosyasını buraya bırak</b>
      <p>veya tıkla · .bin / .hex / .ori / .rom · maks 12 MB</p>
      <input type="file" id="ecuFile" accept=".bin,.hex,.ori,.mod,.rom,.ecu,application/octet-stream" style="display:none">
    `;
    rebindDrop();
    $('#step2').classList.add('hidden');
    $('#step3').classList.add('hidden');
    $('#step1').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ===== KT200 / Device Bridge =====
  function openDeviceSheet() { $('#ecuDevicePanel').classList.remove('hidden'); loadBridges(); }
  function closeDeviceSheet() { $('#ecuDevicePanel').classList.add('hidden'); }

  async function loadBridges(silent) {
    try {
      const res = await fetch('/api/ecu/device/bridges');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      state.bridges = data.bridges || [];
      renderBridges();
      updateDeviceStatus();
    } catch (err) {
      if (!silent) toast('Bridge: ' + err.message);
      $('#ecuDeviceStatus').textContent = 'KT200 · bağlantı yok';
      $('#ecuDeviceStatus').style.color = '#8ba4b7';
    }
  }

  function updateDeviceStatus() {
    const online = state.bridges.filter(b => b.online || b.last_seen_at && (Date.now() - new Date(b.last_seen_at).getTime() < 60000));
    const s = $('#ecuDeviceStatus');
    if (online.length) {
      s.textContent = `KT200 · ${online.length} bridge bağlı`;
      s.style.color = '#35df9a';
    } else if (state.bridges.length) {
      s.textContent = `KT200 · ${state.bridges.length} bridge kayıtlı · hiçbiri çevrimiçi değil`;
      s.style.color = '#ffbe55';
    } else {
      s.textContent = 'KT200 bridge yok · Cihaz butonundan ekle';
      s.style.color = '#8ba4b7';
    }
  }

  function renderBridges() {
    const el = $('#ecuDeviceBridges');
    if (!state.bridges.length) {
      el.innerHTML = '<div class="muted">Henüz bridge yok. "YENİ TOKEN ÜRET" ile başla.</div>';
      return;
    }
    el.innerHTML = '';
    state.bridges.forEach(b => {
      const online = b.online || (b.last_seen_at && (Date.now() - new Date(b.last_seen_at).getTime() < 60000));
      const d = document.createElement('div');
      d.className = 'item';
      d.innerHTML = `<b>${esc(b.name || b.id || 'bridge')}</b><small>${online ? '● çevrimiçi' : '○ çevrimdışı'} · ${esc(b.last_seen_at || 'hiç bağlanmadı')}</small>`;
      el.appendChild(d);
    });
  }

  async function newBridgeToken() {
    try {
      const res = await fetch('/api/ecu/device/bridges', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'KT200-' + Date.now().toString(36) })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.detail || ('HTTP ' + res.status));

      const token = data.token || data.bridgeToken || data.secret || '(token yok)';
      const box = $('#ecuDeviceTokenBox');
      box.classList.remove('hidden');
      box.innerHTML = `
        <b style="color:#9df0c5;display:block;margin-bottom:6px">Yeni bridge token (sadece bir kez gösterilir):</b>
        <div style="user-select:all">${esc(token)}</div>
        <button class="softBtn" style="margin-top:10px" onclick="navigator.clipboard.writeText('${esc(token)}').then(()=>this.textContent='KOPYALANDI')">KOPYALA</button>
      `;
      loadBridges();
    } catch (err) {
      toast('Token: ' + err.message);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
