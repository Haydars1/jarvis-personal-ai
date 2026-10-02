const PROFILE = Object.freeze({
  chat: {
    aliases: ['chat','general'],
    providers: { openai:30, anthropic:29, gemini:28, nvidia:24, groq:23, xai:22, mistral:21, deepseek:20, openrouter:19, together:17, fireworks:16 },
    tools: ['memory','chat-history'],
    mode: 'text'
  },
  reporting: {
    aliases: ['report','document-report','analysis-report'],
    providers: { gemini:36, perplexity:33, anthropic:31, openai:30, xai:26, openrouter:24, mistral:21, deepseek:20, nvidia:18 },
    tools: ['web-search','files','citations','structured-output'],
    mode: 'research'
  },
  research: {
    aliases: ['web-research','deep-research'],
    providers: { perplexity:36, gemini:35, xai:32, openai:29, anthropic:27, openrouter:25, nvidia:20, deepseek:19, mistral:18 },
    tools: ['web-search','url-context','citations'],
    mode: 'research'
  },
  youtube_teaching: {
    aliases: ['yt-teaching','youtube-teaching','yt-ogretisi','youtube-ogretisi'],
    providers: { gemini:35, openai:32, anthropic:31, perplexity:29, xai:25, openrouter:23 },
    tools: ['youtube-teaching','citations','learning-engine'],
    mode: 'learning'
  },
  coding: {
    aliases: ['software','development','debug'],
    providers: { anthropic:36, openai:35, deepseek:32, mistral:29, gemini:28, nvidia:25, xai:24, openrouter:23, groq:21, cerebras:18 },
    tools: ['repo','tests','terminal','diff'],
    mode: 'agent'
  },
  social_strategy: {
    aliases: ['instagram','facebook','social-media','content-plan'],
    providers: { gemini:35, openai:32, anthropic:30, xai:29, perplexity:27, openrouter:24, mistral:21, groq:18 },
    tools: ['web-search','social-growth','meta','scheduler'],
    mode: 'workflow'
  },
  video_creation: {
    aliases: ['video','reel','shorts'],
    providers: { gemini:33, openai:31, xai:27, openrouter:24, anthropic:18 },
    tools: ['higgsfield','video-provider-pool','scheduler','social-growth'],
    mode: 'media'
  },
  ecu_diagnostics: {
    aliases: ['dtc','fault-code','diagnostic','obd'],
    providers: { openai:34, anthropic:33, gemini:31, deepseek:29, nvidia:27, mistral:24, xai:22, openrouter:21 },
    tools: ['ecu-file','dtc-database','device-bridge','service-data'],
    mode: 'technical'
  },
  ecu_file_analysis: {
    aliases: ['ecu-bin','hex','map-analysis','ori-mod','checksum'],
    providers: { gemini:34, openai:33, anthropic:31, deepseek:30, nvidia:28, mistral:25, openrouter:22 },
    tools: ['ecu-studio','binary-inspector','ori-mod-diff','checksum'],
    mode: 'technical'
  },
  vehicle_coding: {
    aliases: ['long-coding','byte','adaptation','coding-car'],
    providers: { openai:35, anthropic:33, gemini:30, deepseek:28, mistral:25, nvidia:24, openrouter:21 },
    tools: ['device-bridge','coding-database','adaptation-catalog','audit-log'],
    mode: 'technical'
  },
  service_procedure: {
    aliases: ['service-reset','dpf-cleaning','basic-setting','calibration'],
    providers: { gemini:34, openai:33, anthropic:31, deepseek:27, mistral:24, nvidia:22, openrouter:20 },
    tools: ['device-bridge','service-data','procedure-runner','audit-log'],
    mode: 'technical'
  },
  performance_calibration: {
    aliases: ['stage-1','stage1','torque-calibration','boost-calibration'],
    providers: { openai:33, anthropic:32, deepseek:31, gemini:29, nvidia:27, mistral:24, openrouter:22 },
    tools: ['ecu-studio','binary-inspector','dyno-data','human-review'],
    mode: 'technical-review'
  },
  emissions_modification: {
    aliases: ['dpf-off','egr-off','adblue-off','scr-off'],
    providers: { openai:30, anthropic:29, gemini:28, deepseek:27, nvidia:24 },
    tools: ['ecu-studio','binary-inspector','ori-mod-diff','human-review'],
    mode: 'analysis-only'
  }
});

export function capabilityProfile(kind='chat') {
  const key=String(kind||'chat').toLowerCase();
  if (PROFILE[key]) return { id:key, ...PROFILE[key] };
  for (const [id,p] of Object.entries(PROFILE)) if (p.aliases.includes(key)) return { id, ...p };
  return { id:'chat', ...PROFILE.chat };
}

export function classifyCapability(text='') {
  const v=String(text).toLocaleLowerCase('tr-TR');
  if (/(?:yt|youtube).*(?:öğreti|ogreti|öğren|ogren|eğitim|egitim|teach|kaynak olarak işle)|(?:öğreti|ogreti|öğren|ogren|eğitim|egitim).*(?:youtube|youtu\.be)/i.test(v)) return 'youtube_teaching';
  if (/(dpf|egr|adblue|scr).*(off|iptal|kapat|disable)|(?:off|iptal|kapat).*(dpf|egr|adblue|scr)/i.test(v)) return 'emissions_modification';
  if (/(stage\s*1|stage1|tork|torque|boost|rail pressure|enjeksiyon).*(map|kalibr|tuning|ecu)|(?:map|kalibr|tuning).*(stage\s*1|tork|torque|boost)/i.test(v)) return 'performance_calibration';
  if (/(uzun kodlama|long coding|adaptasyon|adaptation|uyarlama|byte\s*\d+|kodlama).*(araç|ecu|modül|module|obd)|(?:araç|ecu|modül|module|obd).*(uzun kodlama|long coding|adaptasyon|uyarlama|byte)/i.test(v)) return 'vehicle_coding';
  if (/(servis reset|service reset|basic setting|temel ayar|dpf.*(reinigung|clean|temiz)|kalibrasyon|calibration).*(araç|ecu|obd|servis)?/i.test(v)) return 'service_procedure';
  if (/(dtc|hata kod|fault code|arıza kod|obd|diagnos|teşhis)/i.test(v)) return 'ecu_diagnostics';
  if (/(bin|hex|ori|mod|checksum|map|ecu dosya|flash|eeprom).*(analiz|karşılaştır|incele|bul|göster|dosya)?/i.test(v)) return 'ecu_file_analysis';
  if (/(instagram|facebook|reels?|sosyal medya|caption|hashtag|içerik plan)/i.test(v)) return 'social_strategy';
  if (/(video|reels?|shorts).*(üret|oluştur|hazırla|generate|yap)/i.test(v)) return 'video_creation';
  if (/(rapor|report|pdf raporu|analiz raporu|özet rapor)/i.test(v)) return 'reporting';
  if (/(kod|code|javascript|typescript|python|sql|github|debug|refactor|worker|repo|commit)/i.test(v)) return 'coding';
  if (/(araştır|güncel|kaynak|web|internette|haber|karşılaştır)/i.test(v)) return 'research';
  return 'chat';
}

export function providerPreference(kind,provider) {
  const profile=capabilityProfile(kind);
  return Number(profile.providers[String(provider||'').toLowerCase()]||10);
}

export function capabilityTools(kind) {
  return [...capabilityProfile(kind).tools];
}

export const CAPABILITY_PROFILES=PROFILE;
