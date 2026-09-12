(() => {
  let lastDataRefresh = 0;
  let lastStatusRefresh = 0;
  let busy = false;
  const STATUS_MS = 60 * 1000;
  const DATA_MS = 5 * 60 * 1000;

  function ensureHub() {
    const page = document.querySelector('#communication');
    if (!page || document.querySelector('#integrationHub')) return;
    const hub = document.createElement('div');
    hub.id = 'integrationHub';
    hub.className = 'card';
    hub.innerHTML = `
      <h2>Hesap Bağlantıları</h2>
      <p class="muted">Google, YouTube, Facebook ve Instagram bağlantıları otomatik kontrol edilir. Gmail ve Drive içerikleri de arka planda yenilenir.</p>
      <div class="providerGrid" id="integrationCards"></div>
      <div id="metaSetupBox" class="googleSetup hidden">
        <hr><h3>Meta OAuth kurulumu</h3>
        <p class="muted">Facebook ve Instagram için Meta Developer uygulamasının App ID ve App Secret bilgilerini bir kez gir. Sonrasında normal Facebook giriş ekranı açılır.</p>
        <label>Redirect URI</label>
        <div class="row"><input id="metaRedirect" readonly><button id="copyMetaRedirect" type="button">KOPYALA</button></div>
        <a class="btnlink" href="https://developers.facebook.com/apps/" target="_blank" rel="noopener">META DEVELOPER APP AÇ</a>
        <input id="metaAppId" autocomplete="off" placeholder="Meta App ID">
        <input id="metaAppSecret" type="password" autocomplete="new-password" placeholder="Meta App Secret">
        <button id="metaSaveConnect">KAYDET VE FACEBOOK İLE GİRİŞ YAP</button>
      </div>
      <div id="metaPagesBox" class="hidden"><hr><h3>Facebook Sayfası Seç</h3><div class="row"><select id="metaPageSelect"></select><button id="metaPageApply">SEÇ</button></div></div>`;
    page.insertBefore(hub, page.firstChild);
    const copy = hub.querySelector('#copyMetaRedirect');
    copy.onclick = async () => {
      const v = hub.querySelector('#metaRedirect').value;
      try { await navigator.clipboard.writeText(v); toast('Redirect URI kopyalandı'); }
      catch { toast(v); }
    };
    hub.querySelector('#metaSaveConnect').onclick = saveMetaAndConnect;
    hub.querySelector('#metaPageApply').onclick = selectMetaPage;
  }

  function statusBadge(ok, textOk='● BAĞLI', textNo='○ BAĞLI DEĞİL') {
    return `<span class="providerBadge ${ok ? 'ok' : 'bad'}">${ok ? textOk : textNo}</span>`;
  }

  function renderCards(s) {
    ensureHub();
    const host = document.querySelector('#integrationCards');
    if (!host) return;
    const googleConnected = !!s?.google?.connected;
    const youtubeConnected = !!s?.youtube?.connected;
    const fbConnected = !!s?.facebook?.connected;
    const igConnected = !!s?.instagram?.connected;
    host.innerHTML = `
      <div class="providerCard ${googleConnected ? 'ok' : 'bad'}" data-int="google">
        <div class="providerHead"><b>Google</b>${statusBadge(googleConnected)}</div>
        <small>${googleConnected ? esc(s.google.email || 'Google hesabı bağlı') : (s?.google?.configured ? 'OAuth hazır, giriş bekleniyor' : 'OAuth Client kurulumu gerekli')}</small>
        <div class="providerModel">Gmail • Drive</div>
        <button class="googleAction">${googleConnected ? 'YENİDEN YETKİLENDİR' : (s?.google?.configured ? 'GOOGLE İLE GİRİŞ YAP' : 'GOOGLE KURULUMU')}</button>
      </div>
      <div class="providerCard ${youtubeConnected ? 'ok' : 'bad'}" data-int="youtube">
        <div class="providerHead"><b>YouTube</b>${statusBadge(youtubeConnected)}</div>
        <small>${youtubeConnected ? 'Google OAuth üzerinden yetkili' : 'Google hesabıyla tek girişte bağlanır'}</small>
        <div class="providerModel">YouTube Read • Upload</div>
        <button class="youtubeAction">${youtubeConnected ? 'YETKİYİ YENİLE' : 'YOUTUBE’U BAĞLA'}</button>
      </div>
      <div class="providerCard ${fbConnected ? 'ok' : 'bad'}" data-int="facebook">
        <div class="providerHead"><b>Facebook</b>${statusBadge(fbConnected)}</div>
        <small>${fbConnected ? esc(s.facebook.page_name || 'Facebook sayfası bağlı') : (s?.meta?.configured ? 'Meta OAuth hazır' : 'Meta App kurulumu gerekli')}</small>
        <div class="providerModel">Pages • Publish</div>
        <button class="facebookAction">${fbConnected ? 'HESABI YENİDEN BAĞLA' : (s?.meta?.configured ? 'FACEBOOK İLE GİRİŞ YAP' : 'META KURULUMU')}</button>
      </div>
      <div class="providerCard ${igConnected ? 'ok' : 'bad'}" data-int="instagram">
        <div class="providerHead"><b>Instagram</b>${statusBadge(igConnected)}</div>
        <small>${igConnected ? 'Instagram Business bağlı' : (fbConnected ? 'Bu sayfaya bağlı Instagram Business hesabı bulunamadı' : 'Facebook sayfası üzerinden bağlanır')}</small>
        <div class="providerModel">Instagram Business • Publish</div>
        <button class="instagramAction">${igConnected ? 'HESABI YENİDEN BAĞLA' : 'INSTAGRAM’I BAĞLA'}</button>
      </div>`;
    host.querySelector('.googleAction').onclick = () => connectGoogle(s);
    host.querySelector('.youtubeAction').onclick = () => connectGoogle(s);
    host.querySelector('.facebookAction').onclick = () => connectMeta(s);
    host.querySelector('.instagramAction').onclick = () => connectMeta(s);
    renderMetaPages(s?.meta?.pages || []);
  }

  async function connectGoogle(s) {
    if (!s?.google?.configured) {
      const x = await loadGoogleSetupInfo();
      showGoogleSetup(x?.redirect || '');
      toast('Google Cloud OAuth Client ID ve Client Secret bilgilerini bir kez gir');
      return;
    }
    try {
      const x = await api('/api/google/connect');
      location.href = x.url;
    } catch (e) { toast(e.message); }
  }

  function showMetaSetup(redirect='') {
    const box = document.querySelector('#metaSetupBox');
    if (!box) return;
    box.classList.remove('hidden');
    if (redirect) document.querySelector('#metaRedirect').value = redirect;
    box.scrollIntoView({behavior:'smooth',block:'center'});
  }

  async function connectMeta(s) {
    try {
      if (!s?.meta?.configured) {
        const redirect = location.origin + '/api/meta/callback';
        showMetaSetup(redirect);
        toast('Meta App ID ve App Secret bilgilerini bir kez gir');
        return;
      }
      const x = await api('/api/meta/connect');
      location.href = x.url;
    } catch (e) {
      if (String(e.message).includes('META_APP_SETUP_REQUIRED')) showMetaSetup(location.origin + '/api/meta/callback');
      else toast(e.message);
    }
  }

  async function saveMetaAndConnect() {
    const app_id = document.querySelector('#metaAppId').value.trim();
    const app_secret = document.querySelector('#metaAppSecret').value.trim();
    if (!app_id || !app_secret) return toast('Meta App ID ve App Secret gerekli');
    try {
      await api('/api/meta/setup',{method:'POST',body:JSON.stringify({app_id,app_secret})});
      document.querySelector('#metaAppSecret').value = '';
      const x = await api('/api/meta/connect');
      location.href = x.url;
    } catch (e) { toast(e.message); }
  }

  function renderMetaPages(pages) {
    const box = document.querySelector('#metaPagesBox');
    const sel = document.querySelector('#metaPageSelect');
    if (!box || !sel) return;
    if (!pages || pages.length <= 1) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    sel.innerHTML = pages.map(p => `<option value="${esc(p.id)}">${esc(p.name)}${p.instagram_business_id ? ' • Instagram bağlı' : ''}</option>`).join('');
  }

  async function selectMetaPage() {
    const page_id = document.querySelector('#metaPageSelect').value;
    if (!page_id) return;
    try {
      await api('/api/meta/select-page',{method:'POST',body:JSON.stringify({page_id})});
      toast('Facebook / Instagram sayfası seçildi');
      await refreshAll(true);
    } catch (e) { toast(e.message); }
  }

  async function silentMailDrive() {
    try {
      const [m,d] = await Promise.allSettled([api('/api/gmail/messages'),api('/api/drive/files')]);
      if (m.status === 'fulfilled') {
        const e = document.querySelector('#mailList');
        if (e) {
          e.innerHTML = '';
          (m.value || []).forEach(x => { const n=document.createElement('div'); n.className='item'; n.innerHTML=`<b>${esc(x.subject||'(konusuz)')}</b><small>${esc(x.from||'')} • ${esc(x.date||'')}</small>`; e.appendChild(n); });
        }
      }
      if (d.status === 'fulfilled') {
        const e = document.querySelector('#driveList');
        if (e) {
          e.innerHTML = '';
          (d.value.files || []).forEach(f => { const n=document.createElement('div'); n.className='item'; n.innerHTML=`<a target="_blank" rel="noopener" href="${esc(f.webViewLink||'#')}">${esc(f.name)}</a><small>${esc(f.mimeType||'')}</small>`; e.appendChild(n); });
        }
      }
    } catch {}
  }

  async function refreshAll(force=false) {
    if (busy) return;
    const t = Date.now();
    if (!force && t - lastStatusRefresh < STATUS_MS) return;
    busy = true;
    try {
      ensureHub();
      const s = await api('/api/integrations/status');
      renderCards(s);
      const gi = document.querySelector('#googleInfo');
      if (gi) gi.textContent = s.google.connected ? `Google bağlı${s.google.email ? ' • '+s.google.email : ''}${s.youtube.connected ? ' • YouTube bağlı' : ''}` : (s.google.configured ? 'Google OAuth hazır, giriş gerekli' : 'Google OAuth kurulumu gerekli');
      lastStatusRefresh = t;
      if (s.google.connected && (force || t - lastDataRefresh >= DATA_MS)) {
        await silentMailDrive();
        lastDataRefresh = Date.now();
      }
    } catch {} finally { busy = false; }
  }

  function hideManualRefresh() {
    const m = document.querySelector('#mailRefresh');
    const d = document.querySelector('#driveRefresh');
    if (m) m.style.display = 'none';
    if (d) d.style.display = 'none';
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshAll(true); });
  window.addEventListener('focus', () => refreshAll(true));
  setInterval(() => refreshAll(false), STATUS_MS);
  setInterval(() => { if (!document.hidden) silentMailDrive(); }, DATA_MS);
  setTimeout(() => { ensureHub(); hideManualRefresh(); refreshAll(true); }, 800);
})();
