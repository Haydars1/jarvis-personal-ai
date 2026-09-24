const median = values => {
  const xs=[...values].sort((a,b)=>a-b);
  if(!xs.length)return 0;
  const m=Math.floor(xs.length/2);
  return xs.length%2?xs[m]:(xs[m-1]+xs[m])/2;
};

function validHex(value,length){
  return typeof value==='string' && value.length===length*2 && /^[a-f0-9]+$/i.test(value);
}

function autoPromotionDecision(candidate,minPairsPerLabel=5){
  const fullScope=Boolean(candidate?.ecuFamily&&candidate?.hw&&candidate?.sw);
  if(!fullScope)return {promote:false,reason:'SCOPE_NOT_EXACT'};

  if(candidate.operationLabel==='stage1'){
    const patches=Array.isArray(candidate?.rules?.__patches)?candidate.rules.__patches:[];
    if(patches.length)return {promote:false,reason:'STAGE1_PATCH_MANUAL_REVIEW'};
    const entries=Object.entries(candidate.rules||{}).filter(([label])=>label!=='__patches');
    if(!entries.length)return {promote:false,reason:'NO_STAGE1_RULES'};
    const stable=entries.every(([,rule])=>
      Number(rule?.evidencePairs||0)>=minPairsPerLabel &&
      Number.isFinite(Number(rule?.targetDeltaPercent)) &&
      Number(rule?.targetDeltaPercent)!==0 &&
      Number(rule?.directionAgreement||0)>=0.9
    );
    return stable?{promote:true,reason:'VERIFIED_STAGE1_CONSENSUS'}:{promote:false,reason:'STAGE1_CONSENSUS_WEAK'};
  }

  const keys=Object.keys(candidate?.rules||{});
  const patches=Array.isArray(candidate?.rules?.__patches)?candidate.rules.__patches:[];
  if(keys.length!==1||keys[0]!=='__patches'||!patches.length)return {promote:false,reason:'SERVICE_RULEPACK_NOT_EXACT_ONLY'};
  const sorted=[...patches].sort((a,b)=>Number(a.offset)-Number(b.offset));
  let previousEnd=-1;
  for(const patch of sorted){
    const offset=Number(patch?.offset);
    const length=Number(patch?.length);
    if(!Number.isInteger(offset)||offset<0||!Number.isInteger(length)||length<=0)return {promote:false,reason:'PATCH_INVALID'};
    if(Number(patch?.evidencePairs||0)<minPairsPerLabel)return {promote:false,reason:'PATCH_EVIDENCE_WEAK'};
    if(!validHex(String(patch.beforeHex||''),length)||!validHex(String(patch.afterHex||''),length))return {promote:false,reason:'PATCH_HEX_INVALID'};
    if(String(patch.beforeHex).toLowerCase()===String(patch.afterHex).toLowerCase())return {promote:false,reason:'PATCH_NO_CHANGE'};
    if(offset<previousEnd)return {promote:false,reason:'PATCH_OVERLAP'};
    previousEnd=offset+length;
  }
  return {promote:true,reason:'VERIFIED_EXACT_PATCH_CONSENSUS'};
}

async function sha256Text(value){
  const bytes=new TextEncoder().encode(String(value||''));
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
  return [...digest].map(b=>b.toString(16).padStart(2,'0')).join('');
}

function mapRulepackRow(row){
  if(!row)return null;
  return {
    version:row.version,
    operationLabel:row.operation_label,
    ecuFamily:row.ecu_family||'',
    hw:row.hw||'',
    sw:row.sw||'',
    state:row.state,
    verified:Boolean(row.verified),
    rules:(()=>{try{return JSON.parse(row.rules_json||'{}')}catch{return {}}})(),
    evidenceCount:Number(row.evidence_count||0),
    digest:row.digest,
    createdAt:row.created_at,
    promotedAt:row.promoted_at||null,
  };
}

const defaultRepository={
  async listVerifiedEvidence(env){
    const rows=(await env.DB.prepare(`SELECT pair_id,operation_label,ecu_family,hw,sw,semantic_label,map_offset,confidence,delta_stats_json,human_verified
      FROM ecu_change_evidence WHERE human_verified=1
      ORDER BY operation_label,ecu_family,hw,sw,semantic_label,pair_id,created_at ASC`).all()).results||[];
    return rows.map(row=>({
      pairId:row.pair_id,
      operationLabel:row.operation_label,
      ecuFamily:row.ecu_family||'',
      hw:row.hw||'',
      sw:row.sw||'',
      semanticLabel:row.semantic_label,
      mapOffset:Number(row.map_offset||0),
      confidence:Number(row.confidence||0),
      humanVerified:Boolean(row.human_verified),
      deltaStats:(()=>{try{return JSON.parse(row.delta_stats_json||'{}')}catch{return {}}})(),
    }));
  },
  async saveCandidate(env,candidate){
    await env.DB.prepare(`INSERT INTO ecu_rulepack_versions(
      version,operation_label,ecu_family,hw,sw,state,verified,rules_json,evidence_count,digest,created_at,promoted_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(digest) DO UPDATE SET
      evidence_count=excluded.evidence_count,
      rules_json=excluded.rules_json,
      ecu_family=excluded.ecu_family,
      hw=excluded.hw,
      sw=excluded.sw`)
      .bind(
        candidate.version,
        candidate.operationLabel,
        candidate.ecuFamily||'',
        candidate.hw||'',
        candidate.sw||'',
        candidate.state,
        candidate.verified?1:0,
        JSON.stringify(candidate.rules),
        candidate.evidenceCount,
        candidate.digest,
        candidate.createdAt,
        null,
      ).run();
    return candidate;
  },
  async promoteCandidate(env,candidate,reason){
    const promotedAt=Date.now();
    const supersede=env.DB.prepare(`UPDATE ecu_rulepack_versions
      SET state='SUPERSEDED'
      WHERE state='PRODUCTION' AND verified=1 AND operation_label=? AND ecu_family=? AND hw=? AND sw=? AND version<>?`)
      .bind(candidate.operationLabel,candidate.ecuFamily||'',candidate.hw||'',candidate.sw||'',candidate.version);
    const promote=env.DB.prepare(`UPDATE ecu_rulepack_versions
      SET state='PRODUCTION',verified=1,promoted_at=?
      WHERE version=?`).bind(promotedAt,candidate.version);
    if(typeof env.DB.batch==='function')await env.DB.batch([supersede,promote]);
    else { await supersede.run(); await promote.run(); }
    return {...candidate,state:'PRODUCTION',verified:true,promotedAt,promotionReason:reason};
  },
  async latest(env){
    return mapRulepackRow(await env.DB.prepare(`SELECT version,operation_label,ecu_family,hw,sw,state,verified,rules_json,evidence_count,digest,created_at,promoted_at
      FROM ecu_rulepack_versions ORDER BY created_at DESC LIMIT 1`).first());
  },
  async production(env){
    return mapRulepackRow(await env.DB.prepare(`SELECT version,operation_label,ecu_family,hw,sw,state,verified,rules_json,evidence_count,digest,created_at,promoted_at
      FROM ecu_rulepack_versions WHERE state='PRODUCTION' AND verified=1 ORDER BY promoted_at DESC,created_at DESC LIMIT 1`).first());
  },
};

export function createEcuRulepackLearning({
  repository=defaultRepository,
  operationLabel='stage1',
  minPairsPerLabel=5,
}={}){
  return {
    async refresh(env){
      const rows=await repository.listVerifiedEvidence(env);
      const scopes=new Map();

      for(const row of rows){
        if(!row.humanVerified)continue;
        if(operationLabel!=='*'&&row.operationLabel!==operationLabel)continue;
        const label=String(row.semanticLabel||'UNKNOWN');
        if(label==='UNKNOWN')continue;

        const scope={
          operationLabel:String(row.operationLabel||''),
          ecuFamily:String(row.ecuFamily||''),
          hw:String(row.hw||''),
          sw:String(row.sw||''),
        };
        if(!scope.operationLabel)continue;
        const scopeKey=[scope.operationLabel,scope.ecuFamily,scope.hw,scope.sw].join('|');
        if(!scopes.has(scopeKey))scopes.set(scopeKey,{scope,labels:new Map(),patches:new Map()});
        const bucket=scopes.get(scopeKey);

        if(label==='__PATCH__'){
          const beforeHex=String(row.deltaStats?.patchBeforeHex||row.deltaStats?.patch_before_hex||'').toLowerCase();
          const afterHex=String(row.deltaStats?.patchAfterHex||row.deltaStats?.patch_after_hex||'').toLowerCase();
          const length=Number(row.deltaStats?.length||0);
          if(length>0&&beforeHex.length===length*2&&afterHex.length===length*2&&beforeHex!==afterHex&&validHex(beforeHex,length)&&validHex(afterHex,length)){
            const patchKey=[row.mapOffset,beforeHex,afterHex].join(':');
            if(!bucket.patches.has(patchKey))bucket.patches.set(patchKey,{offset:row.mapOffset,beforeHex,afterHex,length,pairs:new Set()});
            bucket.patches.get(patchKey).pairs.add(String(row.pairId||''));
          }
          continue;
        }

        const envelope=Number(row.deltaStats?.p95AbsPercent??row.deltaStats?.p95_abs_percent??0);
        const rawSigned=row.deltaStats?.medianSignedPercent??row.deltaStats?.median_signed_percent;
        const signed=rawSigned==null?null:Number(rawSigned);
        if(!Number.isFinite(envelope)||envelope<=0)continue;
        if(!bucket.labels.has(label))bucket.labels.set(label,new Map());
        bucket.labels.get(label).set(String(row.pairId||''),{envelope,signed:Number.isFinite(signed)&&signed!==0?signed:null});
      }

      const candidates=[];
      const promoted=[];
      for(const {scope,labels,patches} of scopes.values()){
        const rules={};
        let evidenceCount=0;

        for(const [label,byPair] of [...labels.entries()].sort((a,b)=>a[0].localeCompare(b[0]))){
          const values=[...byPair.entries()].filter(([pair])=>pair).map(([,value])=>value);
          if(values.length<minPairsPerLabel)continue;
          const envelopes=values.map(value=>value.envelope);
          const signedValues=values.map(value=>value.signed).filter(value=>Number.isFinite(value)&&value!==0);
          const positive=signedValues.filter(value=>value>0).length;
          const negative=signedValues.filter(value=>value<0).length;
          const directionAgreement=signedValues.length?Math.max(positive,negative)/signedValues.length:0;
          evidenceCount+=values.length;
          rules[label]={
            evidencePairs:values.length,
            observedEnvelopePercent:median(envelopes),
            minObservedPercent:Math.min(...envelopes),
            maxObservedPercent:Math.max(...envelopes),
            ...(signedValues.length===values.length&&directionAgreement>=0.8?{
              targetDeltaPercent:median(signedValues),
              directionAgreement,
            }:{}),
          };
        }

        const exactPatches=[...patches.values()]
          .filter(patch=>patch.pairs.size>=minPairsPerLabel)
          .sort((a,b)=>a.offset-b.offset)
          .map(patch=>({
            offset:patch.offset,
            length:patch.length,
            beforeHex:patch.beforeHex,
            afterHex:patch.afterHex,
            evidencePairs:patch.pairs.size,
          }));
        if(exactPatches.length){
          rules.__patches=exactPatches;
          evidenceCount+=exactPatches.reduce((sum,patch)=>sum+patch.evidencePairs,0);
        }
        if(!Object.keys(rules).length)continue;

        const canonical=JSON.stringify({...scope,rules});
        const digest=await sha256Text(canonical);
        const candidate={
          version:`rules-${digest.slice(0,16)}`,
          ...scope,
          state:'EVIDENCE_CANDIDATE',
          verified:false,
          rules,
          evidenceCount,
          digest,
          createdAt:Date.now(),
        };
        await repository.saveCandidate(env,candidate);

        const decision=autoPromotionDecision(candidate,minPairsPerLabel);
        if(decision.promote&&typeof repository.promoteCandidate==='function'){
          const item=await repository.promoteCandidate(env,candidate,decision.reason);
          candidates.push(item);
          promoted.push(item);
        }else{
          candidates.push({...candidate,promotionReason:decision.reason});
        }
      }

      if(!candidates.length)return {created:false,reason:'INSUFFICIENT_VERIFIED_CHANGE_EVIDENCE'};
      return {created:true,candidate:candidates[0],candidates,autoPromoted:promoted};
    },
    async status(env){
      const [latest,production]=await Promise.all([
        repository.latest(env),
        typeof repository.production==='function'?repository.production(env):Promise.resolve(null),
      ]);
      return {latest:latest||null,production:production||null};
    },
  };
}
