function clean(value){return value===undefined||value===null||value===''?undefined:value;}

export function buildChatContext(input={}) {
  return Object.fromEntries(Object.entries({
    pagePath: clean(input.pagePath),
    faultCode: clean(input.faultCode),
    vehicleProfileKey: clean(input.vehicleProfileKey)
  }).filter(([,v])=>v!==undefined));
}

export function getContextualGreeting({faultCode}={}) {
  const code=String(faultCode||'').toUpperCase();
  if(code==='P0299') return 'Sie sehen P0299? Ich kann Ihnen beim Thema Ladedruck/Turbo mit ein paar gezielten Fragen helfen.';
  if(code.includes('ADBLUE')||code==='P20EE'||code==='P2201'||code==='P229F') return 'Geht es um eine AdBlue-/SCR-Meldung? Ich kann die möglichen Ursachen mit Ihnen eingrenzen.';
  if(code==='P2453'||code==='P2463'||code==='DPF') return 'Geht es um DPF oder Differenzdruck? Beschreiben Sie bitte Meldung und Fahrverhalten.';
  if(code==='ABS') return 'Geht es um eine ABS-/Bremswarnung? Nennen Sie bitte die genaue Meldung und ob weitere Warnlampen aktiv sind.';
  return 'Wie kann ich Ihnen bei Ihrem Fahrzeug helfen? Wenn Sie einen Fehlercode haben, können Sie ihn direkt eingeben.';
}

export function chatLauncherMarkup({greeting=getContextualGreeting()}={}) {
  return `<button class="support-chat-launcher" type="button" aria-label="6006 Diagnose-Chat öffnen"><span>6006</span><b>Diagnose-Chat</b></button>
  <section class="support-chat-panel" hidden aria-label="6006 Diagnose-Chat">
    <header><div><small>6006 PERFORMANCE</small><strong>Diagnose-Assistent</strong></div><button type="button" data-chat-close aria-label="Chat schließen">×</button></header>
    <div class="support-chat-messages"><article class="assistant">${greeting}</article></div>
    <p class="support-chat-privacy">Kontaktdaten werden nur gespeichert, wenn Sie sie freiwillig im Chat senden. Weitere Hinweise finden Sie im Datenschutz.</p>
    <form class="support-chat-form"><textarea name="message" rows="2" placeholder="Nachricht schreiben …" required></textarea><button type="submit">Senden</button></form>
  </section>`;
}

export function mountSupportChat({root=document.body, transport, context={}, storage=localStorage}={}) {
  const wrapper=document.createElement('div');
  wrapper.className='support-chat-root';
  wrapper.innerHTML=chatLauncherMarkup({greeting:getContextualGreeting(context)});
  root.append(wrapper);
  const launcher=wrapper.querySelector('.support-chat-launcher');
  const panel=wrapper.querySelector('.support-chat-panel');
  const close=wrapper.querySelector('[data-chat-close]');
  const form=wrapper.querySelector('.support-chat-form');
  const messages=wrapper.querySelector('.support-chat-messages');
  const state={conversationId:storage?.getItem?.('6006_chat_conversation')||null};
  launcher?.addEventListener('click',()=>{panel.hidden=false;});
  close?.addEventListener('click',()=>{panel.hidden=true;});
  form?.addEventListener('submit',async e=>{
    e.preventDefault();
    const field=form.elements.message;
    const text=String(field.value||'').trim(); if(!text) return;
    if(!state.conversationId&&transport?.createConversation){const c=await transport.createConversation(buildChatContext(context)); state.conversationId=c.id; storage?.setItem?.('6006_chat_conversation',c.id);}
    const user=document.createElement('article'); user.className='visitor'; user.textContent=text; messages.append(user); field.value='';
    if(transport?.sendMessage&&state.conversationId){const reply=await transport.sendMessage(state.conversationId,text); if(reply?.text){const ai=document.createElement('article'); ai.className=reply.role==='owner'?'owner':'assistant'; ai.textContent=reply.text; messages.append(ai);}}
    messages.scrollTop=messages.scrollHeight;
  });
  return {wrapper,state,destroy(){wrapper.remove();}};
}
