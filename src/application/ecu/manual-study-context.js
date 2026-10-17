import { ECU_MANUALS, ECU_MANUAL_FOUNDATIONS, ecuStudyConcepts } from './manual-learning-foundations.js';

// These facts are compiled, source-tagged learning notes, not a PDF lookup and not model-weight training.
// This function is pure: no D1, network, device write, adapter, or firmware operations.
const ECU_SIGNALS=['ecu','edc','msa15','winols','megasquirt','motronic','stage 1','stage1','remap','tuning','chiptuning','enjektör','injector','boost','turbo','soi','smoke limiter','driver wish','rail pressure','harita','kalibrasyon','checksum','bin dosya','dosyası','egr','dpf','n75','hot start','swirl flap'];
const FAMILY_MATCH=[['EDC17',/\bedc17\b/i],['EDC16',/\bedc16\b|\bedc16cp34\b/i],['EDC15',/\bedc15/i],['MSA15',/\bmsa15\b/i],['EMU PRO',/emu.?pro/i],['MS3',/megasquirt|\bms3\b/i],['Motronic',/motronic/i]];
export function ecuPermanentStudyContext(question='',limit=5){
  const text=String(question||'').trim().slice(0,800);
  if(!text||!ECU_SIGNALS.some(term=>text.toLocaleLowerCase('tr-TR').includes(term)))return '';
  const target=FAMILY_MATCH.find(([,pattern])=>pattern.test(text))?.[0]||'';
  const scored=ecuStudyConcepts(text,25);
  let matches=target?scored.filter(item=>{
    const manual=ECU_MANUALS.find(m=>m.id===item.doc);
    return (manual?.applies_to+' '+item.topics.join(' ')).toUpperCase().includes(target);
  }):scored;
  if(!matches.length)matches=scored;
  if(!matches.length)matches=ECU_MANUAL_FOUNDATIONS.filter(c=>c.topics.some(t=>/torque|smoke|boost|axis|duration/i.test(t)));
  const selected=matches.slice(0,Math.max(1,Math.min(6,Number(limit)||5)));
  if(!selected.length)return '';
  const lines=selected.map(item=>{
    const source=ECU_MANUALS.find(m=>m.id===item.doc);
    return '- '+(source?.title||item.doc)+' (s. '+item.pages+'): '+item.lesson;
  });
  return '\n\nECU KALICI TEKNIK OGRENIM (kaynagi belirtilmis ozgun sentez; bu mesaj PDF aramasi yapmadi):\n'+lines.join('\n')+'\nBu notlar eski veya ornek firmware bilgileri olabilir; ECU HW/SW kimligi, olcekler, sensör olcumleri, yasal emisyon kosullari ve guvenlik sinirlari dogrulanmadan genelleme yapma. Harita adresi, izin veya etkileri uydurma.';
}
