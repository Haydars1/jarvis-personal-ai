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
    </div><div class="googleSetup" id="hyperframesPanel">
    <h4>HyperFrames · HTML → MP4</h4>
    <p class="muted">API kredisi olmadan düzenlenebilir tanıtım videosu projesi hazırlar. MP4 için Windows/Linux bilgisayarda HyperFrames, Chromium ve FFmpeg gereklidir. Bu düğme MP4 render etmez.</p>
    <div class="row"><input id="hfBrand" maxlength="60" value="6006 PERFORMANCE" placeholder="Marka"><select id="hfFormat"><option value="reels">Dikey Reels 9:16</option><option value="landscape">Yatay 16:9</option></select></div>
    <input id="hfTitle" maxlength="120" placeholder="Video başlığı">
    <input id="hfSubtitle" maxlength="180" placeholder="Alt başlık">
    <div class="row"><label for="hfDuration">Süre (5–30 sn)</label><input type="number" id="hfDuration" min="5" max="30" value="8"><button id="hfGenerate">HTML PROJESİ OLUŞTUR</button></div>
    <small class="muted" id="hfStatus">Oluşturulan index.html dosyasını HyperFrames bulunan proje klasöründe render edebilirsin.</small>
    <div class="row"><button id="hfRenderCloud">MP4 BULUTTA OLUŞTUR</button><button id="hfRefreshCloud">DURUMU KONTROL ET</button></div>
    <small class="muted" id="hfCloudStatus">Bulut render, GitHub bağlantısıyla çalışır. Her tıklama yeni GitHub Actions işi başlatır (saatte en fazla 3).</small>
    <video id="hfCloudPreview" controls playsinline style="display:none;width:100%;max-height:350px;margin-top:10px"></video>
    <a href="https://hyperframes.heygen.com/guides/rendering" target="_blank" rel="noopener">HyperFrames render rehberi</a>
    </div><div class="row"><button id="videoPoolRun">HAVUZU ŞİMDİ ÇALIŞTIR</button></div>`;
    page.appendChild(box);
    box.querySelector('#replicateSave').onclick=saveReplicate;box.querySelector('#replicateTest').onclick=testReplicate;
    box.querySelector('#runwaySave').onclick=()=>saveExtra('runway');box.querySelector('#runwayTest').onclick=()=>testExtra('runway');
    box.querySelector('#falSave').onclick=()=>saveExtra('fal');box.querySelector('#falTest').onclick=()=>testExtra('fal');
    box.querySelector('#videoPoolRun').onclick=runPool;box.querySelector('#hfGenerate').onclick=generateHyperframesProject;box.querySelector('#hfRenderCloud').onclick=startCloudRender;box.querySelector('#hfRefreshCloud').onclick=refreshCloudRender;
  }
  function fmtUntil(x){if(!x)return'';try{return new Date(x).toLocaleString('tr-TR')}catch{return''}}
  async function loadPool(){ensurePanel();const host=document.querySelector('#videoPoolRows');if(!host)return;try{const x=await api('/api/video-pool/status');const rows=x.providers||[];host.innerHTML=rows.length?rows.map((p,i)=>`<div class="item"><b>${i+1}. ${esc(p.label||p.provider)}</b><small>${esc(p.provider)} • öncelik ${p.priority}${p.model?' • '+esc(p.model):''}</small><small>${p.cooldown?'⏳ Cooldown: '+fmtUntil(p.cooldown.until)+' • '+esc(p.cooldown.reason||''):(p.status==='ok'?'● Hazır':'○ '+esc(p.status||'bekliyor'))}</small></div>`).join(''):'<div class="item"><b>Video sağlayıcısı bağlı değil</b><small>Higgsfield, Replicate, Runway veya fal.ai bağla.</small></div>'}catch(e){host.innerHTML='<div class="item"><small>'+esc(e.message)+'</small></div>'}}
  async function saveReplicate(){const token=document.querySelector('#replicateToken')?.value.trim(),model=document.querySelector('#replicateModel')?.value.trim()||'';if(!token)return toast('Replicate API token gerekli');try{await api('/api/video-pool/replicate/setup',{method:'POST',body:JSON.stringify({token,model})});document.querySelector('#replicateToken').value='';toast('Replicate bağlandı');await loadPool();if(typeof loadCredentials==='function')await loadCredentials()}catch(e){toast(e.message)}}
  async function testReplicate(){try{const x=await api('/api/video-pool/replicate/test',{method:'POST'});toast(x.ok?'Replicate bağlantısı başarılı':'Replicate test başarısız');await loadPool()}catch(e){toast(e.message)}}
  async function saveExtra(p){const token=document.querySelector('#'+p+'Token')?.value.trim(),model=document.querySelector('#'+p+'Model')?.value.trim()||'';if(!token)return toast((p==='runway'?'Runway':'fal.ai')+' API key gerekli');try{await api('/api/video-pool/'+p+'/setup',{method:'POST',body:JSON.stringify({token,model})});document.querySelector('#'+p+'Token').value='';toast((p==='runway'?'Runway':'fal.ai')+' bağlandı');await loadPool();if(typeof loadCredentials==='function')await loadCredentials()}catch(e){toast(e.message)}}
  async function testExtra(p){try{const x=await api('/api/video-pool/'+p+'/test',{method:'POST'});toast(x.ok?(p==='runway'?'Runway':'fal.ai')+' bağlantısı başarılı':'Test başarısız');await loadPool()}catch(e){toast(e.message)}}
  async function runPool(){try{await api('/api/video-pool/run',{method:'POST'});toast('Video havuzu çalıştırıldı');await loadPool()}catch(e){toast(e.message)}}
  async function generateHyperframesProject(){
    const button=document.querySelector('#hfGenerate'),status=document.querySelector('#hfStatus');
    if(button)button.disabled=true;
    try{
      const payload={
        brand:document.querySelector('#hfBrand').value,
        title:document.querySelector('#hfTitle').value,
        subtitle:document.querySelector('#hfSubtitle').value,
        format:document.querySelector('#hfFormat').value,
        duration:Number(document.querySelector('#hfDuration').value)
      };
      const result=await api('/api/video-pool/hyperframes/project',{method:'POST',body:JSON.stringify(payload)});
      if(!result.html||result.rendered!==false)throw Error('Geçersiz HyperFrames proje yanıtı');
      const blob=new Blob([result.html],{type:'text/html;charset=utf-8'});
      const url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download='index.html';document.body.appendChild(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      if(status)status.textContent='HTML projesi hazır. MP4 için bilgisayarda npx hyperframes lint, check ve render --output final.mp4 komutlarını çalıştır.';
      toast('HyperFrames HTML indirildi; MP4 henüz oluşturulmadı');
    }catch(error){if(status)status.textContent=String(error.message||error);toast('HyperFrames: '+error.message)}
    finally{if(button)button.disabled=false}
  }

  let activeCloudRender=null;
  try{activeCloudRender=localStorage.getItem('jarvis.hyperframes.active-job')||null}catch{}
  let cloudPollTimer=null;
  function hfValue(id){return document.querySelector('#'+id)?.value||''}
  function setCloudState(message){
    const e=document.querySelector('#hfCloudStatus');
    if(e)e.textContent=message;
  }
  function scheduleCloudPoll(){
    if(cloudPollTimer)clearTimeout(cloudPollTimer);
    cloudPollTimer=setTimeout(()=>{refreshCloudRender().catch(()=>{})},7000);
  }
  async function startCloudRender(){
    const button=document.querySelector('#hfRenderCloud');
    if(button)button.disabled=true;
    setCloudState('GitHub Actions üzerinden MP4 render talebi gönderiliyor…');
    try{
      const input={brand:hfValue('hfBrand'),title:hfValue('hfTitle'),subtitle:hfValue('hfSubtitle'),
        format:hfValue('hfFormat'),duration:Number(hfValue('hfDuration'))};
      const x=await api('/api/video-pool/hyperframes/render',{method:'POST',body:JSON.stringify(input)});
      activeCloudRender=x.id;
      try{localStorage.setItem('jarvis.hyperframes.active-job',activeCloudRender)}catch{}
      setCloudState('MP4 işi kuyruğa alındı. Kod: '+x.id+'. Durum otomatik yenileniyor.');
      scheduleCloudPoll();
    }catch(e){setCloudState('MP4 render başlatılamadı: '+e.message);toast(e.message)}
    finally{if(button)button.disabled=false}
  }
  async function refreshCloudRender(){
    if(!activeCloudRender){setCloudState('Önce MP4 BULUTTA OLUŞTUR düğmesine bas.');return}
    try{
      const x=await api('/api/video-pool/hyperframes/render-status/'+encodeURIComponent(activeCloudRender));
      if(x.status==='ready'){
        if(cloudPollTimer){clearTimeout(cloudPollTimer);cloudPollTimer=null}
        setCloudState('MP4 hazır. Video dosyası alınıyor…');
        await downloadCloudMp4(activeCloudRender);
        return;
      }
      if(x.status==='failed'){
        setCloudState('Bulut render başarısız ('+(x.conclusion||'unknown')+'). GitHub Actions kaydını kontrol et.');
        return;
      }
      setCloudState(x.status==='queued'?'Bulut render kuyruğunda…':'Bulutta video oluşturuluyor…');
      scheduleCloudPoll();
    }catch(e){setCloudState('Durum okunamadı: '+e.message)}
  }
  function saveBlob(blob,filename){
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),120000);
    return url;
  }
  // Actions artifacts arrive as ZIP. Extract the single MP4 locally in the browser
  // to keep GitHub tokens and signed artifact URLs off the client.
  async function extractCloudMp4(zip) {
    const buffer=await zip.arrayBuffer(),view=new DataView(buffer),bytes=new Uint8Array(buffer);
    const limit=Math.max(0,bytes.length-65557);
    let end=-1;for(let i=bytes.length-22;i>=limit;i--){
      if(view.getUint32(i,true)===0x06054b50){end=i;break}
    }
    if(end<0)throw Error('ZIP_END_NOT_FOUND');
    const count=view.getUint16(end+10,true),offset=view.getUint32(end+16,true);
    if(count<1||count>5||offset>=bytes.length)throw Error('ZIP_DIRECTORY_INVALID');
    let cursor=offset,entry=null;
    for(let i=0;i<count;i++){
      if(cursor+46>bytes.length||view.getUint32(cursor,true)!==0x02014b50)throw Error('ZIP_ENTRY_INVALID');
      const nameLen=view.getUint16(cursor+28,true),extra=view.getUint16(cursor+30,true),comment=view.getUint16(cursor+32,true);
      const name=new TextDecoder().decode(bytes.slice(cursor+46,cursor+46+nameLen));
      if(name==='final.mp4')entry={
        method:view.getUint16(cursor+10,true),compressed:view.getUint32(cursor+20,true),
        size:view.getUint32(cursor+24,true),offset:view.getUint32(cursor+42,true)
      };
      cursor+=46+nameLen+extra+comment;
    }
    if(!entry||entry.size<100||entry.size>20*1024*1024||entry.compressed>24*1024*1024)throw Error('MP4_FILE_NOT_FOUND_OR_TOO_LARGE');
    const local=entry.offset;
    if(local+30>bytes.length||view.getUint32(local,true)!==0x04034b50)throw Error('ZIP_LOCAL_HEADER_INVALID');
    const first=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true);
    if(first+entry.compressed>bytes.length)throw Error('ZIP_BOUNDS');
    const data=bytes.slice(first,first+entry.compressed);
    let decoded;
    if(entry.method===0)decoded=data;
    else if(entry.method===8 && typeof DecompressionStream!=='undefined'){
      decoded=new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    }else throw Error('BROWSER_ZIP_METHOD_UNSUPPORTED');
    if(decoded.length!==entry.size || String.fromCharCode(...decoded.slice(4,8))!=='ftyp')throw Error('INVALID_MP4_IN_ARTIFACT');
    return new Blob([decoded],{type:'video/mp4'});
  }
  async function downloadCloudMp4(id){
    const r=await fetch('/api/video-pool/hyperframes/render-download/'+encodeURIComponent(id),{credentials:'same-origin'});
    if(!r.ok){const x=await r.json().catch(()=>({}));throw Error(x.error||'ZIP_HTTP_'+r.status)}
    const zip=await r.blob();
    if(zip.size>24*1024*1024)throw Error('ZIP_TOO_LARGE');
    let mp4;
    try{mp4=await extractCloudMp4(zip)}
    catch(error){saveBlob(zip,'hyperframes-'+id+'.zip');setCloudState('Tarayıcı MP4 açamadı. ZIP arşivi indirildi: '+error.message);return}
    const url=saveBlob(mp4,'6006-video-'+id.slice(0,8)+'.mp4');
    const player=document.querySelector('#hfCloudPreview');
    if(player){player.src=url;player.style.display='block'}
    setCloudState('MP4 hazır. Video indirildi ve önizlemeye açıldı.');
  }
  if(activeCloudRender)setTimeout(()=>refreshCloudRender().catch(()=>{}),2000);
  window.jarvisLoadVideoPool=loadPool;setTimeout(loadPool,1200);window.addEventListener('focus',()=>loadPool());
})();
