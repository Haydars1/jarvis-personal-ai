import { decryptCredential, fetchWithTimeout, queryOne } from '../../lib/runtime.js';

const RESEARCH_INTERVAL_MS = 3 * 60 * 60 * 1000;

export const DEFAULT_ECU_RESEARCH_TOPICS = Object.freeze([
  'Bosch EDC17 MED17 calibration maps torque boost rail pressure technical documentation',
  'Bosch EDC16 calibration map recognition axes technical documentation',
  'Bosch MD1 MG1 calibration architecture technical documentation',
  'Continental Siemens SID ECU calibration maps technical documentation',
  'Delphi DCM ECU calibration maps technical documentation',
  'Magneti Marelli ECU calibration map technical documentation',
  'A2L ASAP2 ECU calibration map axis open documentation',
  'XCP CCP ECU calibration measurement protocol technical documentation',
  'ECU binary calibration map detection reverse engineering research paper',
  'ECU firmware checksum integrity CRC calibration technical documentation',
  'WinOLS checksum calibration documentation EDC17 MED17 official',
  'TriCore ECU firmware memory layout calibration technical documentation',
  'ECU ORI MOD binary diff calibration learning research',
  'ECU map semantic classification machine learning research',
  'ECU calibration validation dyno logging exhaust temperature rail pressure boost lambda technical',
]);

async function sha256Text(value) {
  const bytes = new TextEncoder().encode(String(value || ''));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function googleConfig(env) {
  const row = await queryOne(env, 'SELECT value FROM kv WHERE key=?', 'google_search_cfg');
  if (!row) return null;
  let wrapper;
  try { wrapper = JSON.parse(row.value); } catch { return null; }
  if (!wrapper?.blob) return null;
  try { return JSON.parse(await decryptCredential(env, wrapper.blob)); } catch { return null; }
}

async function defaultSearch(env, query) {
  const cfg = await googleConfig(env);
  if (!cfg?.key || !cfg?.cx) throw new Error('GOOGLE_SEARCH_NOT_CONFIGURED');
  const url = new URL('https://customsearch.googleapis.com/customsearch/v1');
  url.searchParams.set('key', cfg.key);
  url.searchParams.set('cx', cfg.cx);
  url.searchParams.set('q', String(query || ''));
  url.searchParams.set('num', '6');
  const response = await fetchWithTimeout(url, { headers: { accept: 'application/json' } }, 6000);
  if (!response.ok) throw new Error(`GOOGLE_SEARCH_${response.status}`);
  const payload = await response.json();
  return (payload.items || []).map(item => ({
    title: item.title || '',
    url: item.link || '',
    snippet: item.snippet || '',
    source: 'Google',
  }));
}

function claimTokens(text) {
  return new Set(String(text||'').toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9çğıöşü]+/gi,' ')
    .split(/\s+/)
    .filter(token=>token.length>=3));
}

function claimSimilarity(a,b) {
  const left=claimTokens(a),right=claimTokens(b);
  if(!left.size||!right.size)return 0;
  let intersection=0;
  for(const token of left)if(right.has(token))intersection+=1;
  const union=left.size+right.size-intersection;
  return union?intersection/union:0;
}

function sourceKind(url='', title='') {
  let host='';
  try { host=new URL(String(url)).hostname.toLowerCase(); } catch {}
  const hay=(host+' '+String(title||'')).toLowerCase();
  if(/bosch|evc\.de|iso\.org|asap2|asam/.test(hay)) return 'official';
  if(/arxiv|ieee|springer|sciencedirect|researchgate/.test(hay)) return 'research';
  if(/github\.com|gitlab\.com/.test(hay)) return 'code';
  if(/youtube\.com|youtu\.be|vimeo\.com/.test(hay)) return 'video';
  if(/forum|nefarious|ecuconnections|mhhauto/.test(hay)) return 'forum';
  if(/\.pdf($|\?)/i.test(String(url))) return 'pdf';
  return 'web';
}

function sourceTrust(kind='web') {
  return ({official:0.95,research:0.9,code:0.8,pdf:0.75,web:0.6,video:0.5,forum:0.4})[kind] ?? 0.5;
}

function isPublicResearchUrl(value=''){
  try{
    const url=new URL(String(value));
    if(!['http:','https:'].includes(url.protocol))return false;
    const host=url.hostname.toLowerCase();
    if(host==='localhost'||host==='127.0.0.1'||host==='::1'||host.endsWith('.local'))return false;
    if(/^10\.|^192\.168\.|^169\.254\.|^127\./.test(host))return false;
    const match=host.match(/^172\.(\d+)\./);
    if(match&&Number(match[1])>=16&&Number(match[1])<=31)return false;
    return true;
  }catch{return false;}
}

function htmlToText(value=''){
  return String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&lt;/gi,'<')
    .replace(/&gt;/gi,'>')
    .replace(/&#39;/g,"'")
    .replace(/&quot;/gi,'"')
    .replace(/\s+/g,' ')
    .trim();
}

function sourceClaimChunks(text='',maxChunks=4){
  const clean=String(text||'').replace(/\s+/g,' ').trim().slice(0,24000);
  if(clean.length<80)return [];
  const chunks=[];
  for(let start=0;start<clean.length&&chunks.length<maxChunks;start+=1400){
    const piece=clean.slice(start,start+1600).trim();
    if(piece.length>=80)chunks.push(piece);
  }
  return chunks;
}

async function defaultFetchSource(_env,source){
  if(!isPublicResearchUrl(source?.url))return {text:'',contentType:'',skipped:'URL_NOT_PUBLIC'};
  try{
    const response=await fetchWithTimeout(source.url,{
      headers:{
        accept:'text/html,text/plain,text/markdown,application/json;q=0.8,*/*;q=0.2',
        'user-agent':'JARVIS-ECU-Research/1.0',
      },
      redirect:'follow',
    },7000);
    if(!response.ok)return {text:'',contentType:'',skipped:`HTTP_${response.status}`};
    const contentType=String(response.headers.get('content-type')||'').toLowerCase();
    if(/application\/pdf|video\/|audio\/|application\/octet-stream/.test(contentType)){
      return {text:'',contentType,skipped:'BINARY_SOURCE'};
    }
    if(!/text\/|application\/(json|xml|xhtml)/.test(contentType)){
      return {text:'',contentType,skipped:'UNSUPPORTED_CONTENT_TYPE'};
    }
    const raw=(await response.text()).slice(0,120000);
    const text=/html|xhtml/.test(contentType)?htmlToText(raw):raw.replace(/\s+/g,' ').trim();
    return {text:text.slice(0,24000),contentType,skipped:null};
  }catch{
    return {text:'',contentType:'',skipped:'FETCH_FAILED'};
  }
}

function normalizeResult(row, topic) {
  const url = String(row?.url || '').trim();
  if (!url) return null;
  const kind=sourceKind(url,row?.title);
  return {
    title: String(row?.title || '').slice(0, 500),
    url,
    snippet: String(row?.snippet || '').slice(0, 4000),
    provider: String(row?.source || 'Google').slice(0, 100),
    topic,
    sourceKind: kind,
    trustScore: sourceTrust(kind),
    verified: false,
  };
}

const defaultRepository = {
  async claimRunBucket(env, bucket) {
    const id = `research-${bucket}`;
    const exists = await env.DB.prepare('SELECT id FROM ecu_research_runs WHERE id=? LIMIT 1').bind(id).first();
    if (exists) return false;
    const now = Date.now();
    await env.DB.prepare('INSERT INTO ecu_research_runs(id,bucket,status,started_at,created_at,updated_at) VALUES(?,?,?,?,?,?)')
      .bind(id, bucket, 'RUNNING', now, now, now).run();
    return true;
  },

  async storeSource(env, source) {
    const id = await sha256Text(source.url);
    const now = Date.now();
    await env.DB.prepare(`INSERT INTO ecu_knowledge_sources(id,url,title,provider,topic,source_kind,trust_score,verified,first_seen_at,last_seen_at)
      VALUES(?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(url) DO UPDATE SET title=excluded.title,provider=excluded.provider,topic=excluded.topic,source_kind=excluded.source_kind,trust_score=MAX(ecu_knowledge_sources.trust_score,excluded.trust_score),last_seen_at=excluded.last_seen_at`)
      .bind(id, source.url, source.title, source.provider, source.topic, source.sourceKind, source.trustScore, 0, now, now).run();
  },

  async storeClaim(env, claim) {
    const id = await sha256Text(`${claim.sourceUrl}\n${claim.text}`);
    const now = Date.now();
    await env.DB.prepare(`INSERT INTO ecu_knowledge_claims(id,source_url,topic,text,verification_state,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at`)
      .bind(id, claim.sourceUrl, claim.topic, claim.text, claim.verificationState, now, now).run();
  },

  async listClaims(env) {
    return (await env.DB.prepare(`SELECT c.id,c.source_url,c.topic,c.text,c.verification_state,
      COALESCE(s.trust_score,0.5) AS trust_score,COALESCE(s.source_kind,'web') AS source_kind
      FROM ecu_knowledge_claims c
      LEFT JOIN ecu_knowledge_sources s ON s.url=c.source_url
      WHERE c.verification_state='UNVERIFIED'
      ORDER BY c.created_at DESC LIMIT 1000`).all()).results?.map(row=>({
        id:row.id,
        sourceUrl:row.source_url,
        topic:row.topic,
        text:row.text,
        verificationState:row.verification_state,
        trustScore:Number(row.trust_score||0.5),
        sourceKind:row.source_kind||'web',
      })) || [];
  },

  async markClaimState(env, id, state) {
    await env.DB.prepare('UPDATE ecu_knowledge_claims SET verification_state=?,updated_at=? WHERE id=?')
      .bind(state,Date.now(),id).run();
  },

  async finishRun(env, bucket, summary) {
    const now = Date.now();
    await env.DB.prepare(`UPDATE ecu_research_runs
      SET status=?,sources_found=?,claims_found=?,errors=?,finished_at=?,updated_at=? WHERE id=?`)
      .bind('COMPLETE', summary.sourcesFound, summary.claimsFound, summary.errors, now, now, `research-${bucket}`).run();
  },

  async status(env) {
    const latest = await env.DB.prepare('SELECT * FROM ecu_research_runs ORDER BY created_at DESC LIMIT 1').first();
    const counts = await env.DB.prepare(`SELECT
      (SELECT COUNT(*) FROM ecu_knowledge_sources) AS sources,
      (SELECT COUNT(*) FROM ecu_knowledge_claims) AS claims,
      (SELECT COUNT(*) FROM ecu_knowledge_claims WHERE verification_state='CORROBORATED') AS corroborated_claims,
      (SELECT COUNT(*) FROM ecu_knowledge_claims WHERE verification_state='VERIFIED') AS verified_claims`).first();
    return { latest: latest || null, counts: counts || { sources: 0, claims: 0, corroborated_claims: 0, verified_claims: 0 } };
  },
};

export function createEcuResearch({
  repository = defaultRepository,
  topics = DEFAULT_ECU_RESEARCH_TOPICS,
  search = defaultSearch,
  fetchSource = defaultFetchSource,
  maxEnrichedSourcesPerTopic = 2,
} = {}) {
  const corroborate = async env => {
    if(typeof repository.listClaims!=='function'||typeof repository.markClaimState!=='function'){
      return {corroborated:0,scanned:0};
    }
    const claims=await repository.listClaims(env);
    const supported=new Map();
    for(let i=0;i<claims.length;i+=1){
      const a=claims[i];
      for(let j=i+1;j<claims.length;j+=1){
        const b=claims[j];
        if(String(a.sourceUrl||'')===String(b.sourceUrl||''))continue;
        if(String(a.topic||'')!==String(b.topic||''))continue;
        if(claimSimilarity(a.text,b.text)<0.72)continue;
        const pairTrust=Math.min(Number(a.trustScore||0.5),Number(b.trustScore||0.5));
        supported.set(a.id,Math.max(supported.get(a.id)||0,pairTrust));
        supported.set(b.id,Math.max(supported.get(b.id)||0,pairTrust));
      }
    }
    let verified=0;
    for(const [id,trust] of supported){
      const state=trust>=0.8?'VERIFIED':'CORROBORATED';
      await repository.markClaimState(env,id,state);
      if(state==='VERIFIED')verified+=1;
    }
    return {corroborated:supported.size,verified,scanned:claims.length};
  };

  return {
    async run(env, timestamp = Date.now()) {
      const bucket = Math.floor(Number(timestamp) / RESEARCH_INTERVAL_MS) * RESEARCH_INTERVAL_MS;
      if (!(await repository.claimRunBucket(env, bucket))) {
        return { skipped: true, bucket, reason: 'ALREADY_RESEARCHED' };
      }

      const seenUrls = new Set();
      let sourcesFound = 0;
      let claimsFound = 0;
      let errors = 0;

      for (const topic of topics) {
        let results = [];
        let enrichedForTopic=0;
        try {
          results = await search(env, topic);
        } catch {
          errors += 1;
          continue;
        }

        for (const raw of Array.isArray(results) ? results : []) {
          const source = normalizeResult(raw, topic);
          if (!source || seenUrls.has(source.url)) continue;
          seenUrls.add(source.url);
          await repository.storeSource(env, source);
          sourcesFound += 1;
          if (source.snippet) {
            await repository.storeClaim(env, {
              sourceUrl: source.url,
              topic,
              text: source.snippet,
              verificationState: 'UNVERIFIED',
            });
            claimsFound += 1;
          }

          if(enrichedForTopic<maxEnrichedSourcesPerTopic&&typeof fetchSource==='function'){
            try{
              const fetched=await fetchSource(env,source);
              const chunks=sourceClaimChunks(fetched?.text||'');
              if(chunks.length){
                enrichedForTopic+=1;
                for(const text of chunks){
                  await repository.storeClaim(env,{
                    sourceUrl:source.url,
                    topic,
                    text,
                    verificationState:'UNVERIFIED',
                  });
                  claimsFound+=1;
                }
              }
            }catch{
              errors+=1;
            }
          }
        }
      }

      const summary = { sourcesFound, claimsFound, errors };
      await repository.finishRun(env, bucket, summary);
      const corroboration = await corroborate(env);
      return { skipped: false, bucket, ...summary, ...corroboration };
    },

    async corroborate(env) {
      return corroborate(env);
    },

    async status(env) {
      let persisted = { latest: null, counts: { sources: 0, claims: 0, verified_claims: 0 } };
      if (typeof repository.status === 'function') {
        try { persisted = await repository.status(env); } catch {}
      }
      return {
        status: persisted.latest?.status || 'IDLE',
        mode: 'continuous-research',
        cadenceHours: RESEARCH_INTERVAL_MS / 3_600_000,
        paidApiRequired: false,
        ...persisted,
      };
    },
  };
}
