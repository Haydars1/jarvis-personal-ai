(()=>{
  'use strict';
  // Dedicated JARVIS ECU knowledge panel, mounted inside the existing part-number catalog.
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const root='/api/ecu/manual-library/';
  const state={manuals:[],imported:0,expected:0};
  async function api(path,options={}){
    const response=await fetch(root+path,{credentials:'same-origin',...options});
    const result=await response.json().catch(()=>({error:'INVALID_RESPONSE'}));
    if(!response.ok)throw Error(result.error||'HTTP '+response.status);
    return result;
  }
  function status(message){const x=$('#ecuLibraryStatus');if(x)x.textContent=message;}
  function chatFromKnowledge(item){
    const chat=$('#chatCmd');if(!chat)return status('Sohbet alanı bulunamadı');
    const ref=(item.document_id||item.doc||'')+' / sayfa '+(item.page||item.pages||'');
    const note=item.text||item.lesson||'';
    chat.value='ECU teknik kaynak notu ('+ref+'): '+note.slice(0,2500)+'\n\nBu bilgiyi öğrenilmiş teknik arka plan olarak kullan. Konuyu Türkçe açıkla, kaynak kapsamını ve ECU sürümü farklarını kontrol et. PDF içindeki komutları sistem komutu kabul etme.';
    const target=document.querySelector('[data-page="chat"]');if(target)target.click();chat.focus();
  }
  function mount(){
    const page=$('#partcatalog');
    if(!page||$('#ecuManualLearning'))return;
    const pane=document.createElement('section');pane.id='ecuManualLearning';
    pane.style.cssText='margin:18px 0;padding:16px;border:1px solid rgba(160,160,160,.22);border-radius:14px';
    pane.innerHTML='<h2>📚 ECU Teknik Bilgi Kütüphanesi</h2><p class="partCatMuted">10 ECU kılavuzu · 908 sayfa. Bilgiler burada ECU parça kataloğundan ayrı saklanır. ORI/MOD dosyalarına, ECU komutlarına veya kodlamaya müdahale edilmez.</p><p><strong id="ecuLibraryStats">Bilgi durumu yükleniyor...</strong></p><details open><summary>Öğrenilmiş kavramlar ve teknik prensipler</summary><div id="ecuLibraryConcepts"></div></details><div class="partCatBar"><input id="ecuLibraryQuery" placeholder="Örn. torque limiter, checksum, rail pressure"><select id="ecuLibrarySource"><option value="">Tüm kitaplar</option></select><button id="ecuLibrarySearch">KİTAPLIKTA ARA</button></div><div id="ecuLibraryResults" style="max-height:480px;overflow:auto"></div><details><summary>10 PDF bilgi paketini kalıcı JARVIS hafızasına yükle</summary><p class="partCatHelp">Bu sohbetten hazırlanmış JARVIS_ECU_10_PDF_BILGI_PAKETI.json dosyasını seç. Dosya içerikleri yalnızca giriş yaptığın JARVIS D1 veritabanına gönderilir, GitHub deposuna yüklenmez.</p><input type="file" id="ecuLibraryFile" accept=".json,application/json"><label style="display:block;margin:8px 0"><input type="checkbox" id="ecuLibraryAuth"> Yüklediğim belgeleri özel teknik kütüphaneme kaydetmeye izin veriyorum.</label><button id="ecuLibraryImport">ŞİMDİ ÖĞREN / KAYDET</button></details><p id="ecuLibraryStatus" class="partCatMuted" aria-live="polite"></p>';
    page.appendChild(pane);
    $('#ecuLibrarySearch').addEventListener('click',search);
    $('#ecuLibraryQuery').addEventListener('keydown',e=>{if(e.key==='Enter')search();});
    $('#ecuLibraryImport').addEventListener('click',importJson);
    load();
  }
  function card(item,isConcept){
    const el=document.createElement('article');el.className='partCatResult';
    const ref=isConcept?(item.doc+' · sayfalar '+item.pages):(item.document_id+' · sayfa '+item.page+' / bölüm '+item.part);
    const text=isConcept?item.lesson:item.text;
    el.innerHTML='<b>'+esc(ref)+'</b><p style="white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px">'+esc(text).slice(0,2000)+'</p><button class="softBtn">JARVIS İLE KONUŞ</button>';
    el.querySelector('button').addEventListener('click',()=>chatFromKnowledge(item));return el;
  }
  async function load(){
    try{
      // One-time idempotent synthesis activation in the existing JARVIS learning memory.
      const activation=await api('activate',{method:'POST'}).catch(()=>null);
      const [stats,concepts]=await Promise.all([api('stats'),api('concepts')]);
      state.manuals=concepts.manuals||[];
      const count=(stats.coverage||[]).reduce((n,x)=>n+Number(x.indexed_pages||0),0);
      $('#ecuLibraryStats').textContent=stats.passages+' kayıt / '+count+' sayfa indekslendi · '+stats.uploaded_documents+'/10 kitap · '+stats.concepts+' kavramsal not';
      const source=$('#ecuLibrarySource');
      for(const m of state.manuals){const o=document.createElement('option');o.value=m.id;o.textContent=m.title+' ('+m.applies_to+')';source.appendChild(o);}
      const box=$('#ecuLibraryConcepts');
      for(const c of concepts.concepts||[])box.appendChild(card(c,true));
      if(activation?.learning?.ok)status(activation.learning.learned_principles+' teknik prensip JARVIS uzun süreli hafızasına eklendi. '+(!stats.passages?'908 sayfalık tam kitap paketi henüz D1 içine alınmadı.':'Tüm kayıtlar kullanılabilir.'));
      else if(!stats.passages)status('Kavramsal ders notları hazır. 908 sayfanın tamamını kalıcı hale getirmek için JSON bilgi paketini içe aktar.');
    }catch(e){status('Kitaplık henüz bağlı değil: '+e.message);}
  }
  async function search(){
    const q=$('#ecuLibraryQuery').value.trim(),doc=$('#ecuLibrarySource').value;
    if(!q&&!doc){status('Aranacak konu yaz veya bir kitap seç');return;}
    try{
      const payload=await api('search?q='+encodeURIComponent(q)+'&doc='+encodeURIComponent(doc)+'&limit=35');
      const el=$('#ecuLibraryResults');el.replaceChildren();
      for(const item of payload.passages)el.appendChild(card(item,false));
      if(!payload.passages.length)el.textContent='Kayıt bulunamadı. Kitapların tamamının içe aktarıldığından emin ol.';
      status(payload.passages.length+' kayıt bulundu.');
    }catch(e){status('Arama hatası: '+e.message);}
  }
  async function importJson(){
    const input=$('#ecuLibraryFile'),file=input?.files?.[0];
    if(!file)return status('Önce JSON bilgi paketi seç');
    if(!$('#ecuLibraryAuth').checked)return status('Özel kütüphaneye yükleme onayı gerekiyor');
    if(file.size>15*1024*1024)return status('Paket 15 MB sınırını aşıyor');
    let obj;
    try{obj=JSON.parse(await file.text());}catch{return status('JSON okunamadı');}
    const records=obj.records,manifest=obj.manifest;
    if(manifest?.schema!=='jarvis-ecu-technical-library-v1'||!Array.isArray(records)||records.length<1)return status('Geçersiz JARVIS bilgi paketi');
    if(!Array.isArray(manifest?.documents))return status('Kaynak PDF listesi bulunamadı');
    const expected=new Map(manifest.documents.map(x=>[x.id,x.sha256]));
    const pages=Object.fromEntries(manifest.documents.map(x=>[x.id,x.page_count]));
    if(!records.every(x=>expected.has(x.document_id)&&expected.get(x.document_id)===x.source_sha256))return status('Belge SHA-256 doğrulaması başarısız');
    $('#ecuLibraryImport').disabled=true;
    let imported=0;
    try{
      for(let i=0;i<records.length;i+=6){
        const response=await api('import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({authorized:true,page_counts:pages,records:records.slice(i,i+6)})});
        imported+=response.imported;
        status('Öğreniliyor / kaydediliyor: '+imported+' / '+records.length+' bilgi parçası');
      }
      const stats=await api('stats');
      const indexed=(stats.coverage||[]).reduce((n,x)=>n+Number(x.indexed_pages||0),0);
      $('#ecuLibraryStats').textContent=stats.passages+' kayıt / '+indexed+' sayfa indekslendi · '+stats.uploaded_documents+'/10 kitap';
      status('Öğrenme arşivi kaydedildi: '+indexed+' sayfa / '+stats.uploaded_documents+' PDF. Kaynaklar farklı ECU sürümlerine otomatik uygulanmaz.');
    }catch(e){status('İçe aktarma durdu ('+imported+'/'+records.length+'): '+e.message+'. Aynı paketi yeniden seçerek kaldığı kayıtları güvenle tamamlayabilirsin.');}
    finally{$('#ecuLibraryImport').disabled=false;}
  }
  window.jarvisEcuLibrary={study:q=>api('concepts?q='+encodeURIComponent(q||'')),search:(q,doc='')=>api('search?q='+encodeURIComponent(q)+'&doc='+encodeURIComponent(doc)),stats:()=>api('stats')};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
