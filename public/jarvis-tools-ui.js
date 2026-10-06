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

  // Sayfa açıldığında listeleri yükle
  const settingsBtn = document.querySelector('[data-page="settings"]');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      setTimeout(() => {
        loadLearnList();
        loadSocialJobs();
      }, 300);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
