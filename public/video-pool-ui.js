(() => {
  function ensurePanel(){
    const page=document.querySelector('#credentials .card');
    if(!page||document.querySelector('#videoPoolPanel'))return;
    const box=document.createElement('div');
    box.id='videoPoolPanel';
    box.innerHTML=`<hr><h3>Video AI Havuzu</h3><p class="muted">Higgsfield kota/429/ödeme limiti verirse JARVIS otomatik sıradaki video sağlayıcısına geçer. Hatalı sağlayıcı geçici cooldown'a alınır.</p><div id="videoPoolRows"></div><div class="googleSetup"><h4>Replicate yedek video sağlayıcısı</h4><p class="muted">API token yeterli. Model boş bırakılırsa JARVIS Replicate'ın resmi aramasından uygun text-to-video modeli otomatik seçer.</p><div class="row"><input id="replicateToken" type="password" autocomplete="new-password" placeholder="Replicate API token"><input id="replicateModel" placeholder="Opsiyonel model: owner/name"></div><div class="row"><button id="replicateSave">YEDEK SAĞLAYICIYI BAĞLA</button><button id="replicateTest">TEST ET</button><button id="videoPoolRun">HAVUZU ŞİMDİ ÇALIŞTIR</button></div><a class="btnlink" href="https://replicate.com/account/api-tokens" target="_blank" rel="noopener">REPLICATE API TOKEN AL</a></div>`;
    page.appendChild(box);
    box.querySelector('#replicateSave').onclick=saveReplicate;
    box.querySelector('#replicateTest').onclick=testReplicate;
    box.querySelector('#videoPoolRun').onclick=runPool;
  }
  function fmtUntil(x){if(!x)return'';try{return new Date(x).toLocaleString('tr-TR')}catch{return''}}
  async function loadPool(){ensurePanel();const host=document.querySelector('#videoPoolRows');if(!host)return;try{const x=await api('/api/video-pool/status');const rows=x.providers||[];host.innerHTML=rows.length?rows.map((p,i)=>`<div class="item"><b>${i+1}. ${esc(p.label||p.provider)}</b><small>${esc(p.provider)} • öncelik ${p.priority}${p.model?' • '+esc(p.model):''}</small><small>${p.cooldown?'⏳ Cooldown: '+fmtUntil(p.cooldown.until)+' • '+esc(p.cooldown.reason||''):(p.status==='ok'?'● Hazır':'○ '+esc(p.status||'bekliyor'))}</small></div>`).join(''):'<div class="item"><b>Video sağlayıcısı bağlı değil</b><small>Önce Higgsfield veya Replicate bağla.</small></div>'}catch(e){host.innerHTML='<div class="item"><small>'+esc(e.message)+'</small></div>'}}
  async function saveReplicate(){const token=document.querySelector('#replicateToken')?.value.trim(),model=document.querySelector('#replicateModel')?.value.trim()||'';if(!token)return toast('Replicate API token gerekli');try{await api('/api/video-pool/replicate/setup',{method:'POST',body:JSON.stringify({token,model})});document.querySelector('#replicateToken').value='';toast('Replicate video yedeği bağlandı');await loadPool();if(typeof loadCredentials==='function')await loadCredentials()}catch(e){toast(e.message)}}
  async function testReplicate(){try{const x=await api('/api/video-pool/replicate/test',{method:'POST'});toast(x.ok?'Replicate bağlantısı başarılı':'Replicate test başarısız');await loadPool()}catch(e){toast(e.message)}}
  async function runPool(){try{await api('/api/video-pool/run',{method:'POST'});toast('Video havuzu çalıştırıldı');await loadPool()}catch(e){toast(e.message)}}
  window.jarvisLoadVideoPool=loadPool;
  setTimeout(loadPool,1200);
  window.addEventListener('focus',()=>loadPool());
})();
