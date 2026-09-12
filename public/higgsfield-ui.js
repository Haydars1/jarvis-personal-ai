(() => {
  const CAPS = ['video-generation','reels-video','image-to-video','text-to-video'];
  const CLOUD_URL = 'https://cloud.higgsfield.ai';

  function higgsfieldCredential(rows = []) {
    return rows.find(x => String(x.provider || '').toLowerCase() === 'higgsfield');
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
        <div class="providerHead"><b>Higgsfield</b><span class="providerBadge ${ok ? 'ok' : 'bad'}">${ok ? '● BAĞLI' : '○ TEST GEREKLİ'}</span></div>
        <small>Video / Reels / Image-to-Video / Text-to-Video</small>
        <div class="providerModel">Official Higgsfield API</div>
        <small>Öncelik ${c.priority} • ${c.enabled ? 'aktif' : 'kapalı'}${c.last_error ? ' • ' + esc(c.last_error) : ''}</small>
        <div class="row"><a href="${CLOUD_URL}" target="_blank" rel="noopener">HIGGSFIELD CLOUD</a><button class="hfTest">TEST ET</button></div>`;

      card.querySelector('.hfTest').onclick = async () => {
        try {
          const r = await api('/api/credentials/' + c.id + '/test', { method: 'POST' });
          toast(r.ok ? 'Higgsfield bağlantısı başarılı' : 'Higgsfield test başarısız: ' + (r.error || ''));
          await loadCredentials();
          await refresh();
        } catch (e) {
          toast('Higgsfield: ' + e.message);
        }
      };
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
          const tested = await api('/api/credentials/' + saved.id + '/test', { method: 'POST' });
          card.querySelector('.hfKeyId').value = '';
          card.querySelector('.hfKeySecret').value = '';
          toast(tested.ok ? 'Higgsfield bağlandı' : 'Higgsfield kaydedildi ama test başarısız: ' + (tested.error || ''));
          await loadCredentials();
          await refresh();
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
