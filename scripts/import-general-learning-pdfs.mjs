import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

// Official, publicly accessible PDF. Add further sources only after checking licensing.
const sources=[{title:'Introductory Statistics 2e',url:'https://assets.openstax.org/oscms-prodcms/media/documents/Introductory_Statistics_2e_-_WEB.pdf',license:'CC BY 4.0 (PDF edition)',topic:'statistics'}];
const q=x=>"'"+String(x??'').replaceAll("'","''")+"'";
const statements=[];
const now=Date.now();
for(const src of sources){
  const response=await fetch(src.url,{signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw Error('Download failed '+response.status+' '+src.url);
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.length<1024||new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error('Not a PDF '+src.url);
  const sha=crypto.createHash('sha256').update(bytes).digest('hex');
  const id='generalpdf_'+sha.slice(0,24);
  const doc=await pdfjs.getDocument({data:bytes}).promise;
  const sourceId='jarvis:general-pdf:'+id;
  const meta=JSON.stringify({publisher:'OpenStax',license:src.license,topic:src.topic,source_sha256:sha,original_url:src.url});
  statements.push(`INSERT INTO ecu_manual_library_documents(id,filename,source_sha256,page_count,tags_json,imported_at,updated_at) VALUES(${q(id)},${q(src.title+'.pdf')},${q(sha)},${doc.numPages},${q(JSON.stringify(['general-education',src.topic]))},${now},${now}) ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at;`);
  statements.push(`INSERT INTO learning_sources(id,source_type,source_url,external_id,title,language,status,parent_source_id,job_id,meta_json,learned_at,created_at,updated_at) VALUES(${q(sourceId)},'general-education-pdf',${q(src.url)},${q(id)},${q(src.title)},'en','learned',NULL,NULL,${q(meta)},${now},${now},${now}) ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at;`);
  let passages=0;
  for(let page=1;page<=doc.numPages;page++){
    const data=await(await doc.getPage(page)).getTextContent();
    const text=data.items.map(x=>x.str+(x.hasEOL?'\n':' ')).join('').trim();
    if(!text)continue;
    for(let offset=0,part=1;offset<text.length;offset+=3000,part++){
      const chunk=text.slice(offset,offset+3000).trim();if(!chunk)continue;
      const chunkId=sourceId+':'+page+':'+part;
      statements.push(`INSERT INTO ecu_manual_library_passages(id,document_id,page,part,content,has_visuals,imported_at) VALUES(${q(id+':'+page+':'+part)},${q(id)},${page},${part},${q(chunk)},0,${now}) ON CONFLICT(id) DO UPDATE SET content=excluded.content;`);
      statements.push(`INSERT INTO learning_chunks(id,source_id,ordinal,content,created_at) VALUES(${q(chunkId)},${q(sourceId)},${page*10000+part},${q('['+src.title+' | page '+page+'] '+chunk)},${now}) ON CONFLICT(id) DO UPDATE SET content=excluded.content;`);
      passages++;
    }
  }
  console.log(JSON.stringify({title:src.title,pages:doc.numPages,passages,sha256:sha}));
}
await fs.mkdir('.wrangler',{recursive:true});
await fs.writeFile('.wrangler/general-pdf-import.sql',statements.join('\n')+'\n');
