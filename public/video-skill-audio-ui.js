// Browser-local decoding. Only an explicitly requested, short PCM audio excerpt reaches Cloudflare AI.
(() => {
  const el = id => document.getElementById(id);
  const button = el('skillVideoTranscribe');
  if (!button) return;
  const video = el('skillVideoFile');
  const audio = el('skillVideoAudioFile');
  const status = el('skillVideoStatus');
  const notes = el('skillVideoNotes');
  const transcript = el('skillVideoTranscript');
  const range = el('skillVideoAudioRange');
  const providers = el('skillVideoProviders');

  function wavBase64(buffer, startSecond = 0, duration = 30) {
    const seconds = Math.min(30, duration, Math.max(0, (Number(buffer.duration) || 0) - startSecond));
    const count = Math.floor(seconds * 16000);
    if (count < 1600) throw new Error('Ses çok kısa');
    const array = new ArrayBuffer(44 + count * 2);
    const view = new DataView(array);
    const write = (offset, word) => {
      for (let i = 0; i < word.length; i++) view.setUint8(offset + i, word.charCodeAt(i));
    };
    write(0, 'RIFF');
    view.setUint32(4, 36 + count * 2, true);
    write(8, 'WAVE');
    write(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 16000, true);
    view.setUint32(28, 32000, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    write(36, 'data');
    view.setUint32(40, count * 2, true);

    const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
    if (!channels.length) throw new Error('Ses kanalı bulunamadı');
    for (let i = 0; i < count; i++) {
      const x = startSecond * buffer.sampleRate + i * buffer.sampleRate / 16000;
      const left = Math.floor(x);
      const fraction = x - left;
      let sample = 0;
      for (const channel of channels) {
        const a = channel[Math.min(left, channel.length - 1)] || 0;
        const b = channel[Math.min(left + 1, channel.length - 1)] || 0;
        sample += a + (b - a) * fraction;
      }
      sample = Math.max(-1, Math.min(1, sample / channels.length));
      view.setInt16(44 + i * 2, sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767), true);
    }
    const bytes = new Uint8Array(array);
    let binary = '';
    for (let at = 0; at < bytes.length; at += 8192) {
      binary += String.fromCharCode(...bytes.subarray(at, at + 8192));
    }
    return btoa(binary);
  }

  async function getDecodedAudio(file) {
    if (file.size > 40 * 1024 * 1024) throw new Error('Bu tarayıcıda ses çözme sınırı 40 MB. Daha küçük bir ses dosyası seç.');
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) throw new Error('Tarayıcının ses çözme desteği bulunamadı');
    const context = new Context();
    try {
      const bytes = await file.arrayBuffer();
      const decoded = await context.decodeAudioData(bytes);
      return decoded;
    } catch {
      throw new Error('Bu video/ses formatı tarayıcıda çözülemiyor. Videodan çıkarılmış bir WAV, MP3 veya M4A ses dosyası seç.');
    } finally {
      if (context.state !== 'closed') await context.close().catch(() => {});
    }
  }

  async function providerStatus() {
    try {
      const response = await fetch('/api/learning/video-skills/providers', { credentials: 'same-origin' });
      if (!response.ok) throw new Error('Bağlantı bilgisi alınamadı (' + response.status + ')');
      const info = await response.json();
      const whisper = info.cloudflare_ai_bound ? 'AI bağlantısı mevcut (model test edilmedi)' : 'AI bağlantısı yok';
      const gemini = info.gemini_configured === true ? 'Gemini hesabı yapılandırılmış' :
        info.gemini_configured === false ? 'Gemini hesabı bulunamadı' : 'Gemini bilgisi okunamadı';
      providers.textContent = 'Cloudflare Whisper: ' + whisper + ' · Görüntü analizi: ' + gemini;
    } catch (error) {
      providers.textContent = 'Sağlayıcı kontrolü başarısız: ' + error.message;
    }
  }
  audio.closest('details')?.addEventListener('toggle', event => {
    if (event.target.open) providerStatus();
  });

  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const file = audio.files?.[0] || video.files?.[0];
      if (!file) throw new Error('Video veya ses dosyası seç.');
      status.textContent = 'Seçilen ses cihazda çözümleniyor…';
      const decoded = await getDecodedAudio(file);
      const requested = Number(range.value) === 120 ? 120 : 30;
      const totalSeconds = Math.min(requested, decoded.duration);
      let count = Math.ceil(totalSeconds / 30);
      // Skip a tiny trailing slice which would otherwise fail the minimum audio validation.
      if (count > 1 && totalSeconds - (count - 1) * 30 < 0.25) count--;
      if (!count) throw new Error('Ses bulunamadı');
      if (count > 1 && !window.confirm('Bu işlem ' + count +
        ' ayrı Cloudflare Whisper çağrısı yapacak; kullanım kotası tüketilebilir. Devam edilsin mi?')) {
        status.textContent = 'Çok parçalı ses çözümleme iptal edildi; AI çağrısı yapılmadı.';
        return;
      }
      const lines = [];
      for (let i = 0; i < count; i++) {
        const startSec = i * 30;
        status.textContent = 'Ses bölümü ' + (i + 1) + '/' + count + ' inceleniyor…';
        const data = wavBase64(decoded, startSec, Math.min(30, totalSeconds - startSec));
        const response = await fetch('/api/learning/video-skills/from-audio', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ data, save: false, language: '' })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error('Bölüm ' + (i + 1) + ': ' + (result.error || 'HTTP ' + response.status));
        const spoken = String(result.transcript || '').trim();
        if (spoken) lines.push('[' + Math.floor(startSec / 60) + ':' +
          String(startSec % 60).padStart(2, '0') + '] ' + spoken);
      }
      if (!lines.length) throw new Error('Seçilen aralıkta konuşma bulunamadı');
      const combined = [transcript.value.trim(), ...lines].filter(Boolean).join('\n').slice(0, 49000);
      status.textContent = 'Konuşmalar birleştirildi; öğrenme hafızasına kaydediliyor…';
      const saved = await fetch('/api/learning/video-skills', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: file.name,
          notes: notes.value.trim().slice(0, 40000),
          transcript: combined
        })
      });
      const stored = await saved.json().catch(() => ({}));
      if (!saved.ok) throw new Error(stored.error || 'Öğrenme kaydedilemedi');
      transcript.value = combined.slice(0, 40000);
      status.textContent = 'Sesin ' + totalSeconds.toFixed(1) + ' saniyesi ' + count +
        ' bölümde işlendi ve tek kayda eklendi. Kurulum yapılmadı.';
      window.dispatchEvent(new CustomEvent('video-skill-saved', { detail: { record: stored.record } }));
    } catch (error) {
      status.textContent = 'Ses çözümleme başarısız: ' + error.message + '. Eksik bölüm varsa kayıt tamamlanmadı.';
    } finally { button.disabled = false; }
  });
})();
