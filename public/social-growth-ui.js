(() => {
  let mounted=false;

  function esc2(s=''){return String(s).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]))}

  function mount(){
    if(mounted)return;
    const page=document.querySelector('#communication');
    if(!page)return;
    mounted=true;
    const card=document.createElement('div');
    card.id='socialGrowthHub';
    card.className='card purple';
    card.innerHTML=`
      <div class="providerHead"><div><h2 style="margin:0">JARVIS Social Growth</h2><small>Reels planla • üret • yayınla • yorumları izle</small></div><span id="sgBadge" class="providerBadge bad">yükleniyor</span></div>
      <p class="muted">Instagram/Facebook Page içerikleri resmi API bağlantılarıyla otomatik ilerler. Facebook gruplarında rastgele otomatik üyelik veya insan taklidi yapılmaz; yalnız açıkça yetkilendirilmiş hedefler kullanılabilir.</p>
      <div class="row"><input id="sgTopic" placeholder="Örn: Almanya'da otomobil içerikleriyle büyü ve para kazan"><button id="sgCreate">KAMPANYA BAŞLAT</button></div>
      <div id="sgStats" class="statusGrid" style="margin-top:12px"></div>
      <details style="margin-top:12px"><summary>Meta yorum webhook kurulumu</summary><p class="muted">Meta Developer Webhooks alanına callback URL ve aşağıdaki doğrulama tokenını gir.</p><input id="sgVerify" type="password" placeholder="En az 12 karakter verify token"><button id="sgWebhook" style="margin-top:8px">WEBHOOK'U HAZIRLA</button><div id="sgWebhookInfo" class="muted" style="margin-top:8px"></div></details>
      <div class="grid2" style="margin-top:12px"><div><h3>Kampanyalar</h3><div id="sgCampaigns"></div></div><div><h3>Son Etkileşimler</h3><div id="sgEvents"></div></div></div>`;
    page.insertBefore(card,page.firstChild);
    card.querySelector('#sgCreate').onclick=createCampaign;
    card.querySelector('#sgWebhook').onclick=setupWebhook;
    refreshSocialGrowth();
  }

  async function createCampaign(){
    const topic=document.querySelector('#sgTopic')?.value.trim();
    if(!topic)return toast('Kampanya konusunu yaz');
    try{
      const x=await api('/api/social-growth/campaigns',{method:'POST',body:JSON.stringify({topic})});
      toast('Kampanya oluşturuldu • '+(x.items||0)+' içerik kuyruğa alındı');
      document.querySelector('#sgTopic').value='';
      await refreshSocialGrowth();
    }catch(e){toast(e.message)}
  }

  async function setupWebhook(){
    const verify_token=document.querySelector('#sgVerify')?.value.trim();
    if(!verify_token)return toast('Verify token gerekli');
    try{
      const x=await api('/api/social-growth/webhook/setup',{method:'POST',body:JSON.stringify({verify_token})});
      document.querySelector('#sgWebhookInfo').textContent='Callback: '+x.callback+' • Verify token kaydedildi';
      document.querySelector('#sgVerify').value='';
      toast('Webhook hazır');
      await refreshSocialGrowth();
    }catch(e){toast(e.message)}
  }

  async function refreshSocialGrowth(){
    const host=document.querySelector('#socialGrowthHub');
    if(!host)return;
    try{
      const [s,d]=await Promise.all([api('/api/social-growth/status'),api('/api/social-growth/campaigns')]);
      const badge=document.querySelector('#sgBadge');
      const ok=s.meta&&s.higgsfield;
      badge.className='providerBadge '+(ok?'ok':'bad');
      badge.textContent=ok?'● OTOMASYON HAZIR':'○ KURULUM EKSİK';
      document.querySelector('#sgStats').innerHTML=`
        <div class="statusPill ${s.meta?'ok':'bad'}"><b>Meta</b><small>${s.meta?'● Bağlı':'○ Bağla'}</small></div>
        <div class="statusPill ${s.higgsfield?'ok':'bad'}"><b>Higgsfield</b><small>${s.higgsfield?'● Bağlı':'○ Bağla'}</small></div>
        <div class="statusPill ${s.webhook?'ok':'bad'}"><b>Yorum Webhook</b><small>${s.webhook?'● Hazır':'○ Kurulum'}</small></div>
        <div class="statusPill ok"><b>Kuyruk</b><small>${s.pending||0} bekleyen • ${s.campaigns||0} aktif</small></div>`;
      const c=document.querySelector('#sgCampaigns');c.innerHTML='';
      (d.campaigns||[]).slice(0,8).forEach(x=>{const n=document.createElement('div');n.className='item';n.innerHTML=`<b>${esc2(x.name)}</b><small>${esc2(x.objective)} • ${esc2(x.cadence)} • ${Number(x.enabled)?'aktif':'kapalı'}</small>`;c.appendChild(n)});
      const e=document.querySelector('#sgEvents');e.innerHTML='';
      (d.events||[]).slice(0,10).forEach(x=>{const n=document.createElement('div');n.className='item';n.innerHTML=`<b>${esc2(x.actor||x.event_type)}</b><small>${esc2(x.text||x.event_type)}</small>`;e.appendChild(n)});
    }catch(e){console.debug('social growth ui',e?.message||e)}
  }

  setTimeout(mount,900);
  setInterval(()=>{if(!document.hidden)refreshSocialGrowth()},60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){mount();refreshSocialGrowth()}});
})();
