(() => {
  const loadScript=(src)=>{const s=document.createElement('script');s.src=src;s.defer=true;document.head.appendChild(s)};
  loadScript('/provider-catalog.js?v=20260912-2');
  loadScript('/navigation-state.js?v=20260912-1');
  loadScript('/google-search-ui.js?v=20260912-1');
  loadScript('/chat-enhancements.js?v=20260912-1');
  loadScript('/jarvis-os-ui.js?v=20260912-1');
  loadScript('/social-growth-ui.js?v=20260912-1');
  loadScript('/video-pool-ui.js?v=20260912-2');
  loadScript('/execution-trace-ui.js?v=20260912-1');
  loadScript('/jarvis-face-ui.js?v=20260912-1');
  loadScript('/voice-mode.js?v=20260912-1');

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const res = await nativeFetch(...args);
    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      if (String(url).includes('/api/chat/send')) {
        const x = await res.clone().json().catch(() => null);
        if (x?.media?.length) setTimeout(() => {
          const host = document.querySelector('#chatHistory'); if (!host) return;
          for (const m of x.media) {
            const box = document.createElement('div'); box.className = 'chatMsg assistant';
            if (m.type === 'image' && m.src) box.innerHTML = `<img src="${m.src}" alt="${String(m.alt || 'JARVIS görseli').replace(/[\"<>]/g,'')}" style="display:block;max-width:min(100%,720px);border-radius:16px;margin-top:8px">`;
            else if (m.type === 'video-job') box.textContent = 'Video üretimi başlatıldı. JARVIS sonucu hazır olduğunda takip edecek.';
            else continue;
            host.appendChild(box);
          }
          host.scrollTop = host.scrollHeight;
        }, 100);
      }
    } catch {}
    return res;
  };

  const HEALTHY_FOR_MS = 15 * 60 * 1000, RETRY_AFTER_MS = 60 * 1000, START_DELAY_MS = 2500, BETWEEN_TESTS_MS = 300;
  const DEDICATED_TEST_PROVIDERS = new Set(['runway','fal','replicate','higgsfield']);
  let running = false, lastCycleAt = 0;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  function shouldTest(c, now) { if (!c || Number(c.enabled)!==1) return false; if (DEDICATED_TEST_PROVIDERS.has(String(c.provider||'').toLowerCase())) return false; const last=Number(c.last_test_at||0); return c.last_status==='ok' ? (!last || now-last>=HEALTHY_FOR_MS) : (!last || now-last>=RETRY_AFTER_MS); }
  async function refreshUi(){try{if(typeof loadCredentials==='function')await loadCredentials()}catch{}try{if(typeof refresh==='function')await refresh()}catch{}}
  async function autoTestCredentials({force=false}={}){if(running)return;const t=Date.now();if(!force&&t-lastCycleAt<RETRY_AFTER_MS)return;running=true;lastCycleAt=t;let changed=false;try{const rows=await api('/api/credentials');const targets=(rows||[]).filter(c=>!DEDICATED_TEST_PROVIDERS.has(String(c.provider||'').toLowerCase())&&(force?Number(c.enabled)===1:shouldTest(c,t)));for(const c of targets){try{await api('/api/credentials/'+encodeURIComponent(c.id)+'/test',{method:'POST'});changed=true}catch{changed=true}await sleep(BETWEEN_TESTS_MS)}if(changed)await refreshUi()}catch{}finally{running=false}}
  window.jarvisAutoTestCredentials=autoTestCredentials;setTimeout(()=>autoTestCredentials(),START_DELAY_MS);setInterval(()=>autoTestCredentials(),HEALTHY_FOR_MS);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')autoTestCredentials()});
})();