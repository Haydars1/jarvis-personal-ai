const enc=new TextEncoder();

async function sha256Bytes(value){
  return new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value)));
}
function hex(bytes){return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('')}
async function partition(groupKey){
  const digest=await sha256Bytes(groupKey.join('|'));
  const bucket=((digest[0]<<8)|digest[1])%100;
  return bucket<80?'train':bucket<90?'validation':'test';
}
function parseFeatures(raw){
  if(raw&&typeof raw==='object')return raw;
  try{return JSON.parse(raw||'{}')}catch{return {}}
}
function normalize(row){
  return {
    ecu_family:String(row.ecu_family||'UNKNOWN'),
    hw:String(row.hw||''),
    sw:String(row.sw||''),
    artifact_sha256:String(row.artifact_sha256||''),
    map_offset:Number(row.map_offset||0),
    semantic_label:String(row.semantic_label||'UNKNOWN'),
    source_type:String(row.source_type||''),
    source_confidence:Number(row.source_confidence||0),
    human_verified:Boolean(Number(row.human_verified??row.humanVerified??0)),
    map_features:parseFeatures(row.features_json??row.map_features??{}),
  };
}
function key(row){
  return [row.ecu_family,row.hw,row.sw,row.artifact_sha256,row.map_offset,row.semantic_label,row.source_type,row.source_confidence]
    .join('\u0000');
}
function stable(value){
  if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
  if(value&&typeof value==='object'){
    return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
  }
  return JSON.stringify(value);
}

export async function buildEcuDatasetSnapshot(rows,version){
  const examples=(rows||[]).map(normalize).filter(x=>x.human_verified).sort((a,b)=>key(a).localeCompare(key(b)));
  const splits={train:[],validation:[],test:[]};
  for(const item of examples){
    splits[await partition([item.ecu_family,item.hw,item.sw])].push(item);
  }
  const payload={version:String(version),splits};
  const digest=hex(await sha256Bytes(stable(payload)));
  return {version:String(version),examples,splits,digest,exampleCount:examples.length};
}
