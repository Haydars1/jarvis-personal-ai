// Local-first video sampling: MP4 bytes never leave this browser.
(() => {
  const byId = id => document.getElementById(id);
  const fileInput = byId('skillVideoFile');
  if (!fileInput) return;
  const status = byId('skillVideoStatus');
  const candidates = byId('skillVideoCandidates');
  const copyButton = byId('skillVideoCopyForChatGPT');
  let lastRecord = null;
  const history = byId('skillVideoHistory');
  const analyzeButton = byId('skillVideoAnalyze');
  const saveButton = byId('skillVideoSaveNotes');
  const transcript = byId('skillVideoTranscript');
  const subtitleInput = byId('skillSubtitleFile');
  const notes = byId('skillVideoNotes');
  const setStatus = value => { status.textContent = String(value || ''); };

  async function call(path, body) {
    const response = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(value.error || ('HTTP ' + response.status));
    return value;
  }

  function eventOnce(target, event, timeout = 12000) {
    return new Promise((resolve, reject) => {
      const done = (error) => {
        clearTimeout(timer);
        target.removeEventListener(event, yes);
        target.removeEventListener('error', no);
        if (error) reject(error); else resolve();
      };
      const yes = () => done();
      const no = () => done(new Error('VIDEO_READ_ERROR'));
      const timer = setTimeout(() => done(new Error('VIDEO_DECODE_TIMEOUT')), timeout);
      target.addEventListener(event, yes, { once: true });
      target.addEventListener('error', no, { once: true });
    });
  }

  async function sampleFrames(file) {
    if (!file || !file.type.startsWith('video/') && !/\.(mp4|mov|m4v|webm)$/i.test(file.name))
      throw new Error('VIDEO_FILE_REQUIRED');
    if (file.size > 500 * 1024 * 1024) throw new Error('VIDEO_FILE_TOO_LARGE_FOR_DEVICE');
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    try {
      const ready = eventOnce(video, 'loadedmetadata', 20000);
      video.src = url;
      video.load();
      await ready;
      const duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0 || !video.videoWidth || !video.videoHeight)
        throw new Error('VIDEO_METADATA_UNSUPPORTED');
      const count = Math.min(6, Math.max(1, Math.ceil(duration / 4)));
      const width = Math.min(640, video.videoWidth);
      const height = Math.round(width * video.videoHeight / video.videoWidth);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('VIDEO_CANVAS_UNAVAILABLE');
      const frames = [];
      for (let index = 0; index < count; index++) {
        const second = Math.max(0, Math.min(duration - 0.02, duration * (index + 0.5) / count));
        setStatus('Kare ' + (index + 1) + '/' + count + ' hazırlanıyor…');
        const seeked = eventOnce(video, 'seeked', 12000);
        video.currentTime = second;
        await seeked;
        ctx.drawImage(video, 0, 0, width, height);
        const encoded = canvas.toDataURL('image/jpeg', 0.65).split(',')[1];
        if (!encoded || encoded.length > 550000) throw new Error('VIDEO_FRAME_TOO_LARGE');
        frames.push({ timestamp_sec: Math.round(second * 100) / 100, mime: 'image/jpeg', data: encoded });
      }
      return frames;
    } finally {
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
    }
  }

  function showRecord(record, vision) {
    lastRecord = record;
    copyButton.disabled = !(record?.candidates?.length);
    candidates.replaceChildren();
    const heading = document.createElement('p');
    heading.textContent = (record.candidates || []).length + ' araç adayı bulundu. Hiçbiri otomatik kurulmadı.';
    candidates.appendChild(heading);
    if (vision) {
      const info = document.createElement('small');
      info.textContent = 'Görüntü analizi: ' + vision.provider;
      candidates.appendChild(info);
    }
    for (const skill of record.candidates || []) {
      const item = document.createElement('div');
      item.className = 'learnItem';
      const title = document.createElement('b');
      title.textContent = skill.name + ' • ' + skill.capability + ' • risk: ' + skill.risk;
      const evidence = document.createElement('p');
      evidence.className = 'muted';
      evidence.textContent = 'Kanıt: ' + skill.evidence;
      const next = document.createElement('small');
      next.textContent = 'Durum: aday / yüklenmedi. ' + skill.jarvis.next_step;
      item.append(title, evidence, next);
      candidates.appendChild(item);
    }
  }

  async function refreshHistory() {
    const data = await call('/api/learning/video-skills');
    history.replaceChildren();
    for (const record of (data.records || []).slice(0, 10)) {
      const item = document.createElement('div');
      item.className = 'learnItem';
      item.textContent = record.title + ' · ' + (record.candidates || []).length + ' aday · kurulum yapılmadı';
      item.style.cursor = 'pointer';
      item.title = 'Araç adaylarını görüntüle';
      item.addEventListener('click', () => showRecord(record));
      history.appendChild(item);
    }
    if (!history.childNodes.length) history.textContent = 'Henüz video kaydı bulunmuyor.';
  }

  function extractSubtitleText(source) {
    return String(source || '').replace(/^\uFEFF/, '').split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !/^(WEBVTT|Kind:|Language:|STYLE|REGION|NOTE\b)/i.test(line)
        && !/^\d+$/.test(line)
        && !/^(?:\d{2}:)?\d{2}:\d{2}[.,]\d{3}\s*-->/.test(line))
      .map(line => line.replace(/<[^>]*>/g, '').trim())
      .filter(Boolean).join(' ').slice(0, 40000);
  }
  subtitleInput.addEventListener('change', async () => {
    const file = subtitleInput.files?.[0];
    if (!file) return;
    try {
      if (!/\.(srt|vtt|txt)$/i.test(file.name) || file.size > 120000)
        throw new Error('Yalnız .srt/.vtt/.txt ve en fazla 120 KB');
      const parsed = extractSubtitleText(await file.text());
      if (!parsed) throw new Error('Altyazıdan metin çıkarılamadı');
      transcript.value = parsed;
      setStatus('Altyazı aktarıldı (' + parsed.length + ' karakter). Analiz veya kaydet butonuna bas.');
    } catch (error) {
      setStatus('Altyazı alınamadı: ' + error.message);
    }
  });

  copyButton.addEventListener('click', async () => {
    if (!lastRecord?.candidates?.length) return;
    const lines = [
      'Bu araçlar bir videoda isim olarak tespit edildi; hiçbirinin kurulumu veya çalıştığı doğrulanmadı.',
      'Lütfen ChatGPT eklentilerinde mevcut bağlantılarla eşleştir; resmi bir eklenti varsa göster.',
      'Eksik bağlantıları benim onayım olmadan kurma ve canlı sisteme müdahale etme.',
      ...lastRecord.candidates.map(skill =>
        '- ' + skill.name + ' | kanıt: ' + String(skill.evidence || '').slice(0, 180) + ' | risk: ' + skill.risk)
    ];
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Pano izni kullanılamıyor');
      await navigator.clipboard.writeText(lines.join('\n'));
      setStatus('Araç listesi kopyalandı. ChatGPT sohbetine yapıştırabilirsin; otomatik gönderim yapılmadı.');
    } catch (error) {
      setStatus('Kopyalama başarısız: ' + error.message);
    }
  });

  function bodyText() {
    return {
      title: fileInput.files?.[0]?.name || subtitleInput.files?.[0]?.name || 'Video notları',
      transcript: transcript.value.trim(),
      notes: notes.value.trim()
    };
  }
  function busy(state) { analyzeButton.disabled = state; saveButton.disabled = state; }

  analyzeButton.addEventListener('click', async () => {
    busy(true);
    try {
      const file = fileInput.files?.[0];
      if (!file) throw new Error('Önce video seç.');
      const frames = await sampleFrames(file);
      setStatus('Kareler AI ile inceleniyor; MP4 aktarılmıyor…');
      const result = await call('/api/learning/video-skills/from-frames', { ...bodyText(), frames });
      showRecord(result.record, result.vision);
      setStatus('Analiz kaydedildi: ' + result.analyzed_frames + ' kare. Yeni eklenti kurulmadı.');
      await refreshHistory();
    } catch (error) { setStatus('Analiz başarısız: ' + error.message + '. Gemini görsel bağlantısını ve video formatını kontrol et. Metin notlarını ayrıca kaydedebilirsin.'); }
    finally { busy(false); }
  });
  saveButton.addEventListener('click', async () => {
    busy(true);
    try {
      const body = bodyText();
      if (!body.transcript && !body.notes) throw new Error('Not veya transkript gerekli.');
      setStatus('Metin notları kaydediliyor…');
      const result = await call('/api/learning/video-skills', body);
      showRecord(result.record);
      setStatus('Metin kaydedildi. Kare/ses analizi yapılmadı; araçlar yalnızca metinden önerildi.');
      await refreshHistory();
    } catch (error) { setStatus('Kaydetme başarısız: ' + error.message); }
    finally { busy(false); }
  });
  window.addEventListener('video-skill-saved', event => {
    if (event.detail?.record) {
      showRecord(event.detail.record);
      refreshHistory().catch(() => {});
    }
  });
  fileInput.closest('details')?.addEventListener('toggle', event => {
    if (event.target.open) refreshHistory().catch(error => setStatus('Kaynak listesi: ' + error.message));
  });
})();
