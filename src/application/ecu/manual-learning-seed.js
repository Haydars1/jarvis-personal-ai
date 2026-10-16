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
