// Generates idempotent, public-safe ORIGINAL study notes for authenticated D1 use.
// Full owner-uploaded PDF passages are intentionally excluded from this migration.
import { mkdirSync, writeFileSync } from 'node:fs';
import { ECU_MANUALS, ECU_MANUAL_FOUNDATIONS } from '../src/application/ecu/manual-learning-foundations.js';

export function buildEcuStudySeedSql(){
  const q=value => "'"+String(value??'').replace(/'/g,"''")+"'";
  const ts="CAST(strftime('%s','now') AS INTEGER) * 1000";
  const lines=[
    '-- Source-labeled teaching principles; does NOT contain full PDF text or firmware patches.',
    '-- Purely additive, repeatable UPSERTS; existing learning rows are preserved.',
    'BEGIN TRANSACTION;'
  ];
  for(const manual of ECU_MANUALS){
    const id='jarvis:ecu-manual:'+manual.id;
    const url='jarvis://ecu-library/'+manual.id;
    const meta=JSON.stringify({scope:'technical-learning-notes',manual_id:manual.id,applies_to:manual.applies_to,source:'user-provided-pdfs',no_auto_write:true});
    lines.push("INSERT INTO learning_sources(id,source_type,source_url,external_id,title,language,status,parent_source_id,job_id,meta_json,learned_at,created_at,updated_at) VALUES("+
      [q(id),q('ecu-manual'),q(url),q(manual.id),q('ECU Kitabı: '+manual.title),q('tr'),q('learned'),'NULL','NULL',q(meta),ts,ts,ts].join(',')+") ON CONFLICT(source_url) DO UPDATE SET title=excluded.title,meta_json=excluded.meta_json,status='learned',learned_at=excluded.learned_at,updated_at=excluded.updated_at;");
    let ordinal=0;
    for(const fact of ECU_MANUAL_FOUNDATIONS.filter(row=>row.doc===manual.id)){
      const text='ECU TEKNIK BILGI - '+manual.title+' ('+manual.applies_to+')\\nKaynak sayfalar: '+fact.pages+'\\nKonu etiketleri: '+fact.topics.join(', ')+'\\nTeknik prensip (özgün sentez): '+fact.lesson+'\\nUYARI: ECU adresleri, haritalar, sensör ve firmware kimliği doğrulanmalıdır.';
      lines.push("INSERT INTO learning_chunks(id,source_id,ordinal,content,created_at) VALUES("+
        [q(id+':'+ordinal),q(id),String(ordinal),q(text),ts].join(',')+
        ") ON CONFLICT(source_id,ordinal) DO UPDATE SET content=excluded.content;");
      ordinal++;
    }
  }
  lines.push('COMMIT;');
  return lines.join('\\n')+'\\n';
}

if(process.argv[1]?.endsWith('prepare-ecu-study-seed.mjs')){
  const output='.wrangler/ecu-study-seed.sql';
  mkdirSync('.wrangler',{recursive:true});
  writeFileSync(output,buildEcuStudySeedSql(),'utf8');
  console.log('Prepared '+ECU_MANUALS.length+' source documents and '+ECU_MANUAL_FOUNDATIONS.length+' study concepts in '+output);
}
