import {
  decryptCredential,
  execute,
  fetchWithTimeout,
  jsonResponse,
  queryOne,
  readJson,
  settleWithin
} from '../../lib/runtime.js';

const TARGETS = Object.freeze([
  { id:'vag', brands:['Volkswagen','Audi','SEAT','Škoda','Porsche'], queries:[
    'VCDS adaptation long coding MQB MLB hidden features',
    'OBDeleven coding adaptation channels Volkswagen Audi Skoda Seat',
    'ODIS coding adaptation VAG forum'
  ]},
  { id:'bmw-mini', brands:['BMW','MINI'], queries:[
    'BMW FDL CAFD coding cheat sheet E-Sys',
    'BimmerCode expert mode coding parameters BMW MINI',
    'BMW NCS Expert coding hidden features'
  ]},
  { id:'mercedes', brands:['Mercedes-Benz'], queries:[
    'Mercedes Vediamo variant coding CBF hidden features',
    'DTS Monaco SMR-D coding variant Mercedes',
    'Mercedes Xentry variant coding forum'
  ]},
  { id:'ford-mazda', brands:['Ford','Mazda'], queries:[
    'FORScan As-Built coding spreadsheet Ford',
    'Mazda FORScan hidden features As-Built',
    'Ford module As Built coding hidden features'
  ]},
  { id:'toyota-lexus', brands:['Toyota','Lexus'], queries:[
    'Toyota Techstream customize parameters hidden features',
    'Lexus Techstream customization settings',
    'Toyota body ECU customization Techstream'
  ]},
  { id:'hyundai-kia', brands:['Hyundai','Kia'], queries:[
    'Hyundai GDS variant coding hidden features',
    'Kia KDS coding hidden features',
    'Hyundai Kia BCM coding forum'
  ]},
  { id:'renault-dacia', brands:['Renault'], queries:[
    'Renault DDT4All coding hidden features',
    'Dacia DDT4All coding hidden features',
    'Renault CLIP Renolink configuration coding'
  ]},
  { id:'psa-stellantis', brands:['Peugeot','Citroën','Opel','Fiat','Alfa Romeo','Jeep'], queries:[
    'Diagbox telecoding Peugeot Citroen hidden features',
    'OP-COM Opel variant coding hidden features',
    'MultiECUScan AlfaOBD hidden features coding Fiat Alfa Jeep'
  ]},
  { id:'volvo', brands:['Volvo'], queries:[
    'Volvo VIDA coding hidden features',
    'VDASH OrBit Volvo configuration coding',
    'Volvo CEM configuration hidden features'
  ]},
  { id:'honda', brands:['Honda'], queries:[
    'Honda HDS customization hidden features',
    'Honda i-HDS body electrical customization',
    'Honda HDS customize settings forum'
  ]},
  { id:'nissan', brands:['Nissan'], queries:[
    'Nissan CONSULT III coding hidden features',
    'Nissan BCM configuration CONSULT',
    'Nissan Consult customization forum'
  ]},
  { id:'mitsubishi', brands:['Mitsubishi'], queries:[
    'Mitsubishi ETACS hidden features coding',
    'MUT-III customization coding',
    'Mitsubishi ETACS decoder configuration'
  ]},
  { id:'jlr', brands:['Jaguar','Land Rover'], queries:[
    'Jaguar Land Rover CCF coding hidden features',
    'JLR SDD Pathfinder Car Configuration File coding',
    'Jaguar Land Rover SDD configuration forum'
  ]},
  { id:'gm', brands:['Chevrolet'], queries:[
    'GM GDS2 hidden features coding',
    'Chevrolet Tech2 BCM customization',
    'GM SPS module configuration coding'
  ]}
]);

const now = () => Date.now();
const uid = () => crypto.randomUUID();

async function kvGet(env, key, fallback = null) {
  const row = await queryOne(env, 'SELECT value FROM kv WHERE key=?', key);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch { return fallback; }
}

async function kvSet(env, key, value) {
  await execute(
    env,
    'INSERT INTO kv(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at',
    key,
    JSON.stringify(value),
    now()
  );
}

async function googleConfig(env) {
  const row = await queryOne(env, 'SELECT value FROM kv WHERE key=?', 'google_search_cfg');
  if (!row) return null;
  let wrapper;
  try { wrapper = JSON.parse(row.value); } catch { return null; }
  if (!wrapper?.blob) return null;
  try { return JSON.parse(await decryptCredential(env, wrapper.blob)); } catch { return null; }
}

async function googleSearch(env, query, pages = 3) {
  const cfg = await googleConfig(env);
  if (!cfg?.key || !cfg?.cx) return [];
  const out = [];
  for (let page = 0; page < Math.max(1, Math.min(10, pages)); page++) {
    const start = 1 + page * 10;
    const url = new URL('https://customsearch.googleapis.com/customsearch/v1');
    url.searchParams.set('key', cfg.key);
    url.searchParams.set('cx', cfg.cx);
    url.searchParams.set('q', query);
    url.searchParams.set('num', '10');
    url.searchParams.set('start', String(start));
    let response;
    try { response = await fetchWithTimeout(url, { headers:{accept:'application/json'} }, 7000); }
    catch { break; }
    if (!response.ok) break;
    const payload = await response.json().catch(() => ({}));
    const items = Array.isArray(payload.items) ? payload.items : [];
    if (!items.length) break;
    for (const item of items) {
      out.push({
        id: uid(),
        title: String(item.title || ''),
        url: String(item.link || ''),
        snippet: String(item.snippet || ''),
        source: 'Google',
        host: String(item.displayLink || '')
      });
    }
    if (items.length < 10) break;
  }
  return out;
}

function ghHeaders(env) {
  const headers = {
    accept:'application/vnd.github+json',
    'user-agent':'JARVIS-Vehicle-Coding-Research/1.0',
    'x-github-api-version':'2022-11-28'
  };
  const token = String(env.GITHUB_TOKEN || env.GH_TOKEN || '').trim();
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

async function githubSearch(env, query, pages = 3) {
  const out = [];
  for (let page = 1; page <= Math.max(1, Math.min(10, pages)); page++) {
    const url = new URL('https://api.github.com/search/code');
    url.searchParams.set('q', query);
    url.searchParams.set('per_page', '30');
    url.searchParams.set('page', String(page));
    let response;
    try { response = await fetchWithTimeout(url, { headers:ghHeaders(env) }, 8000); }
    catch { break; }
    if (!response.ok) break;
    const payload = await response.json().catch(() => ({}));
    const items = Array.isArray(payload.items) ? payload.items : [];
    if (!items.length) break;
    for (const item of items) {
      out.push({
        id: uid(),
        title: String(item.name || item.path || ''),
        url: String(item.html_url || ''),
        snippet: `${item.repository?.full_name || ''} • ${item.path || ''}`,
        source: 'GitHub',
        host: 'github.com'
      });
    }
    if (items.length < 30) break;
  }
  return out;
}

function dedupe(rows = []) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const key = String(row.url || '').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function sourceConfidence(row) {
  const host = String(row.host || '').toLowerCase();
  if (/ross-tech|fordservicecontent|toyota-tech|bmwtechinfo|mercedes-benz/.test(host)) return 0.92;
  if (row.source === 'GitHub') return 0.76;
  if (/forum|mbworld|clublexus|forscan/.test(host)) return 0.68;
  if (/reddit/.test(host)) return 0.52;
  return 0.60;
}

async function normalizeCandidates(env, target, query, rows) {
  const compact = rows.slice(0, 24).map((row, index) => ({
    index,
    title:row.title,
    url:row.url,
    snippet:row.snippet,
    source:row.source
  }));

  if (!env.AI || !compact.length) {
    return compact.map(row => ({
      id:uid(),
      target:target.id,
      brands:target.brands,
      query,
      title:row.title,
      feature:'',
      module:'',
      channel:'',
      value:'',
      applicability:'',
      sourceUrl:row.url,
      sourceTitle:row.title,
      sourceKind:row.source,
      confidence:sourceConfidence(rows[row.index] || {}),
      status:'research_only',
      observedAt:now()
    }));
  }

  const prompt = [
    'Extract factual vehicle coding/adaptation/hidden-feature candidates from these public search results.',
    'Return ONLY JSON array. Do not invent missing channel/byte/bit/value data.',
    'Each object keys: feature,module,channel,value,applicability,sourceIndex.',
    'If a result only says a feature exists but gives no exact parameter, leave channel/value empty.',
    `Target brands: ${target.brands.join(', ')}`,
    `Query: ${query}`,
    JSON.stringify(compact)
  ].join('\n');

  const response = await settleWithin(
    env.AI.run('@cf/zai-org/glm-4.7-flash', {
      prompt,
      max_tokens:1800,
      temperature:0.05
    }),
    5000,
    null
  );

  const raw = String(response?.response || response?.result?.response || response?.text || '').trim();
  let parsed = [];
  try {
    const cleaned = raw.replace(/^\`\`\`json\s*/i,'').replace(/\`\`\`$/,'').trim();
    parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) parsed = [];
  } catch { parsed = []; }

  return parsed.flatMap(item => {
    const index = Number(item?.sourceIndex);
    const source = compact[index];
    if (!source?.url) return [];
    const original = rows.find(r => r.url === source.url) || {};
    return [{
      id:uid(),
      target:target.id,
      brands:target.brands,
      query,
      title:String(source.title || ''),
      feature:String(item.feature || '').trim(),
      module:String(item.module || '').trim(),
      channel:String(item.channel || '').trim(),
      value:String(item.value || '').trim(),
      applicability:String(item.applicability || '').trim(),
      sourceUrl:source.url,
      sourceTitle:source.title,
      sourceKind:source.source,
      confidence:sourceConfidence(original),
      status:'research_only',
      observedAt:now()
    }];
  });
}

async function saveTarget(env, target, candidates) {
  const key = `vehicle_coding_research:${target.id}`;
  const existing = await kvGet(env, key, { candidates:[] });
  const merged = [...(existing?.candidates || []), ...candidates];
  const byKey = new Map();
  for (const row of merged) {
    const fingerprint = [
      row.feature,row.module,row.channel,row.value,row.sourceUrl
    ].map(x => String(x || '').trim().toLowerCase()).join('|');
    if (!fingerprint.replaceAll('|','')) continue;
    const old = byKey.get(fingerprint);
    if (!old || Number(row.confidence || 0) > Number(old.confidence || 0)) byKey.set(fingerprint,row);
  }
  const finalRows = [...byKey.values()]
    .sort((a,b) => Number(b.confidence||0)-Number(a.confidence||0) || Number(b.observedAt||0)-Number(a.observedAt||0))
    .slice(0,1500);
  await kvSet(env, key, {
    target:target.id,
    brands:target.brands,
    updatedAt:now(),
    candidates:finalRows
  });
  return finalRows.length;
}

async function researchTarget(env, target, { pages = 3, maxQueries = 3 } = {}) {
  let added = 0;
  const errors = [];
  for (const query of target.queries.slice(0, Math.max(1, maxQueries))) {
    const [google, github] = await Promise.all([
      googleSearch(env, query, pages).catch(error => { errors.push(`google:${error.message}`); return []; }),
      githubSearch(env, query, pages).catch(error => { errors.push(`github:${error.message}`); return []; })
    ]);
    const rows = dedupe([...google, ...github]);
    const candidates = await normalizeCandidates(env, target, query, rows);
    if (candidates.length) {
      await saveTarget(env, target, candidates);
      added += candidates.length;
    }
  }
  return { target:target.id, brands:target.brands, added, errors };
}

function findTarget(value = '') {
  const needle = String(value || '').trim().toLowerCase();
  if (!needle) return null;
  return TARGETS.find(target =>
    target.id.toLowerCase() === needle ||
    target.brands.some(brand => brand.toLowerCase() === needle)
  ) || null;
}

async function status(env) {
  const rows = [];
  for (const target of TARGETS) {
    const stored = await kvGet(env, `vehicle_coding_research:${target.id}`, null);
    rows.push({
      id:target.id,
      brands:target.brands,
      queryCount:target.queries.length,
      candidates:stored?.candidates?.length || 0,
      updatedAt:stored?.updatedAt || null
    });
  }
  return {
    targets:rows,
    targetCount:TARGETS.length,
    totalCandidates:rows.reduce((sum,row)=>sum+row.candidates,0),
    googleConfigured:!!(await googleConfig(env)),
    githubTokenConfigured:!!String(env.GITHUB_TOKEN || env.GH_TOKEN || '').trim()
  };
}

async function catalog(env, brand = '') {
  const target = findTarget(brand);
  if (target) {
    return await kvGet(env, `vehicle_coding_research:${target.id}`, {
      target:target.id, brands:target.brands, candidates:[]
    });
  }
  const all = [];
  for (const item of TARGETS) {
    const stored = await kvGet(env, `vehicle_coding_research:${item.id}`, null);
    if (stored?.candidates) all.push(...stored.candidates);
  }
  return { candidates:all, total:all.length };
}

async function authed(core, req, env, ctx) {
  const response = await core.fetch(
    new Request(new URL('/api/auth/status', req.url), { headers:req.headers }),
    env,
    ctx
  );
  try { return !!(await response.json()).authenticated; } catch { return false; }
}

export function createVehicleCodingResearch(core) {
  if (!core?.fetch) throw new Error('VEHICLE_CODING_RESEARCH_CORE_REQUIRED');

  return {
    async fetch(req, env, ctx) {
      const url = new URL(req.url);
      const path = url.pathname;
      const method = req.method;

      if (!path.startsWith('/api/vehicle/coding-research/')) return core.fetch(req, env, ctx);
      if (!(await authed(core, req, env, ctx))) return core.fetch(req, env, ctx);

      if (path === '/api/vehicle/coding-research/status' && method === 'GET') {
        return jsonResponse(await status(env));
      }

      if (path === '/api/vehicle/coding-research/catalog' && method === 'GET') {
        const brand = String(url.searchParams.get('brand') || '');
        return jsonResponse(await catalog(env, brand));
      }

      if (path === '/api/vehicle/coding-research/sync' && method === 'POST') {
        const body = await readJson(req);
        const target = findTarget(body.brand || body.target || '');
        if (!target) return jsonResponse({ error:'UNKNOWN_BRAND_OR_TARGET' }, 400);
        const pages = Math.max(1, Math.min(10, Number(body.pages || 3)));
        const result = await researchTarget(env, target, { pages, maxQueries:3 });
        return jsonResponse({ ok:true, result, status:await status(env) });
      }

      if (path === '/api/vehicle/coding-research/sync-all' && method === 'POST') {
        const body = await readJson(req);
        const pages = Math.max(1, Math.min(5, Number(body.pages || 2)));
        const results = [];
        for (const target of TARGETS) {
          results.push(await researchTarget(env, target, { pages, maxQueries:2 }));
        }
        return jsonResponse({ ok:true, results, status:await status(env) });
      }

      return jsonResponse({ error:'NOT_FOUND' }, 404);
    },

    async scheduled(event, env, ctx) {
      await core.scheduled?.(event, env, ctx);
      const cursor = Number((await kvGet(env, 'vehicle_coding_research_cursor', 0)) || 0);
      const target = TARGETS[cursor % TARGETS.length];
      ctx.waitUntil((async() => {
        await researchTarget(env, target, { pages:2, maxQueries:2 });
        await kvSet(env, 'vehicle_coding_research_cursor', (cursor + 1) % TARGETS.length);
      })().catch(() => {}));
    }
  };
}

export { TARGETS as VEHICLE_CODING_RESEARCH_TARGETS, researchTarget };
