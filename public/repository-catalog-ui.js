function mount() {
  const host = document.querySelector('#tools'); if (!host) return;
  const card = document.createElement('div'); card.className = 'card';
  card.innerHTML = '<h3>PDF GitHub Becerileri</h3><p>Her repo için kaynak doğrulaması ve çalıştırma durumu ayrı gösterilir.</p><div class="row"><input id="repositorySearch" placeholder="ThinkDiag, ses, ECU veya repo ara"><button id="repositoryRefresh">LİSTEYİ YÜKLE</button></div><p id="repositoryStatus" role="status">Liste henüz yüklenmedi.</p><div id="repositoryRows" style="max-height:600px;overflow:auto"></div><pre id="repositoryResult" style="white-space:pre-wrap"></pre>';
  host.append(card); let rows = [];
  const labels = { ready: 'Çalışır adaptör', 'source-only': 'Kaynak bağlantısı', 'configuration-required': 'Servis ayarı gerekli', 'hardware-required': 'Donanım/adaptör gerekli', reference: 'Kaynak materyali' };
  const api = async (path, body) => { const response = await fetch(path, { credentials: 'include', ...(body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || response.status); return result; };
  function render() {
    const root = document.querySelector('#repositoryRows'); root.replaceChildren(); const term = document.querySelector('#repositorySearch').value.trim().toLowerCase();
    for (const row of rows.filter(row => `${row.repo} ${row.category} ${row.integration.detail}`.toLowerCase().includes(term))) {
      const article = document.createElement('article'); article.style.padding = '12px 0'; article.style.borderBottom = '1px solid #444'; const link = document.createElement('a'); link.href = row.url; link.target = '_blank'; link.rel = 'noopener'; link.textContent = row.repo;
      const detail = document.createElement('p'); detail.textContent = `${labels[row.integration.status]} · Lisans: ${row.license || 'doğrulanmadı'} · ${row.source_verification === 'source-verified' ? 'Commit ve README doğrulandı' : row.metadata_verified ? 'Metaveri doğrulandı; README yok' : 'Doğrulama bekleniyor'}\n${row.integration.detail}`;
      const button = document.createElement('button'); button.textContent = 'KAYNAĞI İNCELE'; button.onclick = async () => { button.disabled = true; try { const result = await api('/api/tools/cloud/jobs', { adapter_id: 'repo-inspect', repo: row.repo, commit: row.source_commit, input: {} }); document.querySelector('#repositoryResult').textContent = 'Kaynak incelemesi kuyruğa alındı: ' + result.job.id + '. Tamamlandığında “SONUÇLARI GÖSTER” ile görebilirsin.'; } catch (error) { document.querySelector('#repositoryResult').textContent = error.message; } finally { button.disabled = false; } };
      article.append(link, detail, button); root.append(article);
    }
  }
  document.querySelector('#repositorySearch').oninput = render;
  document.querySelector('#repositoryRefresh').onclick = async () => { try { const data = await api('/api/tools/repositories'); rows = data.repositories; document.querySelector('#repositoryStatus').textContent = data.total + ' repo · Çalışır adaptör ve kaynak bağlantısı ayrı gösteriliyor.'; render(); } catch (error) { document.querySelector('#repositoryStatus').textContent = error.message; } };
  const results = document.createElement('button'); results.textContent = 'SONUÇLARI GÖSTER'; results.onclick = async () => { try { const data = await api('/api/tools/cloud/jobs'); document.querySelector('#repositoryResult').textContent = JSON.stringify(data.jobs, null, 2); } catch (error) { document.querySelector('#repositoryResult').textContent = error.message; } }; card.append(results);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
