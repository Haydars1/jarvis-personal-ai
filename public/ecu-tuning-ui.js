// ECU Tuning UI — mevcut ECU Studio bölümüne yeni "TUNING" kanalı olarak eklenir.
// Backend: /api/ecu/upload, /api/ecu/generate, /api/ecu/download
(() => {
  const state = {
    uploadId: null,
    fileName: '',
    fileSize: 0,
    detections: [],
    selectedVehicle: null,
    proposals: [],
    selectedProposals: new Set(),
    tunedId: null
  };

  const q = s => document.querySelector(s);
  const toast = t => { const e = q('#toast'); if (!e) return; e.textContent = t; e.classList.remove('hidden'); setTimeout(() => e.classList.add('hidden'), 2800); };

  function mount() {
    const ecuShell = document.querySelector('#ecu .ecuShell');
    if (!ecuShell) { setTimeout(mount, 300); return; }
    if (document.querySelector('[data-ecu-channel="tuning"]')) return;

    // 1) Kanal butonu ekle (sekme listesinde)
    const channels = document.querySelector('#ecu .ecuChannels');
    if (channels && !channels.querySelector('[data-ecu-channel="tuning"]')) {
      const btn = document.createElement('button');
      btn.dataset.ecuChannel = 'tuning';
      btn.textContent = 'TUNING';
      channels.appendChild(btn);
      btn.addEventListener('click', () => activateChannel('tuning'));
    }

    // 2) Panel ekle
    const panel = document.createElement('div');
    panel.className = 'card ecuPanel hidden';
    panel.dataset.ecuPanel = 'tuning';
    panel.innerHTML = `
      <h3>Otomatik Tuning · Stage 1 / EGR Off</h3>
      <p class="muted">Dosyayı yükle → araç tespit → öneri seç → tuned dosyayı indir. Üretim için gerçek adres haritası gereklidir; şu an deneysel.</p>

      <div class="ecuTuning">
        <div id="ecuTuningDrop" class="ecuTuningDrop">
          <b>ECU dosyasını buraya bırak</b>
          <p>veya tıkla · .bin / .hex kabul edilir · max 12 MB</p>
          <input type="file" id="ecuTuningFile" accept=".bin,.hex,.ori,.mod,.rom,.ecu,application/octet-stream" style="display:none">
        </div>

        <div id="ecuTuningDetect" class="hidden">
          <h3>Tespit Edilen Araçlar</h3>
          <div id="ecuTuningVehicles" class="ecuVehicleGrid"></div>
        </div>

        <div id="ecuTuningProposals" class="hidden">
          <h3>Tuning Önerileri</h3>
          <div id="ecuTuningList" class="ecuProposalGrid"></div>
          <div class="ecuTuningWarn">⚠ Uygulamadan önce dosyayı yedekle. Üretim seviyesi değildir — gerçek Bosch ME7 / Siemens MSE7 adres haritası henüz entegre değil.</div>
          <div class="cardFooter">
            <button id="ecuTuningReset" class="ghost">SIFIRLA</button>
            <button id="ecuTuningApply">UYGULA VE OLUŞTUR</button>
          </div>
        </div>

        <div id="ecuTuningResult" class="hidden">
          <div class="ecuTuningDone">
            <b>✓ Tuned dosya hazır</b>
            <div id="ecuTuningResultInfo" style="margin-top:6px;font-size:12px"></div>
          </div>
          <div class="cardFooter">
            <button id="ecuTuningNew" class="ghost">YENİ DOSYA</button>
            <button id="ecuTuningDownload">İNDİR</button>
          </div>
        </div>
      </div>
    `;
    ecuShell.appendChild(panel);

    bind();
  }

  function activateChannel(channelName) {
    document.querySelectorAll('[data-ecu-channel]').forEach(b => b.classList.toggle('active', b.dataset.ecuChannel === channelName));
    document.querySelectorAll('[data-ecu-panel]').forEach(p => p.classList.toggle('hidden', p.dataset.ecuPanel !== channelName));
  }

  function bind() {
    const drop = q('#ecuTuningDrop');
    const fileInput = q('#ecuTuningFile');
    drop.addEventListener('click', () => fileInput.click());
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.style.borderColor = '#31dfff'; });
    drop.addEventListener('dragleave', () => drop.style.borderColor = '');
    drop.addEventListener('drop', e => { e.preventDefault(); drop.style.borderColor = ''; if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
    fileInput.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });

    q('#ecuTuningReset').addEventListener('click', resetFlow);
    q('#ecuTuningNew').addEventListener('click', resetFlow);
    q('#ecuTuningApply').addEventListener('click', applyTuning);
    q('#ecuTuningDownload').addEventListener('click', downloadTuned);
  }

  async function handleFile(file) {
    if (file.size > 12 * 1024 * 1024) { toast('Dosya 12 MB sınırını aşıyor'); return; }
    state.fileName = file.name;
    state.fileSize = file.size;
    q('#ecuTuningDrop').classList.add('has');
    q('#ecuTuningDrop').innerHTML = `<b>✓ ${esc(file.name)}</b><p>${(file.size / 1024).toFixed(1)} KB · yüklendi, araç tespit ediliyor...</p>`;

    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const b64 = btoa(bin);

      const res = await fetch('/api/ecu/upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ filename: file.name, fileData: b64 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.detail || ('HTTP ' + res.status));

      state.uploadId = data.uploadId;
      state.detections = data.detections || [];
      renderDetections();
    } catch (err) {
      toast('Yükleme: ' + err.message);
      q('#ecuTuningDrop').classList.remove('has');
      q('#ecuTuningDrop').innerHTML = `<b>ECU dosyasını buraya bırak</b><p>Hata: ${esc(err.message)} · tekrar dene</p>`;
    }
  }

  function renderDetections() {
    const section = q('#ecuTuningDetect');
    const list = q('#ecuTuningVehicles');
    section.classList.remove('hidden');
    list.innerHTML = '';

    if (!state.detections.length) {
      list.innerHTML = '<div class="muted" style="padding:12px">Araç tespit edilemedi · dosya bilinmeyen format</div>';
      return;
    }

    state.detections.forEach(v => {
      const card = document.createElement('div');
      card.className = 'ecuVehicleCard';
      card.innerHTML = `<b>${esc(v.type || v.id || 'Bilinmeyen')}</b><small>Güven: ${((v.confidence || 0) * 100).toFixed(0)}%</small>`;
      card.addEventListener('click', () => selectVehicle(v, card));
      list.appendChild(card);
    });

    if (state.detections.length === 1) selectVehicle(state.detections[0], list.firstChild);
  }

  async function selectVehicle(v, cardEl) {
    document.querySelectorAll('.ecuVehicleCard').forEach(c => c.classList.remove('selected'));
    cardEl.classList.add('selected');
    state.selectedVehicle = v.type || v.id;
    state.proposals = v.proposals || [];
    state.selectedProposals.clear();
    renderProposals();
  }

  function renderProposals() {
    const section = q('#ecuTuningProposals');
    const list = q('#ecuTuningList');
    section.classList.remove('hidden');
    list.innerHTML = '';

    if (!state.proposals.length) {
      list.innerHTML = '<div class="muted" style="padding:12px">Bu araç için öneri yok</div>';
      return;
    }

    state.proposals.forEach(p => {
      const row = document.createElement('label');
      row.className = 'ecuProposal';
      row.innerHTML = `<input type="checkbox" data-pid="${esc(p.id)}"><div><b>${esc(p.label || p.id)}</b><small>${esc(p.description || '')}</small></div>`;
      row.querySelector('input').addEventListener('change', e => {
        if (e.target.checked) state.selectedProposals.add(p.id);
        else state.selectedProposals.delete(p.id);
      });
      list.appendChild(row);
    });
  }

  async function applyTuning() {
    if (!state.uploadId || !state.selectedVehicle) { toast('Önce dosya yükle ve araç seç'); return; }
    if (!state.selectedProposals.size) { toast('En az bir öneri seç'); return; }

    const btn = q('#ecuTuningApply');
    btn.disabled = true;
    btn.textContent = 'OLUŞTURULUYOR...';

    try {
      const res = await fetch('/api/ecu/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          uploadId: state.uploadId,
          vehicleId: state.selectedVehicle,
          proposals: [...state.selectedProposals]
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.detail || ('HTTP ' + res.status));

      state.tunedId = data.tunedId;
      q('#ecuTuningProposals').classList.add('hidden');
      q('#ecuTuningResult').classList.remove('hidden');
      q('#ecuTuningResultInfo').innerHTML = `Dosya: ${esc(state.fileName)}<br>Uygulanan yama sayısı: ${(data.appliedPatches || []).length}<br>Boyut: ${data.size || state.fileSize} bayt`;
      toast('Tuned dosya hazır');
    } catch (err) {
      toast('Hata: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'UYGULA VE OLUŞTUR';
    }
  }

  function downloadTuned() {
    if (!state.tunedId) return;
    const a = document.createElement('a');
    a.href = `/api/ecu/download?tunedId=${encodeURIComponent(state.tunedId)}`;
    a.download = state.fileName.replace(/\.(bin|hex|rom|ori)$/i, '_tuned.$1');
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function resetFlow() {
    state.uploadId = null;
    state.fileName = '';
    state.detections = [];
    state.selectedVehicle = null;
    state.proposals = [];
    state.selectedProposals.clear();
    state.tunedId = null;
    q('#ecuTuningDrop').classList.remove('has');
    q('#ecuTuningDrop').innerHTML = '<b>ECU dosyasını buraya bırak</b><p>veya tıkla · .bin / .hex kabul edilir · max 12 MB</p><input type="file" id="ecuTuningFile" accept=".bin,.hex,.ori,.mod,.rom,.ecu,application/octet-stream" style="display:none">';
    q('#ecuTuningDetect').classList.add('hidden');
    q('#ecuTuningProposals').classList.add('hidden');
    q('#ecuTuningResult').classList.add('hidden');
    bind();
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>'"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[m]));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
