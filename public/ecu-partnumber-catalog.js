(()=>{
  'use strict';
  const SOURCE='https://www.controlunits.info/partnumbers/';
  const GROUPS=['bosch','ford','mazda','vag','peugeot','citroen','man'];
  const $=selector=>document.querySelector(selector);
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let lastResults=[];
  function notify(message){const el=$('#partCatalogStatus');if(el)el.textContent=message;}
  async function api(path,options={}){
    const response=await fetch(path,{credentials:'same-origin',...options});
    const data=await response.json().catch(()=>({error:'INVALID_RESPONSE'}));
    if(!response.ok)throw Error(data.error||'HTTP '+response.status);
    return data;
  }
  function goPage(){
    if(typeof window.switchPage==='function')window.switchPage('partcatalog');
    else {document.querySelectorAll('main .page').forEach(x=>x.classList.toggle('active',x.id==='partcatalog'));document.querySelectorAll('[data-page]').forEach(x=>x.classList.toggle('active',x.dataset.page==='partcatalog'));}
  }
  function mount(){
    if(!document.querySelector('main')||$('#partcatalog'))return;
    const style=document.createElement('style');
    style.textContent='.partCatGrid{display:grid;grid-template-columns:minmax(0,2fr) minmax(220px,1fr);gap:12px}.partCatBar{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.partCatBar input{min-width:180px;flex:1}.partCatResult{padding:12px;border:1px solid rgba(160,160,160,.25);border-radius:12px;margin:8px 0}.partCatResult small{display:block;opacity:.76;margin:3px 0}.partCatResult button{margin-top:8px}.partCatMono{font-family:ui-monospace,monospace;overflow-wrap:anywhere}.partCatMuted{opacity:.75}.partCatHelp{font-size:12px;line-height:1.5}.partCatCard{padding:16px;border:1px solid rgba(160,160,160,.20);border-radius:14px;margin-bottom:12px}.partCatCard input[type=file]{max-width:100%}@media(max-width:760px){.partCatGrid{grid-template-columns:1fr}.partCatBar{display:grid;grid-template-columns:1fr}.partCatBar input{min-width:0}}';
    document.head.appendChild(style);
    for(const [selector,markup] of [['aside nav','⊞ <span>ECU Kataloğu</span>'],['.bottomNav','⊞<small>Parça No</small>']]){
      const nav=$(selector);if(!nav||nav.querySelector('[data-page="partcatalog"]'))continue;
      const button=document.createElement('button');button.dataset.page='partcatalog';button.innerHTML=markup;button.addEventListener('click',goPage);nav.appendChild(button);
    }
    const section=document.createElement('section');
    section.id='partcatalog';section.className='page';
    section.innerHTML='<h1>ECU Parça No Kataloğu</h1><p class="partCatMuted">JARVIS ile bağlantılı ayrı araştırma alanı. Orijinal ECU kodları, tuning ayarları ve dosyalar değişmez.</p><div class="partCatGrid"><div><div class="partCatCard"><h2>ECU Bul</h2><div class="partCatBar"><input id="partCatQuery" placeholder="Örn. 0261200001, ME7.1, VAG"><select id="partCatGroup"><option value="">Tüm gruplar</option></select><button id="partCatSearch">ARA</button></div><small id="partCatCount" class="partCatMuted">Veritabanı kontrol ediliyor...</small><div id="partCatResults"></div></div></div><div><div class="partCatCard"><h3>Kaynak grupları</h3><div id="partCatSourceLinks"></div><p class="partCatHelp">Dış bağlantılar kaynağı açar; sitenin tamamı otomatik kopyalanmaz.</p></div><div class="partCatCard"><h3>İzinli veri içe aktar</h3><p class="partCatHelp">Sadece sahibi olduğun veya aktarım izni aldığın CSV/JSON verilerini yükle. Kaynak sitedeki toplu veriler henüz JARVIS’e kopyalanmadı.</p><input id="partCatFile" type="file" accept=".csv,.json,text/csv,application/json"><input id="partCatRights" style="width:100%;margin-top:8px" placeholder="İzin kaynağı / lisans açıklaması"><label class="partCatHelp"><input type="checkbox" id="partCatConsent"> Verileri içe aktarma hakkım olduğunu onaylıyorum.</label><button id="partCatImport">İÇE AKTAR</button><div class="partCatHelp">Alanlar: group, part_number, ecu_type, manufacturer, brand, model, engine, software_part_number, software_version, description, source_url, notes.</div></div></div></div><p id="partCatalogStatus" aria-live="polite" class="partCatMuted"></p>';
    $('main').appendChild(section);
    GROUPS.forEach(group=>{const opt=document.createElement('option');opt.value=group;opt.textContent=group.toUpperCase();$('#partCatGroup').appendChild(opt);});
    $('#partCatSourceLinks').innerHTML=GROUPS.map(g=>'<p><a href="'+SOURCE+g+'/" target="_blank" rel="noopener noreferrer">'+escapeHtml(g.toUpperCase())+' ↗</a></p>').join('');
    $('#partCatSearch').addEventListener('click',search);
    $('#partCatQuery').addEventListener('keydown',e=>{if(e.key==='Enter')search();});
    $('#partCatGroup').addEventListener('change',search);
    $('#partCatImport').addEventListener('click',importFile);
    refreshStats();
  }
  async function refreshStats(){
    try{const stats=await api('/api/ecu/partnumbers/stats');$('#partCatCount').textContent=stats.total.toLocaleString('tr-TR')+' kayıt JARVIS veritabanında';}
    catch(e){$('#partCatCount').textContent='Katalog kullanılamıyor: '+e.message;}
  }
  function renderResults(results){
    const target=$('#partCatResults');target.replaceChildren();
    if(!results.length){target.textContent='Eşleşen yerel kayıt yok. Kaynak bağlantılarından kontrol edebilir veya izinli veri aktarabilirsin.';return;}
    results.forEach((r,i)=>{
      const card=document.createElement('article');card.className='partCatResult';
      const details=[r.ecu_type,r.manufacturer,r.brand,r.model,r.engine].filter(Boolean).map(escapeHtml).join(' · ');
      card.innerHTML='<strong class="partCatMono">'+escapeHtml(r.part_number)+'</strong> <small>'+escapeHtml(r.group).toUpperCase()+'</small><p>'+details+'</p><small>SW: '+escapeHtml(r.software_part_number||'—')+' · Versiyon: '+escapeHtml(r.software_version||'—')+'</small><p>'+escapeHtml(r.description||'')+'</p><button type="button" class="softBtn">JARVIS SOHBETİNE AKTAR</button> '+(r.source_url?'<a href="'+escapeHtml(r.source_url)+'" target="_blank" rel="noopener noreferrer">Kaynak ↗</a>':'');
      card.querySelector('button').addEventListener('click',()=>{
        const chat=$('#chatCmd');if(!chat){notify('Sohbet alanı bulunamadı');return;}
        const info=[r.part_number,r.ecu_type,r.manufacturer,r.brand,r.model,r.engine,r.software_part_number,r.software_version].filter(Boolean).join(' / ');
        chat.value='Şu ECU parça numarasını incele: '+info+'. Uyumlu araçları, teşhis kontrollerini ve kodlama öncesi gerekli doğrulamaları açıkla. ECU numarasından kesin uyumluluk varsayma.';
        window.dispatchEvent(new CustomEvent('jarvis:ecu-part-selected',{detail:{...r}}));
        if(typeof window.switchPage==='function')window.switchPage('chat');
        else document.querySelector('[data-page="chat"]')?.click();
        chat.focus();
      });
      target.appendChild(card);
    });
  }
  async function search(){
    const query=$('#partCatQuery')?.value.trim()||'',group=$('#partCatGroup')?.value||'';
    if(!query&&!group){notify('Parça numarası yaz veya grup seç');return;}
    notify('Aranıyor...');
    try{const data=await api('/api/ecu/partnumbers/search?q='+encodeURIComponent(query)+'&group='+encodeURIComponent(group));lastResults=data.results||[];renderResults(lastResults);notify(lastResults.length+' sonuç');}
    catch(e){notify('Arama hatası: '+e.message);}
  }
  // RFC4180-style CSV parsing, incl. quoted newlines and escaped quote characters.
  function parseCsv(value){
    const rows=[],row=[];let field='',quoted=false;
    for(let i=0;i<value.length;i++){const ch=value[i];
      if(ch==='"'){if(quoted&&value[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
      else if(ch===','&&!quoted){row.push(field);field='';}
      else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&value[i+1]==='\n')i++;row.push(field);field='';if(row.some(c=>String(c).trim()))rows.push(row.splice(0));else row.length=0;}
      else field+=ch;
    }
    if(quoted)throw Error('CSV_UNCLOSED_QUOTE');
    row.push(field);if(row.some(c=>String(c).trim()))rows.push(row);
    const headings=(rows.shift()||[]).map(x=>x.trim().replace(/^\uFEFF/,''));
    return rows.map(cols=>Object.fromEntries(headings.map((h,i)=>[h,(cols[i]||'').trim()])));
  }
  async function importFile(){
    const file=$('#partCatFile').files?.[0],rights=$('#partCatRights').value.trim();
    if(!file)return notify('Önce CSV veya JSON dosyası seç');
    if(!$('#partCatConsent').checked||!rights)return notify('Önce kullanım hakkını ve kaynağını onayla');
    if(file.size>8*1024*1024)return notify('Dosya 8 MB sınırını aşıyor');
    try{
      const raw=await file.text();
      let records=file.name.toLowerCase().endsWith('.json')?JSON.parse(raw):parseCsv(raw);
      if(!Array.isArray(records))records=records.records;
      if(!Array.isArray(records)||!records.length)throw Error('Kayıt listesi bulunamadı');
      if(records.length>50000)throw Error('Tek dosyada en çok 50.000 kayıt');
      let imported=0;
      for(let i=0;i<records.length;i+=100){
        const body={authorized:true,rights_basis:rights,records:records.slice(i,i+100)};
        const data=await api('/api/ecu/partnumbers/import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
        imported+=data.imported;notify(imported+' / '+records.length+' içe aktarıldı');
      }
      await refreshStats();notify(imported+' kayıt içe aktarıldı. Mevcut ECU kodlamalarına dokunulmadı.');search();
    }catch(e){notify('İçe aktarma durdu: '+e.message);}
  }
  window.jarvisEcuParts={open:goPage,search:async(q,group='')=>api('/api/ecu/partnumbers/search?q='+encodeURIComponent(q)+'&group='+encodeURIComponent(group)),source:SOURCE};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
