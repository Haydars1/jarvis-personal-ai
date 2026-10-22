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

  function wavBase64(buffer) {
    const seconds = Math.min(30, Number(buffer.duration) || 0);
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
      const x = i * buffer.sampleRate / 16000;
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

  async function getWavExcerpt(file) {
    if (file.size > 40 * 1024 * 1024) throw new Error('Bu tarayıcıda ses çözme sınırı 40 MB. Daha küçük bir ses dosyası seç.');
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) throw new Error('Tarayıcının ses çözme desteği bulunamadı');
    const context = new Context();
    try {
      const bytes = await file.arrayBuffer();
      const decoded = await context.decodeAudioData(bytes);
      return wavBase64(decoded);
    } catch {
      throw new Error('Bu video/ses formatı tarayıcıda çözülemiyor. Videodan çıkarılmış bir WAV, MP3 veya M4A ses dosyası seç.');
    } finally {
      if (context.state !== 'closed') await context.close().catch(() => {});
    }
  }

  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const file = audio.files?.[0] || video.files?.[0];
      if (!file) throw new Error('Video veya ses dosyası seç.');
      status.textContent = 'İlk 30 saniyenin sesi yerel olarak çözümleniyor…';
      const data = await getWavExcerpt(file);
      status.textContent = 'Kısa ses örneği Cloudflare Whisper ile çözümleniyor…';
      const response = await fetch('/api/learning/video-skills/from-audio', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: file.name,
          notes: notes.value.trim(),
          transcript: transcript.value.trim(),
          language: '',
          data
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'HTTP ' + response.status);
      transcript.value = [transcript.value.trim(), result.transcript].filter(Boolean).join('\n').slice(0, 40000);
      status.textContent = 'İlk ' + Number(result.transcribed_audio_seconds).toFixed(1) +
        ' saniye çözümlendi ve kaydedildi; araçlar yalnızca adaydır.';
      window.dispatchEvent(new CustomEvent('video-skill-saved', { detail: { record: result.record } }));
    } catch (error) {
      status.textContent = 'Ses çözümleme başarısız: ' + error.message;
    } finally {
      button.disabled = false;
    }
  });
})();
