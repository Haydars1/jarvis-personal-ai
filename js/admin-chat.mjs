function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
export function adminConversationCard(c={}){
  const status=c.status==='human_active'?'Übernommen':'AI aktiv';
  return `<button class="admin-conversation-card" data-conversation-id="${esc(c.id)}"><span><strong>${esc(c.faultCode||'Allgemein')}</strong><small>${esc(c.vehicleLabel||'Fahrzeug noch nicht gewählt')}</small></span><span><em>${status}</em>${c.unread?`<b>${Number(c.unread)}</b>`:''}</span></button>`;
}
export function adminChatMarkup(c={}){
  return `<section class="admin-chat-view" data-conversation-id="${esc(c.id)}">
  <aside class="admin-context"><small>Fahrzeugkontext</small><strong>${esc(c.vehicleLabel||'Noch nicht gewählt')}</strong><span>${esc(c.faultCode||'Kein Fehlercode')}</span></aside>
  <header><span>Status: ${c.status==='human_active'?'Mensch aktiv':'AI aktiv'}</span><div><button type="button" data-takeover>Chat übernehmen</button><button type="button" data-release>AI wieder aktivieren</button></div></header>
  <div class="admin-chat-messages"></div>
  <form class="admin-chat-form"><textarea name="message" placeholder="Antwort an Kunden …"></textarea><button type="submit">Senden</button></form>
  </section>`;
}
export function mountAdminChat({root=document.body,transport,conversation}={}){
  root.innerHTML=adminChatMarkup(conversation||{});
  root.querySelector('[data-takeover]')?.addEventListener('click',()=>transport?.takeOver?.(conversation.id));
  root.querySelector('[data-release]')?.addEventListener('click',()=>transport?.releaseToAi?.(conversation.id));
  root.querySelector('.admin-chat-form')?.addEventListener('submit',async e=>{e.preventDefault(); const text=String(e.currentTarget.elements.message.value||'').trim(); if(text) await transport?.sendOwnerMessage?.(conversation.id,text);});
}
