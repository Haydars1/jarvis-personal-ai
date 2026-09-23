export function voiceCapabilityPolicy(capabilities = {}) {
  const native = capabilities.nativeSpeech !== false;
  const cloudTts = capabilities.cloudTts === true;
  const cloudStt = capabilities.cloudStt === true;

  return {
    bargeIn: true,
    tts: cloudTts ? 'cloud' : (native ? 'native' : 'unavailable'),
    stt: cloudStt ? 'cloud' : (native ? 'native' : 'unavailable'),
    fallbackTts: cloudTts && native ? 'native' : null,
    fallbackStt: cloudStt && native ? 'native' : null
  };
}
