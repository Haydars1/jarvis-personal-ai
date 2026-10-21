// Browser-triggered, authenticated HyperFrames MP4 rendering on GitHub Actions.
// No Chromium or shell execution inside Cloudflare Workers.
import { jsonResponse, queryOne, execute, readJson } from '../../lib/runtime.js';
import { githubCredential, repoCfg, gh } from '../../lib/github.js';
import { normalizeHyperframesBrief } from './hyperframes-project.js';

const REPO = 'Haydars1/jarvis-personal-ai';
const WORKFLOW = 'hyperframes-render.yml';
const MAX_ZIP_BYTES = 24 * 1024 * 1024;
const now = () => Date.now();

async function stateGet(env, key) {
  const r = await queryOne(env, 'SELECT value FROM kv WHERE key=?', key);
  if (!r) return null;
  try { return JSON.parse(r.value); } catch { return null; }
}
async function statePut(env, key, value) {
  await execute(env, 'INSERT INTO kv(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at',
    key, JSON.stringify(value), now());
}
const jobKey = id => 'hyperframes:render:' + id;
const cleanId = value => /^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(String(value || ''));
const err = (message, status = 400) => jsonResponse({ ok:false, error:message }, status);

async function connection(env) {
  const credential = await githubCredential(env);
  if (!credential) throw new Error('GITHUB_CREDENTIAL_REQUIRED');
  const config = repoCfg(credential);
  if (config.repo.toLowerCase() !== REPO.toLowerCase()) throw new Error('GITHUB_REPOSITORY_MUST_BE_' + REPO);
  return credential;
}
function publicState(job, run = null) {
  const conclusion = String(run?.conclusion || '');
  const status = run ? (run.status === 'completed' ? (conclusion === 'success' ? 'ready' : 'failed') : 'rendering') : 'queued';
  return { ok:true, id:job.id, status, created_at:job.createdAt,
    run_id:run?.id || job.runId || null, conclusion:conclusion || null,
    download_ready:status === 'ready' };
}

export async function startHyperframesCloudRender(env, req) {
  let brief;
  try { brief = normalizeHyperframesBrief(await readJson(req)); }
  catch (e) { return err(e.message); }
  let credential;
  try { credential = await connection(env); }
  catch(e) { return err(e.message, 409); }
  const windowKey = 'hyperframes:quota:v1';
  const current = await stateGet(env, windowKey);
  const window = current && now() - Number(current.start||0) < 3600000
    ? current : {start:now(), count:0};
  if (window.count >= 3) return err('HYPERFRAMES_HOURLY_LIMIT_3', 429);
  const id = crypto.randomUUID();
  const job = { id, brief, createdAt: now(), runId: null };
  try {
    // GitHub dispatch executes on the configured default branch. It will not be
    // available until the workflow is merged; no speculative success is returned.
    await gh(credential, '/repos/' + REPO + '/actions/workflows/' + WORKFLOW + '/dispatches', {
      method:'POST', headers:{'content-type':'application/json'},
      body:JSON.stringify({ref:'main', inputs:{
        job_id:id, brand:brief.brand, title:brief.title, subtitle:brief.subtitle,
        format:brief.format, duration:String(brief.duration)
      }})
    });
  } catch(e) { return err('HYPERFRAMES_DISPATCH_FAILED:' + e.message, 502); }
  await statePut(env, jobKey(id), job);
  await statePut(env, windowKey, {...window,count:window.count+1});
  return jsonResponse({ ...publicState(job), message:'GitHub Actions üzerinde MP4 render kuyruğa alındı.' }, 202);
}

async function resolveJob(env, id) {
  if (!cleanId(id)) return {error:'INVALID_RENDER_ID', code:400};
  const job = await stateGet(env, jobKey(id));
  if (!job) return {error:'RENDER_NOT_FOUND', code:404};
  let credential;
  try { credential = await connection(env); }
  catch(e) { return {error:e.message,code:409}; }
  let run = null;
  try {
    if (job.runId) {
      run = await gh(credential, '/repos/' + REPO + '/actions/runs/' + job.runId);
    } else {
      const list = await gh(credential, '/repos/' + REPO + '/actions/workflows/' + WORKFLOW + '/runs?event=workflow_dispatch&per_page=60');
      run = (list.workflow_runs || []).find(item => String(item.display_title || '').includes(id)) || null;
      if (run) { job.runId = run.id; await statePut(env,jobKey(id),job); }
    }
  } catch(e) { return {error:'GITHUB_RUN_STATUS_ERROR:' + e.message,code:502}; }
  return {job,credential,run};
}
export async function hyperframesCloudStatus(env,id) {
  const data = await resolveJob(env,id);
  if (data.error) return err(data.error,data.code);
  if (!data.run && now()-data.job.createdAt>10*60*1000)
    return err('HYPERFRAMES_RUN_NOT_FOUND_AFTER_DISPATCH',502);
  return jsonResponse(publicState(data.job,data.run));
}

export async function hyperframesCloudDownload(env,id) {
  const data = await resolveJob(env,id);
  if (data.error) return err(data.error,data.code);
  if (data.run?.status !== 'completed' || data.run?.conclusion !== 'success')
    return err('RENDER_NOT_READY',409);
  let artifacts;
  try { artifacts = await gh(data.credential,'/repos/'+REPO+'/actions/runs/'+data.run.id+'/artifacts?per_page=30'); }
  catch(e) { return err('GITHUB_ARTIFACT_LOOKUP_FAILED:'+e.message,502); }
  const artifact = (artifacts.artifacts||[]).find(a => a.name === 'hyperframes-'+id && !a.expired);
  if (!artifact) return err('RENDER_ARTIFACT_MISSING_OR_EXPIRED',404);
  if (Number(artifact.size_in_bytes||0) > MAX_ZIP_BYTES)
    return err('RENDER_ARTIFACT_TOO_LARGE',413);
  const response = await fetch('https://api.github.com/repos/'+REPO+'/actions/artifacts/'+artifact.id+'/zip',{
    headers:{authorization:'Bearer '+data.credential.secret,accept:'application/vnd.github+json',
      'x-github-api-version':'2022-11-28','user-agent':'hayirlievlad-hyperframes'}
  });
  if (!response.ok) return err('GITHUB_ARTIFACT_DOWNLOAD_'+response.status,502);
  if (Number(response.headers.get('content-length')||0) > MAX_ZIP_BYTES)
    return err('RENDER_ARCHIVE_TOO_LARGE',413);
  return new Response(response.body, {
    headers:{'content-type':'application/zip','cache-control':'private, no-store',
      'content-disposition':'attachment; filename="hyperframes-'+id+'.zip"','x-content-type-options':'nosniff'}
  });
}
