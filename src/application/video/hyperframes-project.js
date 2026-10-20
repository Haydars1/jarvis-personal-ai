// Cloudflare-safe authoring only. MP4 rendering needs Chromium and FFmpeg outside Workers.
export const HYPERFRAMES_SOURCE = 'https://github.com/heygen-com/hyperframes';

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function field(v, fallback, max) {
  const value = String(v == null ? '' : v).trim();
  if (value.length > max) throw new RangeError('HYPERFRAMES_TEXT_TOO_LONG');
  return value || fallback;
}
export function normalizeHyperframesBrief(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('HYPERFRAMES_INVALID_BRIEF');
  const format = input.format || 'reels';
  if (!['reels','landscape'].includes(format)) throw new RangeError('HYPERFRAMES_INVALID_FORMAT');
  const duration = input.duration === undefined ? 8 : Number(input.duration);
  if (!Number.isInteger(duration) || duration < 5 || duration > 30) throw new RangeError('HYPERFRAMES_INVALID_DURATION');
  return {
    format, duration,
    brand: field(input.brand, '6006 PERFORMANCE', 60),
    title: field(input.title, 'Profesyonel araç çözümleri', 120),
    subtitle: field(input.subtitle, 'Diagnose · Codierung · Softwareoptimierung', 180)
  };
}
export function buildHyperframesProject(input = {}) {
  const brief = normalizeHyperframesBrief(input);
  const width = brief.format === 'reels' ? 1080 : 1920;
  const height = brief.format === 'reels' ? 1920 : 1080;
  const fade = Math.max(0.8, brief.duration - 0.75);
  const lines = [
    '<!doctype html>',
    '<html lang="tr"><head><meta charset="UTF-8">',
    '<meta name="viewport" content="width=' + width + ', height=' + height + '">',
    '<title>' + escapeHtml(brief.title) + '</title>',
    '<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>',
    '<style>',
    '*{box-sizing:border-box}html,body{margin:0;background:#100f10}',
    '#root{position:relative;width:' + width + 'px;height:' + height + 'px;overflow:hidden;background:radial-gradient(ellipse at 80% 18%,#4b1b21,transparent 45%),#100f10;color:#f6f2ef;font-family:Arial,Helvetica,sans-serif}',
    '.clip{position:absolute;inset:0;display:flex;flex-direction:column;padding:8%}',
    '.pattern{position:absolute;inset:0;opacity:.12;background-image:linear-gradient(30deg,#fff 1px,transparent 1px),linear-gradient(150deg,#fff 1px,transparent 1px);background-size:76px 132px;pointer-events:none}',
    '.brand{position:relative;font-weight:900;letter-spacing:.15em;color:#f4d8d8;font-size:' + Math.round(width*.028) + 'px}',
    '.spacer{flex:1}.headline{position:relative}.accent{height:9px;width:140px;border-radius:6px;background:#c52d39;margin-bottom:50px}',
    'h1{margin:0 0 30px;font-size:' + Math.round(width*(brief.format==='reels'?.096:.07)) + 'px;line-height:1.08;font-weight:900;overflow-wrap:break-word}',
    '.subtitle{font-size:' + Math.round(width*.034) + 'px;color:#d4cbca;overflow-wrap:break-word}',
    '.footer{position:relative;font-size:' + Math.round(width*.02) + 'px;color:#b2a5a6;letter-spacing:.1em}',
    '</style></head><body>',
    '<div id="root" data-composition-id="main" data-start="0" data-duration="' + brief.duration + '" data-width="' + width + '" data-height="' + height + '" data-fps="30">',
    '<section id="promo" class="clip" data-start="0" data-duration="' + brief.duration + '" data-track-index="1">',
    '<div class="pattern"></div><div id="brand" class="brand">' + escapeHtml(brief.brand) + '</div>',
    '<div class="spacer"></div><div id="headline" class="headline"><div class="accent"></div><h1>' + escapeHtml(brief.title) + '</h1>',
    '<div class="subtitle">' + escapeHtml(brief.subtitle) + '</div></div><div class="spacer"></div>',
    '<div class="footer">DIAGNOSE · CODIERUNG · SOFTWARE</div></section></div>',
    '<script>window.__timelines=window.__timelines||{};',
    'const tl=gsap.timeline({paused:true});',
    'tl.fromTo("#brand",{opacity:0,y:-40},{opacity:1,y:0,duration:.7,ease:"power3.out"},.2);',
    'tl.fromTo("#headline",{opacity:0,y:95},{opacity:1,y:0,duration:1,ease:"power3.out"},.6);',
    'tl.to("#promo",{opacity:0,duration:.55},' + fade + ');',
    'window.__timelines.main=tl;</script></body></html>'
  ];
  return {
    filename: 'index.html',
    media_type: 'text/html',
    html: lines.join('\n'),
    brief,
    renderer: 'hyperframes-local',
    rendered: false,
    instructions: [
      'index.html dosyasını yeni bir proje klasörüne kaydet.',
      'Projede npm install --save-dev hyperframes çalıştır (ağ indirmesi onay gerektirir).',
      'npx hyperframes lint && npx hyperframes check',
      'npx hyperframes render --output final.mp4'
    ]
  };
}
