(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const OFFICIAL = 'https://kt200ii.com/support-list/';
  let lastLookup = null;
  function status(message) { const el = $('#ktStatus'); if (el) el.textContent = message; }
  function goPage() {
    if (typeof window.switchPage === 'function') window.switchPage('ecucompat');
    else {
      document.querySelectorAll('main .page').forEach(p => p.classList.toggle('active', p.id === 'ecucompat'));
      document.querySelectorAll('[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === 'ecucompat'));
    }
    // Use the existing ECU vehicle selection as a convenience, not as an ECU identification claim.
    if ($('#vMake')?.value && !$('#ktBrand').value) {
      $('#ktBrand').value = $('#vMake').selectedOptions?.[0]?.textContent || '';
      $('#ktModel').value = $('#vModel')?.value || '';
      $('#ktYear').value = $('#vYear')?.value || '';
      $('#ktEcuType').value = $('#vEcu')?.value || '';
    }
  }
  function field(id, name, placeholder = '', type = 'text') {
    return '<label class="ktField">' + name + '<input id="' + id + '" type="' + type + '" placeholder="' + placeholder + '" autocomplete="off"></label>';
  }
  function mount() {
    if (!document.querySelector('main') || $('#ecucompat')) return;
    const style = document.createElement('style');
    style.textContent = '.ktCard{border:1px solid rgba(160,160,160,.25);border-radius:14px;padding:15px;margin:12px 0}.ktGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.ktField{display:flex;flex-direction:column;gap:5px;font-size:12px}.ktField input,.ktField select,.ktField textarea{width:100%;min-width:0}.ktActions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.ktMuted{opacity:.76;font-size:12px;line-height:1.6}.ktResult{padding:12px;margin:8px 0;border:1px solid rgba(160,160,160,.23);border-radius:10px}.ktResult small{display:block;margin:5px 0}.ktResult a{overflow-wrap:anywhere}.ktWarning{border-left:3px solid #e9ae58;padding:9px 12px;margin:10px 0;background:rgba(190,140,60,.07)}@media(max-width:720px){.ktGrid{grid-template-columns:1fr}.ktActions button{flex:1}}';
    document.head.appendChild(style);
    for (const [selector, label] of [['aside nav','⌕ <span>KT200 II ECU Bul</span>'],['.bottomNav','⌕<small>ECU Bul</small>']]) {
      const nav = $(selector);
      if (!nav || nav.querySelector('[data-page="ecucompat"]')) continue;
      const button = document.createElement('button');
      button.dataset.page = 'ecucompat';
      button.innerHTML = label;
      button.addEventListener('click', goPage);
      nav.appendChild(button);
    }
    const section = document.createElement('section');
    section.id = 'ecucompat';
    section.className = 'page';
    section.innerHTML = '<h1>KT200 II · Araçtan ECU Bul</h1>' +
      '<p class="ktMuted">Marka, model ve motor bilgilerini gir. Yerel ECU kataloğu ve mevcutsa kaynak araması taranır; gerçek okuma yöntemi ECU ID ile doğrulanır.</p>' +
      '<form id="ktForm" class="ktCard"><div class="ktGrid">' +
      field('ktBrand','Marka *','VW / Audi / BMW') +
      field('ktModel','Model *','Passat B8 / A6 C8') +
      field('ktYear','Yıl','2021','number') +
      field('ktEngine','Motor','2.0 TDI / 3.0 TDI') +
      field('ktPower','Güç (PS)','150','number') +
      field('ktPart','ECU parça numarası (isteğe bağlı)','04L 906 ...') +
      field('ktHW','HW / donanım numarası','Thinkdiag bilgisi') +
      field('ktSW','SW / yazılım numarası','Thinkdiag bilgisi') +
      field('ktEcuType','ECU tipi (biliniyorsa)','EDC17 / MD1 / MG1') +
      '</div><div class="ktActions"><button type="submit">ECU ARAŞTIR</button><button type="button" id="ktChat" class="softBtn">SOHBETTE DEĞERLENDİR</button><a id="ktOfficial" href="' + OFFICIAL + '" target="_blank" rel="noopener noreferrer">KT200 II resmi protokol listesi ↗</a></div></form>' +
      '<p class="ktWarning ktMuted"><strong>Güvenlik:</strong> Araç modeli ECU kimliğini kesinleştirmez. OBD / Bench / Boot önerisi, ECU ve HW/SW eşleşmeden onaylanmış sayılmaz. VR gerçek hafıza yedeği değildir.</p>' +
      '<p id="ktStatus" class="ktMuted" aria-live="polite">Araç bilgilerini girerek başla.</p><div id="ktResults"></div>' +
      '<details class="ktCard"><summary>Doğruladığım protokolü kaydet (isteğe bağlı)</summary>' +
      '<p class="ktMuted">KT200 II programında ve üretici listesinde kontrol ettiğin sonucu, ECU parça + HW/SW numarasıyla not al. Bu işlem ECU’ya komut göndermez.</p>' +
      '<form id="ktNoteForm"><div class="ktGrid"><label class="ktField">Bağlantı yöntemi<select id="ktMethod"><option value="OBD">OBD</option><option value="BENCH">BENCH</option><option value="BOOT">BOOT</option><option value="JTAG">JTAG</option><option value="BDM">BDM</option></select></label>' +
      '<label class="ktField">Okuma türü<select id="ktReadType"><option value="UNKNOWN">Belirsiz</option><option value="PHYSICAL_READ">Gerçek okuma</option><option value="VIRTUAL_READ">Virtual Read (VR)</option><option value="WRITE_ONLY">Yalnız yazma</option></select></label>' +
      field('ktSource','Kontrol ettiğin kaynak URL *','https://kt200ii.com/support-list/') + '</div>' +
      '<label class="ktField">Not<textarea id="ktNotes" rows="2" placeholder="Protokol adı, sürüm, kısıtlamalar..."></textarea></label>' +
      '<label class="ktMuted"><input type="checkbox" id="ktConfirmed"> ECU parça, HW, SW ve protokol bilgilerini kontrol ettim.</label>' +
      '<div class="ktActions"><button type="submit">PROTOKOL NOTUNU KAYDET</button></div></form></details>';
    $('main').appendChild(section);
    $('#ktForm').addEventListener('submit', event => { event.preventDefault(); lookup(); });
    $('#ktChat').addEventListener('click', openChat);
    $('#ktNoteForm').addEventListener('submit', saveNote);
    window.jarvisKt200Finder = { open: goPage, lookup };
  }
  function values() {
    return {
      brand: $('#ktBrand').value.trim(), model: $('#ktModel').value.trim(), year: $('#ktYear').value.trim(),
      engine: $('#ktEngine').value.trim(), power: $('#ktPower').value.trim(),
      ecu_part_number: $('#ktPart').value.trim(), hw: $('#ktHW').value.trim(), sw: $('#ktSW').value.trim()
    };
  }
  function safeUrl(url) {
    try { const parsed = new URL(url); return parsed.protocol === 'https:' ? parsed.href : ''; } catch { return ''; }
  }
  function resultCard(item) {
    const div = document.createElement('article');
    div.className = 'ktResult';
    div.innerHTML = '<b>' + escapeHtml(item.ecu_type || 'ECU tipi belirtilmemiş') + '</b> · <code>' + escapeHtml(item.part_number || '') + '</code>' +
      '<small>' + escapeHtml([item.brand,item.model,item.engine].filter(Boolean).join(' / ')) + '</small>' +
      '<small class="ktMuted">Model bazlı ECU adayı · <strong>KT200 II yöntemi doğrulanmadı</strong> · üretim yılı doğrulanmadı</small>' +
      (safeUrl(item.source_url) ? '<a href="' + escapeHtml(safeUrl(item.source_url)) + '" target="_blank" rel="noopener noreferrer">Katalog kaynağı ↗</a>' : '') +
      ' <button class="softBtn" type="button">BU ECU’YU SEÇ</button>';
    div.querySelector('button').addEventListener('click', () => {
      $('#ktPart').value = item.part_number || '';
      $('#ktEcuType').value = item.ecu_type || '';
      status('ECU adayını seçtin. HW/SW numaralarını kontrol edip tekrar ARAŞTIR’a bas.');
    });
    return div;
  }
  async function googleResearch(info, target) {
    const query = ['site:kt200ii.com', 'KT200II', info.brand, info.model, info.engine, $('#ktEcuType').value, info.ecu_part_number, 'OBD BENCH'].filter(Boolean).join(' ').slice(0, 250);
    try {
      const res = await fetch('/api/google-search?num=5&q=' + encodeURIComponent(query), { credentials: 'same-origin' });
      if (!res.ok) throw Error('Google bağlantısı yapılandırılmamış olabilir.');
      const data = await res.json();
      const rows = (data.results || []).filter(x => safeUrl(x.url));
      if (!rows.length) throw Error('Kaynak sonucu yok.');
      const block = document.createElement('div');
      block.className = 'ktCard';
      block.innerHTML = '<h3>İnternette bulunan kaynaklar</h3><p class="ktMuted">Bağlantılar araştırma amaçlıdır. Arama özeti protokol desteğinin kanıtı değildir.</p>';
      rows.forEach(item => {
        const link = document.createElement('p');
        link.innerHTML = '<a href="' + escapeHtml(safeUrl(item.url)) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(item.title || item.url) + ' ↗</a>';
        block.appendChild(link);
      });
      target.appendChild(block);
    } catch {
      const infoNode = document.createElement('p');
      infoNode.className = 'ktMuted';
      infoNode.textContent = 'Canlı Google kaynak araması kullanılamadı. Yukarıdaki resmi KT200 II protokol listesi bağlantısıyla kontrol edebilirsin.';
      target.appendChild(infoNode);
    }
  }
  async function lookup() {
    const info = values();
    if ((!info.brand || !info.model) && !info.ecu_part_number) return status('Marka + model veya ECU parça numarası gir.');
    const target = $('#ktResults');
    target.replaceChildren();
    status('Yerel katalog ve kaynaklar kontrol ediliyor...');
    try {
      const params = new URLSearchParams(info);
      const res = await fetch('/api/ecu/compatibility/lookup?' + params, { credentials:'same-origin' });
      const data = await res.json();
      if (!res.ok) throw Error(data.error || 'HTTP ' + res.status);
      lastLookup = data;
      const card = document.createElement('div');
      card.className = 'ktCard';
      card.innerHTML = '<h2>ECU adayları (' + (data.results || []).length + ')</h2>';
      if (!data.results?.length) {
        const p = document.createElement('p');
        p.className = 'ktMuted';
        p.textContent = 'Yerel katalogda bu araç için kayıt bulunamadı. Bu durum aracın KT200 II ile desteklenmediğini göstermez. Thinkdiag ECU ID veya üretici destek listesiyle araştır.';
        card.appendChild(p);
      }
      (data.results || []).forEach(item => card.appendChild(resultCard(item)));
      target.appendChild(card);
      const notes = (data.notes || []);
      if (notes.length) {
        const block = document.createElement('div');
        block.className = 'ktCard';
        block.innerHTML = '<h3>Önceden kaydedilmiş protokol notları</h3><p class="ktMuted">Bunlar kullanıcı tarafından girilmiş notlardır; KT200 II ile canlı bağlantı testi değildir.</p>';
        notes.forEach(n => {
          const row = document.createElement('p');
          const matched = n.evidence_status === 'OPERATOR_RECORDED_EXACT_ID';
          row.innerHTML = '<b>' + escapeHtml(n.method) + '</b> · ' + escapeHtml(n.read_type) +
            ' · <strong>' + (matched ? 'HW/SW ile eşleşen kullanıcı kaydı' : 'HW/SW teyidi gerekiyor') + '</strong>' +
            ' · <a target="_blank" rel="noopener noreferrer" href="' + escapeHtml(safeUrl(n.source_url) || OFFICIAL) + '">Kaynak ↗</a>';
          block.appendChild(row);
        });
        target.appendChild(block);
      }
      status(data.results.length + ' yerel ECU adayı bulundu. OBD / Bench / Boot için protokol ve ECU kimliğini doğrula.');
      await googleResearch(info, target);
    } catch(err) { status('Araştırma tamamlanamadı: ' + err.message); }
  }
  async function saveNote(event) {
    event.preventDefault();
    const info = values();
    if (!info.ecu_part_number || !info.hw || !info.sw || !$('#ktConfirmed').checked) {
      return status('Protokol kaydı için ECU parça numarası, HW, SW ve kontrol onayı gerekli.');
    }
    const body = {
      ...info, ecu_type: $('#ktEcuType').value.trim(), method: $('#ktMethod').value,
      read_type: $('#ktReadType').value, source_url: $('#ktSource').value.trim(),
      notes: $('#ktNotes').value.trim(), operator_confirmed: true
    };
    try {
      const res = await fetch('/api/ecu/compatibility/note', { method:'POST', credentials:'same-origin', headers:{'content-type':'application/json'}, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw Error(data.error || 'HTTP ' + res.status);
      status('Kullanıcı protokol notu kaydedildi. Bu, cihazda test edildiği anlamına gelmez.');
      $('#ktConfirmed').checked = false;
      await lookup();
    } catch(err) { status('Kayıt hatası: ' + err.message); }
  }
  function openChat() {
    const v = values();
    const text = 'KT200 II ECU dosyası okuma yöntemi araştırması: Marka ' + v.brand + ', model ' + v.model + ', yıl ' + v.year + ', motor ' + v.engine + ', güç ' + v.power + ' PS, ECU parça no ' + (v.ecu_part_number || 'bilinmiyor') + ', HW ' + (v.hw || '?') + ', SW ' + (v.sw || '?') + ', ECU tipi ' + ($('#ktEcuType').value || '?') + '. Olası ECU türleri, gerçek Read/Virtual Read farkı, OBD/Bench/Boot destek kanıtlarını ve doğrulanması gereken adımları kaynaklarıyla göster. Modelden kesin destek iddia etme.';
    const chat = $('#chatCmd');
    if (!chat) return status('Sohbet bulunamadı.');
    chat.value = text;
    if (typeof window.switchPage === 'function') window.switchPage('chat');
    else document.querySelector('[data-page="chat"]')?.click();
    chat.focus();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();