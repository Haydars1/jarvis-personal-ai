import core from './worker.js';

const HF_API = 'https://api.higgsfield.ai';
const HF_DOCS = 'https://docs.higgsfield.ai/docs';
const HF_OPENAPI = 'https://docs.higgsfield.ai/docs/openapi.json';
const HF_CLOUD = 'https://cloud.higgsfield.ai';
const HF_CAPS = ['video-generation', 'reels-video', 'image-to-video', 'text-to-video'];
const te = new TextEncoder();
const td = new TextDecoder();
const now = () => Date.now();
const uid = () => crypto.randomUUID();
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: {'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
});
const q1 = (env, sql, ...bind) => env.DB.prepare(sql).bind(...bind).first();
const qall = async (env, sql, ...bind) => (await env.DB.prepare(sql).bind(...bind).all()).results || [];
const run = (env, sql, ...bind) => env.DB.prepare(sql).bind(...bind).run();

function cookies(req) {
  return Object.fromEntries((req.headers.get('cookie') || '').split(';').filter(Boolean).map(x => {
    const [k, ...v] = x.trim().split('=');
    return [k, decodeURIComponent(v.join('='))];
  }));
}
async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', te.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  return btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', key, te.encode(data)))))
    .replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
}
async function authed(req, env) {
  try {
    const [b, s] = String(cookies(req).jarvis_session || '').split('.');
    if (!b || !s || await hmac(env.JARVIS_SECRET || 'CHANGE_ME', b) !== s) return false;
    const p = JSON.parse(atob(b.replaceAll('-','+').replaceAll('_','/')));
    return p.exp > now();
  } catch {
    return false;
  }
}
function b64u(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
}
function fromB64u(s) {
  s = String(s).replaceAll('-','+').replaceAll('_','/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}
async function masterKey(env) {
  const raw = String(env.CREDENTIAL_MASTER_KEY || '').trim();
  if (raw.length < 24) throw Error('CREDENTIAL_MASTER_KEY_NOT_SET');
  let bytes = null;
  try {
    const x = Uint8Array.from(atob(raw.replace(/\s+/g,'')), c => c.charCodeAt(0));
    if ([16,24,32].includes(x.length)) bytes = x;
  } catch {}
  if (!bytes) bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode(raw)));
  return crypto.subtle.importKey('raw', bytes, {name:'AES-GCM'}, false, ['encrypt','decrypt']);
}
async function enc(env, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await masterKey(env);
  const ct = new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv}, key, te.encode(String(value))));
  return b64u(iv) + '.' + b64u(ct);
}
async function dec(env, value) {
  const [a,b] = String(value || '').split('.');
  if (!a || !b) throw Error('INVALID_CREDENTIAL_BLOB');
  const key = await masterKey(env);
  const pt = await crypto.subtle.decrypt({name:'AES-GCM',iv:fromB64u(a)}, key, fromB64u(b));
  return td.decode(pt);
}
async function reqBody(req) {
  try { return await req.json(); } catch { return {}; }
}
function normalizeCap(value) {
  const x = String(value || '').toLowerCase().trim();
  if (['reels','reel','reels-video'].includes(x)) return 'reels-video';
  if (['video','video-generation'].includes(x)) return 'video-generation';
  if (['image-to-video','img2video','i2v'].includes(x)) return 'image-to-video';
  if (['text-to-video','txt2video','t2v'].includes(x)) return 'text-to-video';
  return x;
}
function registry() {
  return {
    id:'higgsfield',
    name:'Higgsfield',
    base_url:HF_API,
    cloud_url:HF_CLOUD,
    docs_url:HF_DOCS,
    openapi_url:HF_OPENAPI,
    auth:{type:'api_key_pair',header:'Authorization: Key <KEY_ID>:<KEY_SECRET>'},
    capabilities:HF_CAPS,
    endpoint_policy:'Generation endpoints are discovered from the official Higgsfield OpenAPI document at runtime.'
  };
}

let specCache = {ts:0,spec:null};
async function openapi() {
  if (specCache.spec && now() - specCache.ts < 15*60*1000) return specCache.spec;
  const r = await fetch(HF_OPENAPI, {headers:{accept:'application/json'}});
  if (!r.ok) throw Error('HIGGSFIELD_OPENAPI_' + r.status);
  const spec = await r.json();
  specCache = {ts:now(),spec};
  return spec;
}
function resolveRef(spec, node, seen = new Set()) {
  if (!node || typeof node !== 'object') return node;
  if (node.$ref && String(node.$ref).startsWith('#/')) {
    if (seen.has(node.$ref)) return {};
    seen.add(node.$ref);
    let cur = spec;
    for (const part of node.$ref.slice(2).split('/')) cur = cur?.[part.replaceAll('~1','/').replaceAll('~0','~')];
    return resolveRef(spec, cur, seen);
  }
  if (Array.isArray(node)) return node.map(x => resolveRef(spec, x, new Set(seen)));
  const out = {};
  for (const [k,v] of Object.entries(node)) out[k] = resolveRef(spec, v, new Set(seen));
  return out;
}
function requestSchema(spec, op) {
  const content = op?.requestBody?.content || {};
  const schema = content['application/json']?.schema || Object.values(content)[0]?.schema || {};
  return resolveRef(spec, schema);
}
function classify(spec, path, op) {
  const schemaText = JSON.stringify(requestSchema(spec, op)).toLowerCase();
  const text = [path, op?.operationId, op?.summary, op?.description, ...(op?.tags || [])].filter(Boolean).join(' ').toLowerCase();
  const caps = [];
  const video = /video|motion|animate|animation|camera/.test(text) || /video/.test(schemaText);
  if (video) {
    caps.push('video-generation','reels-video');
    if (/image/.test(schemaText)) caps.push('image-to-video');
    if (/prompt|text/.test(schemaText)) caps.push('text-to-video');
  }
  return [...new Set(caps)];
}
async function endpoints() {
  const spec = await openapi();
  const out = [];
  for (const [path,item] of Object.entries(spec.paths || {})) {
    const op = item?.post;
    if (!op || path.startsWith('/requests/')) continue;
    const caps = classify(spec, path, op);
    if (!caps.length) continue;
    out.push({
      path,
      url:HF_API + path,
      operationId:op.operationId || null,
      summary:op.summary || null,
      tags:op.tags || [],
      capabilities:caps
    });
  }
  return out;
}
async function credential(env, cap = null) {
  let rows = await qall(env, "SELECT * FROM credentials WHERE provider='higgsfield' AND enabled=1 ORDER BY priority ASC,created_at ASC");
  if (cap) rows = rows.filter(r => {
    try {
      const caps = JSON.parse(r.capabilities || '[]');
      return caps.includes(cap) || caps.includes('video-generation');
    } catch { return false; }
  });
  if (!rows.length) return null;
  const row = rows[0];
  const pair = JSON.parse(await dec(env, row.encrypted_secret));
  return {...row,keyId:pair.keyId,keySecret:pair.keySecret};
}
function headers(c) {
  return {'Authorization':`Key ${c.keyId}:${c.keySecret}`,'Content-Type':'application/json','Accept':'application/json'};
}
async function saveCredential(env, b) {
  let keyId = String(b.keyId || '').trim();
  let keySecret = String(b.keySecret || '').trim();
  if ((!keyId || !keySecret) && b.secret) {
    const s = String(b.secret).trim();
    const i = s.indexOf(':');
    if (i > 0) { keyId = s.slice(0,i).trim(); keySecret = s.slice(i+1).trim(); }
  }
  if (!keyId || !keySecret) return json({error:'HIGGSFIELD_KEY_ID_AND_SECRET_REQUIRED'},400);
  const t = now();
  const id = uid();
  const caps = Array.isArray(b.capabilities) && b.capabilities.length ? b.capabilities.map(normalizeCap) : HF_CAPS;
  const encrypted = await enc(env, JSON.stringify({keyId,keySecret}));
  await run(env,
    'INSERT INTO credentials(id,provider,label,kind,encrypted_secret,capabilities,endpoint,model,priority,enabled,meta,last_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    id,'higgsfield',String(b.label || 'Higgsfield').trim() || 'Higgsfield','api_key_pair',encrypted,JSON.stringify(caps),
    HF_API,null,Number(b.priority || 25),1,JSON.stringify({docs:HF_DOCS,cloud:HF_CLOUD,openapi:HF_OPENAPI}),'untested',t,t
  );
  return json({ok:true,id,provider:'higgsfield',capabilities:caps});
}
async function testCredential(env, c) {
  try {
    const probe = '00000000-0000-0000-0000-000000000000';
    const r = await fetch(`${HF_API}/requests/${probe}/status`, {headers:headers(c)});
    if (r.status === 401) throw Error('HIGGSFIELD_INVALID_CREDENTIALS');
    if (r.status >= 500) throw Error('HIGGSFIELD_API_' + r.status);
    await run(env,'UPDATE credentials SET last_status=?,last_error=NULL,last_test_at=?,updated_at=? WHERE id=?','ok',now(),now(),c.id);
    return {ok:true,status:r.status};
  } catch (e) {
    await run(env,'UPDATE credentials SET last_status=?,last_error=?,last_test_at=?,updated_at=? WHERE id=?','error',e.message,now(),now(),c.id);
    return {ok:false,error:e.message};
  }
}
async function route(env, cap) {
  cap = normalizeCap(cap);
  if (!HF_CAPS.includes(cap)) throw Error('HIGGSFIELD_CAPABILITY_UNSUPPORTED');
  const c = await credential(env, cap);
  const candidates = (await endpoints()).filter(x => x.capabilities.includes(cap));
  return {
    provider:'higgsfield',
    capability:cap,
    credential:c ? {id:c.id,label:c.label,status:c.last_status} : null,
    selected:candidates[0] || null,
    candidates,
    registry:registry()
  };
}
async function generate(env, b) {
  const cap = normalizeCap(b.capability || 'video-generation');
  const r = await route(env, cap);
  if (!r.credential) throw Error('HIGGSFIELD_CREDENTIAL_REQUIRED');
  const c = await credential(env, cap);
  let ep = r.selected;
  if (b.endpoint) {
    const wanted = String(b.endpoint).trim();
    ep = r.candidates.find(x => x.path === wanted || x.url === wanted);
    if (!ep) throw Error('HIGGSFIELD_ENDPOINT_NOT_IN_OFFICIAL_OPENAPI');
  }
  if (!ep) throw Error('HIGGSFIELD_NO_OFFICIAL_ENDPOINT_FOR_CAPABILITY');
  const payload = b.input && typeof b.input === 'object' ? b.input : {};
  const res = await fetch(ep.url,{method:'POST',headers:headers(c),body:JSON.stringify(payload)});
  const text = await res.text();
  let out;
  try { out = JSON.parse(text); } catch { out = {raw:text}; }
  if (!res.ok) throw Error(`HIGGSFIELD_${res.status}:${String(out?.detail || out?.error || text).slice(0,300)}`);
  return {ok:true,provider:'higgsfield',capability:cap,endpoint:ep.path,...out};
}
async function requestStatus(env, requestId, cancel = false) {
  const c = await credential(env);
  if (!c) throw Error('HIGGSFIELD_CREDENTIAL_REQUIRED');
  const suffix = cancel ? 'cancel' : 'status';
  const res = await fetch(`${HF_API}/requests/${encodeURIComponent(requestId)}/${suffix}`, {
    method:cancel ? 'POST' : 'GET',
    headers:headers(c)
  });
  if (cancel && res.status === 204) return {ok:true,canceled:true};
  const text = await res.text();
  let out;
  try { out = JSON.parse(text); } catch { out = {raw:text}; }
  if (!res.ok) throw Error(`HIGGSFIELD_${res.status}:${String(out?.detail || out?.error || text).slice(0,300)}`);
  return out;
}
async function scout(req, env, cap) {
  const base = await core.fetch(req, env);
  let x = {results:[]};
  try { x = await base.clone().json(); } catch {}
  let routed = null;
  try { routed = await route(env, cap); } catch {}
  const official = {
    title:'Higgsfield — Official API',
    url:HF_DOCS,
    snippet:`Official Higgsfield provider • ${cap} • ${routed?.candidates?.length || 0} matching endpoint(s) from the official OpenAPI specification.`,
    provider:'higgsfield',
    official:true,
    capability:cap
  };
  return json({
    capability:cap,
    results:[official,...(x.results || []).filter(r => !String(r.url || '').includes('higgsfield.ai'))],
    route:routed
  });
}
async function hfRouter(req, env) {
  const u = new URL(req.url);
  const p = u.pathname;
  const m = req.method;
  if (p === '/api/providers/higgsfield' && m === 'GET') return json(registry());
  if (p === '/api/higgsfield/openapi/endpoints' && m === 'GET') return json({provider:'higgsfield',source:HF_OPENAPI,endpoints:await endpoints()});
  if (p === '/api/higgsfield/setup' && m === 'POST') return saveCredential(env, await reqBody(req));
  if (p === '/api/credentials' && m === 'POST') {
    const b = await reqBody(req.clone());
    if (String(b.provider || '').toLowerCase() === 'higgsfield') return saveCredential(env, b);
    return null;
  }
  let mm = p.match(/^\/api\/credentials\/([^/]+)\/test$/);
  if (mm && m === 'POST') {
    const row = await q1(env,'SELECT * FROM credentials WHERE id=?',mm[1]);
    if (row && String(row.provider).toLowerCase() === 'higgsfield') {
      const pair = JSON.parse(await dec(env,row.encrypted_secret));
      return json(await testCredential(env,{...row,...pair}));
    }
    return null;
  }
  if (p === '/api/capabilities/route' && m === 'GET' && String(u.searchParams.get('provider') || 'higgsfield').toLowerCase() === 'higgsfield') {
    return json(await route(env,u.searchParams.get('capability') || 'video-generation'));
  }
  if (p === '/api/higgsfield/generate' && m === 'POST') return json(await generate(env,await reqBody(req)));
  mm = p.match(/^\/api\/higgsfield\/requests\/([^/]+)$/);
  if (mm && m === 'GET') return json(await requestStatus(env,mm[1],false));
  mm = p.match(/^\/api\/higgsfield\/requests\/([^/]+)\/cancel$/);
  if (mm && m === 'POST') return json(await requestStatus(env,mm[1],true));
  if (p === '/api/tools/discover' && m === 'GET') {
    const cap = normalizeCap(u.searchParams.get('capability') || '');
    if (HF_CAPS.includes(cap)) return scout(req,env,cap);
  }
  return null;
}
export default {
  async fetch(req,env,ctx) {
    try {
      const u = new URL(req.url);
      if (u.pathname.startsWith('/api/') && env.DB) {
        const candidate = /^\/api\/(providers\/higgsfield|higgsfield|capabilities\/route|tools\/discover|credentials)/.test(u.pathname);
        if (candidate) {
          if (!(await authed(req,env)) && !u.pathname.startsWith('/api/providers/higgsfield')) return core.fetch(req,env,ctx);
          const r = await hfRouter(req,env);
          if (r) return r;
        }
      }
      return core.fetch(req,env,ctx);
    } catch (e) {
      return json({error:'HIGGSFIELD_INTEGRATION_ERROR',detail:e.message},500);
    }
  },
  async scheduled(event,env,ctx) {
    if (core.scheduled) return core.scheduled(event,env,ctx);
  }
};
