(() => {
  const PROVIDERS = [
    {
      id:'deepseek', name:'DeepSeek', desc:'Güçlü reasoning + kodlama, OpenAI uyumlu API',
      endpoint:'https://api.deepseek.com', model:'deepseek-v4-flash', priority:22,
      caps:['chat','coding','reasoning','research'],
      url:'https://platform.deepseek.com/api_keys', badge:'ÖNERİLEN'
    },
    {
      id:'mistral', name:'Mistral', desc:'Hızlı genel kullanım, kodlama ve Avrupa merkezli güçlü alternatif',
      endpoint:'https://api.mistral.ai/v1', model:'mistral-large-latest', priority:24,
      caps:['chat','coding','reasoning','research'],
      url:'https://console.mistral.ai/api-keys', badge:'ÖNERİLEN'
    },
    {
      id:'xai', name:'xAI', desc:'Grok tabanlı genel amaçlı sohbet, reasoning ve güncel bilgi iş akışları',
      endpoint:'https://api.x.ai/v1', model:'grok-4.6', priority:26,
      caps:['chat','coding','reasoning','research','vision'],
      url:'https://console.x.ai/', badge:'GÜÇLÜ'
    },
    {
      id:'together', name:'Together AI', desc:'Çok sayıda açık model; sohbet, vision, image ve TTS için tek API',
      endpoint:'https://api.together.ai/v1', model:'openai/gpt-oss-20b', priority:34,
      caps:['chat','coding','reasoning','vision','image-generation','tts'],
      url:'https://api.together.ai/settings/api-keys', badge:'ÇOK MODELLİ'
    },
    {
      id:'fireworks', name:'Fireworks AI', desc:'Hızlı inference; açık modeller, vision, audio ve structured output',
      endpoint:'https://api.fireworks.ai/inference/v1', model:'accounts/fireworks/models/deepseek-v3p1', priority:36,
      caps:['chat','coding','reasoning','vision','audio','embeddings'],
      url:'https://app.fireworks.ai/', badge:'HIZLI'
    }
  ];

  function findCred(rows,id){ return (rows||[]).find(x => String(x.provider||'').toLowerCase() === id); }
  function escLocal(s=''){ return typeof esc === 'function' ? esc(s) : String(s).replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m])); }

  function addCard(host,p,rows){
    if (host.querySelector('[data-provider="'+p.id+'"]')) return;
    const c = findCred(rows,p.id);
    const ok = !!c && c.last_status === 'ok' && Number(c.enabled) === 1;
    const d = document.createElement('div');
    d.className = 'providerCard ' + (ok ? 'ok' : 'bad');
    d.dataset.provider = p.id;

    if (c) {
      d.innerHTML = `
        <div class="providerHead"><b>${escLocal(p.name)}</b><span class="providerBadge ${ok?'ok':'bad'}">${ok?'● BAĞLI':'○ OTOMATİK TEST'}</span></div>
        <small>${escLocal(p.desc)}</small>
        <div class="providerModel">${escLocal(c.model || p.model)}</div>
        <small>${escLocal(p.badge)} • Öncelik ${c.priority} • ${c.enabled?'aktif':'kapalı'}${c.last_error?' • '+escLocal(c.last_error):''}</small>
        <div class="row"><a href="${p.url}" target="_blank" rel="noopener">KONSOL</a><span class="muted">Otomatik sağlık kontrolü açık</span></div>`;
    } else {
      d.innerHTML = `
        <div class="providerHead"><b>${escLocal(p.name)}</b><span class="providerBadge bad">○ BAĞLI DEĞİL</span></div>
        <small>${escLocal(p.desc)}</small>
        <div class="providerModel">${escLocal(p.badge)} • ${escLocal(p.model)}</div>
        <input class="pcModel" autocomplete="off" value="${escLocal(p.model)}" placeholder="Model ID">
        <input class="pcKey" type="password" autocomplete="new-password" placeholder="${escLocal(p.name)} API key">
        <div class="row"><a href="${p.url}" target="_blank" rel="noopener">API ANAHTARI AL</a><button class="pcConnect">BAĞLA + TEST</button></div>`;

      d.querySelector('.pcConnect').onclick = async () => {
        const secret = d.querySelector('.pcKey').value.trim();
        const model = d.querySelector('.pcModel').value.trim() || p.model;
        if (!secret) return toast(p.name + ' API key gerekli');
        try {
          const saved = await api('/api/credentials', {
            method:'POST',
            body:JSON.stringify({
              provider:p.id,
              label:p.name,
              secret,
              model,
              endpoint:p.endpoint,
              priority:p.priority,
              capabilities:p.caps
            })
          });
          const r = await api('/api/credentials/' + saved.id + '/test', {method:'POST'});
          d.querySelector('.pcKey').value='';
          toast(r.ok ? p.name + ' bağlandı' : p.name + ' kaydedildi; otomatik test tekrar deneyecek');
          await loadCredentials();
          await refresh();
        } catch (e) {
          toast(p.name + ': ' + e.message);
        }
      };
    }
    host.appendChild(d);
  }

  function renderRecommended(rows=[]){
    const host = document.querySelector('#providerCards');
    if (!host) return;
    PROVIDERS.forEach(p => addCard(host,p,rows));
  }

  if (typeof renderProviderCards === 'function') {
    const previous = renderProviderCards;
    renderProviderCards = function(rows=[]){
      previous(rows);
      renderRecommended(rows);
    };
  }
})();
