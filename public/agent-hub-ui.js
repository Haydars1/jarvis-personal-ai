(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  async function api(url, options) {
    const res = await fetch(url, { credentials:'same-origin', ...(options || {}) });
    const data = await res.json();
    if (!res.ok) throw Error(data.error || 'İstek başarısız');
    return data;
  }
  function mount() {
    const host = document.getElementById('settings');
    if (!host || document.getElementById('jarvisAgentHub')) return;
    const section = document.createElement('section');
    section.id = 'jarvisAgentHub';
    section.className = 'card';
    section.innerHTML = '<h2>JARVIS Agent Hub</h2><p class="muted">Cloudflare üzerinden açık kaynak beceriler, güvenli görev planlama ve mevcut GitHub çalışma kuyruğu.</p><p id="agentHubStats" aria-live="polite">Durum yükleniyor...</p><div class="row"><input id="agentHubTask" maxlength="1000" placeholder="Örn: 6006 sitesi SEO ve araç seçim hatalarını incele" aria-label="Ajan görevi"><button type="button" id="agentHubPlan">Beceri bul</button><button type="button" id="agentHubRefresh">Yenile</button></div><p id="agentHubMessage" aria-live="polite"></p><div id="agentHubSkills"></div><h3>Son bulut görevleri</h3><div id="agentHubJobs"></div><p class="muted">Yalnızca doğrulanmış araçlar çalıştırılabilir. Ücretli API, otomatik deploy veya bilinmeyen GitHub kodu çalıştırılmaz.</p>';
    host.appendChild(section);
    const $ = id => section.querySelector('#'+id);
    async function refresh() {
      try {
        const data = await api('/api/tools/agent-hub');
        const c = data.capabilities || {};
        $('agentHubStats').textContent = 'Katalog: '+(c.curated_repositories||0)+' depo • Öğrenilen: '+(c.learned_skills||0)+' • Çalıştırılabilir: '+(c.executable||0)+' • Güvenli görev kuyruğu';
        $('agentHubJobs').innerHTML = (data.jobs||[]).slice(0,10).map(j=>'<div class="muted">'+esc(j.adapter_id)+' — '+esc(j.repo)+' — '+esc(j.status)+'</div>').join('') || '<p class="muted">Görev yok.</p>';
      } catch(e) { $('agentHubMessage').textContent = 'Agent Hub: '+e.message; }
    }
    const workflowBox=document.createElement('div');
    workflowBox.innerHTML='<h3>Çoklu ajan zinciri</h3><p class="muted">Önce kayıtlı depoyu incele, sonra kaynak içinde ara. Yalnızca izinli, salt-okunur işlemler.</p><input id="agentHubRepo" placeholder="owner/repository" aria-label="GitHub deposu"><input id="agentHubTerm" placeholder="Kaynakta aranacak kelime" aria-label="Aranacak kelime"><button type="button" id="agentHubStartWorkflow">Zinciri başlat</button>';
    section.appendChild(workflowBox);
    $('agentHubStartWorkflow').addEventListener('click',async()=>{
      const repo=$('agentHubRepo').value.trim(),term=$('agentHubTerm').value.trim();
      if(!repo||!term){$('agentHubMessage').textContent='Depo ve aranacak kelime gerekli.';return;}
      try{
        const result=await api('/api/tools/agent-hub/workflows',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({steps:[{adapter_id:'repo-inspect',repo},{adapter_id:'source-search',repo,input:{term}}]})});
        $('agentHubMessage').textContent='Görev kuyruğa eklendi: '+result.workflow_id;await refresh();
      }catch(error){$('agentHubMessage').textContent=error.message;}
    });
    const launcher=document.createElement('div');
    launcher.innerHTML='<h3>JARVIS otomatik ajanı</h3><input id="hubAutoRepo" aria-label="GitHub deposu" placeholder="GitHub kaynak deposu (owner/repo)"><textarea id="hubAutoTask" aria-label="Ajan görevi" placeholder="Ne araştırılsın?"></textarea><button type="button" id="hubAutoStart">Ajanı başlat</button>';
    section.appendChild(launcher);
    $('hubAutoStart').addEventListener('click',async()=>{
      const repo=$('hubAutoRepo').value.trim(),task=$('hubAutoTask').value.trim();
      if(!repo||!task){$('agentHubMessage').textContent='Depo ve görev gerekli';return;}
      try{
        const result=await api('/api/tools/agent-hub/durable',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({repo,task})});
        $('agentHubMessage').textContent='Cloudflare ajanı başlatıldı: '+result.workflow_id+' — '+result.plan.steps.length+' adım • '+(result.plan.recommended_skills||[]).length+' güvenli beceri önerisi.';
        $('agentHubWorkflowId').value=result.workflow_id;
        refresh();
      }catch(error){$('agentHubMessage').textContent=error.message;}
    });
    const track=document.createElement('div');
    track.innerHTML='<h3>Cloudflare ajan durumu</h3><select id="agentHubRecent" aria-label="Son ajan görevleri"><option value="">Önceki görevlerden seç</option></select><button type="button" id="hubLoadRecent">Görev geçmişini yenile</button><input id="agentHubWorkflowId" placeholder="Workflow kimliği" aria-label="Workflow kimliği"><button type="button" id="hubCheckWorkflow">Ajan durumunu kontrol et</button><pre id="hubWorkflowReport" style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:400px;overflow:auto"></pre>';
    section.appendChild(track);
    async function loadRecentWorkflows(){
      try{
        const data=await api('/api/tools/agent-hub/workflows');
        const seen=new Set();
        const recent=[];
        for(const job of data.jobs||[]){
          const meta=job.input?.__agent_hub||{};
          const id=String(meta.workflow_id||'');
          if(!/^[a-f0-9-]{36}$/i.test(id)||seen.has(id))continue;
          seen.add(id);
          recent.push({id,repo:job.repo,status:job.status});
          if(recent.length>=20)break;
        }
        const control=$('agentHubRecent');
        control.replaceChildren();
        const placeholder=document.createElement('option');
        placeholder.value='';placeholder.textContent='Önceki ajan görevlerinden seç';
        control.appendChild(placeholder);
        for(const job of recent){
          const option=document.createElement('option');
          option.value=job.id;
          option.textContent=(job.repo||'depo')+' — '+job.status+' — '+job.id.slice(0,8);
          control.appendChild(option);
        }
      }catch(error){$('hubWorkflowReport').textContent='Geçmiş alınamadı: '+error.message;}
    }
    $('agentHubRecent').addEventListener('change',e=>{$('agentHubWorkflowId').value=e.target.value;});
    $('hubLoadRecent').addEventListener('click',loadRecentWorkflows);
    $('hubCheckWorkflow').addEventListener('click',async()=>{
      const id=$('agentHubWorkflowId').value.trim();
      if(!/^[a-f0-9-]{36}$/i.test(id)){$('hubWorkflowReport').textContent='Geçerli bir Workflow kimliği gir.';return;}
      try{
        const data=await api('/api/tools/agent-hub/durable/'+encodeURIComponent(id));
        const output=data.output||{};
        $('hubWorkflowReport').textContent='Durum: '+(data.status||'?')+
          (output.summary?'\\n\\n'+String(output.summary.text||''):'')+
          (output.progress?'\\n\\nGörev: '+String(output.progress.status||''):'')+
          ((output.progress?.audit_findings||[]).length?'\\n\\nKOD DENETİMİ:\\n'+output.progress.audit_findings.slice(0,50).map(f=>String(f.file||'')+':'+Number(f.line||0)+' ['+String(f.severity||'')+'] '+String(f.message||'')).join('\\n'):'');
      }catch(error){$('hubWorkflowReport').textContent=error.message;}
    });
    const providers=document.createElement('div');
    providers.innerHTML='<h3>Entegrasyonlar</h3><div id="agentHubProviders">Durum yükleniyor...</div>';
    section.appendChild(providers);
    async function refreshProviders(){
      try{
        const data=await api('/api/tools/agent-hub/providers');
        $('agentHubProviders').innerHTML=data.providers.map(p=>'<p><strong>'+esc(p.name)+'</strong> — '+esc(p.state)+'<br><small>'+esc(p.requirements)+'</small></p>').join('');
      }catch(e){$('agentHubProviders').textContent=e.message;}
    }
    // Curated repository suggestions and Skills.sh-compatible SKILL.md discovery.
    const suggestions=document.createElement('datalist');
    suggestions.id='agentHubRepoList';
    section.appendChild(suggestions);
    for (const field of ['agentHubRepo','hubAutoRepo']) {
      $(field).setAttribute('list','agentHubRepoList');
      $(field).value='Haydars1/jarvis-personal-ai';
    }
    async function loadRepoSuggestions(){
      try{
        const data=await api('/api/tools/agent-hub/catalog');
        suggestions.replaceChildren();
        for(const repo of data.repositories||[]){
          const option=document.createElement('option');
          option.value=repo;suggestions.appendChild(option);
        }
        const skillSource=$('hubSkillSource'),previous=skillSource.value;
        skillSource.replaceChildren();
        const allSources=document.createElement('option');
        allSources.value='all';allSources.textContent='Tüm doğrulanmış kaynaklar';skillSource.appendChild(allSources);
        for(const repo of data.skill_sources||[]){
          const option=document.createElement('option');
          option.value=repo;option.textContent=repo;skillSource.appendChild(option);
        }
        skillSource.value=(data.skill_sources||[]).includes(previous)?previous:'all';
        $('hubSkillLearn').disabled=skillSource.value==='all';
      }catch(error){if(error.message!=='AUTH_REQUIRED')$('agentHubMessage').textContent='Kaynak listesi: '+error.message;}
    }
    const automotive=document.createElement('section');
    automotive.innerHTML='<h3>Otomotiv ve ECU araçları</h3><p class="muted">Gerçek GitHub projeleri: OBD teşhis, VIN, CAN, ECU firmware analizi. Katalog ve uyumluluk bilgisi; cihaz bağlantısı veya kurulum değildir.</p><input id="hubAutoToolsQuery" maxlength="1000" placeholder="Örn: Thinkdiag canlı veri, ECU BIN analizi veya VIN ile araç bul"><button type="button" id="hubAutoToolsFind">Uygun otomotiv aracını bul</button><div id="hubAutoToolsResults" aria-live="polite"></div>';
    section.appendChild(automotive);
    const vinWidget=document.createElement('section');
    vinWidget.innerHTML='<h4>VIN ile araç tanımla (ücretsiz NHTSA)</h4><p class="muted">VIN yalnızca sorgu düğmesine basınca NHTSA API ile paylaşılır. Avrupa modellerinde sonuç eksik olabilir.</p><input id="hubVinInput" maxlength="17" autocomplete="off" placeholder="17 haneli şasi numarası"><button type="button" id="hubVinDecode">VIN sorgula</button><pre id="hubVinResult" style="white-space:pre-wrap"></pre>';
    automotive.appendChild(vinWidget);
    $('hubVinDecode').addEventListener('click',async()=>{
      const vin=$('hubVinInput').value.trim();
      $('hubVinResult').textContent='NHTSA sorgulanıyor...';
      try{
        const response=await api('/api/tools/agent-hub/vin-decode',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({vin})});
        const v=response.vehicle||{};
        $('hubVinResult').textContent=['Marka: '+(v.make||'?'),'Model: '+(v.model||'?'),'Yıl: '+(v.year||'?'),'Motor: '+(v.engine||'?'),'Yakıt: '+(v.fuel||'?'),'Kaynak: NHTSA vPIC'].join('\\n');
      }catch(error){$('hubVinResult').textContent='VIN sorgusu başarısız: '+error.message;}
    });
    $('hubAutoToolsFind').addEventListener('click',async()=>{
      const q=$('hubAutoToolsQuery').value.trim();
      if(!q){$('hubAutoToolsResults').textContent='Ne yapmak istediğini yaz.';return;}
      $('hubAutoToolsResults').textContent='Kaynaklar eşleştiriliyor...';
      try{
        const data=await api('/api/tools/agent-hub/automotive-tools?task='+encodeURIComponent(q));
        const target=$('hubAutoToolsResults');target.replaceChildren();
        if(!data.tools?.length){target.textContent='Bu iş için doğrulanmış araç bulunamadı.';return;}
        for(const tool of data.tools){
          const item=document.createElement('p');
          const a=document.createElement('a');
          a.href='https://github.com/'+encodeURI(tool.repo);a.target='_blank';a.rel='noopener noreferrer';
          a.textContent=tool.repo;
          item.appendChild(a);
          const note=document.createElement('small');
          note.textContent=' — '+tool.title+' • '+tool.runtime+' • '+(tool.device_required?'Cihaz gerekiyor':'Cihaz gerekmiyor')+' • '+(tool.thinkdiag_compatible?'Thinkdiag uyumlu':'Thinkdiag uyumluluğu doğrulanmadı')+' • Kurulu değil';
          item.appendChild(note);target.appendChild(item);
        }
      }catch(error){$('hubAutoToolsResults').textContent=error.message;}
    });
    const ecuUpload=document.createElement('section');
    ecuUpload.innerHTML='<h3>ECU dosya analizi</h3><p class="muted">BIN, HEX, ROM veya ORI dosyanı seç (en fazla 4 MB). Analiz bellekte yapılır; dosya saklanmaz veya ECU\'ya yazılmaz.</p><input id="hubEcuFile" type="file" accept=".bin,.hex,.rom,.ori"><button type="button" id="hubEcuAnalyze">Dosyayı analiz et</button><pre id="hubEcuAnalysis" style="white-space:pre-wrap;overflow-wrap:anywhere"></pre>';
    section.appendChild(ecuUpload);
    $('hubEcuAnalyze').addEventListener('click',async()=>{
      const file=$('hubEcuFile').files?.[0],output=$('hubEcuAnalysis');
      if(!file){output.textContent='Bir ECU dosyası seç.';return;}
      if(!/\.(bin|hex|rom|ori)$/i.test(file.name)||file.size>4*1024*1024||file.size===0){output.textContent='Desteklenen uzantı ve boyut gerekli (1 bayt–4 MB).';return;}
      output.textContent='Dosya analiz ediliyor...';
      try{
        const result=await api('/api/tools/agent-hub/ecu-file-inspect',{method:'POST',headers:{'content-type':'application/octet-stream','x-ecu-filename':file.name},body:file});
        const a=result.analysis||{};
        output.textContent=['Dosya: '+a.file,'Boyut: '+a.size_bytes+' bayt','Entropi: '+a.entropy_bits_per_byte+' bit/bayt','İşaretler: '+((a.ascii_markers||[]).join(', ')||'Bulunamadı'),'Başlık: '+a.header_hex,'Checksum doğrulandı: Hayır','ECU tanımlaması kesin değil'].join('\n');
      }catch(error){output.textContent='Analiz başarısız: '+error.message;}
    });
    const ecuCompare=document.createElement('section');
    ecuCompare.innerHTML='<h3>Orijinal / değiştirilmiş ECU dosyası karşılaştırma</h3><p class="muted">İki BIN, ORI, ROM veya Intel HEX dosyasını karşılaştır. Değişen byte sayısı ve adres aralıkları gösterilir. Dosyalar kaydedilmez; firmware checksum otomatik düzeltilmez.</p><div class="row"><label>Orijinal dosya<input id="hubEcuOriginal" type="file" accept=".bin,.hex,.rom,.ori"></label><label>Değiştirilmiş dosya<input id="hubEcuModified" type="file" accept=".bin,.hex,.rom,.ori"></label></div><button type="button" id="hubEcuCompare">Dosyaları karşılaştır</button><pre id="hubEcuCompareResult" style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:400px;overflow:auto" aria-live="polite"></pre>';
    section.appendChild(ecuCompare);
    $('hubEcuCompare').addEventListener('click',async()=>{
      const original=$('hubEcuOriginal').files?.[0],modified=$('hubEcuModified').files?.[0],output=$('hubEcuCompareResult');
      if(!original||!modified){output.textContent='Karşılaştırmak için iki dosya seç.';return;}
      const permitted=file=>/\.(bin|hex|rom|ori)$/i.test(file.name)&&file.size>0&&file.size<=4*1024*1024;
      if(!permitted(original)||!permitted(modified)){output.textContent='Dosyalar 4 MB veya daha küçük BIN, HEX, ORI ya da ROM olmalı.';return;}
      const form=new FormData();form.set('original',original);form.set('modified',modified);
      output.textContent='Dosyalar karşılaştırılıyor...';
      try{
        const result=await api('/api/tools/agent-hub/ecu-compare',{method:'POST',body:form});
        const c=result.comparison||{};
        const lines=['Orijinal: '+(c.original?.file||'?')+' ('+(c.original?.format||'?')+')',
          'Yeni: '+(c.modified?.file||'?')+' ('+(c.modified?.format||'?')+')',
          'Durum: '+(c.identical?'Aynı':'Farklı'),
          'Değişen byte: '+c.changed_bytes,'Eklenen byte: '+c.added_bytes,'Çıkarılan byte: '+c.removed_bytes,
          'Farklı adres aralığı: '+c.total_changed_ranges,
          'Intel HEX kayıt checksum: '+(c.intel_hex_record_checksums_valid===true?'Geçerli':c.intel_hex_record_checksums_valid===null?'Uygulanmaz':'Doğrulanmadı'),
          'Orijinal SHA-256: '+(c.original?.sha256||'?'),
          'Değiştirilmiş SHA-256: '+(c.modified?.sha256||'?'),
          'Not: SHA-256 dosya parmak izidir, ECU checksum değildir.',
          'ECU firmware checksum: Doğrulanmadı'];
        for(const range of c.ranges||[]){
          lines.push(range.start_hex+' – '+range.end_hex+' ('+(range.changed+range.added+range.removed)+' byte)',
            '  Önce: '+range.before_hex,'  Sonra: '+range.after_hex);
        }
        if(c.truncated_ranges)lines.push('Not: İlk 64 farklı adres aralığı gösteriliyor.');
        output.textContent=lines.join('\n');
      }catch(error){output.textContent='Karşılaştırma başarısız: '+error.message;}
    });
    const directory=document.createElement('div');
    directory.innerHTML='<h3>GitHub / Skills.sh beceri keşfi</h3><p class="muted">Beceri dosyaları yalnızca incelenir. Üçüncü taraf kodlar çalıştırılmaz.</p><div class="row"><select id="hubSkillSource" aria-label="GitHub beceri kaynağı"><option value="all">Tüm doğrulanmış kaynaklar</option></select><input id="hubSkillQuery" maxlength="100" placeholder="Beceri ara: cloudflare, code-review..." aria-label="Beceri ara"><button type="button" id="hubSkillScan">Becerileri tara</button><button type="button" id="hubSkillLearn">Kaynağı JARVIS’e öğret</button></div><p id="hubSkillStatus" aria-live="polite"></p><div class="row"><button type="button" id="hubSkillPrevious" disabled>Önceki sayfa</button><button type="button" id="hubSkillNext" disabled>Sonraki sayfa</button></div><div id="hubSkillList"></div><pre id="hubSkillPreview" style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:360px;overflow:auto"></pre>';
    section.appendChild(directory);
    $('hubSkillLearn').addEventListener('click',async()=>{
      const repo=$('hubSkillSource').value;
      if(repo==='all'){$('hubSkillStatus').textContent='Bütün kaynaklar topluca çalıştırılamaz. İncelemek istediğin depoyu seç.';return;}
      $('hubSkillStatus').textContent='Kaynak öğrenme görevi hazırlanıyor...';
      try {
        const result=await api('/api/tools/skills/compile',{
          method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({repo})
        });
        $('hubSkillStatus').textContent='Öğrenme görevi kuyruğa eklendi: '+(result.job?.id||'')+'. Sonuç için görev durumunu yenile.';
        await refresh();
      }catch(error){$('hubSkillStatus').textContent=error.message;}
    });
    const matcher=document.createElement('div');
    matcher.innerHTML='<h3>Göreve göre beceri öner</h3><p class="muted">Görev yaz; JARVIS onaylı SKILL.md kaynaklarını önerir. Kod çalıştırmaz.</p><input id="hubSkillTask" maxlength="1000" placeholder="Örn: 6006 web sitesinin SEO ve erişilebilirliğini iyileştir"><button type="button" id="hubSuggestSkills">Beceri öner</button><div id="hubSuggestedSkills" aria-live="polite"></div>';
    directory.appendChild(matcher);
    $('hubSuggestSkills').addEventListener('click',async()=>{
      const task=$('hubSkillTask').value.trim();
      if(!task){$('hubSuggestedSkills').textContent='Görev açıklaması yaz.';return;}
      $('hubSuggestedSkills').textContent='Uygun beceriler aranıyor...';
      try{
        const data=await api('/api/tools/agent-hub/skill-suggest?task='+encodeURIComponent(task));
        const target=$('hubSuggestedSkills');
        target.replaceChildren();
        if(!data.skills?.length){target.textContent='Bu görev için onaylı beceri bulunamadı.';return;}
        for(const skill of data.skills){
          const button=document.createElement('button');button.type='button';
          button.textContent=skill.name+' ('+skill.repo+')';
          button.addEventListener('click',async()=>{
            $('hubSkillPreview').textContent='Beceri okunuyor...';
            try{
              const result=await api('/api/tools/agent-hub/skill-preview?repo='+encodeURIComponent(skill.repo)+'&path='+encodeURIComponent(skill.path));
              $('hubSkillPreview').textContent=result.content.slice(0,8000);
            }catch(error){$('hubSkillPreview').textContent=error.message;}
          });
          target.appendChild(button);
        }
      }catch(error){$('hubSuggestedSkills').textContent=error.message;}
    });
    const featured=document.createElement('div');
    featured.innerHTML='<h4>Önerilen beceriler</h4><p class="muted">Doğrulanmış kaynak dosyalarını açar; kod çalıştırmaz.</p><div id="hubRecommendedSkills"></div>';
    directory.appendChild(featured);
    for(const skill of [
      {name:'Web tasarımı ve erişilebilirlik',path:'skills/web-design-guidelines/SKILL.md'},
      {name:'React performansı',path:'skills/react-best-practices/SKILL.md'},
      {name:'React bileşen mimarisi',path:'skills/composition-patterns/SKILL.md'}
    ]){
      const button=document.createElement('button');button.type='button';
      button.textContent=skill.name;
      button.addEventListener('click',async()=>{
        $('hubSkillPreview').textContent='Kaynak okunuyor...';
        try{
          const result=await api('/api/tools/agent-hub/skill-preview?repo=vercel-labs%2Fagent-skills&path='+encodeURIComponent(skill.path));
          $('hubSkillPreview').textContent=result.content.slice(0,8000);
        }catch(error){$('hubSkillPreview').textContent=error.message;}
      });
      $('hubRecommendedSkills').appendChild(button);
    }
    const skillPageSize=40;
    let skillPageOffset=0;
    async function scanSkills(offset=0){
      const selected=$('hubSkillSource').value,query=$('hubSkillQuery').value.trim();
      $('hubSkillStatus').textContent='GitHub beceri dosyaları aranıyor...';
      $('hubSkillList').replaceChildren();
      $('hubSkillPreview').textContent='';
      $('hubSkillPrevious').disabled=true;
      $('hubSkillNext').disabled=true;
      try{
        const url='/api/tools/agent-hub/skills-directory?repo='+encodeURIComponent(selected)+
          '&query='+encodeURIComponent(query)+'&offset='+offset+'&limit='+skillPageSize;
        const data=await api(url);
        skillPageOffset=data.offset;
        const count=(data.skills||[]).length;
        $('hubSkillStatus').textContent=data.total+' eşleşen SKILL.md • '+(count?data.offset+1:0)+'–'+(data.offset+count)+
          ' görüntüleniyor.'+(selected==='all'?' '+data.sources_loaded+'/'+data.sources+' kaynak tarandı.':'')+
          (data.partial?' Bazı kaynaklar erişilemedi: '+(data.source_errors||[]).map(item=>item.repo).join(', ')+'.':'')+
          (data.truncated?' GitHub dizini eksik olabilir.':'')+
          ' Beceriler henüz kurulu veya çalıştırılabilir değil.';
        $('hubSkillPrevious').disabled=skillPageOffset===0;
        $('hubSkillNext').disabled=!data.has_more;
        for(const skill of data.skills||[]){
          const button=document.createElement('button');button.type='button';
          button.textContent=skill.name+' — '+skill.repo+' / '+skill.path;button.style.display='block';
          button.addEventListener('click',async()=>{
            $('hubSkillPreview').textContent='Beceri okunuyor...';
            try{
              const result=await api('/api/tools/agent-hub/skill-preview?repo='+encodeURIComponent(selected)+'&path='+encodeURIComponent(skill.path));
              $('hubSkillPreview').textContent=result.content.slice(0,8000);
            }catch(error){$('hubSkillPreview').textContent=error.message;}
          });
          $('hubSkillList').appendChild(button);
        }
      }catch(error){$('hubSkillStatus').textContent=error.message;}
    }
    $('hubSkillScan').addEventListener('click',()=>scanSkills(0));
    $('hubSkillPrevious').addEventListener('click',()=>scanSkills(Math.max(0,skillPageOffset-skillPageSize)));
    $('hubSkillNext').addEventListener('click',()=>scanSkills(skillPageOffset+skillPageSize));
    $('hubSkillSource').addEventListener('change',()=>{ $('hubSkillLearn').disabled=$('hubSkillSource').value==='all';scanSkills(0); });
    $('hubSkillQuery').addEventListener('keydown',event=>{if(event.key==='Enter')scanSkills(0);});
    function refreshHubAfterLogin(){
      refresh();refreshProviders();loadRecentWorkflows();loadRepoSuggestions();
    }
    $('agentHubRefresh').addEventListener('click',refreshHubAfterLogin);
    // The panel mounts behind the login screen. Fetch again after the owner opens Settings.
    document.querySelectorAll('[data-page="settings"]').forEach(button=>{
      button.addEventListener('click',refreshHubAfterLogin);
    });
    $('agentHubPlan').addEventListener('click',async()=>{
      const task=$('agentHubTask').value.trim();
      if (!task) return;
      $('agentHubMessage').textContent='Uygun beceriler aranıyor...';
      try {
        const data=await api('/api/tools/agent-hub/plan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({task})});
        $('agentHubMessage').textContent=(data.recommended_skills||[]).length+' uygun beceri bulundu. Çalıştırma otomatik başlatılmadı.';
        $('agentHubSkills').innerHTML=(data.recommended_skills||[]).map(s=>'<div class="card"><strong>'+esc(s.repo)+'</strong><p class="muted">'+esc(s.primary_capability)+' • '+esc(s.execution_state)+' • '+esc(s.risk)+'</p></div>').join('') || '<p class="muted">Bu görev için doğrulanmış beceri bulunamadı.</p>';
      } catch(e) { $('agentHubMessage').textContent=e.message; }
    });
    // Do not fetch authenticated data before sign-in; Settings navigation triggers load.
    if(document.getElementById('app')?.classList.contains('hidden')===false &&
       document.getElementById('settings')?.classList.contains('active'))refreshHubAfterLogin();
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount);
  else mount();
})();
