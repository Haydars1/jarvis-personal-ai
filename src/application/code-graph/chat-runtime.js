import { execute, jsonResponse } from '../../lib/runtime.js';

export const JARVIS_CODE_GRAPH_REPO = 'Haydars1/jarvis-personal-ai';

const FILE_PATTERN = /(?:^|[\s`'"(])((?:src|public|ios|scripts|tests|local-bridge|\.github)\/[A-Za-z0-9_.\/-]+\.(?:js|mjs|cjs|ts|tsx|jsx|swift|sql|json|yml|yaml|md))/gi;
const QUOTED_PATTERN = /[`'"]([^`'"]{2,160})[`'"]/g;

function unique(values) { return [...new Set(values.filter(Boolean))]; }
function fileTargets(text) {
  const matches=[]; let match;
  FILE_PATTERN.lastIndex=0;
  while((match=FILE_PATTERN.exec(String(text||''))))matches.push(match[1]);
  return unique(matches);
}
function quotedTargets(text) {
  const matches=[]; let match;
  QUOTED_PATTERN.lastIndex=0;
  while((match=QUOTED_PATTERN.exec(String(text||''))))matches.push(match[1].trim());
  return unique(matches);
}

export function parseCodeGraphIntent(text='') {
  const raw=String(text||'').trim();if(!raw)return null;
  const lower=raw.toLocaleLowerCase('tr-TR');
  const files=fileTargets(raw),quoted=quotedTargets(raw);
  const explicitGraph=/\b(graphify|code\s*graph|kod\s*graf|dependency\s*graph|bağımlılık\s*graf|bagimlilik\s*graf)\b/i.test(lower);
  const jarvisCode=/\b(jarvis|repo|repository|codebase|kod\s*taban[ıi]|kaynak\s*kod)\b/i.test(lower)||files.length>0;
  const impact=/(etkilen|etki|bozul|kırıl|kiril|impact|affected|break|değiştir|degistir|dokunursam|dokunsam)/i.test(lower);
  const dependency=/(bağıml|bagiml|dependency|depends|çağır|cagir|call|kullanıyor|kullaniyor|uses|neighbor|komşu|komsu)/i.test(lower);
  const pathIntent=/(bağlantı\s*yolu|baglanti\s*yolu|dependency\s*path|call\s*path|arasında.*yol|arasinda.*yol|\bpath\b)/i.test(lower);
  const symbolIntent=/(sembol|symbol|fonksiyon|function|class|sınıf|sinif|dosya|file|nerede|bul|find)/i.test(lower);
  if(!(explicitGraph||(jarvisCode&&(impact||dependency||pathIntent||symbolIntent))))return null;
  const targets=unique([...files,...quoted]);
  if(impact&&files.length)return {operation:'impact',files:files.slice(0,12)};
  if(pathIntent&&targets.length>=2)return {operation:'path',from:targets[0],to:targets[1]};
  if(dependency&&targets.length)return {operation:'neighbors',query:targets[0],direction:/kim.*kullan|incoming|gelen|çağıran|cagiran/i.test(lower)?'incoming':'both'};
  const query=targets[0]||raw.replace(/\b(graphify|code\s*graph|kod\s*graf|jarvis|repo|repository|codebase|bul|find|ara|search|göster|goster)\b/gi,' ').replace(/\s+/g,' ').trim().slice(0,160);
  return query?{operation:'find',query}:{operation:'status'};
}

async function queueGraphJob(env,input){
  const id=crypto.randomUUID(),ts=Date.now();
  await execute(env,'INSERT INTO cloud_tool_jobs(id,adapter_id,repo,commit_sha,input_json,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',id,'code-graph-query',JARVIS_CODE_GRAPH_REPO,null,JSON.stringify(input),'queued',ts,ts);
  return {id,adapter_id:'code-graph-query',repo:JARVIS_CODE_GRAPH_REPO,commit:null,input,status:'queued',created_at:ts,updated_at:ts};
}

async function attachPendingJob(response,job){
  if(!response?.ok)return response;
  let payload;try{payload=await response.clone().json();}catch{return response;}
  if(!payload||typeof payload!=='object')return response;
  if(!payload.job)payload.job=job;
  payload.trace=[...(Array.isArray(payload.trace)?payload.trace:[]),{kind:'code-graph',label:'JARVIS code graph',value:`${job.adapter_id} · ${job.repo} · queued`}];
  return jsonResponse(payload,response.status);
}

export function createCodeGraphChatRuntime(fallback){
  if(typeof fallback!=='function')throw new Error('CODE_GRAPH_CHAT_FALLBACK_REQUIRED');
  return async function handleCodeGraphChat(req,env,ctx){
    let body={};try{body=await req.clone().json();}catch{}
    const intent=parseCodeGraphIntent(body?.text||'');
    if(!intent)return fallback(req,env,ctx);
    const job=await queueGraphJob(env,{...intent,source:'chat-code-graph'}).catch(()=>null);
    const response=await fallback(req,env,ctx);
    return job?attachPendingJob(response,job):response;
  };
}
