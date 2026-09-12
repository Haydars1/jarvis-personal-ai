(() => {
  const catalog = document.createElement('script');
  catalog.src = '/provider-catalog.js';
  catalog.defer = true;
  document.head.appendChild(catalog);

  const HEALTHY_FOR_MS = 15 * 60 * 1000;
  const RETRY_AFTER_MS = 60 * 1000;
  const START_DELAY_MS = 2500;
  const BETWEEN_TESTS_MS = 300;
  let running = false;
  let lastCycleAt = 0;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function shouldTest(c, now) {
    if (!c || Number(c.enabled) !== 1) return false;
    const last = Number(c.last_test_at || 0);
    if (c.last_status === 'ok') return !last || (now - last) >= HEALTHY_FOR_MS;
    return !last || (now - last) >= RETRY_AFTER_MS;
  }

  async function refreshUi() {
    try {
      if (typeof loadCredentials === 'function') await loadCredentials();
    } catch (e) {
      console.debug('Credential auto-test UI refresh:', e?.message || e);
    }
    try {
      if (typeof refresh === 'function') await refresh();
    } catch (e) {
      console.debug('Credential auto-test state refresh:', e?.message || e);
    }
  }

  async function autoTestCredentials({ force = false } = {}) {
    if (running) return;
    const now = Date.now();
    if (!force && now - lastCycleAt < RETRY_AFTER_MS) return;
    running = true;
    lastCycleAt = now;
    let changed = false;

    try {
      const rows = await api('/api/credentials');
      const targets = (rows || []).filter(c => force ? Number(c.enabled) === 1 : shouldTest(c, now));

      for (const c of targets) {
        try {
          await api('/api/credentials/' + encodeURIComponent(c.id) + '/test', { method: 'POST' });
          changed = true;
        } catch (e) {
          changed = true;
          console.debug('Credential auto-test failed:', c.provider || c.label || c.id, e?.message || e);
        }
        await sleep(BETWEEN_TESTS_MS);
      }

      if (changed) await refreshUi();
    } catch (e) {
      console.debug('Credential auto-test cycle:', e?.message || e);
    } finally {
      running = false;
    }
  }

  window.jarvisAutoTestCredentials = autoTestCredentials;

  setTimeout(() => autoTestCredentials(), START_DELAY_MS);
  setInterval(() => autoTestCredentials(), HEALTHY_FOR_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') autoTestCredentials();
  });
})();
