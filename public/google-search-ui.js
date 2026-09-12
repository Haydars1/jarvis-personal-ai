(() => {
  function ensureGoogleSearchBox(){
    const page=document.querySelector('#research');
    if(!page||document.querySelector('#googleSearchSetupCard'))return;
    const card=document.createElement('div');
    card.id='googleSearchSetupCard';
    card.className='card';
    card.innerHTML=`
      <h3>Google Web Araması</h3>
      <div id="googleSearchStatus" class="muted">Durum kontrol ediliyor…</div>
      <div id="googleSearchSetup" class="googleSetup hidden">
        <p class="muted">JARVIS, Google'ın resmi Programmable Search JSON API'sini kullanır. API key ve Search Engine ID (cx) bir kez girilir ve şifreli saklanır.</p>
        <div class="row"><a class="btnlink" href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">GOOGLE API KEY</a><a class="btnlink" href="https://programmablesearchengine.google.com/controlpanel/all" target="_blank" rel="noopener">SEARCH ENGINE ID (CX)</a></div>
        <input id="googleSearchApiKey" type="password" autocomplete="new-password" placeholder="Google Custom Search API key">
        <input id="googleSearchCx" autocomplete="off" placeholder="Search Engine ID (cx)">
        <button id="googleSearchSave">KAYDET + TEST ET</button>
      </div>
      <button id="googleSearchToggle">GOOGLE SEARCH KURULUMU</button>`;
    page.appendChild(card);
    card.querySelector('#googleSearchToggle').onclick=()=>card.querySelector('#googleSearchSetup').classList.toggle('hidden');
    card.querySelector('#googleSearchSave').onclick=save;
    refresh();
  }
  async function refresh(){
    try{
      const s=await api('/api/google-search/status');
      const e=document.querySelector('#googleSearchStatus');
      const b=document.querySelector('#googleSearchToggle');
      if(e)e.textContent=s.configured?'● Google Search bağlı':'○ Google Search kurulumu gerekli';
      if(b)b.textContent=s.configured?'GOOGLE SEARCH AYARLARI':'GOOGLE SEARCH KURULUMU';
    }catch{}
  }
  async function save(){
    const api_key=document.querySelector('#googleSearchApiKey').value.trim();
    const cx=document.querySelector('#googleSearchCx').value.trim();
    if(!api_key||!cx)return toast('Google API key ve Search Engine ID (cx) gerekli');
    try{
      const r=await api('/api/google-search/setup',{method:'POST',body:JSON.stringify({api_key,cx})});
      document.querySelector('#googleSearchApiKey').value='';
      toast(r.ok?'Google Search bağlandı':'Google Search kaydedildi');
      document.querySelector('#googleSearchSetup').classList.add('hidden');
      await refresh();
    }catch(e){toast('Google Search: '+e.message)}
  }
  setTimeout(ensureGoogleSearchBox,700);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
})();