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
        const result=await api('/api/tools/agent-hub/agent',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({repo,task})});
        $('agentHubMessage').textContent='Ajan kuyruğa eklendi: '+result.workflow_id+' — 3 görev adımı.';
        refresh();
      }catch(error){$('agentHubMessage').textContent=error.message;}
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
    refreshProviders();
    // Curated repository suggestions and Skills.sh-compatible SKILL.md discovery.
    const suggestions=document.createElement('datalist');
    suggestions.id='agentHubRepoList';
    section.appendChild(suggestions);
    for (const field of ['agentHubRepo','hubAutoRepo']) {
      $(field).setAttribute('list','agentHubRepoList');
      $(field).value='Haydars1/jarvis-personal-ai';
    }
    api('/api/tools/agent-hub/catalog').then(data=>{
      for (const repo of data.repositories||[]) {
        const option=document.createElement('option');
        option.value=repo;suggestions.appendChild(option);
      }
    }).catch(error=>{$('agentHubMessage').textContent='Kaynak listesi: '+error.message;});
    const directory=document.createElement('div');
    directory.innerHTML='<h3>GitHub / Skills.sh beceri keşfi</h3><p class="muted">Beceri dosyaları yalnızca incelenir. Üçüncü taraf kodlar çalıştırılmaz.</p><div class="row"><select id="hubSkillSource"><option value="anthropics/skills">Anthropic Skills</option><option value="vercel-labs/skills">Skills.sh CLI deposu</option></select><button type="button" id="hubSkillScan">Becerileri tara</button></div><p id="hubSkillStatus" aria-live="polite"></p><div id="hubSkillList"></div><pre id="hubSkillPreview" style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:360px;overflow:auto"></pre>';
    section.appendChild(directory);
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
    $('agentHubRefresh').addEventListener('click',()=>{refresh();refreshProviders();});
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
    refresh();
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount);
  else mount();
})();
