import { applyDocumentTranslations, loadLanguage, mountLanguageSwitcher, normalizeLanguage, t } from './i18n.mjs';

function ensureStyles(){
  if(document.querySelector('link[data-6006-i18n]')) return;
  const link=document.createElement('link'); link.rel='stylesheet'; link.href='i18n.css'; link.dataset['6006I18n']='true'; document.head.append(link);
}
function setText(selector,value){const el=document.querySelector(selector); if(el) el.textContent=value;}
function translateHome(lang){
  setText('.topbar nav a[href="#leistungen"]',t(lang,'nav.services'));
  setText('.topbar nav a[href="#fehlercodes"]',t(lang,'nav.faults'));
  setText('.topbar nav a[href="#kontakt"]',t(lang,'nav.contact'));
  setText('.hero .eyebrow',t(lang,'home.eyebrow'));
  const lead=document.querySelector('.hero .lead'); if(lead){lead.textContent='';lead.append(document.createTextNode(t(lang,'home.lead1')+' '));const em=document.createElement('em');em.textContent=t(lang,'home.lead2');lead.append(em);}
  setText('.hero .intro',t(lang,'home.intro'));
  setText('.hero .actions .primary',t(lang,'home.whatsapp'));
  setText('.hero .actions a[href^="mailto:"]',t(lang,'home.email'));
  setText('.hero .hint',t(lang,'home.hint'));
  const cards=[['service.diagnosis','service.diagnosisText'],['service.coding','service.codingText'],['service.software','service.softwareText']];
  document.querySelectorAll('.services > div').forEach((card,i)=>{if(!cards[i])return;const strong=card.querySelector('strong'),p=card.querySelector('p');if(strong)strong.textContent=t(lang,cards[i][0]);if(p)p.textContent=t(lang,cards[i][1]);});
}
function translateFault(lang){
  setText('.back-link',t(lang,'fault.back'));setText('.detail-kicker',t(lang,'fault.kicker'));
  const labels=document.querySelectorAll('.fault-section-label');
  ['fault.drive','fault.note','fault.symptoms','fault.causes','fault.diagnosis','fault.solutions'].forEach((key,i)=>{if(labels[i])labels[i].textContent=t(lang,key);});
  setText('.fault-contact-strip strong',t(lang,'fault.contactTitle')); setText('.fault-contact-strip p',t(lang,'fault.contactText'));
}
export function applySiteLanguage(lang){
  const language=normalizeLanguage(lang); applyDocumentTranslations(document,language); if(document.querySelector('.hero'))translateHome(language); if(document.querySelector('.fault-content'))translateFault(language); document.documentElement.lang=language; return language;
}
export function initSiteLanguage({storage=window.localStorage,navigatorLanguage=window.navigator?.language,onChange=()=>{}}={}){
  ensureStyles(); let language=loadLanguage(storage,navigatorLanguage); applySiteLanguage(language);
  const header=document.querySelector('.topbar,.fault-page-topbar');
  let host=document.getElementById('language-switcher-host'); if(!host&&header){host=document.createElement('div');host.id='language-switcher-host';host.className='language-switcher-host';const contact=header.querySelector('.contact-mini,.back-link'); if(contact) header.insertBefore(host,contact); else header.append(host);}
  const controller=host?mountLanguageSwitcher({root:host,storage,navigatorLanguage,onChange(next){language=next;applySiteLanguage(next);onChange(next);window.dispatchEvent(new CustomEvent('6006:languagechange',{detail:{language:next}}));}}):null;
  return {getLanguage:()=>language,setLanguage(next){controller?.setLanguage(next);}};
}
if(document.querySelector('.topbar')) initSiteLanguage();
