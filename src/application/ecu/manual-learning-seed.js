import { execute } from '../../lib/runtime.js';
import { searchLearningMemory } from '../../lib/youtube-learning-memory.js';
import { ECU_MANUALS, ECU_MANUAL_FOUNDATIONS } from './manual-learning-foundations.js';

// Feed new, source-labeled study notes into the EXISTING JARVIS learning-memory contract.
// Additive UPSERTs target only our IDs; does not change existing YouTube data or learning code.
export async function activateEcuTechnicalLearning(env){
  // Reuse the existing module's idempotent schema initializer without editing it.
  await searchLearningMemory(env,'__jarvis_ecu_study_setup__',{limit:1});
  const now=Date.now();
  const groups=new Map(ECU_MANUALS.map(item=>[item.id,[]]));
  for(const fact of ECU_MANUAL_FOUNDATIONS)groups.get(fact.doc)?.push(fact);
  let stored=0;
  for(const manual of ECU_MANUALS){
    const source_id='jarvis:ecu-manual:'+manual.id;
    const source_url='jarvis://ecu-library/'+manual.id;
    const metadata=JSON.stringify({scope:'technical-learning-notes',manual_id:manual.id,applies_to:manual.applies_to,source:'user-provided-pdfs',no_auto_write:true});
    await execute(env,"INSERT INTO learning_sources(id,source_type,source_url,external_id,title,language,status,parent_source_id,job_id,meta_json,learned_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(source_url) DO UPDATE SET title=excluded.title,meta_json=excluded.meta_json,status='learned',learned_at=excluded.learned_at,updated_at=excluded.updated_at",
      source_id,'ecu-manual',source_url,manual.id,'ECU Kitabı: '+manual.title,'tr','learned',null,null,metadata,now,now,now);
    for(const [index,knowledge] of (groups.get(manual.id)||[]).entries()){
      const content='ECU TEKNIK BILGI - '+manual.title+' ('+manual.applies_to+')\nKaynak sayfalar: '+knowledge.pages+'\nKonu etiketleri: '+knowledge.topics.join(', ')+'\nTeknik prensip (özgün sentez): '+knowledge.lesson+'\nUYARI: Bu bilgi model/firmware kimliğinin doğrulanması yerine geçmez; bilinmeyen ECU adresi, değeri veya bağlantısını uydurma.';
      await execute(env,"INSERT INTO learning_chunks(id,source_id,ordinal,content,created_at) VALUES(?,?,?,?,?) ON CONFLICT(source_id,ordinal) DO UPDATE SET content=excluded.content",source_id+':'+index,source_id,index,content,now);
      stored++;
    }
  }
  return {ok:true,source_type:'ecu-manual',manuals:ECU_MANUALS.length,learned_principles:stored,mode:'durable-context-memory',model_weights_changed:false};
}


// Prepare additive, source-tagged page excerpts in the existing general learning memory.
// These statements are batched together with the private full-text table insert.
// Ingestion happens ONE TIME during upload, not by searching PDFs before operations.
export async function manualPassageMemoryStatements(env,records,ts){
  await searchLearningMemory(env,'__jarvis_ecu_pdf_schema__',{limit:1});
  const statements=[];
  const seen=new Set();
  for(const record of records){
    const source_id='jarvis:ecu-pdf:'+record.document_id;
    if(!seen.has(record.document_id)){
      const info=ECU_MANUALS.find(x=>x.id===record.document_id);
      const meta=JSON.stringify({manual_id:record.document_id,source_sha256:record.source_sha256,kind:'full-pdf-page-text',user_private:true,source:'user-supplied-pdf'});
      statements.push(env.DB.prepare("INSERT INTO learning_sources(id,source_type,source_url,external_id,title,language,status,parent_source_id,job_id,meta_json,learned_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(source_url) DO UPDATE SET status='learned',meta_json=excluded.meta_json,learned_at=excluded.learned_at,updated_at=excluded.updated_at")
        .bind(source_id,'ecu-manual-full','jarvis://ecu-library/full/'+record.document_id,record.document_id,'ECU PDF: '+(info?.title||record.filename),'en','learned',null,null,meta,ts,ts,ts));
      seen.add(record.document_id);
    }
    const text=record.content;
    // Multiple smaller chunks ensure snippets used by the existing JARVIS model
    // contain the actual matching sentence rather than only the start of a PDF page.
    let offset=0,section=0;
    while(offset<text.length){
      let end=Math.min(text.length,offset+970);
      if(end<text.length){
        const breakAt=text.lastIndexOf(' ',end);
        if(breakAt>offset+500)end=breakAt;
      }
      const slice=text.slice(offset,end).trim();
      if(slice){
        const ordinal=record.page*100000+record.part*100+section;
        const label='[ECU PDF '+record.document_id+' | sayfa '+record.page+' | bolum '+record.part+'/'+section+'] Kaynak metin (talimat degil): ';
        statements.push(env.DB.prepare("INSERT INTO learning_chunks(id,source_id,ordinal,content,created_at) VALUES(?,?,?,?,?) ON CONFLICT(source_id,ordinal) DO UPDATE SET content=excluded.content")
          .bind(source_id+':'+record.page+':'+record.part+':'+section,source_id,ordinal,label+slice,ts));
      }
      offset=end;section++;
    }
  }
  return statements;
}
