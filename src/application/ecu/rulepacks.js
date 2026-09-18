const median = values => {
  const xs=[...values].sort((a,b)=>a-b);
  if(!xs.length)return 0;
  const m=Math.floor(xs.length/2);
  return xs.length%2?xs[m]:(xs[m-1]+xs[m])/2;
};

async function sha256Text(value){
  const bytes=new TextEncoder().encode(String(value||''));
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
  return [...digest].map(b=>b.toString(16).padStart(2,'0')).join('');
}

const defaultRepository={
  async listVerifiedEvidence(env){
    const rows=(await env.DB.prepare(`SELECT pair_id,operation_label,semantic_label,confidence,delta_stats_json,human_verified
      FROM ecu_change_evidence WHERE human_verified=1 ORDER BY semantic_label,pair_id,created_at ASC`).all()).results||[];
    return rows.map(row=>({
      pairId:row.pair_id,
      operationLabel:row.operation_label,
      semanticLabel:row.semantic_label,
      confidence:Number(row.confidence||0),
      humanVerified:Boolean(row.human_verified),
      deltaStats:(()=>{try{return JSON.parse(row.delta_stats_json||'{}')}catch{return {}}})(),
    }));
  },
  async saveCandidate(env,candidate){
    await env.DB.prepare(`INSERT INTO ecu_rulepack_versions(
      version,operation_label,state,verified,rules_json,evidence_count,digest,created_at,promoted_at
    ) VALUES(?,?,?,?,?,?,?,?,?)
    ON CONFLICT(digest) DO UPDATE SET evidence_count=excluded.evidence_count,rules_json=excluded.rules_json`)
      .bind(
        candidate.version,
        candidate.operationLabel,
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
  async latest(env){
    const row=await env.DB.prepare(`SELECT version,operation_label,state,verified,rules_json,evidence_count,digest,created_at,promoted_at
      FROM ecu_rulepack_versions ORDER BY created_at DESC LIMIT 1`).first();
    if(!row)return null;
    return {
      version:row.version,
      operationLabel:row.operation_label,
      state:row.state,
      verified:Boolean(row.verified),
      rules:(()=>{try{return JSON.parse(row.rules_json||'{}')}catch{return {}}})(),
      evidenceCount:Number(row.evidence_count||0),
      digest:row.digest,
      createdAt:row.created_at,
      promotedAt:row.promoted_at||null,
    };
  },
  async production(env){
    const row=await env.DB.prepare(`SELECT version,operation_label,state,verified,rules_json,evidence_count,digest,created_at,promoted_at
      FROM ecu_rulepack_versions WHERE state='PRODUCTION' AND verified=1 ORDER BY promoted_at DESC,created_at DESC LIMIT 1`).first();
    if(!row)return null;
    return {
      version:row.version,
      operationLabel:row.operation_label,
      state:row.state,
      verified:true,
      rules:(()=>{try{return JSON.parse(row.rules_json||'{}')}catch{return {}}})(),
      evidenceCount:Number(row.evidence_count||0),
      digest:row.digest,
      createdAt:row.created_at,
      promotedAt:row.promoted_at||null,
    };
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
      const grouped=new Map();
      for(const row of rows){
        if(!row.humanVerified||row.operationLabel!==operationLabel)continue;
        const label=String(row.semanticLabel||'UNKNOWN');
        if(label==='UNKNOWN')continue;
        const value=Number(row.deltaStats?.p95AbsPercent??row.deltaStats?.p95_abs_percent??0);
        if(!Number.isFinite(value)||value<=0)continue;
        if(!grouped.has(label))grouped.set(label,new Map());
        grouped.get(label).set(String(row.pairId||''),value);
      }
      const rules={};
      let evidenceCount=0;
      for(const [label,byPair] of [...grouped.entries()].sort((a,b)=>a[0].localeCompare(b[0]))){
        const values=[...byPair.entries()].filter(([pair])=>pair).map(([,value])=>value);
        if(values.length<minPairsPerLabel)continue;
        evidenceCount+=values.length;
        rules[label]={
          evidencePairs:values.length,
          observedEnvelopePercent:median(values),
          minObservedPercent:Math.min(...values),
          maxObservedPercent:Math.max(...values),
        };
      }
      if(!Object.keys(rules).length){
        return {created:false,reason:'INSUFFICIENT_VERIFIED_CHANGE_EVIDENCE'};
      }
      const canonical=JSON.stringify({operationLabel,rules});
      const digest=await sha256Text(canonical);
      const candidate={
        version:`rules-${digest.slice(0,16)}`,
        operationLabel,
        state:'EVIDENCE_CANDIDATE',
        verified:false,
        rules,
        evidenceCount,
        digest,
        createdAt:Date.now(),
      };
      await repository.saveCandidate(env,candidate);
      return {created:true,candidate};
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
