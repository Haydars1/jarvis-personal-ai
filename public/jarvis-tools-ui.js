// JARVIS Tools UI — DTC arama, YouTube öğrenme, video oluşturma, sosyal otomasyon
(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>'"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  const toast = t => { const e = $('#toast'); if (!e) return; e.textContent = t; e.classList.remove('hidden'); clearTimeout(toast._t); toast._t = setTimeout(() => e.classList.add('hidden'), 3200); };

  function init() {
    if (!$('#dtcSearch') && !$('#dtcSearchBtn')) { setTimeout(init, 300); return; }
    // DTC (eski panel)
    if ($('#dtcSearch')) { $('#dtcSearch').addEventListener('click', dtcLookup); $('#dtcInput').addEventListener('keydown', e => { if (e.key === 'Enter') dtcLookup(); }); loadDtcStats(); }
    // DTC yeni panel (ayarlar altında)
    if ($('#dtcSearchBtn')) { $('#dtcSearchBtn').addEventListener('click', dtcSearchNew); $('#dtcCode').addEventListener('keydown', e => { if (e.key === 'Enter') dtcSearchNew(); }); }
    // Öğrenme
    if ($('#learnBtn')) $('#learnBtn').addEventListener('click', learnYouTube);
    if ($('#learnSearchBtn')) $('#learnSearchBtn').addEventListener('click', learnSearch);
    // Video
    if ($('#videoCreate')) $('#videoCreate').addEventListener('click', createVideo);
    // Tek görsel
    if ($('#singleImageBtn')) $('#singleImageBtn').addEventListener('click', singleImage);
    // Vision
    if ($('#visionBtn')) $('#visionBtn').addEventListener('click', analyzeVision);
    // Stok
    if ($('#stockBtn')) $('#stockBtn').addEventListener('click', searchStock);
    // Takvim
    // eski sosyal takvim — artık calBtn iş takvimi için kullanılıyor
    // Sosyal
    if ($('#socialSchedule')) $('#socialSchedule').addEventListener('click', scheduleSocial);
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
    // Dashboard
    if ($('#dashRefresh')) $('#dashRefresh').addEventListener('click', loadDashboard);
    // Randevu
    if ($('#aptAdd')) $('#aptAdd').addEventListener('click', addAppointment);
    // Araç geçmişi
    if ($('#vhSearchBtn')) { $('#vhSearchBtn').addEventListener('click', searchVehicleHistory); $('#vhPlate').addEventListener('keydown', e => { if (e.key === 'Enter') searchVehicleHistory(); }); }
    // Mesaj şablonları
    if ($('#msgGenerate')) $('#msgGenerate').addEventListener('click', generateMessage);
    // Maliyet hesaplayıcı
    if ($('#calcBtn')) $('#calcBtn').addEventListener('click', calculateProfit);
    // Not defteri
    if ($('#noteAddBtn')) $('#noteAddBtn').addEventListener('click', addNote);
    if ($('#noteSearchBtn')) { $('#noteSearchBtn').addEventListener('click', () => loadNotes($('#noteSearch')?.value)); $('#noteSearch')?.addEventListener('keydown', e => { if (e.key === 'Enter') loadNotes($('#noteSearch')?.value); }); }
    // Yapılacaklar
    if ($('#todoAddBtn')) { $('#todoAddBtn').addEventListener('click', addTodo); $('#todoText')?.addEventListener('keydown', e => { if (e.key === 'Enter') addTodo(); }); }
    // Hızlı iş
    if ($('#qjCreateBtn')) $('#qjCreateBtn').addEventListener('click', createQuickJob);
    if ($('#qjDate')) { $('#qjDate').value = new Date().toISOString().slice(0, 10); }
    // Müşteri raporu
    if ($('#reportBtn')) $('#reportBtn').addEventListener('click', loadCustomerReport);
    // İletişim kaydı
    if ($('#contactAddBtn')) $('#contactAddBtn').addEventListener('click', addContact);
    // Yedekleme
    if ($('#backupBtn')) $('#backupBtn').addEventListener('click', downloadBackup);
    // Fiyat listesi
    if ($('#priceAddBtn')) $('#priceAddBtn').addEventListener('click', addPrice);
    // Gelir/gider
    if ($('#txAddBtn')) $('#txAddBtn').addEventListener('click', addTransaction);
    if ($('#txFilterBtn')) $('#txFilterBtn').addEventListener('click', () => loadTransactions($('#txMonth')?.value));
    if ($('#txDate')) { const today = new Date().toISOString().slice(0, 10); $('#txDate').value = today; }
    if ($('#txMonth')) { const m = new Date().toISOString().slice(0, 7); $('#txMonth').value = m; }
    // İş takvimi
    if ($('#calBtn')) { $('#calBtn').addEventListener('click', loadCalendarDay); }
    if ($('#calDate')) { const today = new Date().toISOString().slice(0, 10); $('#calDate').value = today; }
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

  // ========== DTC ARAMA (Ayarlar paneli) ==========
  async function dtcSearchNew() {
    const input = $('#dtcCode')?.value?.trim();
    if (!input) return toast('Kod veya kelime gir');
    const el = $('#dtcResult');
    el.innerHTML = '<div class="muted">Aranıyor...</div>';
    const upper = input.toUpperCase();

    // Tek DTC kodu mu kontrol et
    if (/^[PBCU][0-3]\d{3}$/i.test(upper)) {
      try {
        const res = await fetch('/api/dtc/lookup?code=' + encodeURIComponent(upper));
        const d = await res.json();
        if (d.ok) {
          el.innerHTML = `<div class="card">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <b style="font-size:18px;color:cyan">${esc(d.code)}</b>
              <span class="muted">${esc(d.category || '')}</span>
            </div>
            <div style="margin:8px 0"><b>EN:</b> ${esc(d.title?.en || '')}</div>
            <div><b>DE:</b> ${esc(d.title?.de || '')}</div>
            ${d.description?.en ? `<div style="margin-top:8px;font-size:13px;color:#aaa">${esc(d.description.en).slice(0,300)}</div>` : ''}
            ${d.mil ? '<div style="margin-top:6px;color:orange">⚠ MIL (Motor Arıza Lambası) aktif</div>' : ''}
            ${(d.causes||[]).length ? `<div style="margin-top:8px"><small style="color:#888">Olası Nedenler:</small><br>${d.causes.map(c=>'• '+esc(c)).join('<br>')}</div>` : ''}
            ${(d.parts||[]).length ? `<div style="margin-top:6px"><small style="color:#888">İlgili Parçalar:</small> ${d.parts.map(p=>esc(p)).join(', ')}</div>` : ''}
          </div>`;
        } else {
          // Tek kod bulunamadı, arama yap
          await dtcTextSearch(input, el);
        }
      } catch (err) { el.innerHTML = '<div class="muted">Hata: ' + esc(err.message) + '</div>'; }
    } else {
      await dtcTextSearch(input, el);
    }

    // İstatistikleri de yükle
    try {
      const sr = await fetch('/api/dtc/stats');
      const sd = await sr.json();
      if (sd.ok) {
        const statsEl = $('#dtcStats');
        if (statsEl) statsEl.innerHTML = `Toplam <b>${sd.total}</b> arıza kodu · ` + (sd.byCategory||[]).slice(0,5).map(c => `${esc(c.category)}: ${c.n}`).join(' · ');
      }
    } catch {}
  }

  async function dtcTextSearch(query, el) {
    try {
      const res = await fetch('/api/dtc/search', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({query}) });
      const d = await res.json();
      if (d.ok && d.results?.length) {
        el.innerHTML = `<div class="muted">${d.count} sonuç</div>` + d.results.map(r => `
          <div class="card" style="cursor:pointer;margin-bottom:4px" onclick="document.querySelector('#dtcCode').value='${esc(r.code)}';document.querySelector('#dtcSearchBtn').click()">
            <div style="display:flex;justify-content:space-between"><b style="color:cyan">${esc(r.code)}</b><small class="muted">${esc(r.category||'')}</small></div>
            <div style="font-size:13px">${esc(r.title_en || '')}</div>
            ${r.title_de ? `<div style="font-size:12px;color:#888">${esc(r.title_de)}</div>` : ''}
          </div>
        `).join('');
      } else {
        el.innerHTML = '<div class="muted">Sonuç bulunamadı: "' + esc(query) + '"</div>';
      }
    } catch (err) { el.innerHTML = '<div class="muted">Arama hatası: ' + esc(err.message) + '</div>'; }
  }

  // ========== DASHBOARD ==========
  async function loadDashboard() {
    const metrics = $('#dashMetrics');
    const recent = $('#dashRecentJobs');
    const revenue = $('#dashRevenue');
    if (!metrics) return;
    metrics.innerHTML = '<div class="muted">Yükleniyor...</div>';
    try {
      const res = await fetch('/api/dashboard/stats');
      const d = await res.json();
      if (!d.ok) { metrics.innerHTML = '<div class="muted">Hata: ' + esc(d.error) + '</div>'; return; }
      metrics.innerHTML = `
        <div class="card cyan"><small>MÜŞTERİ</small><b>${d.customers}</b></div>
        <div class="card green"><small>TOPLAM İŞ</small><b>${d.jobs}</b></div>
        <div class="card amber"><small>AÇIK İŞ</small><b>${d.openJobs}</b></div>
        <div class="card purple"><small>TAMAMLANAN</small><b>${d.completedJobs}</b></div>
        <div class="card cyan"><small>FATURA</small><b>${d.invoices}</b></div>
        <div class="card green"><small>RANDEVU</small><b>${d.upcomingAppointments}</b></div>
      `;
      // Gelir
      if (revenue) {
        revenue.innerHTML = `<div class="card" style="display:flex;justify-content:space-around;text-align:center">
          <div><small class="muted">Toplam Gelir</small><br><b style="font-size:20px;color:#0f0">€${(d.revenue||0).toFixed(2)}</b></div>
          <div><small class="muted">Son 30 Gün</small><br><b style="font-size:20px;color:cyan">€${(d.monthRevenue||0).toFixed(2)}</b></div>
        </div>`;
        if ((d.topCustomers||[]).length) {
          revenue.innerHTML += '<h4 style="margin-top:12px">En İyi Müşteriler</h4>' + d.topCustomers.map(c => `<div class="card" style="display:flex;justify-content:space-between"><span>${esc(c.name)}</span><span>${c.job_count} iş · <b>€${(c.total_spent||0).toFixed(2)}</b></span></div>`).join('');
        }
      }
      // Son işler
      if (recent && (d.recentJobs||[]).length) {
        recent.innerHTML = d.recentJobs.map(j => {
          const colors = {open:'cyan',completed:'#0f0',cancelled:'#f55'};
          return `<div class="card" style="margin-bottom:4px;display:flex;justify-content:space-between;align-items:center">
            <div><b>${esc(j.title||'İsimsiz')}</b><br><small class="muted">${esc(j.customer_name||'—')} · ${esc(j.type||'')}</small></div>
            <div style="text-align:right"><span style="color:${colors[j.status]||'#888'}">${esc(j.status)}</span><br><small>€${(j.price||0).toFixed(2)}</small></div>
          </div>`;
        }).join('');
      } else if (recent) { recent.innerHTML = '<div class="muted">Henüz iş yok</div>'; }
    } catch (err) { metrics.innerHTML = '<div class="muted">Hata: ' + esc(err.message) + '</div>'; }
  }

  // ========== RANDEVU ==========
  async function addAppointment() {
    const title = $('#aptTitle')?.value?.trim();
    const date = $('#aptDate')?.value;
    const time = $('#aptTime')?.value || '10:00';
    const notes = $('#aptNotes')?.value?.trim() || '';
    const customerId = $('#aptCustomer')?.value || '';
    if (!title) return toast('Randevu başlığı gir');
    if (!date) return toast('Tarih seç');
    try {
      const res = await fetch('/api/appointments', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({title,date,time,notes,customer_id:customerId||null}) });
      const d = await res.json();
      if (d.ok) { toast('Randevu eklendi'); $('#aptTitle').value=''; $('#aptNotes').value=''; loadAppointmentList(); }
      else toast('Hata: '+(d.error||''));
    } catch (err) { toast('Hata: '+err.message); }
  }

  async function loadAppointmentList() {
    const el = $('#aptList');
    if (!el) return;
    try {
      const res = await fetch('/api/appointments?status=scheduled');
      const d = await res.json();
      if (!d.ok || !d.appointments?.length) { el.innerHTML = '<div class="muted">Yaklaşan randevu yok</div>'; return; }
      el.innerHTML = d.appointments.map(a => {
        const today = new Date().toISOString().slice(0,10);
        const isToday = a.date === today;
        const isPast = a.date < today;
        const bg = isToday ? 'rgba(0,255,200,0.12)' : isPast ? 'rgba(255,80,80,0.1)' : '';
        return `<div class="card" style="margin-bottom:4px;${bg?'background:'+bg:''}">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <b>${esc(a.title)}</b>
              ${a.customer_name ? `<br><small class="muted">${esc(a.customer_name)}${a.customer_plate?' · '+esc(a.customer_plate):''}</small>` : ''}
            </div>
            <div style="text-align:right">
              <b style="color:${isToday?'#0f0':isPast?'#f55':'cyan'}">${esc(a.date)}</b><br>
              <small>${esc(a.time)}</small>
            </div>
          </div>
          ${a.notes ? `<div style="font-size:12px;color:#888;margin-top:4px">${esc(a.notes)}</div>` : ''}
          <div style="margin-top:6px;display:flex;gap:6px">
            <button class="ghost" style="font-size:11px" onclick="completeAppointment('${a.id}')">✓ TAMAMLA</button>
            <button class="ghost" style="font-size:11px;color:#f55" onclick="cancelAppointment('${a.id}')">✕ İPTAL</button>
          </div>
        </div>`;
      }).join('');
    } catch (err) { el.innerHTML = '<div class="muted">Hata: '+esc(err.message)+'</div>'; }
  }

  // Global randevu fonksiyonları
  window.completeAppointment = async function(id) {
    try {
      await fetch('/api/appointments/'+id, {method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({status:'completed'})});
      toast('Randevu tamamlandı');
      loadAppointmentList();
    } catch {}
  };
  window.cancelAppointment = async function(id) {
    try {
      await fetch('/api/appointments/'+id, {method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({status:'cancelled'})});
      toast('Randevu iptal edildi');
      loadAppointmentList();
    } catch {}
  };

  // ========== ARAÇ GEÇMİŞİ ==========
  async function searchVehicleHistory() {
    const plate = $('#vhPlate')?.value?.trim();
    if (!plate) return toast('Plaka gir');
    const el = $('#vhResult');
    el.innerHTML = '<div class="muted">Aranıyor...</div>';
    try {
      const res = await fetch('/api/vehicle/history?plate=' + encodeURIComponent(plate));
      const d = await res.json();
      if (!d.ok) { el.innerHTML = '<div class="muted">Hata: ' + esc(d.error) + '</div>'; return; }
      if (!d.customers?.length) { el.innerHTML = '<div class="muted">Bu plaka ile kayıtlı müşteri bulunamadı: "' + esc(plate) + '"</div>'; return; }
      let html = '';
      // Müşteri bilgileri
      for (const c of d.customers) {
        html += `<div class="card" style="margin-bottom:8px;border-left:3px solid cyan">
          <div style="display:flex;justify-content:space-between"><b>${esc(c.name)}</b><span style="color:cyan">${esc(c.plate)}</span></div>
          <div class="muted">${esc(c.vehicle||'')} ${c.phone?'· '+esc(c.phone):''}</div>
        </div>`;
      }
      // İş geçmişi
      if (d.jobs?.length) {
        html += '<h4 style="margin:12px 0 6px">Yapılan İşler</h4>';
        for (const j of d.jobs) {
          const colors = {open:'cyan',completed:'#0f0',cancelled:'#f55'};
          const dt = j.created_at ? new Date(j.created_at).toLocaleDateString('tr-TR') : '';
          html += `<div class="card" style="margin-bottom:4px">
            <div style="display:flex;justify-content:space-between">
              <div><b>${esc(j.title||'İsimsiz')}</b><br><small class="muted">${esc(j.type||'')} · ${esc(j.customer_name||'')}</small></div>
              <div style="text-align:right"><span style="color:${colors[j.status]||'#888'}">${esc(j.status)}</span><br><small>€${(j.price||0).toFixed(2)}</small><br><small class="muted">${dt}</small></div>
            </div>
            ${j.notes?`<div style="font-size:12px;color:#888;margin-top:4px">${esc(j.notes)}</div>`:''}
          </div>`;
        }
      } else { html += '<div class="muted">Bu araç için henüz iş kaydı yok</div>'; }
      el.innerHTML = html;
    } catch (err) { el.innerHTML = '<div class="muted">Hata: ' + esc(err.message) + '</div>'; }
  }

  // ========== MESAJ ŞABLONLARI ==========
  function generateMessage() {
    const tpl = $('#msgTemplate')?.value;
    const name = $('#msgCustomerName')?.value?.trim() || 'Müşterimiz';
    const car = $('#msgCarInfo')?.value?.trim() || '';
    const extra = $('#msgExtra')?.value?.trim() || '';
    const el = $('#msgResult');
    if (!tpl) return toast('Şablon seç');

    const templates = {
      randevu: `Merhaba ${name},\n\n${car ? car + ' aracınız için ' : ''}randevunuz ${extra || 'yakında'}. Zamanında gelmenizi rica ederiz.\n\nBilgi için: 📞 (telefon)\n\nSaygılarımla`,
      tamamlandi: `Merhaba ${name},\n\n${car ? car + ' aracınızdaki ' : ''}işlem tamamlanmıştır. ${extra ? extra + '. ' : ''}Aracınızı teslim almaya gelebilirsiniz.\n\nTeşekkür ederiz 🙏`,
      fiyat: `Merhaba ${name},\n\n${car ? car + ' için ' : ''}fiyat teklifimiz:\n${extra || '(fiyat bilgisi)'}\n\nDetaylı bilgi ve randevu için bize ulaşabilirsiniz.\n\nSaygılarımla`,
      tesekkkur: `Merhaba ${name},\n\n${car ? car + ' aracınızla ' : ''}bizi tercih ettiğiniz için teşekkür ederiz. Memnuniyetiniz bizim için önemlidir.\n\nTekrar görüşmek üzere! 🙏`,
      dtcsonuc: `Merhaba ${name},\n\n${car ? car + ' aracınızın ' : ''}arıza taraması tamamlandı.\n${extra || 'Tespit edilen kodlar raporda belirtilmiştir.'}\n\nDetaylı bilgi için arayabilirsiniz.`,
      indirim: `🔥 Kampanya!\n\nMerhaba ${name},\n\n${car ? car + ' ' : ''}${extra || 'ECU Tuning ve kodlama işlemlerinde özel indirim!'}\n\nRandevu için hemen arayın! 📞`
    };

    const msg = templates[tpl] || '';
    el.innerHTML = `<div class="card" style="white-space:pre-wrap;font-size:14px;line-height:1.6">${esc(msg)}</div>
      <button class="ghost" style="margin-top:6px" onclick="navigator.clipboard.writeText(${JSON.stringify(msg).replace(/'/g,'\\\'')});document.querySelector('#toast').textContent='Kopyalandı';document.querySelector('#toast').classList.remove('hidden');setTimeout(()=>document.querySelector('#toast').classList.add('hidden'),2000)">📋 KOPYALA</button>`;
  }

  // ========== MALİYET HESAPLAYICI ==========
  function calculateProfit() {
    const price = parseFloat($('#calcPrice')?.value) || 0;
    const tool = parseFloat($('#calcTool')?.value) || 0;
    const time = parseFloat($('#calcTime')?.value) || 0;
    const hourly = parseFloat($('#calcHourly')?.value) || 0;
    const other = parseFloat($('#calcOther')?.value) || 0;
    const el = $('#calcResult');
    if (!price) return toast('Fiyat gir');

    const laborCost = time * hourly;
    const totalCost = tool + laborCost + other;
    const profit = price - totalCost;
    const margin = price > 0 ? (profit / price * 100) : 0;
    const profitColor = profit >= 0 ? '#0f0' : '#f55';

    el.innerHTML = `<div class="card">
      <div style="display:flex;justify-content:space-around;text-align:center;margin-bottom:12px">
        <div><small class="muted">Gelir</small><br><b style="font-size:18px;color:cyan">€${price.toFixed(2)}</b></div>
        <div><small class="muted">Maliyet</small><br><b style="font-size:18px;color:orange">€${totalCost.toFixed(2)}</b></div>
        <div><small class="muted">Kâr</small><br><b style="font-size:18px;color:${profitColor}">€${profit.toFixed(2)}</b></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:13px;color:#888">
        <span>İşçilik: €${laborCost.toFixed(2)} (${time}h × €${hourly})</span>
        <span>Ekipman: €${tool.toFixed(2)}</span>
        ${other > 0 ? `<span>Diğer: €${other.toFixed(2)}</span>` : ''}
      </div>
      <div style="margin-top:8px;text-align:center">
        <span style="font-size:14px">Kâr Marjı: <b style="color:${profitColor}">${margin.toFixed(1)}%</b></span>
      </div>
    </div>`;
  }

  // ========== RANDEVU MÜŞTERİ DROPDOWN ==========
  async function loadAppointmentCustomers() {
    const sel = $('#aptCustomer');
    if (!sel) return;
    try {
      const res = await fetch('/api/crm/customers');
      const d = await res.json();
      if (d.ok && d.customers?.length) {
        sel.innerHTML = '<option value="">Müşteri seç (opsiyonel)...</option>' + d.customers.map(c => `<option value="${esc(c.id)}">${esc(c.name)}${c.plate?' ('+esc(c.plate)+')':''}</option>`).join('');
      }
    } catch {}
  }

  // ========== NOT DEFTERİ ==========
  async function addNote() {
    const content = $('#noteContent')?.value?.trim();
    if (!content) { toast('Not içeriği gerekli'); return; }
    const title = $('#noteTitle')?.value?.trim() || '';
    const category = $('#noteCategory')?.value || 'genel';
    const pinned = $('#notePinned')?.checked || false;
    try {
      const res = await fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, content, category, pinned }) });
      const d = await res.json();
      if (d.ok) {
        toast('Not eklendi');
        $('#noteContent').value = '';
        $('#noteTitle').value = '';
        if ($('#notePinned')) $('#notePinned').checked = false;
        loadNotes();
      } else toast(d.error || 'Hata');
    } catch (e) { toast('Hata: ' + e.message); }
  }

  async function loadNotes(query) {
    const el = $('#noteList');
    if (!el) return;
    try {
      let url = '/api/notes';
      if (query) url += '?q=' + encodeURIComponent(query);
      const res = await fetch(url);
      const d = await res.json();
      if (!d.ok || !d.notes?.length) { el.innerHTML = '<p class="muted">Not bulunamadı.</p>'; return; }
      const catIcons = { genel: '📋', musteri: '👤', teknik: '🔧', fikir: '💡', onemli: '⚠️' };
      el.innerHTML = d.notes.map(n => {
        const dt = n.updated_at ? new Date(n.updated_at).toLocaleDateString('tr-TR') : '';
        return `<div style="background:var(--card);border-radius:8px;padding:10px;margin-bottom:8px;border-left:3px solid ${n.pinned?'var(--accent)':'#333'}">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <b>${catIcons[n.category]||'📋'} ${esc(n.title||'(Başlıksız)')}</b>
            <span style="font-size:11px;opacity:0.5">${dt}</span>
          </div>
          <p style="margin:4px 0;font-size:13px;white-space:pre-wrap">${esc(n.content)}</p>
          <div style="display:flex;gap:6px;margin-top:4px">
            <button onclick="toggleNotePin('${esc(n.id)}',${n.pinned?0:1})" style="font-size:11px;padding:2px 8px">${n.pinned?'📌 Çıkar':'📌 Sabitle'}</button>
            <button onclick="deleteNote('${esc(n.id)}')" style="font-size:11px;padding:2px 8px;background:#611">🗑 Sil</button>
          </div>
        </div>`;
      }).join('');
    } catch (e) { el.innerHTML = '<p class="muted">Yüklenemedi: ' + esc(e.message) + '</p>'; }
  }
  window.toggleNotePin = async (id, pin) => {
    try { await fetch('/api/notes/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pinned: pin }) }); loadNotes(); } catch {}
  };
  window.deleteNote = async (id) => {
    if (!confirm('Bu notu silmek istediğinize emin misiniz?')) return;
    try { await fetch('/api/notes/' + id, { method: 'DELETE' }); toast('Not silindi'); loadNotes(); } catch {}
  };

  // ========== YAPILACAKLAR ==========
  async function addTodo() {
    const text = $('#todoText')?.value?.trim();
    if (!text) { toast('Görev metni gerekli'); return; }
    const priority = $('#todoPriority')?.value || 'normal';
    const due_date = $('#todoDue')?.value || '';
    try {
      const res = await fetch('/api/todos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, priority, due_date }) });
      const d = await res.json();
      if (d.ok) {
        toast('Görev eklendi');
        $('#todoText').value = '';
        if ($('#todoDue')) $('#todoDue').value = '';
        loadTodos();
      } else toast(d.error || 'Hata');
    } catch (e) { toast('Hata: ' + e.message); }
  }

  async function loadTodos() {
    const el = $('#todoList');
    if (!el) return;
    try {
      const res = await fetch('/api/todos');
      const d = await res.json();
      if (!d.ok || !d.todos?.length) { el.innerHTML = '<p class="muted">Görev yok — üstten ekleyin.</p>'; return; }
      const priColors = { high: '#f44', normal: 'var(--accent)', low: '#888' };
      const priLabels = { high: 'YÜKSEK', normal: 'NORMAL', low: 'DÜŞÜK' };
      el.innerHTML = d.todos.map(t => {
        const dueStr = t.due_date || '';
        const isOverdue = dueStr && !t.done && dueStr < new Date().toISOString().slice(0, 10);
        return `<div style="background:var(--card);border-radius:8px;padding:8px 10px;margin-bottom:6px;display:flex;align-items:center;gap:8px;opacity:${t.done?'0.5':'1'}${isOverdue?';border-left:3px solid #f44':''}">
          <input type="checkbox" ${t.done?'checked':''} onchange="toggleTodo('${esc(t.id)}',this.checked)" style="width:18px;height:18px">
          <div style="flex:1">
            <span style="${t.done?'text-decoration:line-through;':''}">${esc(t.text)}</span>
            ${dueStr?`<span style="font-size:11px;opacity:0.5;margin-left:6px">${dueStr}</span>`:''}
          </div>
          <span style="font-size:10px;color:${priColors[t.priority]||'#888'};font-weight:bold">${priLabels[t.priority]||''}</span>
          <button onclick="deleteTodo('${esc(t.id)}')" style="font-size:11px;padding:2px 6px;background:#611">✕</button>
        </div>`;
      }).join('');
    } catch (e) { el.innerHTML = '<p class="muted">Yüklenemedi</p>'; }
  }
  window.toggleTodo = async (id, done) => {
    try { await fetch('/api/todos/' + id, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ done }) }); loadTodos(); } catch {}
  };
  window.deleteTodo = async (id) => {
    try { await fetch('/api/todos/' + id, { method: 'DELETE' }); toast('Silindi'); loadTodos(); } catch {}
  };

  // ========== HIZLI İŞ OLUŞTUR ==========
  async function loadQuickJobCustomers() {
    const sel = $('#qjCustomer');
    if (!sel) return;
    try {
      const res = await fetch('/api/crm/customers');
      const d = await res.json();
      if (d.ok && d.customers?.length) {
        sel.innerHTML = '<option value="">Yeni müşteri (aşağıya yaz)...</option>' + d.customers.map(c => `<option value="${esc(c.id)}" data-name="${esc(c.name)}" data-phone="${esc(c.phone)}" data-vehicle="${esc(c.vehicle)}" data-plate="${esc(c.plate)}">${esc(c.name)}${c.plate ? ' (' + esc(c.plate) + ')' : ''}</option>`).join('');
        sel.addEventListener('change', () => {
          const opt = sel.selectedOptions[0];
          if (opt?.value) {
            if ($('#qjName')) $('#qjName').value = opt.dataset.name || '';
            if ($('#qjPhone')) $('#qjPhone').value = opt.dataset.phone || '';
            if ($('#qjVehicle')) $('#qjVehicle').value = opt.dataset.vehicle || '';
            if ($('#qjPlate')) $('#qjPlate').value = opt.dataset.plate || '';
          }
        });
      }
    } catch {}
  }
  async function createQuickJob() {
    const customer_id = $('#qjCustomer')?.value || '';
    const customer_name = $('#qjName')?.value?.trim();
    if (!customer_id && !customer_name) { toast('Müşteri seçin veya yeni müşteri adı girin'); return; }
    const title = $('#qjTitle')?.value?.trim() || 'ECU Tuning';
    const el = $('#qjResult');
    try {
      const res = await fetch('/api/quick-job', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        customer_id, customer_name,
        phone: $('#qjPhone')?.value || '',
        vehicle: $('#qjVehicle')?.value || '',
        plate: $('#qjPlate')?.value || '',
        type: $('#qjType')?.value || 'tuning',
        title,
        price: $('#qjPrice')?.value || 0,
        date: $('#qjDate')?.value || '',
        time: $('#qjTime')?.value || '10:00',
        notes: $('#qjNotes')?.value || '',
        description: ''
      }) });
      const d = await res.json();
      if (d.ok) {
        toast('İş oluşturuldu!');
        if (el) el.innerHTML = `<div style="background:#143;padding:10px;border-radius:8px;margin-top:8px">
          <b style="color:#4f4">✓ Başarıyla oluşturuldu</b><br>
          <span style="font-size:12px">Müşteri: ${esc(customer_name || customer_id)}<br>İş: ${esc(title)}<br>${$('#qjDate')?.value ? 'Randevu: ' + $('#qjDate').value : ''}</span>
        </div>`;
        // Formu temizle
        $('#qjName').value = ''; $('#qjPhone').value = ''; $('#qjVehicle').value = ''; $('#qjPlate').value = '';
        $('#qjTitle').value = ''; $('#qjPrice').value = ''; $('#qjNotes').value = '';
        if ($('#qjCustomer')) $('#qjCustomer').value = '';
        // Listeleri güncelle
        loadQuickJobCustomers();
        loadDashboard();
      } else { if (el) el.innerHTML = '<p style="color:#f44">Hata: ' + esc(d.error) + '</p>'; }
    } catch (e) { if (el) el.innerHTML = '<p style="color:#f44">Hata: ' + esc(e.message) + '</p>'; }
  }

  // ========== MÜŞTERİ RAPORU ==========
  async function loadReportCustomers() {
    const sel = $('#reportCustomer');
    if (!sel) return;
    try {
      const res = await fetch('/api/crm/customers');
      const d = await res.json();
      if (d.ok && d.customers?.length) {
        sel.innerHTML = '<option value="">Müşteri seç...</option>' + d.customers.map(c => `<option value="${esc(c.id)}">${esc(c.name)}${c.plate ? ' (' + esc(c.plate) + ')' : ''}</option>`).join('');
      }
    } catch {}
  }
  async function loadCustomerReport() {
    const cid = $('#reportCustomer')?.value;
    const el = $('#reportResult');
    if (!cid || !el) { toast('Müşteri seçin'); return; }
    try {
      const res = await fetch('/api/customer/report?id=' + encodeURIComponent(cid));
      const d = await res.json();
      if (!d.ok) { el.innerHTML = '<p style="color:#f44">' + esc(d.error) + '</p>'; return; }
      const c = d.customer;
      const s = d.summary;
      let html = `<div style="background:var(--card);padding:12px;border-radius:8px;margin-top:8px">
        <h3 style="margin:0 0 8px">${esc(c.name)}</h3>
        <div style="font-size:13px;opacity:0.7">${c.phone ? '📞 ' + esc(c.phone) + ' · ' : ''}${c.vehicle ? '🚗 ' + esc(c.vehicle) + ' · ' : ''}${c.plate ? '🔖 ' + esc(c.plate) : ''}</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:10px 0">
          <div style="text-align:center;background:#111;padding:6px;border-radius:6px"><div style="font-size:10px;opacity:0.5">TOPLAM İŞ</div><b style="font-size:18px">${s.totalJobs}</b></div>
          <div style="text-align:center;background:#111;padding:6px;border-radius:6px"><div style="font-size:10px;opacity:0.5">TAMAMLANAN</div><b style="font-size:18px;color:#4f4">${s.completedJobs}</b></div>
          <div style="text-align:center;background:#111;padding:6px;border-radius:6px"><div style="font-size:10px;opacity:0.5">TOPLAM HARCAMA</div><b style="font-size:18px;color:var(--accent)">${s.totalSpent.toFixed(2)}€</b></div>
        </div>`;
      // İşler
      if (d.jobs?.length) {
        html += '<h4>🔧 İşler</h4>';
        html += d.jobs.map(j => `<div style="background:#111;padding:6px 8px;border-radius:4px;margin-bottom:3px;font-size:13px">
          ${esc(j.title || j.type)} · ${j.price}${j.currency || '€'} · <span style="color:${j.status === 'completed' ? '#4f4' : 'var(--accent)'}">${esc(j.status)}</span>
        </div>`).join('');
      }
      // İletişim
      if (d.contacts?.length) {
        html += '<h4>📞 Son İletişimler</h4>';
        html += d.contacts.slice(0, 5).map(ct => `<div style="font-size:12px;padding:3px 0;opacity:0.7">
          ${ct.direction === 'incoming' ? '📥' : '📤'} ${new Date(ct.created_at).toLocaleDateString('tr-TR')} — ${esc(ct.summary).slice(0, 80)}
        </div>`).join('');
      }
      html += '</div>';
      el.innerHTML = html;
    } catch (e) { el.innerHTML = '<p style="color:#f44">Hata: ' + esc(e.message) + '</p>'; }
  }

  // ========== MÜŞTERİ İLETİŞİM KAYDI ==========
  async function loadContactCustomers() {
    const sel = $('#contactCustomer');
    if (!sel) return;
    try {
      const res = await fetch('/api/crm/customers');
      const d = await res.json();
      if (d.ok && d.customers?.length) {
        sel.innerHTML = '<option value="">Müşteri seç...</option>' + d.customers.map(c => `<option value="${esc(c.id)}">${esc(c.name)}${c.plate ? ' (' + esc(c.plate) + ')' : ''}</option>`).join('');
      }
    } catch {}
  }
  async function addContact() {
    const customer_id = $('#contactCustomer')?.value;
    const summary = $('#contactSummary')?.value?.trim();
    if (!customer_id) { toast('Müşteri seçin'); return; }
    if (!summary) { toast('Görüşme özeti gerekli'); return; }
    try {
      const res = await fetch('/api/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        customer_id, summary,
        channel: $('#contactChannel')?.value || 'whatsapp',
        direction: $('#contactDir')?.value || 'outgoing'
      }) });
      const d = await res.json();
      if (d.ok) { toast('Kayıt eklendi'); $('#contactSummary').value = ''; loadContacts(); }
      else toast(d.error || 'Hata');
    } catch (e) { toast('Hata: ' + e.message); }
  }
  async function loadContacts() {
    const el = $('#contactList');
    if (!el) return;
    try {
      const res = await fetch('/api/contacts');
      const d = await res.json();
      if (!d.ok || !d.contacts?.length) { el.innerHTML = '<p class="muted">Kayıt yok.</p>'; return; }
      const chIcons = { whatsapp: '💬', telefon: '📞', sms: '📱', 'yüzyüze': '🤝', email: '✉️' };
      el.innerHTML = d.contacts.map(c => {
        const dt = c.created_at ? new Date(c.created_at).toLocaleString('tr-TR') : '';
        return `<div style="background:var(--card);padding:8px 10px;border-radius:6px;margin-bottom:4px;border-left:3px solid ${c.direction === 'incoming' ? '#4af' : '#4f4'}">
          <div style="display:flex;justify-content:space-between;font-size:12px">
            <span>${chIcons[c.channel] || '📋'} <b>${esc(c.customer_name || '?')}</b> ${c.customer_plate ? '(' + esc(c.customer_plate) + ')' : ''}</span>
            <span style="opacity:0.5">${dt}</span>
          </div>
          <p style="margin:4px 0;font-size:13px">${c.direction === 'incoming' ? '📥' : '📤'} ${esc(c.summary)}</p>
          <button onclick="deleteContact('${esc(c.id)}')" style="font-size:10px;padding:1px 6px;background:#611">Sil</button>
        </div>`;
      }).join('');
    } catch (e) { el.innerHTML = '<p class="muted">Yüklenemedi</p>'; }
  }
  window.deleteContact = async (id) => {
    try { await fetch('/api/contacts/' + id, { method: 'DELETE' }); toast('Silindi'); loadContacts(); } catch {}
  };

  // ========== VERİ YEDEKLEME ==========
  async function downloadBackup() {
    const el = $('#backupStatus');
    if (el) el.innerHTML = 'İndiriliyor...';
    try {
      const res = await fetch('/api/export');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'jarvis-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      if (el) el.innerHTML = '<span style="color:#4f4">✓ Yedek indirildi</span>';
      toast('Yedek indirildi');
    } catch (e) { if (el) el.innerHTML = 'Hata: ' + esc(e.message); }
  }

  // ========== FİYAT LİSTESİ ==========
  async function loadPrices() {
    const el = $('#priceList');
    if (!el) return;
    try {
      const res = await fetch('/api/prices');
      const d = await res.json();
      if (!d.ok || !d.prices?.length) { el.innerHTML = '<p class="muted">Fiyat listesi boş.</p>'; return; }
      const catLabels = { tuning: '🔧 Tuning', kodlama: '💻 Kodlama', diagnostik: '🔍 Diagnostik', diger: '📋 Diğer' };
      const grouped = {};
      d.prices.forEach(p => { const cat = p.category || 'diger'; if (!grouped[cat]) grouped[cat] = []; grouped[cat].push(p); });
      let html = '';
      for (const [cat, items] of Object.entries(grouped)) {
        html += `<h4 style="margin:10px 0 6px;color:var(--accent)">${catLabels[cat] || cat}</h4>`;
        html += items.map(p => `<div style="background:var(--card);padding:8px 10px;border-radius:6px;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center">
          <div><b>${esc(p.service)}</b>${p.description ? '<br><span style="font-size:12px;opacity:0.6">' + esc(p.description) + '</span>' : ''}</div>
          <div style="text-align:right"><b style="color:var(--accent);font-size:16px">${p.price}€</b>
            <br><button onclick="deletePrice('${esc(p.id)}')" style="font-size:10px;padding:1px 6px;background:#611">Sil</button></div>
        </div>`).join('');
      }
      el.innerHTML = html;
    } catch (e) { el.innerHTML = '<p class="muted">Yüklenemedi</p>'; }
  }
  async function addPrice() {
    const service = $('#priceService')?.value?.trim();
    const price = parseFloat($('#priceAmount')?.value);
    if (!service || isNaN(price)) { toast('Hizmet adı ve fiyat gerekli'); return; }
    try {
      const res = await fetch('/api/prices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ service, description: $('#priceDesc')?.value || '', price, category: $('#priceCat')?.value || 'tuning' }) });
      const d = await res.json();
      if (d.ok) { toast('Fiyat eklendi'); $('#priceService').value = ''; $('#priceDesc').value = ''; $('#priceAmount').value = ''; loadPrices(); }
      else toast(d.error || 'Hata');
    } catch (e) { toast('Hata: ' + e.message); }
  }
  window.deletePrice = async (id) => {
    if (!confirm('Bu fiyatı silmek istediğinize emin misiniz?')) return;
    try { await fetch('/api/prices/' + id, { method: 'DELETE' }); toast('Silindi'); loadPrices(); } catch {}
  };

  // ========== GELİR/GİDER TAKİBİ ==========
  async function loadTransactions(month) {
    const el = $('#txList');
    const sumEl = $('#txSummary');
    if (!el) return;
    try {
      let url = '/api/transactions';
      if (month) url += '?month=' + encodeURIComponent(month);
      const res = await fetch(url);
      const d = await res.json();
      // Özet kartları
      if (sumEl) {
        const profit = d.profit || 0;
        sumEl.innerHTML = `
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px">
            <div style="background:var(--card);padding:10px;border-radius:8px;text-align:center">
              <div style="font-size:11px;opacity:0.6">GELİR</div>
              <div style="font-size:18px;color:#4f4;font-weight:bold">${(d.income || 0).toFixed(2)}€</div>
            </div>
            <div style="background:var(--card);padding:10px;border-radius:8px;text-align:center">
              <div style="font-size:11px;opacity:0.6">GİDER</div>
              <div style="font-size:18px;color:#f44;font-weight:bold">${(d.expense || 0).toFixed(2)}€</div>
            </div>
            <div style="background:var(--card);padding:10px;border-radius:8px;text-align:center">
              <div style="font-size:11px;opacity:0.6">KÂR</div>
              <div style="font-size:18px;color:${profit >= 0 ? '#4f4' : '#f44'};font-weight:bold">${profit.toFixed(2)}€</div>
            </div>
          </div>`;
      }
      if (!d.ok || !d.transactions?.length) { el.innerHTML = '<p class="muted">Kayıt bulunamadı.</p>'; return; }
      el.innerHTML = d.transactions.map(t => {
        const isIncome = t.type === 'income';
        return `<div style="background:var(--card);padding:8px 10px;border-radius:6px;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;border-left:3px solid ${isIncome ? '#4f4' : '#f44'}">
          <div>
            <span style="font-size:12px;opacity:0.5">${esc(t.date)}</span>
            <b style="margin-left:6px">${isIncome ? '💰' : '💸'} ${esc(t.description || t.category)}</b>
            <span style="font-size:11px;opacity:0.5;margin-left:4px">[${esc(t.category)}]</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <b style="color:${isIncome ? '#4f4' : '#f44'}">${isIncome ? '+' : '-'}${t.amount}€</b>
            <button onclick="deleteTx('${esc(t.id)}')" style="font-size:10px;padding:1px 6px;background:#611">✕</button>
          </div>
        </div>`;
      }).join('');
    } catch (e) { el.innerHTML = '<p class="muted">Yüklenemedi</p>'; }
  }
  async function addTransaction() {
    const amount = parseFloat($('#txAmount')?.value);
    const date = $('#txDate')?.value;
    if (isNaN(amount) || !date) { toast('Tutar ve tarih gerekli'); return; }
    try {
      const res = await fetch('/api/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        type: $('#txType')?.value || 'income',
        amount, date,
        description: $('#txDesc')?.value || '',
        category: $('#txCategory')?.value || 'genel'
      }) });
      const d = await res.json();
      if (d.ok) { toast('Kayıt eklendi'); $('#txAmount').value = ''; $('#txDesc').value = ''; loadTransactions($('#txMonth')?.value); }
      else toast(d.error || 'Hata');
    } catch (e) { toast('Hata: ' + e.message); }
  }
  window.deleteTx = async (id) => {
    if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
    try { await fetch('/api/transactions/' + id, { method: 'DELETE' }); toast('Silindi'); loadTransactions($('#txMonth')?.value); } catch {}
  };

  // ========== İŞ TAKVİMİ ==========
  async function loadCalendarDay() {
    const el = $('#calResult');
    if (!el) return;
    const date = $('#calDate')?.value || new Date().toISOString().slice(0, 10);
    try {
      const res = await fetch('/api/calendar/day?date=' + encodeURIComponent(date));
      const d = await res.json();
      if (!d.ok) { el.innerHTML = '<p class="muted">Hata: ' + esc(d.error) + '</p>'; return; }
      const dayName = new Date(date + 'T12:00:00').toLocaleDateString('tr-TR', { weekday: 'long' });
      let html = `<h3 style="margin:8px 0">${esc(date)} — ${esc(dayName)}</h3>`;

      // Randevular
      if (d.appointments?.length) {
        html += '<h4 style="color:var(--accent)">📅 Randevular</h4>';
        html += d.appointments.map(a => `<div style="background:var(--card);padding:8px;border-radius:6px;margin-bottom:4px">
          <b>${esc(a.time||'')} — ${esc(a.title)}</b>
          ${a.customer_name?` · <span style="opacity:0.7">${esc(a.customer_name)}</span>`:''}
          ${a.customer_plate?` <span style="opacity:0.5">(${esc(a.customer_plate)})</span>`:''}
          <span style="font-size:11px;color:${a.status==='completed'?'#4f4':a.status==='cancelled'?'#f44':'var(--accent)'}">[${esc(a.status)}]</span>
        </div>`).join('');
      } else html += '<p class="muted">Bu gün randevu yok.</p>';

      // İşler
      if (d.jobs?.length) {
        html += '<h4 style="color:var(--accent)">🔧 İşler</h4>';
        html += d.jobs.map(jj => `<div style="background:var(--card);padding:8px;border-radius:6px;margin-bottom:4px">
          <b>${esc(jj.title||jj.type)}</b> · ${esc(jj.customer_name||'?')} · ${jj.price}${jj.currency||'€'}
          <span style="font-size:11px;color:${jj.status==='completed'?'#4f4':'var(--accent)'}">[${esc(jj.status)}]</span>
        </div>`).join('');
      } else html += '<p class="muted">Bu gün iş kaydı yok.</p>';

      // Yapılacaklar
      if (d.todos?.length) {
        html += '<h4 style="color:var(--accent)">✅ Yapılacaklar</h4>';
        html += d.todos.map(t => `<div style="background:var(--card);padding:6px 8px;border-radius:6px;margin-bottom:4px;opacity:${t.done?'0.5':'1'}">
          ${t.done?'☑':'☐'} ${esc(t.text)}
        </div>`).join('');
      }

      el.innerHTML = html;
    } catch (e) { el.innerHTML = '<p class="muted">Yüklenemedi: ' + esc(e.message) + '</p>'; }
  }

  // Sayfa açıldığında listeleri yükle
  const settingsBtn = document.querySelector('[data-page="settings"]');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      setTimeout(() => {
        if (typeof loadLearnList === 'function') loadLearnList();
        if (typeof loadSocialJobs === 'function') loadSocialJobs();
        loadInvoiceList();
        loadCustomerList();
        loadJobList();
        loadAppointmentList();
        loadAppointmentCustomers();
        loadDashboard();
        loadNotes();
        loadTodos();
        loadPrices();
        loadTransactions();
        loadContactCustomers();
        loadContacts();
        loadQuickJobCustomers();
        loadReportCustomers();
      }, 300);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
