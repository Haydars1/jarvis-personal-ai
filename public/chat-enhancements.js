(() => {
  let attachments = [];

  function removeToolsTab() {
    document.querySelectorAll('[data-page="tools"]').forEach(x => x.remove());
    const page = document.querySelector('#tools');
    if (page) page.remove();
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || '').split(',')[1] || '');
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  function ensureAttachmentUI() {
    const composer = document.querySelector('#chat .chatComposer');
    if (!composer || document.querySelector('#chatAttachBtn')) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.id = 'chatAttachInput';
    input.accept = 'image/*';
    input.multiple = true;
    input.hidden = true;

    const camera = document.createElement('input');
    camera.type = 'file';
    camera.id = 'chatCameraInput';
    camera.accept = 'image/*';
    camera.setAttribute('capture', 'environment');
    camera.hidden = true;

    const attach = document.createElement('button');
    attach.id = 'chatAttachBtn';
    attach.type = 'button';
    attach.className = 'iconBtn';
    attach.title = 'Fotoğraf ekle';
    attach.textContent = '📎';

    const cam = document.createElement('button');
    cam.id = 'chatCameraBtn';
    cam.type = 'button';
    cam.className = 'iconBtn';
    cam.title = 'Kameradan fotoğraf çek';
    cam.textContent = '📷';

    const strip = document.createElement('div');
    strip.id = 'chatAttachments';
    strip.className = 'chatAttachments hidden';

    composer.prepend(strip);
    composer.prepend(input);
    composer.prepend(camera);
    const textarea = composer.querySelector('#chatCmd');
    textarea.before(attach, cam);

    attach.onclick = () => input.click();
    cam.onclick = () => camera.click();
    input.onchange = () => addFiles([...input.files]);
    camera.onchange = () => addFiles([...camera.files]);
  }

  async function addFiles(files) {
    const imgs = files.filter(f => /^image\//i.test(f.type)).slice(0, 3 - attachments.length);
    for (const f of imgs) {
      if (f.size > 6 * 1024 * 1024) { toast(f.name + ' çok büyük (maks. 6 MB)'); continue; }
      const base64 = await fileToBase64(f);
      attachments.push({ name: f.name, type: f.type || 'image/jpeg', base64, preview: URL.createObjectURL(f) });
    }
    renderAttachments();
  }

  function renderAttachments() {
    const host = document.querySelector('#chatAttachments');
    if (!host) return;
    host.classList.toggle('hidden', !attachments.length);
    host.innerHTML = attachments.map((a,i) => `<div class="chatAttachment"><img src="${a.preview}" alt=""><span>${esc(a.name)}</span><button type="button" data-i="${i}">×</button></div>`).join('');
    host.querySelectorAll('button[data-i]').forEach(b => b.onclick = () => {
      const i = Number(b.dataset.i);
      try { URL.revokeObjectURL(attachments[i]?.preview); } catch {}
      attachments.splice(i,1);
      renderAttachments();
    });
  }

  function renderInlineTools(items=[]) {
    if (!items.length) return;
    const host = document.querySelector('#chatHistory');
    if (!host) return;
    const box = document.createElement('div');
    box.className = 'chatMsg assistant toolCardsInline';
    box.innerHTML = '<b>Bulduğum araçlar</b>' + items.slice(0,5).map(t => `<a target="_blank" rel="noopener" href="${esc(t.url||'#')}">${esc(t.title||'AI aracı')}</a><small>${esc(t.snippet||'')}</small>`).join('');
    host.appendChild(box);
    host.scrollTop = host.scrollHeight;
  }

  function appendLocalPhotoPreview(items) {
    const host = document.querySelector('#chatHistory');
    if (!host || !items.length) return;
    const box = document.createElement('div');
    box.className = 'chatMsg user chatPhotoBubble';
    box.innerHTML = items.map(a => `<img src="${a.preview}" alt="${esc(a.name)}">`).join('');
    host.appendChild(box);
    host.scrollTop = host.scrollHeight;
  }

  if (typeof send === 'function') {
    const baseSend = send;
    send = async function(t) {
      t = String(t || '').trim();
      if (!attachments.length) return baseSend(t);
      const payloadAttachments = attachments.map(({name,type,base64}) => ({name,type,base64}));
      const previews = attachments.slice();
      attachments = [];
      renderAttachments();
      switchPage('chat');
      appendChat('user', t || 'Bu fotoğrafı incele');
      appendLocalPhotoPreview(previews);
      mode('THINKING','Fotoğrafı inceliyorum');
      try {
        const r = await api('/api/chat/send',{method:'POST',body:JSON.stringify({text:t,attachments:payloadAttachments})});
        STATE = r.state;
        render();
        renderChat(r.history || []);
        if (r.tools) renderInlineTools(r.tools);
        const p = document.querySelector('#chatProvider');
        if (p) p.textContent = `Kalıcı hafıza • ${r.provider || 'JARVIS'}`;
        speak(r.reply);
      } catch (e) {
        appendChat('assistant','Fotoğraf işlenemedi: '+e.message,'Sistem');
        toast(e.message);
        mode('IDLE','Hata');
      } finally {
        previews.forEach(a => { try { URL.revokeObjectURL(a.preview); } catch {} });
      }
    };
  }

  const nativeTools = typeof tools === 'function' ? tools : null;
  if (nativeTools) {
    tools = function(items) { renderInlineTools(items || []); };
  }

  removeToolsTab();
  ensureAttachmentUI();
  setTimeout(() => { removeToolsTab(); ensureAttachmentUI(); }, 500);
})();
