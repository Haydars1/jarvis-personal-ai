export const VIDEO_PROVIDER_CATALOG = Object.freeze({
  higgsfield: { label: 'Higgsfield', modes: ['text-to-video','image-to-video'], portrait: true, transport: 'higgsfield' },
  kling: { label: 'Kling', modes: ['text-to-video','image-to-video'], portrait: true, transport: 'fal', defaultModel: 'fal-ai/kling-video/v1/standard/text-to-video' },
  runway: { label: 'Runway', modes: ['text-to-video','image-to-video'], portrait: true, transport: 'runway' },
  hailuo: { label: 'MiniMax Hailuo', modes: ['text-to-video','image-to-video'], portrait: true, transport: 'minimax', provider: 'minimax' },
  veo: { label: 'Google Veo', modes: ['text-to-video','image-to-video'], portrait: true, transport: 'vertex-ai', defaultModel: 'veo-3.1-generate-001', nativeAudio: true }
});

export function videoProviderOrder({ format = 'shorts', animation = false } = {}) {
  const preferred = animation ? ['veo','kling','hailuo','higgsfield','runway'] : ['veo','runway','kling','higgsfield','hailuo'];
  return format === 'shorts' ? preferred.filter(id => VIDEO_PROVIDER_CATALOG[id]?.portrait) : preferred;
}

export function availableVideoProviders({ configuredTransports = [], format = 'shorts', animation = false } = {}) {
  const configured = new Set((configuredTransports || []).map(value => String(value || '').toLowerCase()).filter(Boolean));
  return videoProviderOrder({ format, animation }).filter(id => configured.has(String(VIDEO_PROVIDER_CATALOG[id]?.transport || '').toLowerCase()));
}
