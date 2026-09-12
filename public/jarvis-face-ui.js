(() => {
  if(window.__jarvisFaceUi)return;window.__jarvisFaceUi=true;
  const esc=s=>String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const style=document.createElement('style');style.textContent=`
    #chatProvider{font-weight:800;color:#9cefff}.chatMsg.assistant>small{display:none!important}
    .jarvisResourceGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:10px}
    .jarvisResource{display:block;border:1px solid #294466;border-radius:14px;overflow:hidden;text-decoration:none;color:inherit;background:#09172a}
    .jarvisResource img{display:block;width:100%;aspect-ratio:16/10;object-fit:cover}.jarvisResource div{padding:9px}.jarvisResource b{font-size:13px}.jarvisResource small{display:block;color:#8ba4b7;margin-top:4px}
    @media(max-width:600px){.jarvisResourceGrid{grid-template-columns:1fr}}
  `;document.head.appendChild(style);
  const nativeFetch=window.fetch.bind(window);
  window.fetch=async(...args)=>{
    const res=await nativeFetch(...args);
    try{
      const url=typeof args[0]==='string'?args[0]:args[0]?.url||'';
      if(!String(url).includes('/api/chat/send'))return res;
      const x=await res.clone().json().catch(()=>null);if(!x)return res;
      setTimeout(()=>{
        const p=document.querySelector('#chatProvider');if(p)p.textContent='JARVIS';
        const host=document.querySelector('#chatHistory');if(!host)return;
        if(x.resources?.length){const box=document.createElement('div');box.className='chatMsg assistant';box.innerHTML='<b>Bulduğum görsel / video kaynakları</b><div class="jarvisResourceGrid">'+x.resources.slice(0,8).map(r=>`<a class="jarvisResource" href="${esc(r.url)}" target="_blank" rel="noopener">${r.image?`<img src="${esc(r.image)}" alt="">`:''}<div><b>${esc(r.title||'Kaynak')}</b><small>${esc(r.source||'')}</small></div></a>`).join('')+'</div>';host.appendChild(box);host.scrollTop=host.scrollHeight}
      },120);
    }catch{}
    return res;
  };
  const enforce=()=>{const p=document.querySelector('#chatProvider');if(p)p.textContent='JARVIS';document.querySelectorAll('#chatHistory .chatMsg.assistant small').forEach(x=>x.style.display='none')};
  new MutationObserver(enforce).observe(document.documentElement,{childList:true,subtree:true});setTimeout(enforce,300);
})();