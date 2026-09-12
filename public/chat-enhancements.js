(() => {
  function removeToolsTab(){document.querySelectorAll('[data-page="tools"]').forEach(x=>x.remove());document.querySelector('#tools')?.remove()}
  function renderInlineTools(items=[]){if(!items.length)return;const host=document.querySelector('#chatHistory');if(!host)return;const box=document.createElement('div');box.className='chatMsg assistant toolCardsInline';box.innerHTML='<b>Bulduğum araçlar</b>'+items.slice(0,5).map(t=>`<a target="_blank" rel="noopener" href="${esc(t.url||'#')}">${esc(t.title||'AI aracı')}</a><small>${esc(t.snippet||'')}</small>`).join('');host.appendChild(box);host.scrollTop=host.scrollHeight}
  if(typeof tools==='function')tools=function(items){renderInlineTools(items||[])};
  removeToolsTab();setTimeout(removeToolsTab,600);
})();