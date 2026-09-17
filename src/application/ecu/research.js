import { searchGoogle } from '../search/google.js';

const RESEARCH_INTERVAL_MS = 6 * 60 * 60 * 1000;

export const DEFAULT_ECU_RESEARCH_TOPICS = Object.freeze([
  'Bosch EDC17C46 calibration maps torque boost rail pressure technical documentation',
  'EDC17C46 map recognition axes calibration educational material',
  'Bosch EDC17 calibration strategy torque structure technical paper',
  'A2L ASAP2 ECU calibration map axis open documentation',
  'ECU binary calibration map detection open source research',
]);

async function sha256Text(value) {
  const bytes = new TextEncoder().encode(String(value || ''));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function normalizeResult(row, topic) {
  const url = String(row?.url || '').trim();
  if (!url) return null;
  return {
    title: String(row?.title || '').slice(0, 500),
    url,
    snippet: String(row?.snippet || '').slice(0, 4000),
    provider: String(row?.source || 'Google').slice(0, 100),
    topic,
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
    await env.DB.prepare(`INSERT INTO ecu_knowledge_sources(id,url,title,provider,topic,verified,first_seen_at,last_seen_at)
      VALUES(?,?,?,?,?,?,?,?)
      ON CONFLICT(url) DO UPDATE SET title=excluded.title,provider=excluded.provider,topic=excluded.topic,last_seen_at=excluded.last_seen_at`)
      .bind(id, source.url, source.title, source.provider, source.topic, 0, now, now).run();
  },

  async storeClaim(env, claim) {
    const id = await sha256Text(`${claim.sourceUrl}\n${claim.text}`);
    const now = Date.now();
    await env.DB.prepare(`INSERT INTO ecu_knowledge_claims(id,source_url,topic,text,verification_state,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at`)
      .bind(id, claim.sourceUrl, claim.topic, claim.text, claim.verificationState, now, now).run();
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
      (SELECT COUNT(*) FROM ecu_knowledge_claims WHERE verification_state='VERIFIED') AS verified_claims`).first();
    return { latest: latest || null, counts: counts || { sources: 0, claims: 0, verified_claims: 0 } };
  },
};

export function createEcuResearch({
  repository = defaultRepository,
  topics = DEFAULT_ECU_RESEARCH_TOPICS,
  search = (env, query) => searchGoogle(env, query, { num: 6 }),
} = {}) {
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
        }
      }

      const summary = { sourcesFound, claimsFound, errors };
      await repository.finishRun(env, bucket, summary);
      return { skipped: false, bucket, ...summary };
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
