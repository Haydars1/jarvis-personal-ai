(() => {
  let active = false;
  let rec = null;
  let wakeLock = null;
  let lastTranscript = '';
  const VOICE_URL = location.origin + '/?voice=1';

  function escV(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function style(){
    if(document.querySelector('#jarvisVoiceStyle'))return;
    const s=document.createElement('style');s.id='jarvisVoiceStyle';s.textContent=`
      .voiceCard{margin-top:14px}.voiceCard .voiceSteps{display:grid;gap:7px;margin:10px 0}.voiceCard code{font-size:12px;word-break:break-all}
      .jarvisVoiceOverlay{position:fixed;inset:0;z-index:999;background:radial-gradient(circle at 50% 30%,#10284a 0,#071224 34%,#030813 75%);display:grid;grid-template-rows:auto 1fr auto;padding:max(18px,env(safe-area-inset-top)) 18px max(22px,env(safe-area-inset-bottom));color:#fff}
      .jarvisVoiceOverlay.hidden{display:none}.voiceHead{display:flex;justify-content:space-between;align-items:center}.voiceHead b{font-size:22px;letter-spacing:.08em}.voiceClose{width:44px;height:44px;border-radius:14px;padding:0}
      .voiceCenter{display:grid;place-items:center;text-align:center;align-content:center;gap:18px}.voiceOrb{width:min(54vw,230px);aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,#8ef4ff 0 8%,#38d9ff 18%,#1963d2 42%,#081a38 67%,transparent 70%);box-shadow:0 0 28px #4bdcff88,0 0 80px #216be466;animation:voicePulse 2s ease-in-out infinite}.voiceOrb.listening{animation-duration:.8s;box-shadow:0 0 35px #5ef4ff,0 0 110px #2a7cffaa}.voiceOrb.thinking{filter:hue-rotate(35deg)}.voiceOrb.speaking{filter:hue-rotate(285deg)}
      @keyframes voicePulse{50%{transform:scale(1.055);filter:brightness(1.12)}}
      .voiceState{font-weight:800;font-size:18px}.voiceTranscript{max-width:720px;font-size:20px;line-height:1.35;color:#d9ecff;min-height:64px}.voiceHint{color:#91a9c2;font-size:13px}.voiceBottom{display:grid;grid-template-columns:1fr auto;gap:10px}.voiceTalk{min-height:58px;border-radius:18px;font-size:17px;font-weight:800}.voiceKeyboard{min-width:58px;border-radius:18px}
      @media(min-width:720px){.voiceOrb{width:220px}.voiceTranscript{font-size:24px}}
    `;document.head.appendChild(s);
  }

  function overlay(){
    let o=document.querySelector('#jarvisVoiceOverlay');if(o)return o;
    o=document.createElement('div');o.id='jarvisVoiceOverlay';o.className='jarvisVoiceOverlay hidden';o.innerHTML=`
      <div class="voiceHead"><div><b>JARVIS</b><div class="voiceHint">Sesli asistan modu</div></div><button class="voiceClose" type="button">×</button></div>
      <div class="voiceCenter"><div class="voiceOrb"></div><div class="voiceState">Hazır</div><div class="voiceTranscript">JARVIS seni dinlemeye hazır.</div><div class="voiceHint">Konuş → JARVIS araştırır/araçları kullanır → cevabı sesli verir.</div></div>
      <div class="voiceBottom"><button class="voiceTalk" type="button">🎙 JARVIS'İ BAŞLAT</button><button class="voiceKeyboard" type="button">⌨️</button></div>`;
    document.body.appendChild(o);
    o.querySelector('.voiceClose').onclick=()=>stopVoice(true);
    o.querySelector('.voiceTalk').onclick=()=>active?stopVoice(false):startVoice(true);
    o.querySelector('.voiceKeyboard').onclick=()=>{stopVoice(false);o.classList.add('hidden');try{switchPage('chat')}catch{};setTimeout(()=>document.querySelector('#chatCmd')?.focus(),150)};
    return o;
  }
  function setState(state,text){const o=overlay(),orb=o.querySelector('.voiceOrb');orb.classList.remove('listening','thinking','speaking');if(state)orb.classList.add(state);o.querySelector('.voiceState').textContent=state==='listening'?'Dinliyorum':state==='thinking'?'Düşünüyorum':state==='speaking'?'Yanıtlıyorum':'Hazır';if(text)o.querySelector('.voiceTranscript').textContent=text;o.querySelector('.voiceTalk').textContent=active?'■ SES MODUNU KAPAT':'🎙 JARVIS\'İ BAŞLAT'}
  async function lockScreen(){try{if('wakeLock'in navigator){wakeLock=await navigator.wakeLock.request('screen')}}catch{}}
  async function releaseLock(){try{await wakeLock?.release()}catch{}wakeLock=null}
  function ensureRec(){
    if(rec)return rec;const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR)return null;
    rec=new SR();rec.lang='tr-TR';rec.continuous=true;rec.interimResults=true;
    rec.onstart=()=>setState('listening','Seni dinliyorum…');
    rec.onresult=e=>{let interim='',final='';for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript.trim();if(e.results[i].isFinal)final+=t+' ';else interim+=t+' '}if(interim)setState('listening',interim.trim());if(final.trim()){lastTranscript=final.trim();setState('thinking',lastTranscript);try{rec.stop()}catch{};setTimeout(()=>{try{send(lastTranscript)}catch(err){setState('',String(err?.message||err))}},50)}};
    rec.onerror=e=>{if(e.error==='not-allowed'||e.error==='service-not-allowed'){active=false;setState('','Mikrofon izni gerekli. Aşağıdaki düğmeye dokunup izin ver.')}else if(e.error!=='no-speech')setState('',`Ses hatası: ${e.error}`)};
    rec.onend=()=>{if(active&&!speechSynthesis.speaking)setTimeout(()=>{try{rec.start()}catch{}},450)};
    return rec;
  }
  async function startVoice(userGesture=false){style();const o=overlay();o.classList.remove('hidden');active=true;await lockScreen();const r=ensureRec();if(!r){active=false;setState('','Bu tarayıcı sürekli konuşma tanımayı desteklemiyor. iPhone’da Safari/PWA ve mikrofon izni kullan.');return}try{r.start();setState('listening','Seni dinliyorum…')}catch(e){if(userGesture)setState('','Başlatılamadı: '+(e.message||e))}}
  async function stopVoice(close=false){active=false;try{rec?.stop()}catch{};speechSynthesis.cancel();await releaseLock();setState('','Ses modu kapalı.');if(close){overlay().classList.add('hidden');const u=new URL(location.href);u.searchParams.delete('voice');history.replaceState({},'',u)}}

  function wrapSpeak(){
    if(typeof speak!=='function'||window.__jarvisVoiceSpeakWrapped)return;window.__jarvisVoiceSpeakWrapped=true;const base=speak;
    speak=function(t){if(!active)return base(t);try{rec?.stop()}catch{};speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(String(t||''));u.lang='tr-TR';u.rate=1.02;u.pitch=1;u.onstart=()=>setState('speaking',String(t||''));u.onend=()=>{if(active){setState('listening','Devam edebilirsin…');setTimeout(()=>{try{rec?.start()}catch{}},350)}};u.onerror=()=>{if(active)setTimeout(()=>{try{rec?.start()}catch{}},350)};speechSynthesis.speak(u)};
  }

  function installSettingsCard(){
    const settings=document.querySelector('#settings');if(!settings||document.querySelector('#voiceSettingsCard'))return;
    const card=document.createElement('div');card.id='voiceSettingsCard';card.className='card voiceCard';card.innerHTML=`<h2>JARVIS Ses Modu / iPhone</h2><p class="muted">Telefonda JARVIS'i konuşarak kullan. PWA açıkken sürekli dinleme ve sesli cevap çalışır.</p><div class="row"><button id="openVoiceMode">🎙 SES MODUNU AÇ</button><button id="copyVoiceUrl">SIRI KISAYOLU URL'SİNİ KOPYALA</button></div><div class="voiceSteps"><small>1. Safari → Paylaş → Ana Ekrana Ekle.</small><small>2. Kestirmeler uygulaması → yeni kestirme → “URL Aç” → aşağıdaki JARVIS adresini gir.</small><small>3. Kestirmenin adını “JARVIS” yap. Sonra “Hey Siri, JARVIS” dediğinde ses modu açılır.</small></div><code>${escV(VOICE_URL)}</code><p class="muted">Not: iOS, web uygulamalarına ekran kilitliyken arka planda “Hey JARVIS” diye sürekli mikrofon dinleme izni vermez. Gerçek bağımsız wake-word için ileride native iOS uygulaması gerekir.</p>`;
    const grid=settings.querySelector('.grid2');(grid||settings).appendChild(card);
    card.querySelector('#openVoiceMode').onclick=()=>{const u=new URL(location.href);u.searchParams.set('voice','1');history.replaceState({},'',u);startVoice(true)};
    card.querySelector('#copyVoiceUrl').onclick=async()=>{try{await navigator.clipboard.writeText(VOICE_URL);toast('JARVIS ses modu adresi kopyalandı')}catch{toast(VOICE_URL)}};
  }

  function boot(){style();wrapSpeak();installSettingsCard();if(new URL(location.href).searchParams.get('voice')==='1'){overlay().classList.remove('hidden');setState('','Bir kez “JARVIS\'İ BAŞLAT” düğmesine dokun. Sonrasında konuşarak devam edebilirsin.')}}
  window.jarvisVoiceMode={start:startVoice,stop:stopVoice,url:VOICE_URL};
  setTimeout(boot,500);setTimeout(installSettingsCard,1500);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&active){lockScreen();setTimeout(()=>{try{rec?.start()}catch{}},300)}});
})();
