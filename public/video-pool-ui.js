(() => {
  function ensurePanel(){
    const page=document.querySelector('#credentials .card');
    if(!page||document.querySelector('#videoPoolPanel'))return;
    const box=document.createElement('div');
    box.id='videoPoolPanel';
    box.innerHTML=`<hr><h3>Video AI Havuzu</h3><p class="muted">JARVIS video üretiminde sağlayıcıları sırayla dener. Kota, 429, kredi veya servis hatasında otomatik diğerine geçer ve problemli sağlayıcıyı cooldown'a alır.</p><div id="videoPoolRows"></div>
    <div class="grid2">
      <div class="googleSetup"><h4>Replicate</h4><p class="muted">API token yeterli. Model boşsa uygun video modeli otomatik aranır.</p><input id="replicateToken" type="password" autocomplete="new-password" placeholder="Replicate API token"><input id="replicateModel" placeholder="Opsiyonel model: owner/name"><div class="row"><button id="replicateSave">BAĞLA</button><button id="replicateTest">TEST</button></div><a class="btnlink" href="https://replicate.com/account/api-tokens" target="_blank" rel="noopener">API TOKEN AL</a></div>
      <div class="googleSetup"><h4>Runway</h4><p class="muted">Resmi Runway Dev API. Varsayılan video modeli gen4.5; 9:16 Reels üretimine hazır.</p><input id="runwayToken" type="password" autocomplete="new-password" placeholder="Runway API secret"><input id="runwayModel" placeholder="Model (varsayılan: gen4.5)"><div class="row"><button id="runwaySave">BAĞLA</button><button id="runwayTest">TEST</button></div><a class="btnlink" href="https://dev.runwayml.com/" target="_blank" rel="noopener">RUNWAY DEV</a></div>
      <div class="googleSetup"><h4>fal.ai</h4><p class="muted">fal queue altyapısı. Varsayılan Kling text-to-video endpoint'i kullanılır; model alanından başka fal video endpoint'i seçilebilir.</p><input id="falToken" type="password" autocomplete="new-password" placeholder="fal API key"><input id="falModel" placeholder="fal endpoint/model"><div class="row"><button id="falSave">BAĞLA</button><button id="falTest">TEST</button></div><a class="btnlink" href="https://fal.ai/dashboard/keys" target="_blank" rel="noopener">FAL API KEY AL</a></div>
    </div><div class="row"><button id="videoPoolRun">HAVUZU ŞİMDİ ÇALIŞTIR</button></div>`;
    page.appendChild(box);
    box.querySelector('#replicateSave').onclick=saveReplicate;box.querySelector('#replicateTest').onclick=testReplicate;
    box.querySelector('#runwaySave').onclick=()=>saveExtra('runway');box.querySelector('#runwayTest').onclick=()=>testExtra('runway');
    box.querySelector('#falSave').onclick=()=>saveExtra('fal');box.querySelector('#falTest').onclick=()=>testExtra('fal');
    box.querySelector('#videoPoolRun').onclick=runPool;
  }
  function fmtUntil(x){if(!x)return'';try{return new Date(x).toLocaleString('tr-TR')}catch{return''}}
  async function loadPool(){ensurePanel();const host=document.querySelector('#videoPoolRows');if(!host)return;try{const x=await api('/api/video-pool/status');const rows=x.providers||[];host.innerHTML=rows.length?rows.map((p,i)=>`<div class="item"><b>${i+1}. ${esc(p.label||p.provider)}</b><small>${esc(p.provider)} • öncelik ${p.priority}${p.model?' • '+esc(p.model):''}</small><small>${p.cooldown?'⏳ Cooldown: '+fmtUntil(p.cooldown.until)+' • '+esc(p.cooldown.reason||''):(p.status==='ok'?'● Hazır':'○ '+esc(p.status||'bekliyor'))}</small></div>`).join(''):'<div class="item"><b>Video sağlayıcısı bağlı değil</b><small>Higgsfield, Replicate, Runway veya fal.ai bağla.</small></div>'}catch(e){host.innerHTML='<div class="item"><small>'+esc(e.message)+'</small></div>'}}
  async function saveReplicate(){const token=document.querySelector('#replicateToken')?.value.trim(),model=document.querySelector('#replicateModel')?.value.trim()||'';if(!token)return toast('Replicate API token gerekli');try{await api('/api/video-pool/replicate/setup',{method:'POST',body:JSON.stringify({token,model})});document.querySelector('#replicateToken').value='';toast('Replicate bağlandı');await loadPool();if(typeof loadCredentials==='function')await loadCredentials()}catch(e){toast(e.message)}}
  async function testReplicate(){try{const x=await api('/api/video-pool/replicate/test',{method:'POST'});toast(x.ok?'Replicate bağlantısı başarılı':'Replicate test başarısız');await loadPool()}catch(e){toast(e.message)}}
  async function saveExtra(p){const token=document.querySelector('#'+p+'Token')?.value.trim(),model=document.querySelector('#'+p+'Model')?.value.trim()||'';if(!token)return toast((p==='runway'?'Runway':'fal.ai')+' API key gerekli');try{await api('/api/video-pool/'+p+'/setup',{method:'POST',body:JSON.stringify({token,model})});document.querySelector('#'+p+'Token').value='';toast((p==='runway'?'Runway':'fal.ai')+' bağlandı');await loadPool();if(typeof loadCredentials==='function')await loadCredentials()}catch(e){toast(e.message)}}
  async function testExtra(p){try{const x=await api('/api/video-pool/'+p+'/test',{method:'POST'});toast(x.ok?(p==='runway'?'Runway':'fal.ai')+' bağlantısı başarılı':'Test başarısız');await loadPool()}catch(e){toast(e.message)}}
  async function runPool(){try{await api('/api/video-pool/run',{method:'POST'});toast('Video havuzu çalıştırıldı');await loadPool()}catch(e){toast(e.message)}}
  window.jarvisLoadVideoPool=loadPool;setTimeout(loadPool,1200);window.addEventListener('focus',()=>loadPool());
})();
