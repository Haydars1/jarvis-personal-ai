// JARVIS Tools UI — DTC arama, YouTube öğrenme, video oluşturma, sosyal otomasyon
(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>'"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  const toast = t => { const e = $('#toast'); if (!e) return; e.textContent = t; e.classList.remove('hidden'); clearTimeout(toast._t); toast._t = setTimeout(() => e.classList.add('hidden'), 3200); };

  function init() {
    if (!$('#dtcSearch')) { setTimeout(init, 300); return; }
    // DTC
    $('#dtcSearch').addEventListener('click', dtcLookup);
    $('#dtcInput').addEventListener('keydown', e => { if (e.key === 'Enter') dtcLookup(); });
    loadDtcStats();
    // Öğrenme
    $('#learnBtn').addEventListener('click', learnYouTube);
    $('#learnSearchBtn').addEventListener('click', learnSearch);
    // Video
    $('#videoCreate').addEventListener('click', createVideo);
    // Tek görsel
    if ($('#singleImageBtn')) $('#singleImageBtn').addEventListener('click', singleImage);
    // Vision
    if ($('#visionBtn')) $('#visionBtn').addEventListener('click', analyzeVision);
    // Stok
    if ($('#stockBtn')) $('#stockBtn').addEventListener('click', searchStock);
    // Takvim
    if ($('#calBtn')) $('#calBtn').addEventListener('click', generateCalendar);
    // Sosyal
    $('#socialSchedule').addEventListener('click', scheduleSocial);
    // Fatura
    if ($('#invCreate')) $('#invCreate').addEventListener('click', createInvoice);
    if ($('#invAddItem')) $('#invAddItem').addEventListener('click', addInvoiceItem);
    // CRM
    if ($('#crmAdd')) $('#crmAdd').addEventListener('click', addCustomer);
    if ($('#jobAdd')) $('#jobAdd').addEventListener('click', addJob);
    // Hızlı Araçlar
    if ($('#weatherBtn')) $('#weatherBtn').addEventListener('click', fetchWeather);
    if ($('#fuelBtn')) $('#fuelBtn').addEventListener('click', fetchFuel);
    if ($('#translateBtn')) $('#translateBtn').addEventListener('click', doTranslate);
    if ($('#ocrBtn')) $('#ocrBtn').addEventListener('click', doOcr);
    if ($('#qrBtn')) $('#qrBtn').addEventListener('click', generateQr);
    if ($('#shiftBtn')) $('#shiftBtn').addEventListener('click', generateShiftPlan);
  }

  // ========== DTC ==========
  async function dtcLookup() {
    const input = $('#dtcInput').value.trim().toUpperCase();
    if (!input) return;
    const el = $('#dtcResult');
    el.innerHTML = '<div class="muted">Aranıyor...</div>';

    // Birden fazla kod girilmiş olabilir
    const codes = input.match(/[PBCU][0-3]\d{3}/gi) || [input];

    const results = [];
    for (const code of [...new Set(codes)].slice(0, 8)) {
      try {
        const res = await fetch('/api/dtc/lookup?code=' + encodeURIComponent(code));
        const data = await res.json();
        if (data.ok) results.push(data);
        else results.push({ code, error: data.error || 'Bulunamadı' });
      } catch (err) {
        results.push({ code, error: err.message });
      }
    }

    el.innerHTML = results.map(r => {
      if (r.error) return `<div class="dtcCard dtcMiss"><b>${esc(r.code)}</b><small>${esc(r.error)}</small></div>`;
      const causes = (r.causes || []).map(c =>
        `<div class="dtcCause"><span class="dtcLikelihood ${c.p}">${esc(c.p)}</span> ${esc(c.en || c.de || c.id)}</div>`
      ).join('');
      const parts = (r.parts || []).map(p => `<span class="dtcPart">${esc(p)}</span>`).join(' ');
      const repair = r.repair || {};
      return `
        <div class="dtcCard">
          <div class="dtcHeader">
            <b class="dtcCode">${esc(r.code)}</b>
            ${r.mil ? '<span class="dtcMil">MIL ●</span>' : ''}
          </div>
          <div class="dtcTitle">${esc(r.title?.de || r.title?.en || '')}</div>
          <div class="dtcDesc">${esc(r.description?.de || r.description?.en || '')}</div>
          ${parts ? `<div class="dtcParts">${parts}</div>` : ''}
          ${causes ? `<div class="dtcCauses"><small class="muted">Olası sebepler (olasılık sıralı):</small>${causes}</div>` : ''}
          ${repair.difficulty ? `<div class="dtcRepair">
            Zorluk: <b>${esc(repair.difficulty)}</b>
            ${repair.diy_possible ? ' · DIY mümkün' : ''}
            ${repair.estimated_cost_eur ? ` · €${repair.estimated_cost_eur[0]}–${repair.estimated_cost_eur[1]}` : ''}
            ${repair.estimated_hours ? ` · ${repair.estimated_hours[0]}–${repair.estimated_hours[1]} saat` : ''}
          </div>` : ''}
        </div>
      `;
    }).join('');
  }

  async function loadDtcStats() {
    try {
      const res = await fetch('/api/dtc/stats');
      const data = await res.json();
      if (data.ok) {
        const el = $('#dtcStats');
        const cats = (data.byCategory || []).map(c => `${c.category}: ${c.n}`).join(' · ');
        el.textContent = `Toplam: ${data.total} kod · ${cats}`;
      }
    } catch {}
  }

  // ========== YOUTUBE ÖĞRENME ==========
  async function learnYouTube() {
    const url = $('#learnUrl').value.trim();
    if (!url) return;
    const el = $('#learnStatus');
    const btn = $('#learnBtn');
    btn.disabled = true;
    btn.textContent = 'ÖĞRENİYOR...';
    el.innerHTML = '<div class="muted">Transcript çekiliyor ve hafızaya kaydediliyor...</div>';

    try {
      const res = await fetch('/api/learn/youtube', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.detail || 'FAILED');

      el.innerHTML = `
        <div class="learnSuccess">
          <b>✓ Öğrenildi</b>
          <div>${esc(data.title || 'Video')}</div>
          <small>${data.learning_chunks || 0} chunk · ${data.transcriptLength || 0} karakter · dil: ${esc(data.language || '?')}</small>
          <div class="muted" style="margin-top:6px;font-size:11px">${esc((data.preview || '').slice(0, 200))}...</div>
        </div>
      `;
      $('#learnUrl').value = '';
      toast('✓ Video öğrenildi');
      loadLearnList();
    } catch (err) {
      el.innerHTML = `<div class="learnError">✗ ${esc(err.message)}</div>`;
      toast('Hata: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'ÖĞREN';
    }
  }

  async function loadLearnList() {
    const el = $('#learnList');
    try {
      const res = await fetch('/api/learn/list');
      const data = await res.json();
      if (!data.ok || !data.sources?.length) {
        el.innerHTML = '<div class="muted">Henüz öğrenilmiş kaynak yok. Yukarıdan bir YouTube linki at.</div>';
        return;
      }
      el.innerHTML = data.sources.map(s => `
        <div class="learnItem">
          <div class="learnItemHead">
            <span class="learnStatus ${s.status === 'learned' ? 'ok' : 'wait'}">${s.status === 'learned' ? '✓' : '○'}</span>
            <b>${esc(s.title || 'Video')}</b>
          </div>
          <small>
            <a href="${esc(s.source_url)}" target="_blank" rel="noopener" style="color:#9fe3ff">${esc(s.source_url?.slice(0, 60) || '')}</a>
            · ${s.status} · ${s.language || '?'}
          </small>
        </div>
      `).join('');
    } catch (err) {
      el.innerHTML = '<div class="muted">Liste yüklenemedi: ' + esc(err.message) + '</div>';
    }
  }

  async function learnSearch() {
    const q = $('#learnQuery').value.trim();
    if (!q) return;
    const el = $('#learnSearchResult');
    el.innerHTML = '<div class="muted">Aranıyor...</div>';
    try {
      const res = await fetch('/api/learn/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: q })
      });
      const data = await res.json();
      if (!data.ok || !data.results?.length) {
        el.innerHTML = '<div class="muted">Sonuç bulunamadı.</div>';
        return;
      }
      el.innerHTML = data.results.map(r => `
        <div class="learnResult">
          <div class="learnResultHead"><b>${esc(r.title || 'Video')}</b><small class="muted">skor: ${r.learning_score}</small></div>
          <div class="learnResultText">${esc((r.content || '').slice(0, 300))}</div>
          ${r.source_url ? `<small><a href="${esc(r.source_url)}" target="_blank" rel="noopener" style="color:#9fe3ff">→ kaynak</a></small>` : ''}
        </div>
      `).join('');
    } catch (err) {
      el.innerHTML = '<div class="muted">Hata: ' + esc(err.message) + '</div>';
    }
  }

  // ========== VİDEO OLUŞTUR ==========
  async function createVideo() {
    const topic = $('#videoTopic').value.trim();
    if (!topic) { toast('Konu yaz'); return; }
    const btn = $('#videoCreate');
    const el = $('#videoStatus');
    btn.disabled = true;
    btn.textContent = 'GÖRSELLER ÜRETİLİYOR...';
    el.innerHTML = '<div class="muted">AI görselleri üretiyor (slayt başına ~5 saniye)...</div>';

    try {
      const res = await fetch('/api/video/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic,
          platform: $('#videoPlatform').value,
          imageCount: parseInt($('#videoSlides').value) || 5,
          model: $('#videoModel')?.value || 'flux-schnell',
          style: $('#videoStyle')?.value || 'automotive',
          voice: $('#videoVoice')?.value || 'tr-TR-AhmetNeural',
          subtitles: $('#videoSubtitles')?.checked !== false
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'FAILED');

      el.innerHTML = `
        <div class="videoSuccess">
          <b>✓ ${data.imageCount} görsel üretildi</b>
          <small>Job: ${esc(data.jobId)} · Platform: ${esc(data.platform)}</small>
        </div>
      `;
      // Görselleri ve detayları göster
      const preview = $('#videoPreview');
      preview.classList.remove('hidden');
      preview.innerHTML = `
        <div class="videoGrid">
          ${(data.imageUrls || []).map((url, i) => `
            <div class="videoFrame">
              <img src="${esc(url)}" alt="Slide ${i + 1}" loading="lazy">
              <small>${i + 1}</small>
            </div>
          `).join('')}
        </div>
        ${data.narration ? `<div style="margin-top:10px;padding:10px;background:#0b1a31;border-radius:10px;font-size:12px"><b>🎙 Seslendirme:</b> ${esc(data.narration)}</div>` : ''}
        ${data.hashtags ? `<div style="margin-top:6px;font-size:11px;color:#9fe3ff">${esc(data.hashtags)}</div>` : ''}
        <div class="muted" style="margin-top:6px;font-size:11px">Model: ${esc(data.model||'')} · Ses: ${esc(data.voice||'')} · ${esc(data.note || '')}</div>
      `;
      toast('✓ Görseller hazır');
    } catch (err) {
      el.innerHTML = `<div class="learnError">✗ ${esc(err.message)}</div>`;
      toast('Hata: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'OLUŞTUR';
    }
  }

  // ========== TEK GÖRSEL ÜRET ==========
  async function singleImage() {
    const prompt = $('#singleImagePrompt').value.trim();
    if (!prompt) return;
    const el = $('#singleImageResult');
    el.innerHTML = '<div class="muted">Üretiliyor...</div>';
    try {
      const res = await fetch('/api/ai/image', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'FAILED');
      el.innerHTML = `<div style="margin-top:8px"><img src="/api/ai/image/serve?id=${esc(data.id)}" style="max-width:100%;border-radius:12px;border:1px solid #294466" loading="lazy"><small class="muted" style="display:block;margin-top:4px">${esc(data.model||'')} · ${(data.size/1024).toFixed(0)} KB</small></div>`;
    } catch (err) {
      el.innerHTML = `<div class="learnError">✗ ${esc(err.message)}</div>`;
    }
  }

  // ========== GÖRSEL ANALİZ ==========
  async function analyzeVision() {
    const fileInput = $('#visionFile');
    const question = $('#visionQuestion').value.trim() || 'Bu görselde ne var?';
    if (!fileInput.files[0]) { toast('Görsel seç'); return; }
    const el = $('#visionResult');
    el.innerHTML = '<div class="muted">Analiz ediliyor...</div>';
    try {
      const file = fileInput.files[0];
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const CHUNK = 0x8000;
      let bin = '';
      for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
      const b64 = btoa(bin);
      const res = await fetch('/api/ai/vision', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image: b64, question })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'FAILED');
      el.innerHTML = `<div style="padding:12px;background:#081226;border:1px solid #294466;border-radius:12px;margin-top:8px;font-size:13px;line-height:1.6">${esc(data.answer)}</div>`;
    } catch (err) {
      el.innerHTML = `<div class="learnError">✗ ${esc(err.message)}</div>`;
    }
  }

  // ========== STOK VİDEO/GÖRSEL ARA ==========
  async function searchStock() {
    const query = $('#stockQuery').value.trim();
    if (!query) return;
    const type = $('#stockType').value;
    const el = $('#stockResults');
    el.innerHTML = '<div class="muted">Aranıyor...</div>';
    try {
      const res = await fetch('/api/stock/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query, type })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.detail || 'FAILED');
      if (!data.results?.length) { el.innerHTML = '<div class="muted">Sonuç bulunamadı.</div>'; return; }
      el.innerHTML = `<div class="videoGrid" style="grid-template-columns:repeat(auto-fill,minmax(${type==='videos'?'140':'100'}px,1fr))">${data.results.map(r => `
        <a href="${esc(r.url)}" target="_blank" rel="noopener" class="videoFrame" style="text-decoration:none">
          <img src="${esc(r.thumb||r.url)}" loading="lazy" style="aspect-ratio:${type==='videos'?'9/16':'1/1'}">
          <small>${type==='videos' ? (r.duration||'?')+'s' : (r.photographer||r.alt||'').slice(0,15)}</small>
        </a>
      `).join('')}</div>`;
    } catch (err) {
      el.innerHTML = `<div class="learnError">✗ ${esc(err.message)}</div>`;
    }
  }

  // ========== İÇERİK TAKVİMİ ==========
  async function generateCalendar() {
    const topic = $('#calTopic').value.trim();
    if (!topic) return;
    const weeks = parseInt($('#calWeeks').value) || 4;
    const el = $('#calResult');
    el.innerHTML = '<div class="muted">Takvim oluşturuluyor...</div>';
    try {
      const res = await fetch('/api/content/calendar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topic, weeks, postsPerWeek: 3 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'FAILED');
      el.innerHTML = `
        <div style="margin-top:10px">
          <div class="muted" style="margin-bottom:8px">${data.totalPosts} post · ${data.weeks} hafta · ${esc(data.hashtags||'')}</div>
          ${(data.calendar||[]).map((p,i) => `
            <div class="socialJob" style="margin-top:6px">
              <div class="socialJobHead">
                <span class="socialPlatform">H${p.week}</span>
                <b>${esc(p.day)} · ${esc(p.type)}</b>
              </div>
              <small>${esc(p.emoji||'')} ${esc(p.caption||p.topic||'')}</small>
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      el.innerHTML = `<div class="learnError">✗ ${esc(err.message)}</div>`;
    }
  }

  // ========== SOSYAL MEDYA OTOMASYON ==========
  async function scheduleSocial() {
    const topic = $('#socialTopic').value.trim();
    if (!topic) { toast('Konu yaz'); return; }
    try {
      const res = await fetch('/api/social/schedule', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic,
          platform: $('#socialPlatform').value,
          cadence: $('#socialCadence').value
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'FAILED');
      toast('✓ Plan oluşturuldu');
      $('#socialTopic').value = '';
      loadSocialJobs();
    } catch (err) {
      toast('Hata: ' + err.message);
    }
  }

  async function loadSocialJobs() {
    const el = $('#socialJobs');
    try {
      const res = await fetch('/api/social/jobs');
      const data = await res.json();
      if (!data.ok || !data.jobs?.length) {
        el.innerHTML = '<div class="muted">Aktif plan yok. Yukarıdan oluştur.</div>';
        return;
      }
      el.innerHTML = data.jobs.map(j => `
        <div class="socialJob">
          <div class="socialJobHead">
            <span class="socialPlatform">${esc(j.platform)}</span>
            <b>${esc(j.topic?.slice(0, 60) || '')}</b>
          </div>
          <small>
            ${esc(j.cadence)} · 
            Son: ${j.last_run ? new Date(j.last_run).toLocaleDateString('tr') : 'hiç'} · 
            Sonraki: ${j.next_run ? new Date(j.next_run).toLocaleDateString('tr') : '?'}
          </small>
        </div>
      `).join('');
    } catch (err) {
      el.innerHTML = '<div class="muted">Yüklenemedi: ' + esc(err.message) + '</div>';
    }
  }

  // ========== FATURA ==========
  function addInvoiceItem() {
    const container = $('#invItems');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'invItem row';
    row.innerHTML = '<input class="invDesc" placeholder="Açıklama" style="flex:3"><input class="invQty" type="number" value="1" min="1" style="flex:1" placeholder="Adet"><input class="invPrice" type="number" step="0.01" placeholder="Fiyat €" style="flex:1"><button class="ghost" onclick="this.parentElement.remove()" style="flex:0;padding:4px 8px">✕</button>';
    container.appendChild(row);
  }

  async function createInvoice() {
    const items = [];
    document.querySelectorAll('.invItem').forEach(row => {
      const desc = row.querySelector('.invDesc')?.value?.trim() || '';
      const qty = parseFloat(row.querySelector('.invQty')?.value) || 1;
      const price = parseFloat(row.querySelector('.invPrice')?.value) || 0;
      if (desc) items.push({ desc, qty, price });
    });
    if (!items.length) return toast('En az 1 kalem ekle');
    const data = {
      from: { name: $('#invFromName')?.value, address: $('#invFromAddr')?.value, tax_id: $('#invFromTax')?.value, phone: $('#invFromPhone')?.value },
      to: { name: $('#invToName')?.value, address: $('#invToAddr')?.value, tax_id: $('#invToTax')?.value, phone: $('#invToPhone')?.value },
      items,
      lang: $('#invLang')?.value || 'de'
    };
    const el = $('#invResult');
    el.innerHTML = '<div class="muted">Oluşturuluyor...</div>';
    try {
      const res = await fetch('/api/invoice/create', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
      const d = await res.json();
      if (d.ok) {
        el.innerHTML = `<div class="card"><b>${esc(d.number)}</b> — Toplam: €${d.total?.toFixed(2) || '0'}<br><a href="/api/invoice/${esc(d.id)}" target="_blank" style="color:cyan">📄 FATURA AÇ</a></div>`;
        toast('Fatura oluşturuldu: ' + d.number);
        loadInvoiceList();
      } else el.innerHTML = '<div class="muted">Hata: ' + esc(d.error) + '</div>';
    } catch (err) { el.innerHTML = '<div class="muted">Hata: ' + esc(err.message) + '</div>'; }
  }

  async function loadInvoiceList() {
    const el = $('#invList');
    if (!el) return;
    try {
      const res = await fetch('/api/invoice/list');
      const d = await res.json();
      if (!d.ok || !d.invoices?.length) { el.innerHTML = '<div class="muted">Fatura yok.</div>'; return; }
      el.innerHTML = d.invoices.map(inv => `<div class="card" style="margin-bottom:6px"><a href="/api/invoice/${esc(inv.id)}" target="_blank" style="color:cyan"><b>${esc(inv.number)}</b></a> — ${inv.currency}${inv.total?.toFixed(2) || '0'} · ${inv.status} · ${new Date(inv.created_at).toLocaleDateString('tr')}</div>`).join('');
    } catch (err) { el.innerHTML = '<div class="muted">Yüklenemedi</div>'; }
  }

  // ========== CRM ==========
  async function addCustomer() {
    const name = $('#crmName')?.value?.trim();
    if (!name) return toast('İsim gerekli');
    try {
      const res = await fetch('/api/crm/customers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, phone: $('#crmPhone')?.value, vehicle: $('#crmVehicle')?.value, plate: $('#crmPlate')?.value, notes: $('#crmNotes')?.value }) });
      const d = await res.json();
      if (d.ok) { toast('Müşteri eklendi'); loadCustomerList(); $('#crmName').value = ''; $('#crmPhone').value = ''; $('#crmVehicle').value = ''; $('#crmPlate').value = ''; $('#crmNotes').value = ''; }
      else toast('Hata: ' + (d.error || '?'));
    } catch (err) { toast('Hata: ' + err.message); }
  }

  async function loadCustomerList() {
    const el = $('#crmList');
    if (!el) return;
    try {
      const res = await fetch('/api/crm/customers');
      const d = await res.json();
      if (!d.ok || !d.customers?.length) { el.innerHTML = '<div class="muted">Müşteri yok.</div>'; return; }
      el.innerHTML = d.customers.map(c => `<div class="card" style="margin-bottom:6px"><b>${esc(c.name)}</b>${c.vehicle ? ' · ' + esc(c.vehicle) : ''}${c.plate ? ' · ' + esc(c.plate) : ''}${c.phone ? ' · ' + esc(c.phone) : ''}</div>`).join('');
      // Populate job customer dropdown
      const sel = $('#jobCustomer');
      if (sel) { sel.innerHTML = '<option value="">Müşteri seç...</option>' + d.customers.map(c => `<option value="${esc(c.id)}">${esc(c.name)}${c.plate ? ' (' + esc(c.plate) + ')' : ''}</option>`).join(''); }
    } catch (err) { el.innerHTML = '<div class="muted">Yüklenemedi</div>'; }
  }

  async function addJob() {
    const cid = $('#jobCustomer')?.value;
    const title = $('#jobTitle')?.value?.trim();
    if (!cid) return toast('Müşteri seç');
    if (!title) return toast('İş başlığı gerekli');
    try {
      const res = await fetch('/api/crm/jobs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ customer_id: cid, title, type: $('#jobType')?.value || 'tuning', price: parseFloat($('#jobPrice')?.value) || 0, notes: $('#jobNotes')?.value || '' }) });
      const d = await res.json();
      if (d.ok) { toast('İş eklendi'); loadJobList(); $('#jobTitle').value = ''; $('#jobPrice').value = ''; $('#jobNotes').value = ''; }
      else toast('Hata: ' + (d.error || '?'));
    } catch (err) { toast('Hata: ' + err.message); }
  }

  async function loadJobList() {
    const el = $('#jobList');
    if (!el) return;
    try {
      const res = await fetch('/api/crm/jobs');
      const d = await res.json();
      if (!d.ok || !d.jobs?.length) { el.innerHTML = '<div class="muted">İş kaydı yok.</div>'; return; }
      el.innerHTML = d.jobs.map(j => {
        const statusColor = j.status === 'done' ? 'green' : j.status === 'open' ? 'cyan' : 'amber';
        return `<div class="card" style="margin-bottom:6px"><b>${esc(j.title)}</b> — ${esc(j.customer_name || '')}<br><span class="${statusColor}">${esc(j.status)}</span> · ${esc(j.type)} · €${(j.price || 0).toFixed(2)} · ${new Date(j.created_at).toLocaleDateString('tr')}</div>`;
      }).join('');
    } catch (err) { el.innerHTML = '<div class="muted">Yüklenemedi</div>'; }
  }

  // ========== HAVA DURUMU ==========
  async function fetchWeather() {
    const lat = $('#weatherLat')?.value || '51.23';
    const lon = $('#weatherLon')?.value || '6.78';
    const el = $('#weatherResult');
    el.innerHTML = '<div class="muted">Sorgulanıyor...</div>';
    try {
      const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
      const d = await res.json();
      if (!d.ok) { el.innerHTML = '<div class="muted">Hata: ' + esc(d.error) + '</div>'; return; }
      let html = `<div class="card"><b>${d.current.desc}</b> · ${d.current.temp}°C · Rüzgar ${d.current.wind} km/h · Nem %${d.current.humidity}</div>`;
      html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">';
      (d.daily || []).forEach(day => {
        html += `<div class="card" style="flex:1;min-width:100px;text-align:center"><small>${day.date}</small><br>${day.desc}<br><b>${day.max}°</b> / ${day.min}°<br>🌧 ${day.rain}mm</div>`;
      });
      html += '</div>';
      el.innerHTML = html;
    } catch (err) { el.innerHTML = '<div class="muted">Hata: ' + esc(err.message) + '</div>'; }
  }

  // ========== YAKIT ==========
  async function fetchFuel() {
    const lat = $('#fuelLat')?.value;
    const lon = $('#fuelLon')?.value;
    if (!lat || !lon) return toast('Enlem / boylam gerekli');
    const el = $('#fuelResult');
    el.innerHTML = '<div class="muted">Aranıyor...</div>';
    try {
      const res = await fetch(`/api/fuel?lat=${lat}&lon=${lon}`);
      const d = await res.json();
      if (!d.ok) { el.innerHTML = '<div class="muted">Hata: ' + esc(d.error) + '</div>'; return; }
      if (!d.stations?.length) { el.innerHTML = '<div class="muted">İstasyon bulunamadı</div>'; return; }
      el.innerHTML = d.stations.map(s => `<div class="card" style="margin-bottom:6px"><b>${esc(s.brand || s.name)}</b> · ${s.dist} km${s.open ? '' : ' · <span class="amber">KAPALI</span>'}<br>Diesel: <b>${s.diesel || '—'}€</b> · E5: ${s.e5 || '—'}€ · E10: ${s.e10 || '—'}€<br><small>${esc(s.address)}</small></div>`).join('');
    } catch (err) { el.innerHTML = '<div class="muted">Hata: ' + esc(err.message) + '</div>'; }
  }

  // ========== ÇEVİRİ ==========
  async function doTranslate() {
    const text = $('#translateText')?.value?.trim();
    if (!text) return toast('Metin gir');
    const el = $('#translateResult');
    el.innerHTML = '<div class="muted">Çevriliyor...</div>';
    try {
      const res = await fetch('/api/translate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, source: $('#translateFrom')?.value || 'tr', target: $('#translateTo')?.value || 'de' }) });
      const d = await res.json();
      if (d.ok) el.innerHTML = `<div class="card" style="white-space:pre-wrap"><b>${esc($('#translateFrom')?.value)} → ${esc($('#translateTo')?.value)}</b><br>${esc(d.translated)}</div>`;
      else el.innerHTML = '<div class="muted">Hata: ' + esc(d.error) + '</div>';
    } catch (err) { el.innerHTML = '<div class="muted">Hata: ' + esc(err.message) + '</div>'; }
  }

  // ========== OCR ==========
  async function doOcr() {
    const file = $('#ocrFile')?.files?.[0];
    if (!file) return toast('Görsel seç');
    const el = $('#ocrResult');
    el.innerHTML = '<div class="muted">Okunuyor...</div>';
    try {
      const buf = await file.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const res = await fetch('/api/ocr', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image: b64 }) });
      const d = await res.json();
      if (d.ok) el.innerHTML = `<div class="card" style="white-space:pre-wrap">${esc(d.text)}</div>`;
      else el.innerHTML = '<div class="muted">Hata: ' + esc(d.error) + '</div>';
    } catch (err) { el.innerHTML = '<div class="muted">Hata: ' + esc(err.message) + '</div>'; }
  }

  // ========== QR ==========
  function generateQr() {
    const text = $('#qrText')?.value?.trim();
    if (!text) return toast('Metin gir');
    const el = $('#qrResult');
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}&format=svg`;
    el.innerHTML = `<div class="card" style="text-align:center"><img src="${url}" width="200" height="200" style="border-radius:8px;background:#fff;padding:8px"><br><a href="${url}" target="_blank" style="color:cyan;font-size:12px">SVG indir</a></div>`;
  }

  // ========== VARDİYA ==========
  async function generateShiftPlan() {
    const start = $('#shiftStart')?.value || new Date().toISOString().slice(0, 10);
    const days = $('#shiftDays')?.value || '7';
    const el = $('#shiftResult');
    el.innerHTML = '<div class="muted">Oluşturuluyor...</div>';
    try {
      const res = await fetch(`/api/shifts?start=${start}&days=${days}`);
      const d = await res.json();
      if (!d.ok) { el.innerHTML = '<div class="muted">Hata</div>'; return; }
      el.innerHTML = '<div style="display:flex;gap:6px;flex-wrap:wrap">' + d.schedule.map(s => {
        const bg = s.weekend ? 'rgba(255,100,100,0.15)' : 'rgba(0,255,200,0.08)';
        return `<div class="card" style="flex:1;min-width:90px;text-align:center;background:${bg}"><small>${s.date}</small><br><b>${s.day}</b><br>${s.shifts.join('<br>')}</div>`;
      }).join('') + '</div>';
    } catch (err) { el.innerHTML = '<div class="muted">Hata: ' + esc(err.message) + '</div>'; }
  }

  // Sayfa açıldığında listeleri yükle
  const settingsBtn = document.querySelector('[data-page="settings"]');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      setTimeout(() => {
        loadLearnList();
        loadSocialJobs();
        loadInvoiceList();
        loadCustomerList();
        loadJobList();
      }, 300);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
