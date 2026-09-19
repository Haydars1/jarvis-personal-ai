export const VIDEO_PROVIDER_CATALOG = Object.freeze({
  higgsfield: { label: 'Higgsfield', modes: ['text-to-video','image-to-video'], portrait: true },
  kling: { label: 'Kling', modes: ['text-to-video','image-to-video'], portrait: true, transport: 'fal' },
  runway: { label: 'Runway', modes: ['text-to-video','image-to-video'], portrait: true },
  hailuo: { label: 'MiniMax Hailuo', modes: ['text-to-video','image-to-video'], portrait: true, provider: 'minimax' },
  veo: { label: 'Google Veo', modes: ['text-to-video','image-to-video'], portrait: true, nativeAudio: true }
});

export function videoProviderOrder({ format = 'shorts', animation = false } = {}) {
  const preferred = animation ? ['veo','kling','hailuo','higgsfield','runway'] : ['veo','runway','kling','higgsfield','hailuo'];
  return format === 'shorts' ? preferred.filter(id => VIDEO_PROVIDER_CATALOG[id]?.portrait) : preferred;
}
