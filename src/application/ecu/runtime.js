import { createEcuJobRecord } from './models.js';
import { assertEcuJobTransition } from './state-machine.js';
import { createEcuResearch } from './research.js';
import { discoverGitHubEcuSources } from './github-intelligence.js';
import { createEcuTraining } from './training.js';
import { buildEcuDatasetSnapshot } from './dataset.js';
import { decideEcuModelPromotion, ecuBenchmarkScore } from './promotion.js';
import { extractVerifiedChangeEvidence } from './change-evidence.js';
import { createEcuRulepackLearning } from './rulepacks.js';
import { evaluateMachineHypothesisGroup } from './machine-consensus.js';
import { createEcuArtifactStore } from '../../infrastructure/ecu/artifact-store.js';
import { createComputeDispatch } from '../../infrastructure/ecu/compute-dispatch.js';

const now = () => Date.now();
const uid = () => crypto.randomUUID();

const ECU_OPERATION_LABELS=Object.freeze({
  stage1_proposal:'stage1',
  dtc_off_proposal:'dtc_off',
  egr_off_proposal:'egr_off',
  dpf_off_proposal:'dpf_off',
  adblue_off_proposal:'adblue_off',
  vmax_off_proposal:'vmax_off',
  startstop_off_proposal:'startstop_off',
});

function firstCandidate(raw){
  try{
    const values=JSON.parse(raw||'[]');
    const first=values?.[0];
    return typeof first==='string'?first:String(first?.value||'');
  }catch{return '';}
}

function firstBodyCandidate(values){
  const first=Array.isArray(values)?values[0]:null;
  return typeof first==='string'?first:String(first?.value||'');
}

async function fileIdentity(env,fileId){
  const row=await env.DB.prepare(`SELECT a.ecu_family,a.hw_candidates,a.sw_candidates
    FROM ecu_analysis_results a
    JOIN ecu_jobs j ON j.id=a.job_id
    WHERE j.file_id=?
    ORDER BY a.created_at DESC LIMIT 1`).bind(fileId).first();
  return {
    ecuFamily:String(row?.ecu_family||''),
    hw:firstCandidate(row?.hw_candidates),
    sw:firstCandidate(row?.sw_candidates),
  };
}

async function defaultListGitHubRepositories(env,limit=20){
  const safe=Math.max(1,Math.min(100,Number(limit||20)));
  const rows=(await env.DB.prepare(`SELECT repository,license,reuse_policy,stars,capabilities_json,default_branch,last_seen_at
    FROM ecu_github_repositories
    ORDER BY CASE reuse_policy WHEN 'ADAPT_WITH_ATTRIBUTION' THEN 0 WHEN 'ARCHITECTURE_ONLY' THEN 1 ELSE 2 END,
      stars DESC,last_seen_at DESC
    LIMIT ?`).bind(safe).all()).results||[];
  return rows.map(row=>({
    repository:row.repository,
    license:row.license,
    reusePolicy:row.reuse_policy,
    stars:Number(row.stars||0),
    capabilities:(()=>{try{return JSON.parse(row.capabilities_json||'[]')}catch{return []}})(),
    defaultBranch:row.default_branch||'',
    lastSeenAt:Number(row.last_seen_at||0),
  }));
}

async function defaultRulepackForIdentity(env,{operationLabel,ecuFamily='',hw='',sw=''}) {
  const row=await env.DB.prepare(`SELECT version,rules_json,ecu_family,hw,sw
    FROM ecu_rulepack_versions
    WHERE state='PRODUCTION' AND verified=1 AND operation_label=?
      AND (ecu_family='' OR ecu_family=?)
      AND (hw='' OR hw=?)
      AND (sw='' OR sw=?)
    ORDER BY
      CASE WHEN sw<>'' THEN 3 WHEN hw<>'' THEN 2 WHEN ecu_family<>'' THEN 1 ELSE 0 END DESC,
      promoted_at DESC,created_at DESC
    LIMIT 1`)
    .bind(String(operationLabel||''),String(ecuFamily||''),String(hw||''),String(sw||'')).first();
  if(!row?.version)return null;
  let rules={};
  try{rules=JSON.parse(row.rules_json||'{}')}catch{}
  return {
    version:row.version,
    rules,
    ecuFamily:row.ecu_family||'',
    hw:row.hw||'',
    sw:row.sw||'',
  };
}

async function defaultChecksumProfileForIdentity(env,{ecuFamily='',hw='',sw=''}) {
  const row=await env.DB.prepare(`SELECT id,ecu_family,hw,sw,algorithm,data_start,data_end,checksum_offset,checksum_size,endian,zero_field,verified_pairs
    FROM ecu_checksum_profiles
    WHERE state='PRODUCTION' AND verified=1
      AND (ecu_family='' OR ecu_family=?)
      AND (hw='' OR hw=?)
      AND (sw='' OR sw=?)
    ORDER BY
      CASE WHEN sw<>'' THEN 3 WHEN hw<>'' THEN 2 WHEN ecu_family<>'' THEN 1 ELSE 0 END DESC,
      verified_pairs DESC,promoted_at DESC,created_at DESC
    LIMIT 1`)
    .bind(String(ecuFamily||''),String(hw||''),String(sw||'')).first();
  if(!row?.id)return null;
  return {
    id:row.id,
    ecuFamily:row.ecu_family||'',
    hw:row.hw||'',
    sw:row.sw||'',
    algorithm:row.algorithm,
    data_start:Number(row.data_start),
    data_end:Number(row.data_end),
    checksum_offset:Number(row.checksum_offset),
    checksum_size:Number(row.checksum_size),
    endian:row.endian||'big',
    zero_field:Boolean(row.zero_field),
    verifiedPairs:Number(row.verified_pairs||0),
  };
}

async function sha256Text(value) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value))));
  return [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

async function readJson(req) {
  try { return await req.json(); } catch { return {}; }
}

function isComputeAuthorized(req, env = {}) {
  const expected = String(env.ECU_COMPUTE_TOKEN || '').trim();
  if (!expected) return false;
  const actual = String(req.headers.get('authorization') || '');
  return actual === `Bearer ${expected}`;
}

function validWorkerEndpoint(value) {
  try {
    const url=new URL(String(value||''));
    if(url.protocol!=='https:')return false;
    const host=url.hostname.toLowerCase();
    if(host==='localhost'||host==='127.0.0.1'||host==='::1'||host.endsWith('.local'))return false;
    return url.pathname.endsWith('/jobs');
  } catch {
    return false;
  }
}

function requestFilename(req) {
  const raw = String(req.headers.get('x-ecu-filename') || 'original.bin').trim();
  let decoded = raw;
  try { decoded = decodeURIComponent(raw); } catch {}
  return decoded.slice(0, 180) || 'original.bin';
}

function mapJob(row) {
  if (!row) return null;
  return {
    id: row.id,
    fileId: row.file_id,
    operation: row.operation,
    state: row.state,
    runFingerprint: row.run_fingerprint ?? null,
    modelVersion: row.model_version ?? null,
    rulepackVersion: row.rulepack_version ?? null,
    workerKind: row.worker_kind ?? null,
    result: row.result_json ? JSON.parse(row.result_json) : null,
    error: row.error ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function defaultCreatePair(env,{oriFileId,modFileId,operationLabel,callbackBaseUrl=null},dispatch){
  const ori=await env.DB.prepare('SELECT id,sha256,artifact_uri,size_bytes FROM ecu_files WHERE id=? LIMIT 1').bind(oriFileId).first();
  const mod=await env.DB.prepare('SELECT id,sha256,artifact_uri,size_bytes FROM ecu_files WHERE id=? LIMIT 1').bind(modFileId).first();
  if(!ori||!mod)throw new Error('ECU_FILE_NOT_FOUND');
  if(Number(ori.size_bytes)!==Number(mod.size_bytes))throw new Error('ECU_PAIR_SIZE_MISMATCH');
  const id=uid();
  const createdAt=now();
  const runFingerprint=await sha256Text(JSON.stringify({
    operation:'diff_pair',
    ori:ori.sha256,
    mod:mod.sha256,
    operationLabel,
  }));
  const existing=await env.DB.prepare('SELECT id,operation_label,state,run_fingerprint,worker_kind,created_at,updated_at FROM ecu_training_pairs WHERE run_fingerprint=? LIMIT 1').bind(runFingerprint).first();
  if(existing){
    return {
      id:existing.id,
      state:existing.state,
      operationLabel:existing.operation_label,
      runFingerprint:existing.run_fingerprint,
      workerKind:existing.worker_kind||null,
      cached:true,
      createdAt:existing.created_at,
      updatedAt:existing.updated_at,
    };
  }
  const identity=await fileIdentity(env,oriFileId);
  await env.DB.prepare(`INSERT INTO ecu_training_pairs(
    id,ori_file_id,mod_file_id,operation_label,ecu_family,hw,sw,state,run_fingerprint,created_at,updated_at
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id,oriFileId,modFileId,operationLabel,identity.ecuFamily,identity.hw,identity.sw,'QUEUED',runFingerprint,createdAt,createdAt).run();

  const result=await dispatch({
    id,
    operation:'diff_pair',
    runFingerprint,
    oriArtifactSha256:ori.sha256,
    modArtifactSha256:mod.sha256,
    oriArtifactUri:ori.artifact_uri,
    modArtifactUri:mod.artifact_uri,
    operationLabel,
    config:callbackBaseUrl?{callback_base_url:callbackBaseUrl}:{},
  },env);
  const state=result?.accepted?'DISPATCHED':'QUEUED';
  await env.DB.prepare('UPDATE ecu_training_pairs SET state=?,worker_kind=?,updated_at=? WHERE id=?')
    .bind(state,result?.workerKind||null,now(),id).run();
  return {id,state,operationLabel,runFingerprint,workerKind:result?.workerKind||null,dispatchReason:result?.reason||null};
}

async function defaultCreateJob(env, { fileId, operation = 'analyze', callbackBaseUrl = null }, dispatch) {
  const file = await env.DB.prepare('SELECT id,sha256,artifact_uri FROM ecu_files WHERE id=? LIMIT 1').bind(fileId).first();
  if (!file) throw new Error('ECU_FILE_NOT_FOUND');
  const productionModel=await env.DB.prepare("SELECT version FROM ecu_model_versions WHERE state='PRODUCTION' ORDER BY promoted_at DESC,created_at DESC LIMIT 1").first();
  const modelVersion = productionModel?.version || 'baseline';
  let rulepackVersion = 'baseline';
  let rulepackConfig = {};
  const operationLabel=ECU_OPERATION_LABELS[operation]||null;
  const identity=await fileIdentity(env,fileId);
  if (operationLabel) {
    const rulepack=await defaultRulepackForIdentity(env,{operationLabel,...identity});
    if (rulepack?.version) {
      let rules={};
      try { rules=JSON.parse(rulepack.rules_json||'{}'); } catch {}
      rulepackVersion=rulepack.version;
      rulepackConfig={
        rulepack_verified:true,
        rulepack:rules,
        operation_label:operationLabel,
        ecu_family:identity.ecuFamily,
        hw:identity.hw,
        sw:identity.sw,
      };
    } else {
      rulepackConfig={
        rulepack_verified:false,
        operation_label:operationLabel,
        ecu_family:identity.ecuFamily,
        hw:identity.hw,
        sw:identity.sw,
      };
    }
  }
  const runFingerprint = await sha256Text(JSON.stringify({
    artifactSha256: file.sha256,
    operation,
    modelVersion,
    rulepackVersion,
  }));
  const existing = await env.DB.prepare('SELECT * FROM ecu_jobs WHERE run_fingerprint=? LIMIT 1').bind(runFingerprint).first();
  if (existing) return { ...mapJob(existing), cached: true };
  const record = createEcuJobRecord({ id: uid(), artifactHash: fileId, operation, createdAt: now() });
  await env.DB.prepare('INSERT INTO ecu_jobs(id,file_id,operation,state,run_fingerprint,model_version,rulepack_version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)')
    .bind(record.id, fileId, operation, record.state, runFingerprint, modelVersion, rulepackVersion, record.createdAt, record.updatedAt).run();

  const dispatched = await dispatch({
    id: record.id,
    runFingerprint,
    artifactUri: file.artifact_uri,
    artifactSha256: file.sha256,
    operation,
    modelVersion,
    rulepackVersion,
    config: {
      ...(callbackBaseUrl ? { callback_base_url: callbackBaseUrl } : {}),
      ...rulepackConfig,
    },
  }, env);
  const state = dispatched?.accepted ? 'DISPATCHED' : 'QUEUED';
  await env.DB.prepare('UPDATE ecu_jobs SET state=?,worker_kind=?,updated_at=? WHERE id=?')
    .bind(state, dispatched?.workerKind || null, now(), record.id).run();
  return {
    ...record,
    fileId,
    state,
    runFingerprint,
    modelVersion,
    rulepackVersion,
    workerKind: dispatched?.workerKind || null,
    dispatchReason: dispatched?.reason || null,
  };
}

async function defaultGetJob(env, id) {
  return mapJob(await env.DB.prepare('SELECT * FROM ecu_jobs WHERE id=? LIMIT 1').bind(id).first());
}

async function defaultListPairs(env,limit=20){
  const safeLimit=Math.max(1,Math.min(100,Number(limit)||20));
  const rows=(await env.DB.prepare(`SELECT
      id,ori_file_id,mod_file_id,operation_label,state,run_fingerprint,worker_kind,diff_digest,diff_json,error,created_at,updated_at
    FROM ecu_training_pairs ORDER BY created_at DESC LIMIT ?`).bind(safeLimit).all()).results||[];
  return rows.map(row=>{
    let diff=null;
    try{diff=row.diff_json?JSON.parse(row.diff_json):null}catch{}
    return {
      id:row.id,
      oriFileId:row.ori_file_id,
      modFileId:row.mod_file_id,
      operationLabel:row.operation_label,
      state:row.state,
      runFingerprint:row.run_fingerprint||null,
      workerKind:row.worker_kind||null,
      diffDigest:row.diff_digest||null,
      changedByteCount:Number(diff?.changed_byte_count||0),
      rangeCount:Array.isArray(diff?.ranges)?diff.ranges.length:0,
      error:row.error||null,
      createdAt:row.created_at,
      updatedAt:row.updated_at,
    };
  });
}

async function defaultMapContextForArtifact(env, sha256) {
  const rows=(await env.DB.prepare(`SELECT
      m.map_offset,m.rows,m.cols,m.data_type,m.endian,m.semantic_label,m.confidence,m.features_json,
      e.id AS verified_example_id
    FROM ecu_map_candidates m
    JOIN ecu_jobs j ON j.id=m.job_id
    JOIN ecu_files f ON f.id=j.file_id
    LEFT JOIN ecu_training_examples e ON e.source_ref=m.id AND e.human_verified=1
    WHERE f.sha256=?
      AND j.state IN ('NEEDS_REVIEW','READY')
    ORDER BY j.updated_at DESC,m.confidence DESC,m.map_offset ASC`).bind(sha256).all()).results||[];
  return rows.map(row=>({
    offset:Number(row.map_offset||0),
    rows:row.rows==null?null:Number(row.rows),
    cols:row.cols==null?null:Number(row.cols),
    dataType:row.data_type||null,
    endian:row.endian||null,
    semanticLabel:row.semantic_label||'UNKNOWN',
    confidence:Number(row.confidence||0),
    humanVerified:Boolean(row.verified_example_id),
    features:(()=>{try{return JSON.parse(row.features_json||'{}')}catch{return {}}})(),
  }));
}

async function defaultListMaps(env, jobId) {
  const rows=(await env.DB.prepare(`SELECT
      id,map_offset,rows,cols,data_type,endian,semantic_label,confidence,features_json,created_at
    FROM ecu_map_candidates WHERE job_id=? ORDER BY confidence DESC,map_offset ASC`).bind(jobId).all()).results||[];
  return rows.map(row=>({
    id:row.id,
    offset:Number(row.map_offset||0),
    rows:row.rows==null?null:Number(row.rows),
    cols:row.cols==null?null:Number(row.cols),
    dataType:row.data_type||null,
    endian:row.endian||null,
    semanticLabel:row.semantic_label||'UNKNOWN',
    confidence:Number(row.confidence||0),
    features:(()=>{try{return JSON.parse(row.features_json||'{}')}catch{return {}}})(),
    createdAt:row.created_at,
  }));
}

async function defaultListJobs(env, limit = 50) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 50));
  const rows = (await env.DB.prepare('SELECT * FROM ecu_jobs ORDER BY created_at DESC LIMIT ?').bind(safeLimit).all()).results || [];
  return rows.map(mapJob);
}

async function defaultUploadOriginal(env, { bytes, filename = 'original.bin', contentType = 'application/octet-stream' }) {
  const store = createEcuArtifactStore(env.ECU_ARTIFACTS);
  const saved = await store.putOriginal(bytes, { filename, contentType });
  const id = saved.sha256;
  const artifactUri = `r2://ecu-artifacts/${saved.key}`;
  const createdAt = now();
  await env.DB.prepare(`INSERT INTO ecu_files(id,sha256,original_name,artifact_uri,size_bytes,immutable,created_at)
    VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(sha256) DO NOTHING`)
    .bind(id, saved.sha256, filename, artifactUri, saved.sizeBytes, 1, createdAt).run();
  return {
    id,
    sha256: saved.sha256,
    artifactUri,
    originalName: filename,
    sizeBytes: saved.sizeBytes,
    existed: saved.existed,
    immutable: true,
  };
}

async function defaultGetValidatedMod(env, jobId) {
  const row=await env.DB.prepare('SELECT sha256,checksum_algorithm FROM ecu_mod_artifacts WHERE job_id=? LIMIT 1').bind(jobId).first();
  if(!row)return null;
  const store=createEcuArtifactStore(env.ECU_ARTIFACTS);
  const bytes=await store.getValidatedMod(String(row.sha256||'').toLowerCase());
  if(!bytes)return null;
  return {
    bytes,
    sha256:row.sha256,
    checksumAlgorithm:row.checksum_algorithm,
    filename:`${jobId}-MOD.bin`,
  };
}

async function defaultStoreValidatedMod(env, jobId, { bytes, checksumAlgorithm }) {
  const existing=await env.DB.prepare('SELECT id,job_id,sha256,artifact_uri,size_bytes,checksum_algorithm,validation_json,created_at FROM ecu_mod_artifacts WHERE job_id=? LIMIT 1').bind(jobId).first();
  if(existing){
    return {
      id:existing.id,
      jobId:existing.job_id,
      sha256:existing.sha256,
      artifactUri:existing.artifact_uri,
      sizeBytes:Number(existing.size_bytes||0),
      checksumAlgorithm:existing.checksum_algorithm,
      validation:(()=>{try{return JSON.parse(existing.validation_json||'{}')}catch{return {}}})(),
      createdAt:existing.created_at,
      existed:true,
    };
  }

  const job=await env.DB.prepare('SELECT id,state,result_json FROM ecu_jobs WHERE id=? LIMIT 1').bind(jobId).first();
  if(!job)throw new Error('ECU_JOB_NOT_FOUND');
  if(job.state!=='READY')throw new Error('ECU_MOD_JOB_NOT_READY');

  let result={};
  try{result=job.result_json?JSON.parse(job.result_json):{}}catch{}
  const validation=result.validation||result.release_validation||result.proposal?.validation||null;
  if(!validation?.ready)throw new Error('ECU_MOD_VALIDATION_NOT_READY');
  const checksumStatus=String(validation?.checksum?.status||validation?.checksum_status||'');
  const recordedAlgorithm=String(validation?.checksum?.algorithm||validation?.checksum_algorithm||'');
  if(checksumStatus!=='VERIFIED')throw new Error('ECU_MOD_CHECKSUM_NOT_VERIFIED');
  if(!checksumAlgorithm||!recordedAlgorithm||String(checksumAlgorithm)!==recordedAlgorithm){
    throw new Error('ECU_MOD_CHECKSUM_ALGORITHM_MISMATCH');
  }

  const store=createEcuArtifactStore(env.ECU_ARTIFACTS);
  const saved=await store.putValidatedMod(bytes,{jobId,checksumAlgorithm});
  const id=`mod-${jobId}`;
  const artifactUri=`r2://ecu-artifacts/${saved.key}`;
  const timestamp=now();
  await env.DB.prepare(`INSERT INTO ecu_mod_artifacts(
    id,job_id,sha256,artifact_uri,size_bytes,checksum_algorithm,validation_json,created_at
  ) VALUES(?,?,?,?,?,?,?,?)`)
    .bind(id,jobId,saved.sha256,artifactUri,saved.sizeBytes,checksumAlgorithm,JSON.stringify(validation),timestamp).run();
  return {
    id,
    jobId,
    sha256:saved.sha256,
    artifactUri,
    sizeBytes:saved.sizeBytes,
    checksumAlgorithm,
    validation,
    createdAt:timestamp,
    existed:false,
  };
}

async function defaultReadModel(env, version) {
  const row=await env.DB.prepare('SELECT artifact_uri FROM ecu_model_versions WHERE version=? LIMIT 1').bind(version).first();
  if(!row?.artifact_uri)return null;
  const match=String(row.artifact_uri).match(/models\/([a-f0-9]{64})\.json$/i);
  if(!match)return null;
  const store=createEcuArtifactStore(env.ECU_ARTIFACTS);
  return store.getModelArtifact(match[1].toLowerCase());
}

async function defaultReadDataset(env, digest) {
  const store = createEcuArtifactStore(env.ECU_ARTIFACTS);
  return store.getDatasetSnapshot(digest);
}

async function defaultReadOriginal(env, sha256) {
  const store = createEcuArtifactStore(env.ECU_ARTIFACTS);
  return store.getOriginal(sha256);
}

async function refreshChecksumProfiles(env,{minPairs=5}={}){
  const rows=(await env.DB.prepare(`SELECT
      ecu_family,hw,sw,algorithm,data_start,data_end,checksum_offset,checksum_size,endian,zero_field,
      COUNT(DISTINCT pair_id) AS pair_count
    FROM ecu_checksum_evidence
    WHERE human_verified=1 AND ecu_family<>'' AND hw<>'' AND sw<>''
    GROUP BY ecu_family,hw,sw,algorithm,data_start,data_end,checksum_offset,checksum_size,endian,zero_field
    HAVING COUNT(DISTINCT pair_id)>=?
    ORDER BY pair_count DESC`).bind(minPairs).all()).results||[];
  const promoted=[];
  for(const row of rows){
    const profile={
      ecuFamily:String(row.ecu_family||''),
      hw:String(row.hw||''),
      sw:String(row.sw||''),
      algorithm:String(row.algorithm||''),
      dataStart:Number(row.data_start||0),
      dataEnd:Number(row.data_end||0),
      checksumOffset:Number(row.checksum_offset||0),
      checksumSize:Number(row.checksum_size||0),
      endian:String(row.endian||'big'),
      zeroField:Boolean(row.zero_field),
      verifiedPairs:Number(row.pair_count||0),
    };
    const digest=await sha256Text(JSON.stringify(profile));
    const id=`checksum-${digest.slice(0,16)}`;
    const timestamp=now();
    await env.DB.prepare(`INSERT INTO ecu_checksum_profiles(
      id,ecu_family,hw,sw,algorithm,data_start,data_end,checksum_offset,checksum_size,endian,zero_field,
      state,verified,verified_pairs,digest,created_at,promoted_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(digest) DO UPDATE SET verified_pairs=excluded.verified_pairs,state='PRODUCTION',verified=1,promoted_at=excluded.promoted_at`)
      .bind(
        id,profile.ecuFamily,profile.hw,profile.sw,profile.algorithm,
        profile.dataStart,profile.dataEnd,profile.checksumOffset,profile.checksumSize,
        profile.endian,profile.zeroField?1:0,'PRODUCTION',1,profile.verifiedPairs,digest,timestamp,timestamp
      ).run();
    await env.DB.prepare(`UPDATE ecu_checksum_profiles SET state='SUPERSEDED'
      WHERE state='PRODUCTION' AND verified=1 AND ecu_family=? AND hw=? AND sw=? AND id<>?`)
      .bind(profile.ecuFamily,profile.hw,profile.sw,id).run();
    promoted.push({id,...profile});
  }
  return {promoted};
}

async function promoteMachineMapHypotheses(env,{operationLabel,ecuFamily,hw,sw,timestamp}){
  if(String(operationLabel||'')!=='stage1'||!ecuFamily||!hw||!sw)return {promotedGroups:0,promotedRows:0};

  const rows=(await env.DB.prepare(`SELECT id,pair_id,semantic_label,map_offset,confidence,delta_stats_json
    FROM ecu_change_hypotheses
    WHERE operation_label='stage1' AND ecu_family=? AND hw=? AND sw=? AND verification_state='UNVERIFIED'
      AND confidence>=0.94
    ORDER BY semantic_label,map_offset,pair_id,created_at ASC`)
    .bind(ecuFamily,hw,sw).all()).results||[];

  const groups=new Map();
  for(const row of rows){
    const label=String(row.semantic_label||'');
    let stats={};
    try{stats=JSON.parse(row.delta_stats_json||'{}')}catch{}
    const signed=Number(stats.medianSignedPercent??stats.median_signed_percent??0);
    const p95=Number(stats.p95AbsPercent??stats.p95_abs_percent??0);
    if(!Number.isFinite(signed)||signed===0||!Number.isFinite(p95)||p95<=0||p95>25)continue;
    const key=[label,Number(row.map_offset||0)].join(':');
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push({
      id:String(row.id),
      pairId:String(row.pair_id),
      label,
      mapOffset:Number(row.map_offset||0),
      confidence:Number(row.confidence||0),
      stats:{...stats,medianSignedPercent:signed,p95AbsPercent:p95},
      signed,
    });
  }

  let promotedGroups=0;
  let promotedRows=0;
  for(const entries of groups.values()){
    const uniquePairs=new Map();
    for(const entry of entries)if(entry.pairId&&!uniquePairs.has(entry.pairId))uniquePairs.set(entry.pairId,entry);
    const decision=evaluateMachineHypothesisGroup([...uniquePairs.values()]);
    if(!decision.promote)continue;

    for(const entry of decision.values){
      const evidenceId=`${entry.pairId}:machine:${entry.label}:${entry.mapOffset}`;
      await env.DB.prepare(`INSERT INTO ecu_change_evidence(
        id,pair_id,operation_label,ecu_family,hw,sw,semantic_label,range_start,range_end,map_offset,overlap_bytes,confidence,delta_stats_json,human_verified,verification_method,created_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        confidence=MAX(ecu_change_evidence.confidence,excluded.confidence),
        delta_stats_json=excluded.delta_stats_json,
        human_verified=1,
        verification_method='machine_consensus'`)
        .bind(
          evidenceId,
          entry.pairId,
          'stage1',
          ecuFamily,
          hw,
          sw,
          entry.label,
          entry.mapOffset,
          entry.mapOffset,
          entry.mapOffset,
          0,
          entry.confidence,
          JSON.stringify(entry.stats),
          1,
          'machine_consensus',
          timestamp,
        ).run();
      promotedRows+=1;
      await env.DB.prepare("UPDATE ecu_change_hypotheses SET verification_state='CONSENSUS_VERIFIED',updated_at=? WHERE id=?")
        .bind(timestamp,entry.id).run();
    }
    promotedGroups+=1;
  }
  return {promotedGroups,promotedRows};
}

async function defaultApplyPairResult(env,pairId,body={}){
  const status=String(body.status||'FAILED');
  if(!new Set(['COMPLETE','FAILED']).has(status))throw new Error('INVALID_PAIR_RESULT_STATUS');
  const pair=await env.DB.prepare('SELECT id,operation_label,ecu_family,hw,sw FROM ecu_training_pairs WHERE id=? LIMIT 1').bind(pairId).first();
  if(!pair)throw new Error('ECU_PAIR_NOT_FOUND');
  const diff=body.diff&&typeof body.diff==='object'?body.diff:null;
  if(status==='COMPLETE'&&!diff?.digest)throw new Error('ECU_PAIR_DIFF_REQUIRED');
  const timestamp=now();
  const scopedFamily=String(pair.ecu_family||body.ecu_family||'');
  const scopedHw=String(pair.hw||firstBodyCandidate(body.hw_candidates)||'');
  const scopedSw=String(pair.sw||firstBodyCandidate(body.sw_candidates)||'');
  await env.DB.prepare(`UPDATE ecu_training_pairs
    SET state=?,diff_digest=?,diff_json=?,error=?,ecu_family=?,hw=?,sw=?,updated_at=? WHERE id=?`)
    .bind(
      status,
      diff?.digest||null,
      diff?JSON.stringify(diff):null,
      body.error||null,
      scopedFamily,
      scopedHw,
      scopedSw,
      timestamp,
      pairId,
    ).run();

  let verifiedEvidenceCount=0;
  if(status==='COMPLETE'&&diff){
    const evidenceRows=extractVerifiedChangeEvidence(diff);
    for(const [index,row] of evidenceRows.entries()){
      const id=`${pairId}:change:${index}:${row.semanticLabel}`;
      await env.DB.prepare(`INSERT INTO ecu_change_evidence(
        id,pair_id,operation_label,ecu_family,hw,sw,semantic_label,range_start,range_end,map_offset,overlap_bytes,confidence,delta_stats_json,human_verified,created_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        overlap_bytes=excluded.overlap_bytes,
        confidence=excluded.confidence,
        delta_stats_json=excluded.delta_stats_json,
        human_verified=1`)
        .bind(
          id,
          pairId,
          pair.operation_label||body.operation_label||'',
          scopedFamily,
          scopedHw,
          scopedSw,
          row.semanticLabel,
          row.rangeStart,
          row.rangeEnd,
          row.mapOffset,
          row.overlapBytes,
          row.confidence,
          JSON.stringify(row.deltaStats||{}),
          1,
          timestamp,
        ).run();
      verifiedEvidenceCount+=1;
    }

    const autoHypotheses=Array.isArray(diff.auto_map_delta_evidence)?diff.auto_map_delta_evidence:[];
    for(const [index,row] of autoHypotheses.entries()){
      const semanticLabel=String(row.semantic_label||row.semanticLabel||'UNKNOWN');
      const mapOffset=Math.max(0,Number(row.map_offset??row.mapOffset??0));
      const confidence=Math.max(0,Math.min(1,Number(row.semantic_confidence??row.confidence??0)));
      if(semanticLabel==='UNKNOWN'||confidence<0.92)continue;
      const id=`${pairId}:hypothesis:${index}:${semanticLabel}:${mapOffset}`;
      await env.DB.prepare(`INSERT INTO ecu_change_hypotheses(
        id,pair_id,operation_label,ecu_family,hw,sw,semantic_label,map_offset,confidence,delta_stats_json,verification_state,created_at,updated_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        confidence=MAX(ecu_change_hypotheses.confidence,excluded.confidence),
        delta_stats_json=excluded.delta_stats_json,
        updated_at=excluded.updated_at`)
        .bind(
          id,
          pairId,
          pair.operation_label||body.operation_label||'',
          scopedFamily,
          scopedHw,
          scopedSw,
          semanticLabel,
          mapOffset,
          confidence,
          JSON.stringify({
            changedCells:Number(row.changed_cells??row.changedCells??0),
            measuredCells:Number(row.measured_cells??row.measuredCells??0),
            meanAbsPercent:Number(row.mean_abs_percent??row.meanAbsPercent??0),
            maxAbsPercent:Number(row.max_abs_percent??row.maxAbsPercent??0),
            p95AbsPercent:Number(row.p95_abs_percent??row.p95AbsPercent??0),
            medianSignedPercent:Number(row.median_signed_percent??row.medianSignedPercent??0),
          }),
          'UNVERIFIED',
          timestamp,
          timestamp,
        ).run();
    }

    const checksumCandidates=Array.isArray(diff.checksum_candidates)?diff.checksum_candidates:[];
    for(const [index,candidate] of checksumCandidates.entries()){
      const algorithm=String(candidate.algorithm||'').toLowerCase();
      const dataStart=Math.max(0,Number(candidate.data_start||0));
      const dataEnd=Math.max(0,Number(candidate.data_end||0));
      const checksumOffset=Math.max(0,Number(candidate.checksum_offset||0));
      const checksumSize=Math.max(0,Number(candidate.checksum_size||0));
      const endian=String(candidate.endian||'big').toLowerCase();
      if(!['sum16','sum32','crc32'].includes(algorithm))continue;
      if(!['big','little'].includes(endian)||!dataEnd||!checksumSize)continue;
      const id=`${pairId}:checksum:${index}:${checksumOffset}`;
      await env.DB.prepare(`INSERT INTO ecu_checksum_evidence(
        id,pair_id,ecu_family,hw,sw,algorithm,data_start,data_end,checksum_offset,checksum_size,endian,zero_field,human_verified,created_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET human_verified=1`)
        .bind(
          id,pairId,scopedFamily,scopedHw,scopedSw,algorithm,dataStart,dataEnd,
          checksumOffset,checksumSize,endian,candidate.zero_field===false?0:1,1,timestamp
        ).run();
    }

    if(String(pair.operation_label||body.operation_label||'')!=='stage1'){
      const patches=Array.isArray(diff.patch_chunks)?diff.patch_chunks:[];
      for(const [index,patch] of patches.entries()){
        const offset=Math.max(0,Number(patch.offset||0));
        const length=Math.max(0,Number(patch.length||0));
        const beforeHex=String(patch.before_hex||patch.beforeHex||'').toLowerCase();
        const afterHex=String(patch.after_hex||patch.afterHex||'').toLowerCase();
        const contextBeforeHex=String(patch.context_before_hex||patch.contextBeforeHex||'').toLowerCase();
        const contextAfterHex=String(patch.context_after_hex||patch.contextAfterHex||'').toLowerCase();
        if(!length||beforeHex.length!==length*2||afterHex.length!==length*2||beforeHex===afterHex)continue;
        if(!/^[a-f0-9]+$/.test(beforeHex)||!/^[a-f0-9]+$/.test(afterHex))continue;
        const id=`${pairId}:patch:${index}:${offset}`;
        await env.DB.prepare(`INSERT INTO ecu_change_evidence(
          id,pair_id,operation_label,ecu_family,hw,sw,semantic_label,range_start,range_end,map_offset,overlap_bytes,confidence,delta_stats_json,human_verified,created_at
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET
          overlap_bytes=excluded.overlap_bytes,
          confidence=excluded.confidence,
          delta_stats_json=excluded.delta_stats_json,
          human_verified=1`)
          .bind(
            id,
            pairId,
            pair.operation_label||body.operation_label||'',
            scopedFamily,
            scopedHw,
            scopedSw,
            '__PATCH__',
            offset,
            offset+length,
            offset,
            length,
            1,
            JSON.stringify({patchBeforeHex:beforeHex,patchAfterHex:afterHex,contextBeforeHex,contextAfterHex,length}),
            1,
            timestamp,
          ).run();
        verifiedEvidenceCount+=1;
      }
    }
  }
  let machineConsensus={promotedGroups:0,promotedRows:0};
  if(status==='COMPLETE'){
    machineConsensus=await promoteMachineMapHypotheses(env,{
      operationLabel:pair.operation_label||body.operation_label||'',
      ecuFamily:scopedFamily,
      hw:scopedHw,
      sw:scopedSw,
      timestamp,
    });
  }
  return {id:pairId,state:status,diffDigest:diff?.digest||null,verifiedEvidenceCount,machineConsensus};
}

async function defaultApplyTrainingResult(env, trainingId, body = {}) {
  const status=String(body.status||'FAILED');
  const allowed=new Set(['CANDIDATE','NEEDS_MORE_DATA','FAILED']);
  if(!allowed.has(status))throw new Error('INVALID_TRAINING_RESULT_STATUS');
  const run=await env.DB.prepare('SELECT id FROM ecu_training_runs WHERE id=? LIMIT 1').bind(trainingId).first();
  if(!run)throw new Error('ECU_TRAINING_RUN_NOT_FOUND');

  const timestamp=now();
  if(status==='FAILED'){
    await env.DB.prepare('UPDATE ecu_training_runs SET status=?,reason=?,updated_at=? WHERE id=?')
      .bind('FAILED',String(body.error||'TRAINING_FAILED'),timestamp,trainingId).run();
    return {id:trainingId,status:'FAILED',modelVersion:null};
  }

  const modelJson=String(body.model_json||'');
  if(!modelJson)throw new Error('ECU_MODEL_ARTIFACT_REQUIRED');
  const store=createEcuArtifactStore(env.ECU_ARTIFACTS);
  const provisionalVersion='candidate-'+String(body.dataset_version||'dataset');
  const artifact=await store.putModelArtifact(modelJson,{modelVersion:provisionalVersion});
  const modelVersion=`model-${artifact.sha256.slice(0,16)}`;
  const artifactUri=`r2://ecu-artifacts/${artifact.key}`;
  const metrics=body.metrics&&typeof body.metrics==='object'?body.metrics:{};
  const score=ecuBenchmarkScore(metrics);
  const benchmarkId=`benchmark-${modelVersion}-${String(body.dataset_version||'unknown')}`;

  let finalStatus=status;
  let promotionReason=status==='NEEDS_MORE_DATA'?'NEEDS_HELDOUT_DATA':null;
  if(status==='CANDIDATE'){
    const production=await env.DB.prepare("SELECT version FROM ecu_model_versions WHERE state='PRODUCTION' ORDER BY promoted_at DESC,created_at DESC LIMIT 1").first();
    let productionMetrics=null;
    if(production?.version){
      const prior=await env.DB.prepare('SELECT metrics_json FROM ecu_benchmarks WHERE model_version=? AND passed=1 ORDER BY created_at DESC LIMIT 1').bind(production.version).first();
      try{productionMetrics=prior?.metrics_json?JSON.parse(prior.metrics_json):null}catch{productionMetrics=null}
    }
    const decision=decideEcuModelPromotion(productionMetrics,metrics);
    const passed=decision.promote?1:0;

    await env.DB.prepare(`INSERT INTO ecu_model_versions(
      version,dataset_version,benchmark_score,artifact_uri,state,rollback_target,created_at,promoted_at
    ) VALUES(?,?,?,?,?,?,?,?)
    ON CONFLICT(version) DO UPDATE SET benchmark_score=excluded.benchmark_score,artifact_uri=excluded.artifact_uri`)
      .bind(modelVersion,String(body.dataset_version||''),score,artifactUri,'CANDIDATE',production?.version||null,timestamp,null).run();
    await env.DB.prepare(`INSERT INTO ecu_benchmarks(id,model_version,dataset_version,metrics_json,score,passed,created_at)
      VALUES(?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET metrics_json=excluded.metrics_json,score=excluded.score,passed=excluded.passed`)
      .bind(benchmarkId,modelVersion,String(body.dataset_version||''),JSON.stringify(metrics),score,passed,timestamp).run();

    if(decision.promote){
      if(production?.version){
        await env.DB.prepare("UPDATE ecu_model_versions SET state='ROLLBACK' WHERE version=?").bind(production.version).run();
      }
      await env.DB.prepare("UPDATE ecu_model_versions SET state='PRODUCTION',rollback_target=?,promoted_at=? WHERE version=?")
        .bind(production?.version||null,timestamp,modelVersion).run();
      finalStatus='PROMOTED';
    }else{
      finalStatus='REJECTED';
    }
    promotionReason=decision.reason;
  }
  await env.DB.prepare('UPDATE ecu_training_runs SET status=?,reason=?,updated_at=? WHERE id=?')
    .bind(finalStatus,promotionReason,timestamp,trainingId).run();
  return {
    id:trainingId,
    status:finalStatus,
    modelVersion:status==='CANDIDATE'?modelVersion:null,
    benchmarkScore:score,
    promotionReason,
  };
}

async function defaultApplyWorkerState(env, jobId, body = {}) {
  const state = String(body.state || '');
  if (state !== 'RUNNING') throw new Error('INVALID_ECU_WORKER_STATE');
  const row = await env.DB.prepare('SELECT id,state FROM ecu_jobs WHERE id=? LIMIT 1').bind(jobId).first();
  if (!row) throw new Error('ECU_JOB_NOT_FOUND');
  if (row.state !== 'DISPATCHED' && row.state !== 'RUNNING') {
    throw new Error(`ILLEGAL_ECU_WORKER_STATE:${row.state}->${state}`);
  }
  await env.DB.prepare('UPDATE ecu_jobs SET state=?,worker_kind=COALESCE(?,worker_kind),updated_at=? WHERE id=?')
    .bind(state, body.workerKind || null, now(), jobId).run();
  return mapJob(await env.DB.prepare('SELECT * FROM ecu_jobs WHERE id=? LIMIT 1').bind(jobId).first());
}

async function defaultApplyWorkerResult(env, jobId, body = {}) {
  const allowed = new Set(['NEEDS_REVIEW', 'READY', 'FAILED']);
  const status = allowed.has(String(body.status || '')) ? String(body.status) : 'NEEDS_REVIEW';
  const timestamp = now();
  const job = await env.DB.prepare('SELECT id,state FROM ecu_jobs WHERE id=? LIMIT 1').bind(jobId).first();
  if (!job) throw new Error('ECU_JOB_NOT_FOUND');
  assertEcuJobTransition(job.state, status);

  const resultJson = JSON.stringify(body);
  await env.DB.prepare(`UPDATE ecu_jobs
    SET state=?,run_fingerprint=?,result_json=?,error=?,updated_at=?
    WHERE id=?`)
    .bind(
      status,
      body.run_fingerprint || null,
      resultJson,
      body.error || null,
      timestamp,
      jobId,
    ).run();

  if (status !== 'FAILED') {
    const resultId = `analysis-${jobId}`;
    await env.DB.prepare(`INSERT INTO ecu_analysis_results(
      id,job_id,ecu_family,hw_candidates,sw_candidates,confidence,evidence,feature_schema_version,created_at
    ) VALUES(?,?,?,?,?,?,?,?,?)
    ON CONFLICT(job_id) DO UPDATE SET
      ecu_family=excluded.ecu_family,
      hw_candidates=excluded.hw_candidates,
      sw_candidates=excluded.sw_candidates,
      confidence=excluded.confidence,
      evidence=excluded.evidence,
      feature_schema_version=excluded.feature_schema_version`)
      .bind(
        resultId,
        jobId,
        body.ecu_family || 'UNKNOWN',
        JSON.stringify(body.hw_candidates || []),
        JSON.stringify(body.sw_candidates || []),
        Number(body.confidence || 0),
        JSON.stringify(body.evidence || []),
        String(body.feature_schema_version || 'v1'),
        timestamp,
      ).run();

    await env.DB.prepare('DELETE FROM ecu_map_candidates WHERE job_id=?').bind(jobId).run();
    for (const [index, candidate] of (body.map_candidates || []).entries()) {
      await env.DB.prepare(`INSERT INTO ecu_map_candidates(
        id,job_id,map_offset,rows,cols,data_type,endian,semantic_label,confidence,features_json,created_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(
          `${jobId}-map-${index}`,
          jobId,
          Number(candidate.offset || 0),
          candidate.rows == null ? null : Number(candidate.rows),
          candidate.cols == null ? null : Number(candidate.cols),
          candidate.data_type || null,
          candidate.endian || null,
          candidate.semantic_label || null,
          Number(candidate.semantic_confidence ?? candidate.confidence ?? candidate.score ?? 0),
          JSON.stringify(candidate),
          timestamp,
        ).run();
    }
  }
  return mapJob(await env.DB.prepare('SELECT * FROM ecu_jobs WHERE id=? LIMIT 1').bind(jobId).first());
}

async function refreshDatasetSnapshot(env) {
  const rows=(await env.DB.prepare(`SELECT
      e.ecu_family,e.hw,e.sw,e.artifact_sha256,e.map_offset,e.semantic_label,
      e.source_type,e.source_confidence,e.human_verified,e.updated_at,
      f.features_json
    FROM ecu_training_examples e
    LEFT JOIN ecu_training_features f ON f.example_id=e.id
    WHERE e.human_verified=1
    ORDER BY e.ecu_family,e.hw,e.sw,e.artifact_sha256,e.map_offset,e.semantic_label`).all()).results||[];
  if(!rows.length)return null;
  const maxUpdated=rows.reduce((m,row)=>Math.max(m,Number(row.updated_at||0)),0);
  const version=`dataset-${rows.length}-${maxUpdated}`;
  const snapshot=await buildEcuDatasetSnapshot(rows,version);
  const store=createEcuArtifactStore(env.ECU_ARTIFACTS);
  const artifact=await store.putDatasetSnapshot(snapshot);
  const artifactUri=`r2://ecu-artifacts/${artifact.key}`;
  await env.DB.prepare(`INSERT INTO ecu_dataset_versions(version,digest,example_count,artifact_uri,created_at)
    VALUES(?,?,?,?,?)
    ON CONFLICT(version) DO UPDATE SET digest=excluded.digest,example_count=excluded.example_count,artifact_uri=excluded.artifact_uri`)
    .bind(snapshot.version,snapshot.digest,snapshot.exampleCount,artifactUri,now()).run();
  return snapshot;
}

async function defaultVerifyMap(env, mapId, { semanticLabel }) {
  const row = await env.DB.prepare(`SELECT
      m.id AS map_id,m.job_id,m.map_offset,m.confidence AS map_confidence,m.features_json,
      j.file_id,f.sha256,
      a.ecu_family,a.hw_candidates,a.sw_candidates
    FROM ecu_map_candidates m
    JOIN ecu_jobs j ON j.id=m.job_id
    JOIN ecu_files f ON f.id=j.file_id
    LEFT JOIN ecu_analysis_results a ON a.job_id=j.id
    WHERE m.id=? LIMIT 1`).bind(mapId).first();
  if (!row) throw new Error('ECU_MAP_NOT_FOUND');

  const parseFirstValue = raw => {
    try {
      const values = JSON.parse(raw || '[]');
      const first = values?.[0];
      return typeof first === 'string' ? first : String(first?.value || '');
    } catch { return ''; }
  };
  const timestamp = now();
  const exampleId = `verified-${mapId}`;
  const label = String(semanticLabel || '').trim();
  await env.DB.prepare(`INSERT INTO ecu_training_examples(
      id,ecu_family,hw,sw,artifact_sha256,map_offset,semantic_label,source_type,source_ref,source_confidence,human_verified,created_at,updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      semantic_label=excluded.semantic_label,
      source_confidence=excluded.source_confidence,
      human_verified=1,
      updated_at=excluded.updated_at`)
    .bind(
      exampleId,
      row.ecu_family || 'UNKNOWN',
      parseFirstValue(row.hw_candidates),
      parseFirstValue(row.sw_candidates),
      row.sha256,
      Number(row.map_offset || 0),
      label,
      'human_map_review',
      mapId,
      Math.max(0, Math.min(1, Number(row.map_confidence || 0))),
      1,
      timestamp,
      timestamp,
    ).run();
  await env.DB.prepare(`INSERT INTO ecu_training_features(example_id,features_json,created_at,updated_at)
      VALUES(?,?,?,?)
      ON CONFLICT(example_id) DO UPDATE SET features_json=excluded.features_json,updated_at=excluded.updated_at`)
    .bind(exampleId, row.features_json || '{}', timestamp, timestamp).run();
  await env.DB.prepare('UPDATE ecu_map_candidates SET semantic_label=?,confidence=? WHERE id=?')
    .bind(label, 1, mapId).run();
  const dataset=await refreshDatasetSnapshot(env);

  return {
    exampleId,
    mapId,
    semanticLabel: label,
    humanVerified: true,
    datasetVersion: dataset?.version || null,
    datasetDigest: dataset?.digest || null,
  };
}

async function defaultDispatchQueuedJobs(env, _timestamp, dispatch) {
  const callbackBaseUrl=String(env.JARVIS_PUBLIC_URL||'').trim();
  if(!callbackBaseUrl)return {attempted:0,dispatched:0,reason:'NO_CALLBACK_URL'};
  const rows=(await env.DB.prepare(`SELECT
      j.id,j.operation,j.run_fingerprint,j.model_version,j.rulepack_version,j.file_id,
      f.sha256,f.artifact_uri
    FROM ecu_jobs j
    JOIN ecu_files f ON f.id=j.file_id
    WHERE j.state='QUEUED'
    ORDER BY j.created_at ASC
    LIMIT 10`).all()).results||[];
  let dispatched=0;
  for(const row of rows){
    const result=await dispatch({
      id:row.id,
      runFingerprint:row.run_fingerprint,
      artifactUri:row.artifact_uri,
      artifactSha256:row.sha256,
      operation:row.operation||'analyze',
      modelVersion:row.model_version||'baseline',
      rulepackVersion:row.rulepack_version||'baseline',
      config:{callback_base_url:callbackBaseUrl},
    },env);
    if(result?.accepted){
      dispatched+=1;
      await env.DB.prepare('UPDATE ecu_jobs SET state=?,worker_kind=?,updated_at=? WHERE id=?')
        .bind('DISPATCHED',result.workerKind||null,now(),row.id).run();
    }
  }
  const pairRows=(await env.DB.prepare(`SELECT
      p.id,p.operation_label,p.run_fingerprint,
      of.sha256 AS ori_sha256,of.artifact_uri AS ori_artifact_uri,
      mf.sha256 AS mod_sha256,mf.artifact_uri AS mod_artifact_uri
    FROM ecu_training_pairs p
    JOIN ecu_files of ON of.id=p.ori_file_id
    JOIN ecu_files mf ON mf.id=p.mod_file_id
    WHERE p.state='QUEUED'
    ORDER BY p.created_at ASC
    LIMIT 10`).all()).results||[];
  let pairDispatched=0;
  for(const row of pairRows){
    const result=await dispatch({
      id:row.id,
      operation:'diff_pair',
      runFingerprint:row.run_fingerprint,
      oriArtifactSha256:row.ori_sha256,
      modArtifactSha256:row.mod_sha256,
      oriArtifactUri:row.ori_artifact_uri,
      modArtifactUri:row.mod_artifact_uri,
      operationLabel:row.operation_label,
      config:{callback_base_url:callbackBaseUrl},
    },env);
    if(result?.accepted){
      pairDispatched+=1;
      await env.DB.prepare('UPDATE ecu_training_pairs SET state=?,worker_kind=?,updated_at=? WHERE id=?')
        .bind('DISPATCHED',result.workerKind||null,now(),row.id).run();
    }
  }
  return {
    attempted:rows.length+pairRows.length,
    dispatched:dispatched+pairDispatched,
    analysis:{attempted:rows.length,dispatched},
    pairs:{attempted:pairRows.length,dispatched:pairDispatched},
  };
}

async function defaultListModels(env, limit = 20) {
  const safeLimit=Math.max(1,Math.min(100,Number(limit)||20));
  const rows=(await env.DB.prepare(`SELECT version,dataset_version,benchmark_score,artifact_uri,state,rollback_target,created_at,promoted_at
    FROM ecu_model_versions ORDER BY COALESCE(promoted_at,created_at) DESC LIMIT ?`).bind(safeLimit).all()).results||[];
  return rows.map(row=>({
    version:row.version,
    datasetVersion:row.dataset_version,
    benchmarkScore:Number(row.benchmark_score||0),
    artifactUri:row.artifact_uri,
    state:row.state,
    rollbackTarget:row.rollback_target||null,
    createdAt:row.created_at,
    promotedAt:row.promoted_at||null,
  }));
}

async function defaultRollbackModel(env, targetVersion) {
  const target = await env.DB.prepare('SELECT version,state FROM ecu_model_versions WHERE version=? LIMIT 1').bind(targetVersion).first();
  if (!target) throw new Error('ECU_MODEL_NOT_FOUND');
  const production = await env.DB.prepare("SELECT version FROM ecu_model_versions WHERE state='PRODUCTION' ORDER BY promoted_at DESC,created_at DESC LIMIT 1").first();
  if (!production?.version) throw new Error('ECU_PRODUCTION_MODEL_NOT_FOUND');
  if (production.version === targetVersion) return { from: production.version, to: targetVersion, state: 'PRODUCTION', noop: true };
  const timestamp = now();
  await env.DB.prepare("UPDATE ecu_model_versions SET state='ROLLBACK' WHERE version=?").bind(production.version).run();
  await env.DB.prepare("UPDATE ecu_model_versions SET state='PRODUCTION',promoted_at=? WHERE version=?")
    .bind(timestamp, targetVersion).run();
  return { from: production.version, to: targetVersion, state: 'PRODUCTION' };
}

async function defaultMetricsStatus(env) {
  const states=['QUEUED','DISPATCHED','RUNNING','NEEDS_REVIEW','READY','FAILED'];
  const rows=(await env.DB.prepare('SELECT state,COUNT(*) AS count FROM ecu_jobs GROUP BY state').all()).results||[];
  const counts=Object.fromEntries(states.map(state=>[state,0]));
  for(const row of rows){ if(Object.hasOwn(counts,row.state)) counts[row.state]=Number(row.count||0); }
  const timing=await env.DB.prepare(`SELECT AVG(updated_at-created_at) AS avg_ms
    FROM ecu_jobs WHERE state IN ('NEEDS_REVIEW','READY','FAILED')`).first();
  const production=await env.DB.prepare("SELECT version FROM ecu_model_versions WHERE state='PRODUCTION' ORDER BY promoted_at DESC,created_at DESC LIMIT 1").first();
  return {
    counts,
    averageTurnaroundMs:Math.round(Number(timing?.avg_ms||0)),
    productionModel:production?.version||'baseline',
    binaryPayloadLogged:false,
  };
}

async function defaultHeartbeatWorker(env, body = {}) {
  const workerId=String(body.workerId||'').trim().slice(0,120);
  const kind=String(body.kind||'local').trim();
  const endpoint=String(body.endpoint||'').trim();
  const ttlSeconds=Math.max(30,Math.min(300,Number(body.ttlSeconds)||90));
  const capabilities=Array.isArray(body.capabilities)?body.capabilities.map(x=>String(x).slice(0,64)).slice(0,20):[];
  if(!workerId)throw new Error('ECU_WORKER_ID_REQUIRED');
  if(kind!=='local')throw new Error('ECU_WORKER_KIND_INVALID');
  if(!validWorkerEndpoint(endpoint))throw new Error('ECU_WORKER_ENDPOINT_INVALID');
  const timestamp=now();
  const expiresAt=timestamp+ttlSeconds*1000;
  await env.DB.prepare(`INSERT INTO ecu_workers(
    id,kind,endpoint,capabilities_json,enabled,last_seen_at,expires_at,created_at,updated_at
  ) VALUES(?,?,?,?,?,?,?,?,?)
  ON CONFLICT(id) DO UPDATE SET
    kind=excluded.kind,
    endpoint=excluded.endpoint,
    capabilities_json=excluded.capabilities_json,
    enabled=1,
    last_seen_at=excluded.last_seen_at,
    expires_at=excluded.expires_at,
    updated_at=excluded.updated_at`)
    .bind(workerId,kind,endpoint,JSON.stringify(capabilities),1,timestamp,expiresAt,timestamp,timestamp).run();
  return {id:workerId,kind,endpoint,capabilities,lastSeenAt:timestamp,expiresAt};
}

async function defaultComputeStatus(env = {}) {
  const tokenConfigured = Boolean(String(env.ECU_COMPUTE_TOKEN || '').trim());
  let localEndpoint = null;
  if (tokenConfigured && env.DB?.prepare) {
    try {
      const row=await env.DB.prepare(`SELECT endpoint,last_seen_at,expires_at
        FROM ecu_workers
        WHERE kind='local' AND enabled=1
        ORDER BY last_seen_at DESC LIMIT 1`).first();
      if(row?.endpoint && Number(row.expires_at||0)>now())localEndpoint=String(row.endpoint);
    } catch {}
  }
  if(!localEndpoint && tokenConfigured && String(env.ECU_LOCAL_WORKER_ONLINE || '').trim()==='1'){
    const configured=String(env.ECU_LOCAL_WORKER_URL||'').trim();
    if(configured)localEndpoint=configured;
  }
  const localOnline = Boolean(localEndpoint);
  const cloudContainerReady = tokenConfigured && Boolean(env.ECU_COMPUTE_CONTAINER && typeof env.ECU_COMPUTE_CONTAINER.getByName === 'function');
  const cloudUrlReady = tokenConfigured && Boolean(String(env.ECU_CLOUD_WORKER_URL || '').trim());
  const preferred = localOnline ? 'local' : cloudContainerReady ? 'cloud-container' : cloudUrlReady ? 'cloud' : 'none';
  return { tokenConfigured, localOnline, localEndpoint, cloudContainerReady, cloudUrlReady, preferred };
}

async function defaultUploadStatus(env) {
  return {
    ready: Boolean(env.ECU_ARTIFACTS),
    storage: env.ECU_ARTIFACTS ? 'r2' : 'unconfigured',
  };
}

export function createEcuRuntime(core, overrides = {}) {
  const research = overrides.research || createEcuResearch({githubDiscover:discoverGitHubEcuSources});
  const rulepacks = overrides.rulepacks || createEcuRulepackLearning({operationLabel:'*'});
  const computeDispatch = overrides.computeDispatch || createComputeDispatch();
  const training = overrides.training || createEcuTraining({
    dispatch: (job, env) => computeDispatch({
      id: job.id,
      operation: 'train',
      runFingerprint: job.runFingerprint,
      datasetVersion: job.datasetVersion,
      datasetDigest: job.datasetDigest,
      productionModelVersion: job.productionModelVersion,
      config: job.callbackBaseUrl ? { callback_base_url: job.callbackBaseUrl } : {},
    }, env),
  });
  const deps = {
    createJob: (env, input) => defaultCreateJob(env, input, computeDispatch),
    createPair: (env, input) => defaultCreatePair(env, input, computeDispatch),
    getJob: defaultGetJob,
    listJobs: defaultListJobs,
    listMaps: defaultListMaps,
    mapContextForArtifact: defaultMapContextForArtifact,
    listPairs: defaultListPairs,
    researchStatus: env => research.status(env),
    listGitHubRepositories: defaultListGitHubRepositories,
    rulepackStatus: env => rulepacks.status(env),
    trainingStatus: env => training.status(env),
    uploadStatus: defaultUploadStatus,
    computeStatus: defaultComputeStatus,
    heartbeatWorker: defaultHeartbeatWorker,
    metricsStatus: defaultMetricsStatus,
    rollbackModel: defaultRollbackModel,
    listModels: defaultListModels,
    uploadOriginal: defaultUploadOriginal,
    storeValidatedMod: defaultStoreValidatedMod,
    getValidatedMod: defaultGetValidatedMod,
    readOriginal: defaultReadOriginal,
    rulepackForIdentity: defaultRulepackForIdentity,
    checksumProfileForIdentity: defaultChecksumProfileForIdentity,
    refreshChecksumProfiles: env => refreshChecksumProfiles(env),
    readDataset: defaultReadDataset,
    readModel: defaultReadModel,
    applyWorkerResult: defaultApplyWorkerResult,
    applyWorkerState: defaultApplyWorkerState,
    verifyMap: defaultVerifyMap,
    applyTrainingResult: defaultApplyTrainingResult,
    applyPairResult: defaultApplyPairResult,
    dispatchQueuedJobs: (env, timestamp) => defaultDispatchQueuedJobs(env, timestamp, computeDispatch),
    ...overrides,
  };

  const maxUploadBytes = Math.max(1, Number(overrides.maxUploadBytes || 16 * 1024 * 1024));

  return {
    async fetch(req, env, ctx) {
      const url = new URL(req.url);
      if (url.pathname === '/api/ecu/internal/workers/heartbeat' && req.method === 'POST') {
        if(!isComputeAuthorized(req,env))return json({error:'UNAUTHORIZED'},401);
        const body=await readJson(req);
        if(!validWorkerEndpoint(body.endpoint))return json({error:'ECU_WORKER_ENDPOINT_INVALID'},400);
        try{
          return json({worker:await deps.heartbeatWorker(env,body)});
        }catch(error){
          if(['ECU_WORKER_ID_REQUIRED','ECU_WORKER_KIND_INVALID','ECU_WORKER_ENDPOINT_INVALID'].includes(error?.message))return json({error:error.message},400);
          throw error;
        }
      }

      if (url.pathname === '/api/ecu/internal/rulepack' && req.method === 'GET') {
        if (!isComputeAuthorized(req, env)) return json({ error: 'UNAUTHORIZED' }, 401);
        const operationLabel=String(url.searchParams.get('operationLabel')||'').trim();
        const ecuFamily=String(url.searchParams.get('ecuFamily')||'').trim();
        const hw=String(url.searchParams.get('hw')||'').trim();
        const sw=String(url.searchParams.get('sw')||'').trim();
        if(!operationLabel)return json({error:'ECU_OPERATION_LABEL_REQUIRED'},400);
        const rulepack=await deps.rulepackForIdentity(env,{operationLabel,ecuFamily,hw,sw});
        return rulepack?json({rulepack}):json({error:'ECU_RULEPACK_NOT_FOUND'},404);
      }

      if (url.pathname === '/api/ecu/internal/checksum-profile' && req.method === 'GET') {
        if (!isComputeAuthorized(req, env)) return json({ error: 'UNAUTHORIZED' }, 401);
        const ecuFamily=String(url.searchParams.get('ecuFamily')||'').trim();
        const hw=String(url.searchParams.get('hw')||'').trim();
        const sw=String(url.searchParams.get('sw')||'').trim();
        const profile=await deps.checksumProfileForIdentity(env,{ecuFamily,hw,sw});
        return profile?json({profile}):json({error:'ECU_CHECKSUM_PROFILE_NOT_FOUND'},404);
      }

      if (url.pathname.startsWith('/api/ecu/internal/models/') && req.method === 'GET') {
        if (!isComputeAuthorized(req, env)) return json({ error: 'UNAUTHORIZED' }, 401);
        const version=decodeURIComponent(url.pathname.slice('/api/ecu/internal/models/'.length));
        if(!version)return json({error:'ECU_MODEL_VERSION_REQUIRED'},400);
        try{
          const modelJson=await deps.readModel(env,version);
          if(!modelJson)return json({error:'ECU_MODEL_NOT_FOUND'},404);
          return new Response(modelJson,{
            status:200,
            headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
          });
        }catch(error){
          if(String(error?.message||'').includes('ECU_ARTIFACTS binding'))return json({error:'ECU_STORAGE_UNAVAILABLE'},503);
          throw error;
        }
      }

      if (url.pathname.startsWith('/api/ecu/internal/datasets/') && req.method === 'GET') {
        if (!isComputeAuthorized(req, env)) return json({ error: 'UNAUTHORIZED' }, 401);
        const digest = decodeURIComponent(url.pathname.slice('/api/ecu/internal/datasets/'.length)).toLowerCase();
        if (!/^[a-f0-9]{64}$/.test(digest)) return json({ error: 'INVALID_DATASET_DIGEST' }, 400);
        try {
          const snapshot = await deps.readDataset(env, digest);
          return snapshot ? json(snapshot) : json({ error: 'ECU_DATASET_NOT_FOUND' }, 404);
        } catch (error) {
          if (String(error?.message || '').includes('ECU_ARTIFACTS binding')) return json({ error: 'ECU_STORAGE_UNAVAILABLE' }, 503);
          throw error;
        }
      }

      if (url.pathname.startsWith('/api/ecu/internal/map-context/') && req.method === 'GET') {
        if (!isComputeAuthorized(req, env)) return json({ error: 'UNAUTHORIZED' }, 401);
        const sha256=decodeURIComponent(url.pathname.slice('/api/ecu/internal/map-context/'.length)).toLowerCase();
        if(!/^[a-f0-9]{64}$/.test(sha256))return json({error:'INVALID_ARTIFACT_SHA256'},400);
        return json({maps:await deps.mapContextForArtifact(env,sha256)});
      }

      if (url.pathname.startsWith('/api/ecu/internal/artifacts/') && req.method === 'GET') {
        if (!isComputeAuthorized(req, env)) return json({ error: 'UNAUTHORIZED' }, 401);
        const sha256 = decodeURIComponent(url.pathname.slice('/api/ecu/internal/artifacts/'.length));
        if (!/^[a-f0-9]{64}$/i.test(sha256)) return json({ error: 'INVALID_ARTIFACT_SHA256' }, 400);
        try {
          const bytes = await deps.readOriginal(env, sha256.toLowerCase());
          if (!bytes) return json({ error: 'ECU_FILE_NOT_FOUND' }, 404);
          return new Response(bytes, {
            status: 200,
            headers: {
              'content-type': 'application/octet-stream',
              'cache-control': 'no-store',
              'x-content-type-options': 'nosniff',
            },
          });
        } catch (error) {
          if (String(error?.message || '').includes('ECU_ARTIFACTS binding')) return json({ error: 'ECU_STORAGE_UNAVAILABLE' }, 503);
          throw error;
        }
      }

      if (url.pathname.startsWith('/api/ecu/internal/pairs/') && url.pathname.endsWith('/result') && req.method === 'POST') {
        if(!isComputeAuthorized(req,env))return json({error:'UNAUTHORIZED'},401);
        const pairId=decodeURIComponent(url.pathname.slice('/api/ecu/internal/pairs/'.length,-'/result'.length));
        if(!pairId)return json({error:'ECU_PAIR_ID_REQUIRED'},400);
        const body=await readJson(req);
        try{
          const pair=await deps.applyPairResult(env,pairId,body);
          try{ await rulepacks.refresh(env); }catch{}
          return json({pair});
        }catch(error){
          if(error?.message==='ECU_PAIR_NOT_FOUND')return json({error:'ECU_PAIR_NOT_FOUND'},404);
          if(error?.message==='INVALID_PAIR_RESULT_STATUS'||error?.message==='ECU_PAIR_DIFF_REQUIRED')return json({error:error.message},400);
          throw error;
        }
      }

      if (url.pathname.startsWith('/api/ecu/internal/training/') && url.pathname.endsWith('/result') && req.method === 'POST') {
        if (!isComputeAuthorized(req, env)) return json({ error: 'UNAUTHORIZED' }, 401);
        const trainingId=decodeURIComponent(url.pathname.slice('/api/ecu/internal/training/'.length,-'/result'.length));
        if(!trainingId)return json({error:'ECU_TRAINING_ID_REQUIRED'},400);
        const body=await readJson(req);
        try{
          return json({training:await deps.applyTrainingResult(env,trainingId,body)});
        }catch(error){
          if(error?.message==='ECU_TRAINING_RUN_NOT_FOUND')return json({error:'ECU_TRAINING_RUN_NOT_FOUND'},404);
          if(error?.message==='INVALID_TRAINING_RESULT_STATUS'||error?.message==='ECU_MODEL_ARTIFACT_REQUIRED')return json({error:error.message},400);
          if(String(error?.message||'').includes('ECU_ARTIFACTS binding'))return json({error:'ECU_STORAGE_UNAVAILABLE'},503);
          throw error;
        }
      }

      if (url.pathname.startsWith('/api/ecu/internal/jobs/') && url.pathname.endsWith('/mod') && req.method === 'POST') {
        if (!isComputeAuthorized(req, env)) return json({ error: 'UNAUTHORIZED' }, 401);
        const jobId=decodeURIComponent(url.pathname.slice('/api/ecu/internal/jobs/'.length,-'/mod'.length));
        if(!jobId)return json({error:'ECU_JOB_ID_REQUIRED'},400);
        const declaredLength=Number(req.headers.get('content-length')||0);
        if(declaredLength>maxUploadBytes)return json({error:'ECU_FILE_TOO_LARGE',maxUploadBytes},413);
        const buffer=await req.arrayBuffer();
        if(!buffer.byteLength)return json({error:'ECU_FILE_EMPTY'},400);
        if(buffer.byteLength>maxUploadBytes)return json({error:'ECU_FILE_TOO_LARGE',maxUploadBytes},413);
        const checksumAlgorithm=String(req.headers.get('x-checksum-algorithm')||'').trim();
        try{
          const mod=await deps.storeValidatedMod(env,jobId,{bytes:new Uint8Array(buffer),checksumAlgorithm});
          return json({mod},mod.existed?200:201);
        }catch(error){
          if(error?.message==='ECU_JOB_NOT_FOUND')return json({error:'ECU_JOB_NOT_FOUND'},404);
          if(['ECU_MOD_JOB_NOT_READY','ECU_MOD_VALIDATION_NOT_READY','ECU_MOD_CHECKSUM_NOT_VERIFIED','ECU_MOD_CHECKSUM_ALGORITHM_MISMATCH'].includes(error?.message))return json({error:error.message},409);
          if(String(error?.message||'').includes('ECU_ARTIFACTS binding'))return json({error:'ECU_STORAGE_UNAVAILABLE'},503);
          throw error;
        }
      }

      if (url.pathname.startsWith('/api/ecu/internal/jobs/') && url.pathname.endsWith('/state') && req.method === 'POST') {
        if (!isComputeAuthorized(req, env)) return json({ error: 'UNAUTHORIZED' }, 401);
        const jobId = decodeURIComponent(url.pathname.slice('/api/ecu/internal/jobs/'.length, -'/state'.length));
        if (!jobId) return json({ error: 'ECU_JOB_ID_REQUIRED' }, 400);
        const body = await readJson(req);
        try {
          return json({ job: await deps.applyWorkerState(env, jobId, body) });
        } catch (error) {
          if (error?.message === 'ECU_JOB_NOT_FOUND') return json({ error: 'ECU_JOB_NOT_FOUND' }, 404);
          if (error?.message === 'INVALID_ECU_WORKER_STATE') return json({ error: 'INVALID_ECU_WORKER_STATE' }, 400);
          if (String(error?.message || '').startsWith('ILLEGAL_ECU_WORKER_STATE:')) return json({ error: error.message }, 409);
          throw error;
        }
      }

      if (url.pathname.startsWith('/api/ecu/internal/jobs/') && url.pathname.endsWith('/result') && req.method === 'POST') {
        if (!isComputeAuthorized(req, env)) return json({ error: 'UNAUTHORIZED' }, 401);
        const jobId = decodeURIComponent(url.pathname.slice('/api/ecu/internal/jobs/'.length, -'/result'.length));
        if (!jobId) return json({ error: 'ECU_JOB_ID_REQUIRED' }, 400);
        const body = await readJson(req);
        try {
          return json({ job: await deps.applyWorkerResult(env, jobId, body) });
        } catch (error) {
          if (error?.message === 'ECU_JOB_NOT_FOUND') return json({ error: 'ECU_JOB_NOT_FOUND' }, 404);
          throw error;
        }
      }

      if (url.pathname === '/api/ecu/files' && req.method === 'POST') {
        const declaredLength = Number(req.headers.get('content-length') || 0);
        if (declaredLength > maxUploadBytes) return json({ error: 'ECU_FILE_TOO_LARGE', maxUploadBytes }, 413);
        const buffer = await req.arrayBuffer();
        if (!buffer.byteLength) return json({ error: 'ECU_FILE_EMPTY' }, 400);
        if (buffer.byteLength > maxUploadBytes) return json({ error: 'ECU_FILE_TOO_LARGE', maxUploadBytes }, 413);
        const filename = requestFilename(req);
        const contentType = String(req.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim() || 'application/octet-stream';
        try {
          const file = await deps.uploadOriginal(env, { bytes: new Uint8Array(buffer), filename, contentType });
          return json({ file }, file.existed ? 200 : 201);
        } catch (error) {
          if (String(error?.message || '').includes('ECU_ARTIFACTS binding')) return json({ error: 'ECU_STORAGE_UNAVAILABLE' }, 503);
          throw error;
        }
      }
      if (url.pathname === '/api/ecu/analyze-file' && req.method === 'POST') {
        const declaredLength = Number(req.headers.get('content-length') || 0);
        if (declaredLength > maxUploadBytes) return json({ error: 'ECU_FILE_TOO_LARGE', maxUploadBytes }, 413);
        const buffer = await req.arrayBuffer();
        if (!buffer.byteLength) return json({ error: 'ECU_FILE_EMPTY' }, 400);
        if (buffer.byteLength > maxUploadBytes) return json({ error: 'ECU_FILE_TOO_LARGE', maxUploadBytes }, 413);
        const filename = requestFilename(req);
        const contentType = String(req.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim() || 'application/octet-stream';
        try {
          const file = await deps.uploadOriginal(env, { bytes: new Uint8Array(buffer), filename, contentType });
          const job = await deps.createJob(env, { fileId: file.id, operation: 'analyze', callbackBaseUrl: url.origin });
          return json({ file, job }, 202);
        } catch (error) {
          if (String(error?.message || '').includes('ECU_ARTIFACTS binding')) return json({ error: 'ECU_STORAGE_UNAVAILABLE' }, 503);
          throw error;
        }
      }

      if (url.pathname.startsWith('/api/ecu/maps/') && url.pathname.endsWith('/verify') && req.method === 'POST') {
        const mapId = decodeURIComponent(url.pathname.slice('/api/ecu/maps/'.length, -'/verify'.length));
        if (!mapId) return json({ error: 'ECU_MAP_ID_REQUIRED' }, 400);
        const body = await readJson(req);
        const semanticLabel = String(body.semanticLabel || '').trim();
        if (!semanticLabel) return json({ error: 'semanticLabel is required' }, 400);
        try {
          return json({ example: await deps.verifyMap(env, mapId, { semanticLabel }) }, 201);
        } catch (error) {
          if (error?.message === 'ECU_MAP_NOT_FOUND') return json({ error: 'ECU_MAP_NOT_FOUND' }, 404);
          throw error;
        }
      }

      if (url.pathname === '/api/ecu/jobs' && req.method === 'POST') {
        const body = await readJson(req);
        const fileId = String(body.fileId || '').trim();
        const operation = String(body.operation || 'analyze').trim() || 'analyze';
        if (!fileId) return json({ error: 'fileId is required' }, 400);
        try {
          return json({ job: await deps.createJob(env, { fileId, operation, callbackBaseUrl: url.origin }) }, 202);
        } catch (error) {
          if (error?.message === 'ECU_FILE_NOT_FOUND') return json({ error: 'ECU_FILE_NOT_FOUND' }, 404);
          throw error;
        }
      }

      if (url.pathname === '/api/ecu/jobs' && req.method === 'GET') {
        return json({ jobs: await deps.listJobs(env, url.searchParams.get('limit')) });
      }

      if (url.pathname.startsWith('/api/ecu/jobs/') && url.pathname.endsWith('/mod') && req.method === 'GET') {
        const jobId=decodeURIComponent(url.pathname.slice('/api/ecu/jobs/'.length,-'/mod'.length));
        if(!jobId)return json({error:'ECU_JOB_ID_REQUIRED'},400);
        try{
          const mod=await deps.getValidatedMod(env,jobId);
          if(!mod)return json({error:'ECU_MOD_NOT_FOUND'},404);
          return new Response(mod.bytes,{
            status:200,
            headers:{
              'content-type':'application/octet-stream',
              'content-disposition':`attachment; filename="${mod.filename}"`,
              'cache-control':'no-store',
              'x-content-type-options':'nosniff',
              'x-ecu-sha256':String(mod.sha256||''),
              'x-ecu-checksum-algorithm':String(mod.checksumAlgorithm||''),
            },
          });
        }catch(error){
          if(String(error?.message||'').includes('ECU_ARTIFACTS binding'))return json({error:'ECU_STORAGE_UNAVAILABLE'},503);
          throw error;
        }
      }

      if (url.pathname.startsWith('/api/ecu/jobs/') && url.pathname.endsWith('/maps') && req.method === 'GET') {
        const jobId=decodeURIComponent(url.pathname.slice('/api/ecu/jobs/'.length,-'/maps'.length));
        if(!jobId)return json({error:'ECU_JOB_ID_REQUIRED'},400);
        return json({maps:await deps.listMaps(env,jobId)});
      }

      if (url.pathname.startsWith('/api/ecu/jobs/') && req.method === 'GET') {
        const id = decodeURIComponent(url.pathname.slice('/api/ecu/jobs/'.length));
        const job = await deps.getJob(env, id);
        return job ? json({ job }) : json({ error: 'ECU_JOB_NOT_FOUND' }, 404);
      }

      if (url.pathname === '/api/ecu/models' && req.method === 'GET') {
        return json({models:await deps.listModels(env,url.searchParams.get('limit'))});
      }

      if (url.pathname.startsWith('/api/ecu/models/') && url.pathname.endsWith('/rollback') && req.method === 'POST') {
        const version=decodeURIComponent(url.pathname.slice('/api/ecu/models/'.length,-'/rollback'.length));
        if(!version)return json({error:'ECU_MODEL_VERSION_REQUIRED'},400);
        try{
          return json({rollback:await deps.rollbackModel(env,version)});
        }catch(error){
          if(error?.message==='ECU_MODEL_NOT_FOUND')return json({error:'ECU_MODEL_NOT_FOUND'},404);
          if(error?.message==='ECU_PRODUCTION_MODEL_NOT_FOUND')return json({error:'ECU_PRODUCTION_MODEL_NOT_FOUND'},409);
          throw error;
        }
      }

      if (url.pathname === '/api/ecu/metrics' && req.method === 'GET') {
        return json(await deps.metricsStatus(env));
      }

      if (url.pathname === '/api/ecu/compute/status' && req.method === 'GET') {
        return json(await deps.computeStatus(env));
      }

      if (url.pathname === '/api/ecu/rulepacks/status' && req.method === 'GET') {
        return json(await deps.rulepackStatus(env));
      }

      if (url.pathname === '/api/ecu/research/status' && req.method === 'GET') {
        return json(await deps.researchStatus(env));
      }

      if (url.pathname === '/api/ecu/research/github' && req.method === 'GET') {
        return json({repositories:await deps.listGitHubRepositories(env,url.searchParams.get('limit'))});
      }

      if (url.pathname === '/api/ecu/research/run' && req.method === 'POST') {
        const result=await research.run(env,Date.now());
        return json(result,result?.skipped?200:202);
      }

      if (url.pathname === '/api/ecu/training/pairs' && req.method === 'GET') {
        return json({pairs:await deps.listPairs(env,url.searchParams.get('limit'))});
      }

      if (url.pathname === '/api/ecu/training/pairs' && req.method === 'POST') {
        const body=await readJson(req);
        const oriFileId=String(body.oriFileId||'').trim();
        const modFileId=String(body.modFileId||'').trim();
        const operationLabel=String(body.operationLabel||'').trim();
        if(!oriFileId||!modFileId||!operationLabel)return json({error:'oriFileId, modFileId and operationLabel are required'},400);
        try{
          return json({pair:await deps.createPair(env,{oriFileId,modFileId,operationLabel,callbackBaseUrl:url.origin})},202);
        }catch(error){
          if(error?.message==='ECU_FILE_NOT_FOUND')return json({error:'ECU_FILE_NOT_FOUND'},404);
          if(error?.message==='ECU_PAIR_SIZE_MISMATCH')return json({error:'ECU_PAIR_SIZE_MISMATCH'},409);
          throw error;
        }
      }

      if (url.pathname === '/api/ecu/training/run' && req.method === 'POST') {
        const result=await training.maybeRun(env,Date.now());
        return json(result,result?.scheduled?202:200);
      }

      if (url.pathname === '/api/ecu/training/status' && req.method === 'GET') {
        return json(await deps.trainingStatus(env));
      }

      if (url.pathname === '/api/ecu/upload-session' && req.method === 'POST') {
        return json(await deps.uploadStatus(env));
      }

      return core.fetch(req, env, ctx);
    },
    async scheduled(event, env, ctx) {
      const timestamp = Number(event?.scheduledTime || Date.now());
      try {
        await deps.dispatchQueuedJobs(env, timestamp);
      } catch {
        // Queue retries are recoverable and must not break the main scheduler.
      }
      try {
        await research.run(env, timestamp);
      } catch {
        // Background learning must never break the main JARVIS scheduler.
      }
      try {
        await rulepacks.refresh(env);
      } catch {
        // Evidence-only rulepack learning is recoverable and never promotes itself.
      }
      try {
        await deps.refreshChecksumProfiles(env);
      } catch {
        // Checksum profile learning is conservative and recoverable.
      }
      try {
        await training.maybeRun(env, timestamp);
      } catch {
        // Training checks are optional background work and remain recoverable.
      }
      return core.scheduled?.(event, env, ctx);
    },
  };
}
