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
      }catch(error){if(error.message!=='AUTH_REQUIRED')$('agentHubMessage').textContent='Kaynak listesi: '+error.message;}
    }
    const directory=document.createElement('div');
    directory.innerHTML='<h3>GitHub / Skills.sh beceri keşfi</h3><p class="muted">Beceri dosyaları yalnızca incelenir. Üçüncü taraf kodlar çalıştırılmaz.</p><div class="row"><select id="hubSkillSource"><option value="anthropics/skills">Anthropic Skills</option><option value="vercel-labs/agent-skills">Vercel Agent Skills</option></select><button type="button" id="hubSkillScan">Becerileri tara</button><button type="button" id="hubSkillLearn">Kaynağı JARVIS’e öğret</button></div><p id="hubSkillStatus" aria-live="polite"></p><div id="hubSkillList"></div><pre id="hubSkillPreview" style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:360px;overflow:auto"></pre>';
    section.appendChild(directory);
    $('hubSkillLearn').addEventListener('click',async()=>{
      const repo=$('hubSkillSource').value;
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
    $('hubSkillScan').addEventListener('click',async()=>{
      const selected=$('hubSkillSource').value;
      $('hubSkillStatus').textContent='GitHub beceri dosyaları aranıyor...';
      $('hubSkillList').replaceChildren();
      $('hubSkillPreview').textContent='';
      try{
        const data=await api('/api/tools/agent-hub/skills-directory?repo='+encodeURIComponent(selected));
        $('hubSkillStatus').textContent=(data.skills||[]).length+' SKILL.md bulundu.'+(data.truncated?' (GitHub listesi sınırlı)':'');
        for(const skill of data.skills||[]){
          const button=document.createElement('button');button.type='button';
          button.textContent=skill.name+' — '+skill.path;button.style.display='block';
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
    });
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
