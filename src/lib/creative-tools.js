// JARVIS Creative Tools — görsel + video + ses üretim araçları
// Tüm modeller Cloudflare AI free tier veya açık kaynak

// ========== CLOUDFLARE AI MODELLERİ ==========
export const IMAGE_MODELS = {
  'flux-schnell':    { id: '@cf/black-forest-labs/FLUX.1-schnell', name: 'Flux Schnell', speed: 'hızlı', quality: 'yüksek', steps: 4 },
  'sdxl-lightning':  { id: '@cf/bytedance/stable-diffusion-xl-lightning', name: 'SDXL Lightning', speed: 'çok hızlı', quality: 'iyi', steps: 1 },
  'sdxl-base':       { id: '@cf/stabilityai/stable-diffusion-xl-base-1.0', name: 'SDXL Base', speed: 'yavaş', quality: 'en iyi', steps: 20 },
  'dreamshaper':     { id: '@cf/lykon/dreamshaper-8-lcm', name: 'DreamShaper 8', speed: 'hızlı', quality: 'yaratıcı', steps: 8 }
};

// Görsel anlama
export const VISION_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';

// Whisper (ses → metin)
export const WHISPER_MODEL = '@cf/openai/whisper-large-v3-turbo';

// ========== GÖRSEL STİLLERİ ==========
export const IMAGE_STYLES = {
  'automotive':     'Professional automotive photography, studio lighting, dark metallic background, premium car detail',
  'tuning':         'ECU tuning workshop, diagnostic screen, dark tech aesthetic, blue accent lighting',
  'social':         'Eye-catching social media post, bold colors, clean modern design, engaging',
  'thumbnail':      'YouTube thumbnail style, dramatic lighting, high contrast, bold text space',
  'minimal':        'Minimalist design, clean white space, subtle shadows, professional',
  'carglanz':       'Premium vehicle detailing, ceramic coating shine, close-up paint reflection, luxury feel',
  'before-after':   'Split comparison view, left side dirty/damaged, right side clean/repaired, dramatic difference',
  'technical':      'Technical diagram style, blueprint aesthetic, dark background, cyan grid lines',
  'cinematic':      'Cinematic wide shot, moody lighting, film grain, dramatic atmosphere'
};

// ========== PROMPT ENRİCHMENT ==========
export function enrichPrompt(prompt, style = 'automotive', platform = 'instagram_reels') {
  const styleText = IMAGE_STYLES[style] || IMAGE_STYLES.automotive;
  const aspectHint = platform.includes('reels') || platform.includes('shorts') 
    ? 'vertical 9:16 composition' 
    : platform.includes('post') ? 'square 1:1 composition' : 'horizontal 16:9 composition';
  return `${styleText}. ${aspectHint}. ${prompt}. High quality, 4K detail, professional.`;
}

// ========== GÖRSEL ÜZERİNE YAZI (SVG overlay → PNG) ==========
// Workers'da canvas yok ama SVG render yapabiliriz
export function textOverlaySvg({ width = 1080, height = 1920, text = '', subtext = '', bgColor = '#0a0a0a', textColor = '#ffffff', accentColor = '#31dfff', position = 'center' } = {}) {
  const fontSize = Math.min(width / 10, 72);
  const subFontSize = Math.min(width / 16, 36);
  const lines = wordWrap(text, Math.floor(width / (fontSize * 0.55)));
  const subLines = subtext ? wordWrap(subtext, Math.floor(width / (subFontSize * 0.55))) : [];
  
  const totalHeight = lines.length * fontSize * 1.3 + subLines.length * subFontSize * 1.3 + 40;
  const yStart = position === 'top' ? fontSize * 2 
    : position === 'bottom' ? height - totalHeight - fontSize 
    : (height - totalHeight) / 2;

  let textSvg = '';
  lines.forEach((line, i) => {
    textSvg += `<text x="${width/2}" y="${yStart + i * fontSize * 1.3}" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-weight="900" font-size="${fontSize}" fill="${textColor}" letter-spacing="0.02em">${escXml(line)}</text>`;
  });
  subLines.forEach((line, i) => {
    textSvg += `<text x="${width/2}" y="${yStart + lines.length * fontSize * 1.3 + 20 + i * subFontSize * 1.3}" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-weight="600" font-size="${subFontSize}" fill="${accentColor}">${escXml(line)}</text>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="${bgColor}" opacity="0.7"/>
    ${textSvg}
  </svg>`;
}

function wordWrap(text, maxChars) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxChars && current) {
      lines.push(current.trim());
      current = word;
    } else {
      current += ' ' + word;
    }
  }
  if (current.trim()) lines.push(current.trim());
  return lines;
}

function escXml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ========== BEFORE/AFTER KARŞILAŞTIRMA ==========
// İki görseli yan yana SVG frame'e koy
export function beforeAfterSvg({ width = 1080, height = 1080, beforeLabel = 'ÖNCE', afterLabel = 'SONRA' } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <clipPath id="leftHalf"><rect x="0" y="0" width="${width/2-2}" height="${height}"/></clipPath>
      <clipPath id="rightHalf"><rect x="${width/2+2}" y="0" width="${width/2-2}" height="${height}"/></clipPath>
    </defs>
    <rect width="${width}" height="${height}" fill="#0a0a0a"/>
    <image id="beforeImg" clip-path="url(#leftHalf)" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>
    <image id="afterImg" clip-path="url(#rightHalf)" width="${width}" height="${height}" x="0" preserveAspectRatio="xMidYMid slice"/>
    <line x1="${width/2}" y1="0" x2="${width/2}" y2="${height}" stroke="#31dfff" stroke-width="4"/>
    <rect x="20" y="${height-60}" width="120" height="36" rx="8" fill="#ff557888"/>
    <text x="80" y="${height-36}" text-anchor="middle" font-family="Inter,sans-serif" font-weight="900" font-size="16" fill="white">${escXml(beforeLabel)}</text>
    <rect x="${width-140}" y="${height-60}" width="120" height="36" rx="8" fill="#35df9a88"/>
    <text x="${width-80}" y="${height-36}" text-anchor="middle" font-family="Inter,sans-serif" font-weight="900" font-size="16" fill="white">${escXml(afterLabel)}</text>
  </svg>`;
}

// ========== HASHTAG ÜRETİCİ ==========
export function generateHashtags(topic, platform = 'instagram', count = 15) {
  const base = ['jarvis', 'ai', 'otomasyon'];
  const auto = ['araç', 'otomotiv', 'car', 'automotive', 'tuning', 'chiptuning', 'ecu', 'ecutuning', 'stage1', 'dpfoff', 'egroff'];
  const detailing = ['detailing', 'ceramiccoating', 'carcare', 'araçbakım', 'polisaj', 'carglanz'];
  const social = ['reels', 'trending', 'viral', 'keşfet', 'fyp'];
  
  const topicWords = topic.toLowerCase().replace(/[^a-zA-ZğüşıöçĞÜŞİÖÇ0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
  
  let pool = [...base];
  if (/ecu|tuning|chip|stage|dpf|egr|adblue/i.test(topic)) pool.push(...auto);
  if (/detailing|polish|coating|ceramic|carglanz|bakım|temizlik/i.test(topic)) pool.push(...detailing);
  pool.push(...social.slice(0, 3));
  pool.push(...topicWords.slice(0, 5));
  
  const unique = [...new Set(pool)].slice(0, count);
  return unique.map(t => '#' + t.replace(/\s+/g, '')).join(' ');
}

// ========== İÇERİK TAKVİMİ ÜRETİCİ ==========
export function generateContentCalendar(topic, weeks = 4, postsPerWeek = 3) {
  const themes = [
    { day: 'Pazartesi', type: 'Eğitim', template: 'Nasıl yapılır / adım adım' },
    { day: 'Çarşamba', type: 'Showcase', template: 'Proje/sonuç gösterimi' },
    { day: 'Cuma', type: 'İpucu', template: 'Kısa tip / bilgi' },
    { day: 'Salı', type: 'Karşılaştırma', template: 'Before/after veya A vs B' },
    { day: 'Perşembe', type: 'Soru-Cevap', template: 'Sık sorulan sorular' },
    { day: 'Cumartesi', type: 'Behind the scenes', template: 'Çalışma ortamı / süreç' },
    { day: 'Pazar', type: 'Motivasyon', template: 'Hafta özeti veya motivasyon' }
  ];
  
  const plan = [];
  for (let w = 1; w <= weeks; w++) {
    const weekPosts = themes.slice(0, postsPerWeek).map(t => ({
      week: w,
      day: t.day,
      type: t.type,
      template: t.template,
      topic: `${topic} — ${t.template}`
    }));
    plan.push(...weekPosts);
  }
  return plan;
}

// ========== EDGE TTS (ücretsiz seslendirme) ==========
// Edge TTS doğrudan Workers'da çalışmaz (WebSocket + binary stream)
// Ama GitHub Actions runner'da edge-tts Python paketi ile çalışır
export const TTS_VOICES = {
  'tr-TR-AhmetNeural': { lang: 'tr', gender: 'male', name: 'Ahmet' },
  'tr-TR-EmelNeural':  { lang: 'tr', gender: 'female', name: 'Emel' },
  'de-DE-ConradNeural': { lang: 'de', gender: 'male', name: 'Conrad' },
  'de-DE-KatjaNeural':  { lang: 'de', gender: 'female', name: 'Katja' },
  'en-US-GuyNeural':    { lang: 'en', gender: 'male', name: 'Guy' },
  'en-US-JennyNeural':  { lang: 'en', gender: 'female', name: 'Jenny' }
};

// GitHub Actions workflow — TTS + video birleştirme
export const TTS_VIDEO_WORKFLOW = `
name: JARVIS TTS Video
on:
  workflow_dispatch:
    inputs:
      job_id:
        required: true
      jarvis_url:
        required: true

jobs:
  render:
    runs-on: ubuntu-latest
    steps:
      - name: Setup
        run: |
          sudo apt-get update && sudo apt-get install -y ffmpeg
          pip install edge-tts

      - name: Fetch, TTS, render
        env:
          JOB_ID: \${{ inputs.job_id }}
          JARVIS_URL: \${{ inputs.jarvis_url }}
        run: |
          JOB=$(curl -s "$JARVIS_URL/api/video/job?id=$JOB_ID")
          
          # Görselleri indir
          mkdir -p frames
          IMAGES=$(echo "$JOB" | python3 -c "import sys,json; [print(x) for x in json.load(sys.stdin).get('imageUrls',[])]")
          i=0; while IFS= read -r url; do
            curl -sL "$JARVIS_URL$url" -o "frames/img_$(printf '%03d' $i).png"; i=$((i+1))
          done <<< "$IMAGES"
          
          # TTS seslendirme
          NARRATION=$(echo "$JOB" | python3 -c "import sys,json; print(json.load(sys.stdin).get('narration',''))")
          VOICE=$(echo "$JOB" | python3 -c "import sys,json; print(json.load(sys.stdin).get('voice','tr-TR-AhmetNeural'))")
          if [ -n "$NARRATION" ]; then
            edge-tts --voice "$VOICE" --text "$NARRATION" --write-media narration.mp3
            AUDIO_FLAG="-i narration.mp3 -c:a aac -shortest"
          else
            AUDIO_FLAG="-an"
          fi
          
          # Video birleştir
          DURATION=$(echo "$JOB" | python3 -c "import sys,json; print(json.load(sys.stdin).get('perImageSec',3))")
          ffmpeg -framerate 1/$DURATION -i "frames/img_%03d.png" $AUDIO_FLAG \\
            -c:v libx264 -pix_fmt yuv420p \\
            -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black" \\
            -t 60 output.mp4
          
          # Yükle
          BASE64=$(base64 -w0 output.mp4)
          curl -s -X POST "$JARVIS_URL/api/video/complete" \\
            -H "Content-Type: application/json" \\
            -d "{\\"jobId\\":\\"$JOB_ID\\",\\"videoBase64\\":\\"$BASE64\\"}"
`;
