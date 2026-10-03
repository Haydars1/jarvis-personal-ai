import { jsonResponse } from '../../lib/runtime.js';

function nodeLabel(node={}){
  const file=String(node.file||'').trim(),name=String(node.name||'').trim();
  const where=file?`${file}${node.line?`:${node.line}`:''}`:'';
  return [where,name&&name!==file?`— ${name}`:'',node.kind?`(${node.kind})`:''].filter(Boolean).join(' ');
}

export function formatCodeGraphResult(result={}){
  const operation=String(result.operation||'status'),stats=result.stats||{};
  const header=`JARVIS kod grafiği hazır · ${Number(stats.nodes||0)} düğüm / ${Number(stats.edges||0)} bağlantı`;
  if(operation==='status')return `${header}\nDurum: ${String(result.graph_status||'unknown')}\nCommit: ${String(result.commit||'')}`.trim();
  if(operation==='find'){
    const nodes=Array.isArray(result.nodes)?result.nodes:[];
    return [header,`Arama: ${String(result.query||'')}`,nodes.length?`Bulunan: ${nodes.length}`:'Eşleşme bulunamadı.',...nodes.slice(0,20).map((node,index)=>`${index+1}. ${nodeLabel(node)}`)].filter(Boolean).join('\n');
  }
  if(operation==='impact'){
    const rows=Array.isArray(result.impacted)?result.impacted:[];
    return [header,`Değişen: ${(result.files||[]).join(', ')}`,rows.length?'Ters bağımlılığa göre etkilenebilecek dosyalar:':'Graph üzerinde etkilenen başka dosya bulunamadı.',...rows.slice(0,30).map((row,index)=>`${index+1}. ${row.file} · etki ${Number(row.score||0).toFixed(2)}`)].filter(Boolean).join('\n');
  }
  if(operation==='neighbors'){
    const rows=Array.isArray(result.neighbors)?result.neighbors:[];
    return [header,result.node?`Merkez: ${nodeLabel(result.node)}`:`Düğüm bulunamadı: ${String(result.query||'')}`,result.node?`Yön: ${String(result.direction||'both')}`:'',...rows.slice(0,40).map((node,index)=>`${index+1}. ${nodeLabel(node)}`)].filter(Boolean).join('\n');
  }
  if(operation==='path'){
    const rows=Array.isArray(result.path)?result.path:[];
    if(!rows.length)return [header,'İki hedef arasında graph yolu bulunamadı.',result.from?`Başlangıç: ${nodeLabel(result.from)}`:'',result.to?`Hedef: ${nodeLabel(result.to)}`:''].filter(Boolean).join('\n');
    return [header,'Bağımlılık yolu:',...rows.map((node,index)=>`${index+1}. ${nodeLabel(node)}`)].join('\n');
  }
  return `${header}\n${JSON.stringify(result,null,2).slice(0,6000)}`;
}

export function createCodeGraphJobPresenter(core){
  if(!core?.fetch)throw new Error('CODE_GRAPH_JOB_CORE_REQUIRED');
  return {
    async fetch(req,env,ctx){
      const response=await core.fetch(req,env,ctx);
      const url=new URL(req.url);
      if(req.method!=='GET'||!/^\/api\/tools\/cloud\/jobs\/[^/]+$/.test(url.pathname)||!response?.ok)return response;
      let payload;try{payload=await response.clone().json();}catch{return response;}
      if(payload?.job?.adapter_id!=='code-graph-query'||payload.job.status!=='completed'||!payload.job.result)return response;
      payload.answer=formatCodeGraphResult(payload.job.result);
      return jsonResponse(payload,response.status);
    },
    scheduled(event,env,ctx){return core.scheduled?.(event,env,ctx);}
  };
}
