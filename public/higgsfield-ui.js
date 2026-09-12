(() => {
  const CAPS = ['video-generation','reels-video','image-to-video','text-to-video'];
  const CLOUD_URL = 'https://cloud.higgsfield.ai';
  const AUTO_TEST_INTERVAL_MS = 15 * 60 * 1000;
  const AUTO_TEST_RETRY_MS = 60 * 1000;
  let autoTestTimer = null;
  let autoTestInFlight = false;
  let lastAutoTestAt = 0;
  let lastCredentialId = null;

  function higgsfieldCredential(rows = []) {
    return rows.find(x => String(x.provider || '').toLowerCase() === 'higgsfield');
  }

  async function testHiggsfieldCredential(c, { quiet = false, force = false } = {}) {
    if (!c || Number(c.enabled) !== 1 || autoTestInFlight) return null;
    const now = Date.now();
    const minGap = c.last_status === 'ok' ? AUTO_TEST_INTERVAL_MS : AUTO_TEST_RETRY_MS;
    if (!force && lastCredentialId === c.id && now - lastAutoTestAt < minGap) return null;

    autoTestInFlight = true;
    lastCredentialId = c.id;
    lastAutoTestAt = now;
    try {
      const r = await api('/api/credentials/' + c.id + '/test', { method: 'POST' });
      if (!quiet) toast(r.ok ? 'Higgsfield bağlantısı başarılı' : 'Higgsfield test başarısız: ' + (r.error || ''));
      if (typeof loadCredentials === 'function') await loadCredentials();
      if (typeof refresh === 'function') await refresh();
      return r;
    } catch (e) {
      if (!quiet) toast('Higgsfield: ' + e.message);
      return { ok: false, error: e.message };
    } finally {
      autoTestInFlight = false;
    }
  }

  function scheduleAutoTest(c) {
    if (autoTestTimer) {
      clearTimeout(autoTestTimer);
      autoTestTimer = null;
    }
    if (!c || Number(c.enabled) !== 1) return;

    const needsImmediateTest = c.last_status !== 'ok';
    if (needsImmediateTest) {
      setTimeout(() => testHiggsfieldCredential(c, { quiet: true }), 250);
    }

    autoTestTimer = setTimeout(async () => {
      await testHiggsfieldCredential(c, { quiet: true, force: true });
    }, AUTO_TEST_INTERVAL_MS);
  }

  function renderHiggsfieldCard(rows = []) {
    const host = document.querySelector('#providerCards');
    if (!host || host.querySelector('[data-provider="higgsfield"]')) return;

    const c = higgsfieldCredential(rows);
    const ok = !!c && c.last_status === 'ok' && Number(c.enabled) === 1;
    const card = document.createElement('div');
    card.className = 'providerCard ' + (ok ? 'ok' : 'bad');
    card.dataset.provider = 'higgsfield';

    if (c) {
      card.innerHTML = `
        <div class="providerHead"><b>Higgsfield</b><span class="providerBadge ${ok ? 'ok' : 'bad'}">${ok ? '● BAĞLI' : '○ OTOMATİK TEST EDİLİYOR'}</span></div>
        <small>Video / Reels / Image-to-Video / Text-to-Video</small>
        <div class="providerModel">Official Higgsfield API</div>
        <small>Öncelik ${c.priority} • ${c.enabled ? 'aktif' : 'kapalı'}${c.last_error ? ' • ' + esc(c.last_error) : ''}</small>
        <div class="row"><a href="${CLOUD_URL}" target="_blank" rel="noopener">HIGGSFIELD CLOUD</a><button class="hfTest">ŞİMDİ TEST ET</button></div>`;

      card.querySelector('.hfTest').onclick = async () => {
        await testHiggsfieldCredential(c, { quiet: false, force: true });
      };

      scheduleAutoTest(c);
    } else {
      card.innerHTML = `
        <div class="providerHead"><b>Higgsfield</b><span class="providerBadge bad">○ BAĞLI DEĞİL</span></div>
        <small>Video / Reels / Image-to-Video / Text-to-Video</small>
        <div class="providerModel">Official API • Key ID + Key Secret</div>
        <input class="hfKeyId" autocomplete="off" placeholder="Higgsfield Key ID">
        <input class="hfKeySecret" type="password" autocomplete="new-password" placeholder="Higgsfield Key Secret">
        <div class="row"><a href="${CLOUD_URL}" target="_blank" rel="noopener">API ANAHTARI AL</a><button class="hfConnect">BAĞLA + TEST</button></div>`;

      card.querySelector('.hfConnect').onclick = async () => {
        const keyId = card.querySelector('.hfKeyId').value.trim();
        const keySecret = card.querySelector('.hfKeySecret').value.trim();
        if (!keyId || !keySecret) return toast('Higgsfield Key ID ve Key Secret gerekli');
        try {
          const saved = await api('/api/higgsfield/setup', {
            method: 'POST',
            body: JSON.stringify({
              keyId,
              keySecret,
              label: 'Higgsfield',
              priority: 25,
              capabilities: CAPS
            })
          });
          card.querySelector('.hfKeyId').value = '';
          card.querySelector('.hfKeySecret').value = '';
          const tested = await testHiggsfieldCredential({ id: saved.id, enabled: 1, last_status: 'untested' }, { quiet: true, force: true });
          toast(tested?.ok ? 'Higgsfield bağlandı ve doğrulandı' : 'Higgsfield kaydedildi; otomatik doğrulama devam ediyor');
          if (typeof loadCredentials === 'function') await loadCredentials();
          if (typeof refresh === 'function') await refresh();
        } catch (e) {
          toast('Higgsfield: ' + e.message);
        }
      };
    }

    host.appendChild(card);
  }

  if (typeof renderProviderCards === 'function') {
    const baseRenderProviderCards = renderProviderCards;
    renderProviderCards = function(rows = []) {
      baseRenderProviderCards(rows);
      renderHiggsfieldCard(rows);
    };
  }
})();
