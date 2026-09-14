import { execute, jsonResponse, queryOne } from '../../lib/runtime.js';

function mediaIntent(text = '') {
  const value = String(text || '').toLowerCase();
  const action = /(göster|bul|ara|getir|oluştur|çiz|üret|hazırla|istiyorum|isterim|görmek|izlemek)/i.test(value);
  return {
    image: action && /(foto|fotoğraf|resim|görsel|şema|diagram|image|logo|amblem|emblem|teknik çizim|exploded)/i.test(value),
    video: action && /(video|youtube|klip|reels?|animasyon)/i.test(value),
    generateImage: /(oluştur|çiz|üret|hazırla)/i.test(value) && /(foto|fotoğraf|resim|görsel|şema|diagram|image|logo|amblem|emblem)/i.test(value)
  };
}

function limitation(text = '') {
  return /(yapamıyorum|yapamam|üretemiyorum|üretemem|gösteremiyorum|gösteremem|doğrudan .* yapamam|doğrudan .* üretemiyorum|görsel .* yok|video .* yok|cannot (generate|create|show|produce)|i can.?t (generate|create|show|produce)|bu özelliğe sahip değilim)/i.test(String(text || ''));
}

function stripRefusal(text = '') {
  return String(text || '')
    .replace(/(^|\n)[^\n]*(?:yapamıyorum|yapamam|üretemiyorum|üretemem|gösteremiyorum|gösteremem|cannot generate|i can.?t generate)[^\n]*/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function google(core, req, env, ctx, query, type = '') {
  const url = new URL('/api/google-search', req.url);
  url.searchParams.set('q', query);
  url.searchParams.set('num', '6');
  if (type) url.searchParams.set('type', type);
  const response = await core.fetch(new Request(url, { headers: req.headers }), env, ctx);
  if (!response.ok) return [];
  try { return (await response.json()).results || []; } catch { return []; }
}

async function illustrativeImage(env, text) {
  if (!env.AI) return null;
  try {
    const prompt = `Educational technical illustration for the user's request: ${String(text).slice(0, 1400)}. Clear labeled schematic style, realistic mechanical context, no misleading claim of being an OEM service-manual drawing.`;
    const result = await env.AI.run('@cf/black-forest-labs/flux-1-schnell', { prompt, steps: 4 });
    const base64 = String(result?.image || result?.result?.image || '').trim();
    if (!base64) return null;
    return {
      type: 'image',
      src: `data:image/jpeg;base64,${base64}`,
      alt: 'JARVIS tarafından oluşturulan temsili teknik şema',
      label: 'Temsili AI şeması'
    };
  } catch {
    return null;
  }
}

async function replaceLatestAssistant(env, text, provider) {
  try {
    const row = await queryOne(env, "SELECT id FROM chat_messages WHERE role='assistant' ORDER BY created_at DESC LIMIT 1");
    if (row?.id) {
      await execute(env, 'UPDATE chat_messages SET content=?,provider=? WHERE id=?', text, provider, row.id);
    }
  } catch {}
}

export function createMediaRescue(core) {
  if (!core?.fetch) throw new Error('MEDIA_CORE_FETCH_REQUIRED');

  return async function handleMediaRescue(req, env, ctx) {
    let text = '';
    try { text = String((await req.clone().json())?.text || ''); } catch {}
    const wanted = mediaIntent(text);
    const response = await core.fetch(req, env, ctx);
    if (!response.ok) return response;

    let payload;
    try { payload = await response.clone().json(); } catch { return response; }
    const limited = limitation(payload?.reply || '');
    if (!wanted.image && !wanted.video && !limited) return response;

    const resources = [];
    const media = Array.isArray(payload.media) ? [...payload.media] : [];
    const trace = Array.isArray(payload.trace) ? [...payload.trace] : [];

    if (wanted.image || limited) {
      const images = await google(core, req, env, ctx, `${text} teknik şema fotoğraf`, 'image');
      for (const image of images.slice(0, 5)) {
        resources.push({
          type: 'image-resource',
          title: image.title,
          url: image.contextUrl || image.url,
          image: image.thumbnail || image.url,
          snippet: image.snippet || '',
          source: 'Google Images'
        });
      }
      if ((wanted.generateImage || !images.length) && wanted.image) {
        const generated = await illustrativeImage(env, text);
        if (generated) media.push(generated);
      }
      if (images.length) {
        trace.push({ kind: 'capability', label: 'Görsel desteği', value: `Google Görseller'den ${Math.min(5, images.length)} sonuç getirildi` });
      }
    }

    if (wanted.video) {
      const videos = await google(core, req, env, ctx, `site:youtube.com ${text} teknik video`);
      for (const video of videos.slice(0, 5)) {
        resources.push({
          type: 'video-resource',
          title: video.title,
          url: video.url,
          snippet: video.snippet || '',
          source: 'Google / YouTube'
        });
      }
      if (videos.length) {
        trace.push({ kind: 'capability', label: 'Video desteği', value: `${Math.min(5, videos.length)} ilgili video bulundu` });
      }
    }

    let useful = stripRefusal(payload.reply || '');
    const resultCount = resources.length + media.length;
    if (resultCount) {
      const prefix = 'Tek bir modelin “yapamıyorum” cevabında durmadım; diğer yetenekleri otomatik devreye aldım.';
      useful = `${prefix}${useful ? `\n\n${useful}` : ''}\n\nAşağıda bulduğum görsel/video kaynaklarını gösteriyorum.`;
      payload.reply = useful;
      payload.provider = `${payload.provider ? `${String(payload.provider)} · ` : ''}Capability Rescue`;
      payload.resources = resources;
      payload.media = media;
      payload.trace = trace;
      await replaceLatestAssistant(env, payload.reply, payload.provider);
      return jsonResponse(payload, response.status);
    }

    if (limited) {
      payload.reply = `${useful ? `${useful}\n\n` : ''}Bu yetenek için bağlı sağlayıcı bulunamadı. JARVIS bunu başarısızlık olarak işaretledi; uygun medya sağlayıcısı bağlandığında otomatik devreye girecek.`;
      payload.provider = `${payload.provider ? `${String(payload.provider)} · ` : ''}Capability Rescue`;
      payload.trace = trace;
      await replaceLatestAssistant(env, payload.reply, payload.provider);
      return jsonResponse(payload, response.status);
    }

    return response;
  };
}
