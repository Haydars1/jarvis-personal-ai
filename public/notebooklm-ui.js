/* Optional read-only NotebookLM panel; requires a configured MCP backend. */
(() => {
  if (window.__hayirlievladNotebookLM) return;
  window.__hayirlievladNotebookLM = true;
  const make = (tag, value='') => {
    const el = document.createElement(tag);
    if (value) el.textContent = value;
    return el;
  };
  const unpack = result => {
    const payload = result?.result || {};
    if (payload.structured && typeof payload.structured === 'object') return payload.structured;
    const text = (payload.content || []).join('\n');
    try { return JSON.parse(text); } catch { return { text }; }
  };
  const entries = (data, keys) => {
    if (Array.isArray(data)) return data;
    for (const key of keys) if (Array.isArray(data?.[key])) return data[key];
    return [];
  };
  const itemId = item => String(item?.id || item?.notebook_id || item?.source_id || item?.title || '');
  const itemLabel = item => String(item?.title || item?.name || item?.id || item?.notebook_id || 'Adsız');
  async function call(path, options={}) {
    const res = await fetch('/api/notebooklm/' + path, { ...options, credentials: 'same-origin',
      headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Error(data.error || 'HTTP_' + res.status);
    return data;
  }
  function install() {
    const chat = document.querySelector('#chat .chatTop');
    if (!chat || document.querySelector('#notebooklmPanel')) return;
    const css = make('style');
    css.textContent = `
    .nbPanel{display:grid;gap:10px;margin:10px 12px;padding:14px;border:1px solid #4b617b;border-radius:13px;background:#101b2d;color:#eaf2fc}
    .nbPanel.hidden{display:none}.nbPanel h3,.nbPanel p{margin:0}.nbPanel p{font-size:13px}
    .nbPanel select,.nbPanel textarea{width:100%;box-sizing:border-box;background:#111c2f;color:#fff;border:1px solid #4b617b;padding:10px;border-radius:8px}
    .nbPanel textarea{min-height:80px}.nbPanel button{border-radius:9px;padding:8px;background:#1e344b;color:#fff;border:1px solid #55718e}
    .nbPanel button:disabled{opacity:.5}.nbPanel .nbAnswer{white-space:pre-wrap;max-height:350px;overflow:auto;background:#0b1324;border-radius:8px;padding:12px}
    .nbLaunch{border-radius:9px;padding:8px;color:#fff;background:#1e344b;border:1px solid #55718e;font-size:13px}
    `;
    document.head.appendChild(css);
    const launch = make('button', '📚 NotebookLM');
    launch.className = 'nbLaunch';
    launch.type = 'button';
    (chat.querySelector('.chatTopActions') || chat).appendChild(launch);
    const panel = make('div');
    panel.id = 'notebooklmPanel';
    panel.className = 'nbPanel hidden';
    const heading = make('h3', 'NotebookLM · Kaynaklara sor');
    const status = make('p', 'Bağlantı kontrol edilmedi');
    status.setAttribute('role', 'status');
    const notebookSelect = make('select');
    notebookSelect.setAttribute('aria-label', 'NotebookLM defteri seç');
    const sourceCount = make('p');
    const question = make('textarea');
    question.placeholder = 'Defter kaynaklarına soracağın soru…';
    question.setAttribute('aria-label', 'NotebookLM sorusu');
    const refresh = make('button', 'Defterleri yenile');
    const ask = make('button', 'Kaynaklara sor');
    const answer = make('div');
    answer.className = 'nbAnswer hidden';
    answer.setAttribute('aria-live', 'polite');
    panel.append(heading, status, notebookSelect, sourceCount, question, refresh, ask, answer);
    chat.insertAdjacentElement('afterend', panel);
    let loaded = false;
    async function sources() {
      sourceCount.textContent = 'Kaynaklar okunuyor…';
      try {
        const payload = unpack(await call('sources?notebook=' + encodeURIComponent(notebookSelect.value)));
        const items = entries(payload, ['sources', 'items', 'results']);
        sourceCount.textContent = items.length + ' kaynak bu defterde mevcut.';
      } catch (err) { sourceCount.textContent = 'Kaynak hatası: ' + err.message; }
    }
    async function notebooks() {
      refresh.disabled = true;
      ask.disabled = true;
      status.textContent = 'Bağlantı kontrol ediliyor…';
      notebookSelect.replaceChildren();
      try {
        const health = await call('status');
        if (!health.configured) {
          status.textContent = 'NotebookLM bağlantısı henüz etkin değil. Önce sunucu adresi ve Google yetkilendirmesi kurulmalı.';
          return;
        }
        const payload = unpack(await call('notebooks'));
        const items = entries(payload, ['notebooks', 'items', 'results']);
        items.forEach(item => {
          const option = make('option', itemLabel(item));
          option.value = itemId(item);
          notebookSelect.appendChild(option);
        });
        loaded = items.length > 0;
        ask.disabled = !loaded;
        status.textContent = loaded ? items.length + ' defter yüklendi.' : 'Defter bulunamadı.';
        if (loaded) await sources();
      } catch (err) { status.textContent = 'NotebookLM hatası: ' + err.message; }
      finally { refresh.disabled = false; }
    }
    launch.addEventListener('click', () => {
      const opening = panel.classList.toggle('hidden') === false;
      launch.setAttribute('aria-expanded', String(opening));
      if (opening && !loaded) notebooks();
    });
    refresh.addEventListener('click', notebooks);
    notebookSelect.addEventListener('change', sources);
    ask.addEventListener('click', async () => {
      const q = question.value.trim();
      if (!notebookSelect.value || !q) { status.textContent = 'Defter seç ve soru yaz.'; return; }
      ask.disabled = true;
      answer.classList.remove('hidden');
      answer.textContent = 'Yanıt alınıyor…';
      try {
        const response = await call('ask', { method: 'POST', body: JSON.stringify({notebook: notebookSelect.value, question: q}) });
        const content = unpack(response);
        answer.textContent = String(content.answer || content.response || content.text || response.result?.content?.join('\n') || JSON.stringify(content));
      } catch (err) { answer.textContent = 'Hata: ' + err.message; }
      finally { ask.disabled = false; }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
