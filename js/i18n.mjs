export const LANGUAGE_STORAGE_KEY='6006_language';
export const SUPPORTED_LANGUAGES=['de','tr','en'];

const translations={
  de:{
    'nav.services':'Leistungen','nav.faults':'Fehlercodes','nav.contact':'Kontakt',
    'home.eyebrow':'FAHRZEUGELEKTRONIK · DIAGNOSE · CODIERUNG','home.lead1':'Technik verstehen.','home.lead2':'Funktionen sichtbar machen.',
    'home.intro':'Persönliche Fahrzeugdiagnose, Codierung und Softwareoptimierung. Kein Online-Shop – eine direkte Vorstellung meiner Arbeit und Möglichkeiten.',
    'home.whatsapp':'WhatsApp schreiben','home.email':'E-Mail','home.hint':'Die Symbole im Hintergrund sind anklickbar.',
    'service.diagnosis':'Diagnose','service.diagnosisText':'Fehlerspeicher, Live-Daten und systematische Fehlersuche.',
    'service.coding':'Codierung','service.codingText':'Fahrzeugfunktionen individuell anpassen und freischalten.',
    'service.software':'Software','service.softwareText':'Softwarebasierte Anpassungen passend zum Fahrzeug.',
    'fault.back':'← Zurück zur Startseite','fault.kicker':'FEHLERCODE / WARNUNG','fault.drive':'Weiterfahrt','fault.note':'Hinweis','fault.symptoms':'Typische Symptome','fault.causes':'Mögliche Ursachen','fault.diagnosis':'Diagnose / Prüfen','fault.solutions':'Mögliche Lösungen','fault.priority':'Priorität: {value}','fault.contactTitle':'Fehler nicht eindeutig?','fault.contactText':'Fahrzeugspezifische Diagnose ist genauer als eine allgemeine Codebeschreibung.','fault.pageTitle':'{code} | 6006 Performance',
    'vehicle.profile':'FAHRZEUGPROFIL','vehicle.choose':'Fahrzeug auswählen','vehicle.general':'Allgemeine Darstellung','vehicle.selected':'AUSGEWÄHLTES FAHRZEUG',
    'vehicle.brand':'MARKE','vehicle.model':'MODELL','vehicle.generation':'BAUREIHE / GENERATION','vehicle.year':'BAUJAHR','vehicle.engine':'MOTORISIERUNG',
    'vehicle.brandPlaceholder':'Marke wählen','vehicle.modelPlaceholder':'Modell wählen','vehicle.generationPlaceholder':'Baureihe wählen','vehicle.yearPlaceholder':'Baujahr wählen','vehicle.enginePlaceholder':'Motor wählen',
    'chat.launch':'Diagnose-Chat','chat.openAria':'6006 Diagnose-Chat öffnen','chat.panelAria':'6006 Diagnose-Chat','chat.title':'Diagnose-Assistent','chat.close':'Chat schließen','chat.privacy':'Kontaktdaten werden nur gespeichert, wenn Sie sie freiwillig im Chat senden. Weitere Hinweise finden Sie im Datenschutz.','chat.placeholder':'Nachricht schreiben …','chat.send':'Senden',
    'chat.greetingDefault':'Wie kann ich Ihnen bei Ihrem Fahrzeug helfen? Wenn Sie einen Fehlercode haben, können Sie ihn direkt eingeben.','chat.greetingP0299':'Sie sehen P0299? Ich kann Ihnen beim Thema Ladedruck/Turbo mit ein paar gezielten Fragen helfen.','chat.greetingAdblue':'Geht es um eine AdBlue-/SCR-Meldung? Ich kann die möglichen Ursachen mit Ihnen eingrenzen.','chat.greetingDpf':'Geht es um DPF oder Differenzdruck? Beschreiben Sie bitte Meldung und Fahrverhalten.','chat.greetingAbs':'Geht es um eine ABS-/Bremswarnung? Nennen Sie bitte die genaue Meldung und ob weitere Warnlampen aktiv sind.',
    'admin.taken':'Übernommen','admin.aiActive':'AI aktiv','admin.general':'Allgemein','admin.noVehicle':'Fahrzeug noch nicht gewählt','admin.context':'Fahrzeugkontext','admin.notSelected':'Noch nicht gewählt','admin.noFault':'Kein Fehlercode','admin.status':'Status: {value}','admin.humanActive':'Mensch aktiv','admin.takeover':'Chat übernehmen','admin.release':'AI wieder aktivieren','admin.replyPlaceholder':'Antwort an Kunden …','admin.send':'Senden'
  },
  tr:{
    'nav.services':'Hizmetler','nav.faults':'Arıza Kodları','nav.contact':'İletişim',
    'home.eyebrow':'ARAÇ ELEKTRONİĞİ · TEŞHİS · KODLAMA','home.lead1':'Teknolojiyi anlayın.','home.lead2':'Fonksiyonları görünür hale getirin.',
    'home.intro':'Kişisel araç teşhisi, kodlama ve yazılım optimizasyonu. Online mağaza değil – yaptığım işleri ve sunduğum imkanları doğrudan tanıtan bir sayfa.',
    'home.whatsapp':'WhatsApp’tan yaz','home.email':'E-posta','home.hint':'Arka plandaki semboller tıklanabilir.',
    'service.diagnosis':'Teşhis','service.diagnosisText':'Arıza hafızası, canlı veriler ve sistematik arıza tespiti.',
    'service.coding':'Kodlama','service.codingText':'Araç fonksiyonlarını kişiselleştirme ve etkinleştirme.',
    'service.software':'Yazılım','service.softwareText':'Araca uygun yazılım tabanlı uyarlamalar.',
    'fault.back':'← Ana sayfaya dön','fault.kicker':'ARIZA KODU / UYARI','fault.drive':'Sürüşe devam','fault.note':'Not','fault.symptoms':'Tipik belirtiler','fault.causes':'Olası nedenler','fault.diagnosis':'Teşhis / Kontrol','fault.solutions':'Olası çözümler','fault.priority':'Öncelik: {value}','fault.contactTitle':'Arıza net değil mi?','fault.contactText':'Araca özel teşhis, genel arıza kodu açıklamasından daha doğrudur.','fault.pageTitle':'{code} | 6006 Performance',
    'vehicle.profile':'ARAÇ PROFİLİ','vehicle.choose':'Araç seç','vehicle.general':'Genel gösterim','vehicle.selected':'SEÇİLEN ARAÇ',
    'vehicle.brand':'MARKA','vehicle.model':'MODEL','vehicle.generation':'KASA / NESİL','vehicle.year':'MODEL YILI','vehicle.engine':'MOTOR',
    'vehicle.brandPlaceholder':'Marka seç','vehicle.modelPlaceholder':'Model seç','vehicle.generationPlaceholder':'Kasa seç','vehicle.yearPlaceholder':'Yıl seç','vehicle.enginePlaceholder':'Motor seç',
    'chat.launch':'Teşhis Sohbeti','chat.openAria':'6006 teşhis sohbetini aç','chat.panelAria':'6006 Teşhis Sohbeti','chat.title':'Teşhis Asistanı','chat.close':'Sohbeti kapat','chat.privacy':'İletişim bilgileriniz yalnızca sohbette gönüllü olarak paylaşırsanız kaydedilir. Ayrıntılar için gizlilik bilgilendirmesine bakın.','chat.placeholder':'Mesaj yaz …','chat.send':'Gönder',
    'chat.greetingDefault':'Aracınızla ilgili nasıl yardımcı olabilirim? Bir arıza kodunuz varsa doğrudan yazabilirsiniz.','chat.greetingP0299':'P0299 kodunu mu görüyorsunuz? Turbo/şarj basıncı konusunda birkaç hedefli soruyla yardımcı olabilirim.','chat.greetingAdblue':'AdBlue/SCR uyarısı mı var? Olası nedenleri birlikte daraltabiliriz.','chat.greetingDpf':'DPF veya diferansiyel basınçla mı ilgili? Lütfen uyarıyı ve aracın davranışını anlatın.','chat.greetingAbs':'ABS/fren uyarısı mı var? Lütfen tam uyarıyı ve başka ikaz lambalarının yanıp yanmadığını yazın.',
    'admin.taken':'Devralındı','admin.aiActive':'AI aktif','admin.general':'Genel','admin.noVehicle':'Araç henüz seçilmedi','admin.context':'Araç bilgisi','admin.notSelected':'Henüz seçilmedi','admin.noFault':'Arıza kodu yok','admin.status':'Durum: {value}','admin.humanActive':'İnsan aktif','admin.takeover':'Sohbeti devral','admin.release':'AI’yi tekrar etkinleştir','admin.replyPlaceholder':'Müşteriye cevap …','admin.send':'Gönder'
  },
  en:{
    'nav.services':'Services','nav.faults':'Fault Codes','nav.contact':'Contact',
    'home.eyebrow':'VEHICLE ELECTRONICS · DIAGNOSTICS · CODING','home.lead1':'Understand the technology.','home.lead2':'Make functions visible.',
    'home.intro':'Personal vehicle diagnostics, coding and software optimization. Not an online shop – a direct presentation of my work and capabilities.',
    'home.whatsapp':'Message on WhatsApp','home.email':'Email','home.hint':'The warning symbols in the background are clickable.',
    'service.diagnosis':'Diagnostics','service.diagnosisText':'Fault memory, live data and systematic troubleshooting.',
    'service.coding':'Coding','service.codingText':'Customize and enable vehicle functions.',
    'service.software':'Software','service.softwareText':'Software-based adjustments matched to the vehicle.',
    'fault.back':'← Back to homepage','fault.kicker':'FAULT CODE / WARNING','fault.drive':'Can I keep driving?','fault.note':'Note','fault.symptoms':'Typical symptoms','fault.causes':'Possible causes','fault.diagnosis':'Diagnosis / Checks','fault.solutions':'Possible solutions','fault.priority':'Priority: {value}','fault.contactTitle':'Fault still unclear?','fault.contactText':'Vehicle-specific diagnostics are more accurate than a general fault-code description.','fault.pageTitle':'{code} | 6006 Performance',
    'vehicle.profile':'VEHICLE PROFILE','vehicle.choose':'Select vehicle','vehicle.general':'General view','vehicle.selected':'SELECTED VEHICLE',
    'vehicle.brand':'MAKE','vehicle.model':'MODEL','vehicle.generation':'GENERATION / CHASSIS','vehicle.year':'MODEL YEAR','vehicle.engine':'ENGINE',
    'vehicle.brandPlaceholder':'Select make','vehicle.modelPlaceholder':'Select model','vehicle.generationPlaceholder':'Select generation','vehicle.yearPlaceholder':'Select year','vehicle.enginePlaceholder':'Select engine',
    'chat.launch':'Diagnostics Chat','chat.openAria':'Open 6006 diagnostics chat','chat.panelAria':'6006 Diagnostics Chat','chat.title':'Diagnostics Assistant','chat.close':'Close chat','chat.privacy':'Contact details are stored only if you voluntarily send them in the chat. See the privacy notice for more information.','chat.placeholder':'Write a message …','chat.send':'Send',
    'chat.greetingDefault':'How can I help with your vehicle? If you have a fault code, you can enter it directly.','chat.greetingP0299':'Are you seeing P0299? I can help narrow down the boost/turbo issue with a few targeted questions.','chat.greetingAdblue':'Is this an AdBlue/SCR warning? I can help narrow down the possible causes.','chat.greetingDpf':'Is this related to the DPF or differential pressure? Please describe the warning and how the vehicle behaves.','chat.greetingAbs':'Is this an ABS/brake warning? Please tell me the exact warning and whether any other warning lights are on.',
    'admin.taken':'Taken over','admin.aiActive':'AI active','admin.general':'General','admin.noVehicle':'Vehicle not selected yet','admin.context':'Vehicle context','admin.notSelected':'Not selected yet','admin.noFault':'No fault code','admin.status':'Status: {value}','admin.humanActive':'Human active','admin.takeover':'Take over chat','admin.release':'Re-enable AI','admin.replyPlaceholder':'Reply to customer …','admin.send':'Send'
  }
};

export function normalizeLanguage(value){
  const code=String(value||'').trim().toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_LANGUAGES.includes(code)?code:'de';
}
export function loadLanguage(storage, navigatorLanguage='de'){
  const stored=storage?.getItem?.(LANGUAGE_STORAGE_KEY);
  if(stored && SUPPORTED_LANGUAGES.includes(String(stored).toLowerCase())) return normalizeLanguage(stored);
  return normalizeLanguage(navigatorLanguage);
}
export function saveLanguage(storage, lang){
  const normalized=normalizeLanguage(lang); storage?.setItem?.(LANGUAGE_STORAGE_KEY,normalized); return normalized;
}
export function t(lang,key,params={}){
  const normalized=normalizeLanguage(lang);
  const template=translations[normalized]?.[key] ?? translations.de[key] ?? key;
  return String(template).replace(/\{(\w+)\}/g,(_,name)=>params[name]??`{${name}}`);
}
export function languageSwitcherMarkup(lang='de'){
  const current=normalizeLanguage(lang);
  return `<div class="language-switcher" role="group" aria-label="Language / Dil / Sprache">${SUPPORTED_LANGUAGES.map(code=>`<button type="button" data-lang="${code}" aria-pressed="${code===current?'true':'false'}">${code.toUpperCase()}</button>`).join('')}</div>`;
}
export function applyDocumentTranslations(root,lang){
  const normalized=normalizeLanguage(lang);
  if(root?.documentElement) root.documentElement.lang=normalized;
  root?.querySelectorAll?.('[data-i18n]')?.forEach?.(el=>{el.textContent=t(normalized,el.dataset.i18n);});
  root?.querySelectorAll?.('[data-i18n-placeholder]')?.forEach?.(el=>{el.setAttribute('placeholder',t(normalized,el.dataset.i18nPlaceholder));});
  root?.querySelectorAll?.('[data-i18n-aria]')?.forEach?.(el=>{el.setAttribute('aria-label',t(normalized,el.dataset.i18nAria));});
  return normalized;
}
export function mountLanguageSwitcher({root,storage,navigatorLanguage,onChange=()=>{}}={}){
  let lang=loadLanguage(storage,navigatorLanguage);
  const render=()=>{root.innerHTML=languageSwitcherMarkup(lang); root.querySelectorAll?.('[data-lang]')?.forEach?.(button=>button.addEventListener('click',()=>{lang=saveLanguage(storage,button.dataset.lang);render();onChange(lang);}));};
  render(); return {getLanguage:()=>lang,setLanguage(next){lang=saveLanguage(storage,next);render();onChange(lang);}};
}

export function createLanguageStore(storage=globalThis.localStorage){return{get(browser=globalThis.navigator?.language){return loadLanguage(storage,browser)},set(lang){return saveLanguage(storage,lang)}}}
