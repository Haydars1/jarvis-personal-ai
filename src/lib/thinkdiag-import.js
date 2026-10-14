/**
 * ThinkDiag TC Recording Import
 *
 * Parses ThinkCar .TC diagnostic log files (binary format) and stores
 * parsed recordings in D1. Ported from cubigato/thinkcar-tc-reader (Python).
 *
 * TC format:
 *   - Magic: LSX8 or LSX9 at offset 0x00
 *   - String table with 1-based indexing
 *   - Metadata in strings[1..8]
 *   - Parameter definitions + unit table
 *   - Records: arrays of uint32 string-table indices
 *
 * Language: JavaScript (Cloudflare Workers ESM)
 * Target: Cloudflare Workers with D1 binding
 */

// ─── Known Unit Fallbacks ─────────────────────────────────────────
const KNOWN_UNITS = Object.freeze({
  'Accel. Opening Angle':['%'],
  'Accelerator Pedal Position':['%'],
  'Actual Forward && Reverse Linear Solenoid Current':['mA'],
  'Actual Secondary Pressure':['MPa'],
  'Air Mixer Position Sensor Voltage':['V'],
  'Air Temperature At The Air Flow Sensor':['°C'],
  'ATF Temp.':['°C'],
  'Commanded Forward && Reverse Linear Solenoid Current':['mA'],
  'Comp Power Supply Voltage':['V'],
  'Control module voltage':['V'],
  'EGR Valve Position Signal Voltage':['V'],
  'Engine Coolant Temperature':['°C'],
  'Engine RPM':['rpm'],
  'Engine Speed':['rpm'],
  'Exterior Air Temperature':['°C'],
  'Front Wheel Speed':['km/h','rpm'],
  'Lock Up Duty Ratio':['%'],
  'Oxygen Sensor Output Voltage B1S1':['V'],
  'Oxygen Sensor Output Voltage B1S2':['V'],
  'Primary DOWN Duty':['%'],
  'Primary Rev Speed':['rpm'],
  'Primary UP Duty':['%'],
  'Secondary Actual Current':['mA'],
  'Secondary Rev Speed':['rpm'],
  'Secondary Set Current':['mA'],
  'Temperature Of The Fuel':['°C'],
  'Temperature Upstream Of The Turbine':['°C'],
  'Transfer Duty Ratio':['%'],
  'Turbine Revolution Speed':['rpm'],
  'Turbocharging Inlet Air Temperature':['°C'],
  'Voltage Of The Turbocharger Position Signal':['V'],
  'Intake Air Temperature':['°C'],
  'Mass Air Flow':['g/s'],
  'Throttle Position':['%'],
  'Vehicle Speed':['km/h'],
  'Fuel Pressure':['kPa'],
  'Intake Manifold Pressure':['kPa'],
  'Battery Voltage':['V'],
  'Oil Temperature':['°C'],
  'Boost Pressure':['bar'],
  'Fuel Rail Pressure':['MPa'],
  'Exhaust Gas Temperature':['°C'],
});

// ─── Binary Helpers ───────────────────────────────────────────────
function u16(dv,off){return dv.getUint16(off,true)}
function u32(dv,off){return dv.getUint32(off,true)}

// ─── String Table Parser ──────────────────────────────────────────
function parseStringTable(dv,buf,startPos){
  const strings=[''];          // index 0 = placeholder for 1-based
  let pos=startPos;
  const len=buf.byteLength;
  while(pos+2<=len){
    const entryLen=u16(dv,pos);
    if(entryLen===0||entryLen>500||entryLen<3)break;
    const entryEnd=pos+entryLen;
    if(entryEnd>len)break;
    const payload=new Uint8Array(buf,pos+2,entryLen-2);
    if(!payload.length||payload[payload.length-1]!==0)break;
    const bytes=payload.slice(0,payload.length-1);
    let s;
    try{s=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}
    catch{s=new TextDecoder('latin1').decode(bytes)}
    strings.push(s);
    pos=entryEnd;
  }
  return strings;
}

// ─── Unit Fallback Application ────────────────────────────────────
function applyUnitFallbacks(parameters,units){
  const result=[...units];
  const occ={};
  for(let i=0;i<parameters.length;i++){
    const p=parameters[i];
    occ[p]=(occ[p]||0);
    if(result[i]){occ[p]++;continue}
    const known=KNOWN_UNITS[p];
    if(!known){occ[p]++;continue}
    if(known.length===1)result[i]=known[0];
    else if(occ[p]<known.length)result[i]=known[occ[p]];
    occ[p]++;
  }
  return result;
}

// ─── Main TC Parser ──────────────────────────────────────────────
export function parseTCBuffer(arrayBuffer){
  const buf=arrayBuffer;
  if(buf.byteLength<0x400)throw new Error('TC_TOO_SMALL');
  const dv=new DataView(buf);
  const bytes=new Uint8Array(buf);

  // 1. Magic
  const magicBytes=new Uint8Array(buf,0,4);
  const magic=String.fromCharCode(...magicBytes);
  if(magic!=='LSX8'&&magic!=='LSX9')throw new Error('TC_BAD_MAGIC: '+magic);

  // 2. String table offset at 0x0C
  const strOff=u32(dv,0x0C);
  if(strOff>=buf.byteLength)throw new Error('TC_STR_OOB');
  const strings=parseStringTable(dv,buf,strOff+16);

  // 3. Metadata from strings[1..8]
  const gs=i=>i<strings.length?strings[i]:'';
  const metadata={
    language:gs(1),timestamp:gs(2),region:gs(3),version:gs(4),
    manufacturer:gs(5),deviceId:gs(6),protocol:gs(7),sessionId:gs(8)
  };

  // 4. Data descriptor offset at 0x118, fallback 0x128
  let ddOff=u32(dv,0x118);
  if(ddOff===0)ddOff=0x128;
  if(ddOff+16>buf.byteLength)throw new Error('TC_DD_OOB');

  const dataBlockOff=u32(dv,ddOff+4);
  const paramSectionSize=u32(dv,ddOff+8);
  const ddRecSize=u32(dv,ddOff+12);
  if(dataBlockOff+16>buf.byteLength)throw new Error('TC_DB_OOB');

  // 5. Data block header
  const dataSize=u32(dv,dataBlockOff+8);
  const recordSize=u32(dv,dataBlockOff+12);
  if(recordSize===0)throw new Error('TC_ZERO_RECSIZE');
  if(recordSize%4!==0)throw new Error('TC_BAD_RECSIZE');
  if(ddRecSize!==0&&ddRecSize!==recordSize)throw new Error('TC_RECSIZE_MISMATCH');
  if(dataSize%recordSize!==0)throw new Error('TC_DATA_MISALIGN');

  const paramCount=recordSize/4;
  const paramTableOff=ddOff+16;

  // 6. Parameter names
  const paramIndices=[];
  for(let i=0;i<paramCount;i++){
    paramIndices.push(u16(dv,paramTableOff+i*4));
  }
  const parameters=paramIndices.map(idx=>idx<strings.length?strings[idx]:`<idx_${idx}>`);

  // 7. Unit table (one record-width after parameter names)
  let paramUnits=new Array(paramCount).fill('');
  const unitTableOff=paramTableOff+recordSize;
  const hasUnitTable=paramSectionSize>=recordSize*2&&unitTableOff+recordSize<=dataBlockOff;
  if(hasUnitTable){
    for(let i=0;i<paramCount;i++){
      const uIdx=u16(dv,unitTableOff+i*4);
      if(uIdx===0)continue;
      if(uIdx<strings.length)paramUnits[i]=strings[uIdx].trim();
    }
  }
  paramUnits=applyUnitFallbacks(parameters,paramUnits);
  const units=[...new Set(paramUnits.filter(Boolean))];

  // 8. Records
  const dataOffset=dataBlockOff+16;
  const recordCount=dataSize/recordSize;
  if(recordCount>100000)throw new Error('TC_TOO_MANY_RECORDS');
  if(dataOffset+dataSize>buf.byteLength)throw new Error('TC_DATA_OOB');

  const records=[];
  for(let r=0;r<recordCount;r++){
    const off=dataOffset+r*recordSize;
    const record={};
    for(let i=0;i<paramCount;i++){
      const valIdx=u32(dv,off+i*4);
      record[parameters[i]]=valIdx<strings.length?strings[valIdx]:`<idx_${valIdx}>`;
    }
    records.push(record);
  }

  return {
    magic,metadata,parameters,paramUnits,units,
    records,recordCount:records.length,stringCount:strings.length-1
  };
}

// ─── Unique Header Builder (for CSV/display) ─────────────────────
function uniqueHeaders(params){
  const out=[];const seen={};
  for(const p of params){
    seen[p]=(seen[p]||0)+1;
    out.push(seen[p]>1?`${p} (${seen[p]})`:p);
  }
  return out;
}

// ─── D1 Helpers ──────────────────────────────────────────────────
const id=()=>crypto.randomUUID().replace(/-/g,'');
const now=()=>Math.floor(Date.now()/1000);

async function storeRecording(env,parsed,fileName,fileSize){
  const recId=id();
  const ts=now();
  const meta=parsed.metadata;

  // Store recording header
  await env.DB.prepare(`INSERT INTO thinkdiag_recordings
    (id,file_name,file_size,magic,language,timestamp_str,region,version,
     manufacturer,device_id,protocol,tc_session_id,
     parameter_count,record_count,string_count,
     parameters_json,units_json,param_units_json,
     created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(recId,fileName||'unknown.tc',fileSize||0,
      parsed.magic,meta.language,meta.timestamp,meta.region,meta.version,
      meta.manufacturer,meta.deviceId,meta.protocol,meta.sessionId,
      parsed.parameters.length,parsed.recordCount,parsed.stringCount,
      JSON.stringify(parsed.parameters),JSON.stringify(parsed.units),
      JSON.stringify(parsed.paramUnits),ts,ts)
    .run();

  // Batch-insert records (D1 batch limit ~100 statements)
  const batchSize=50;
  for(let i=0;i<parsed.records.length;i+=batchSize){
    const batch=parsed.records.slice(i,i+batchSize);
    const stmts=batch.map((rec,idx)=>{
      return env.DB.prepare(`INSERT INTO thinkdiag_record_data
        (id,recording_id,record_index,data_json,created_at)
        VALUES(?,?,?,?,?)`)
        .bind(id(),recId,i+idx,JSON.stringify(rec),ts);
    });
    await env.DB.batch(stmts);
  }
  return recId;
}

// ─── REST Handlers ───────────────────────────────────────────────
const j=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json'}});

async function handleImport(req,env){
  const ct=req.headers.get('content-type')||'';

  let fileBuffer,fileName='upload.tc';

  if(ct.includes('multipart/form-data')){
    const fd=await req.formData();
    const file=fd.get('file');
    if(!file||!file.arrayBuffer)return j({error:'NO_FILE_FIELD'},400);
    fileName=file.name||fileName;
    fileBuffer=await file.arrayBuffer();
  } else if(ct.includes('application/octet-stream')){
    fileBuffer=await req.arrayBuffer();
    const disp=req.headers.get('content-disposition')||'';
    const m=disp.match(/filename="?([^";\s]+)"?/);
    if(m)fileName=m[1];
  } else {
    return j({error:'UNSUPPORTED_CONTENT_TYPE',expected:'multipart/form-data or application/octet-stream'},400);
  }

  if(!fileBuffer||fileBuffer.byteLength<0x400){
    return j({error:'FILE_TOO_SMALL',minBytes:1024},400);
  }

  let parsed;
  try{parsed=parseTCBuffer(fileBuffer)}
  catch(e){return j({error:'PARSE_FAILED',detail:e.message},400)}

  const recId=await storeRecording(env,parsed,fileName,fileBuffer.byteLength);

  return j({
    ok:true,
    recordingId:recId,
    fileName,
    fileSize:fileBuffer.byteLength,
    magic:parsed.magic,
    metadata:parsed.metadata,
    parameterCount:parsed.parameters.length,
    recordCount:parsed.recordCount,
    parameters:parsed.parameters,
    units:parsed.units,
    sampleRecords:parsed.records.slice(0,3)
  });
}

async function handleDecode(req,env){
  // Accept raw TC binary via POST for decode-only (no storage)
  const ct=req.headers.get('content-type')||'';
  let fileBuffer;
  if(ct.includes('multipart/form-data')){
    const fd=await req.formData();
    const file=fd.get('file');
    if(!file||!file.arrayBuffer)return j({error:'NO_FILE_FIELD'},400);
    fileBuffer=await file.arrayBuffer();
  } else {
    fileBuffer=await req.arrayBuffer();
  }
  if(!fileBuffer||fileBuffer.byteLength<0x400)return j({error:'FILE_TOO_SMALL'},400);

  let parsed;
  try{parsed=parseTCBuffer(fileBuffer)}
  catch(e){return j({error:'PARSE_FAILED',detail:e.message},400)}

  return j({
    ok:true,
    magic:parsed.magic,
    metadata:parsed.metadata,
    parameters:parsed.parameters,
    paramUnits:parsed.paramUnits,
    units:parsed.units,
    recordCount:parsed.recordCount,
    stringCount:parsed.stringCount,
    records:parsed.records.slice(0,100),
    truncated:parsed.recordCount>100
  });
}

async function handleListRecordings(env,url){
  const limit=Math.min(parseInt(url.searchParams.get('limit')||'50',10),200);
  const rows=await env.DB.prepare(
    `SELECT id,file_name,file_size,magic,manufacturer,device_id,protocol,
            tc_session_id,parameter_count,record_count,timestamp_str,
            created_at FROM thinkdiag_recordings
     ORDER BY created_at DESC LIMIT ?`
  ).bind(limit).all();
  return j({ok:true,recordings:rows.results||[]});
}

async function handleGetRecording(env,recordingId){
  const rec=await env.DB.prepare(
    'SELECT * FROM thinkdiag_recordings WHERE id=?'
  ).bind(recordingId).first();
  if(!rec)return j({error:'NOT_FOUND'},404);

  // Get record data
  const dataRows=await env.DB.prepare(
    `SELECT record_index,data_json FROM thinkdiag_record_data
     WHERE recording_id=? ORDER BY record_index ASC LIMIT 500`
  ).bind(recordingId).all();

  return j({
    ok:true,
    recording:{
      ...rec,
      parameters:JSON.parse(rec.parameters_json||'[]'),
      units:JSON.parse(rec.units_json||'[]'),
      paramUnits:JSON.parse(rec.param_units_json||'[]'),
    },
    records:(dataRows.results||[]).map(r=>({
      index:r.record_index,
      data:JSON.parse(r.data_json||'{}')
    })),
    totalRecords:rec.record_count
  });
}

async function handleDeleteRecording(env,recordingId){
  const rec=await env.DB.prepare(
    'SELECT id FROM thinkdiag_recordings WHERE id=?'
  ).bind(recordingId).first();
  if(!rec)return j({error:'NOT_FOUND'},404);

  await env.DB.batch([
    env.DB.prepare('DELETE FROM thinkdiag_record_data WHERE recording_id=?').bind(recordingId),
    env.DB.prepare('DELETE FROM thinkdiag_recordings WHERE id=?').bind(recordingId)
  ]);
  return j({ok:true,deleted:recordingId});
}

async function handleExportCSV(env,recordingId){
  const rec=await env.DB.prepare(
    'SELECT * FROM thinkdiag_recordings WHERE id=?'
  ).bind(recordingId).first();
  if(!rec)return j({error:'NOT_FOUND'},404);

  const params=JSON.parse(rec.parameters_json||'[]');
  const paramU=JSON.parse(rec.param_units_json||'[]');
  const headers=uniqueHeaders(params);

  // Fetch all records
  const dataRows=await env.DB.prepare(
    `SELECT record_index,data_json FROM thinkdiag_record_data
     WHERE recording_id=? ORDER BY record_index ASC`
  ).bind(recordingId).all();
  const rows=dataRows.results||[];

  // Build CSV
  const lines=[];
  lines.push(`# ThinkCar TC Recording Export`);
  lines.push(`# File: ${rec.file_name}`);
  lines.push(`# Magic: ${rec.magic}`);
  lines.push(`# Manufacturer: ${rec.manufacturer}`);
  lines.push(`# Device: ${rec.device_id}`);
  lines.push(`# Protocol: ${rec.protocol}`);
  lines.push(`# Timestamp: ${rec.timestamp_str}`);
  lines.push(`# Parameters: ${params.length}`);
  lines.push(`# Records: ${rec.record_count}`);
  lines.push('#');

  // Header row
  lines.push('Record,'+headers.map(h=>csvEsc(h)).join(','));
  // Unit row
  lines.push('Unit,'+paramU.map(u=>csvEsc(u)).join(','));

  // Data rows
  for(const row of rows){
    const data=JSON.parse(row.data_json||'{}');
    const vals=params.map(p=>csvEsc(data[p]||''));
    lines.push(row.record_index+','+vals.join(','));
  }

  return new Response(lines.join('\n'),{
    status:200,
    headers:{
      'content-type':'text/csv; charset=utf-8',
      'content-disposition':`attachment; filename="${rec.file_name.replace(/\.tc$/i,'')}_export.csv"`
    }
  });
}

function csvEsc(v){
  const s=String(v||'');
  if(s.includes(',')||s.includes('"')||s.includes('\n'))return '"'+s.replace(/"/g,'""')+'"';
  return s;
}

async function handleAnalyze(env,recordingId){
  const rec=await env.DB.prepare(
    'SELECT * FROM thinkdiag_recordings WHERE id=?'
  ).bind(recordingId).first();
  if(!rec)return j({error:'NOT_FOUND'},404);

  const params=JSON.parse(rec.parameters_json||'[]');
  const paramU=JSON.parse(rec.param_units_json||'[]');

  // Fetch all records for analysis
  const dataRows=await env.DB.prepare(
    `SELECT data_json FROM thinkdiag_record_data
     WHERE recording_id=? ORDER BY record_index ASC`
  ).bind(recordingId).all();
  const records=(dataRows.results||[]).map(r=>JSON.parse(r.data_json||'{}'));

  // Compute per-parameter statistics
  const stats=params.map((p,i)=>{
    const vals=records.map(r=>{
      const v=r[p];
      const n=parseFloat(v);
      return isNaN(n)?null:n;
    }).filter(v=>v!==null);

    if(!vals.length)return {parameter:p,unit:paramU[i]||'',type:'text',samples:records.length};

    const min=Math.min(...vals);
    const max=Math.max(...vals);
    const avg=vals.reduce((a,b)=>a+b,0)/vals.length;
    const sorted=[...vals].sort((a,b)=>a-b);
    const median=sorted.length%2===0
      ?(sorted[sorted.length/2-1]+sorted[sorted.length/2])/2
      :sorted[Math.floor(sorted.length/2)];

    return {
      parameter:p,unit:paramU[i]||'',type:'numeric',
      samples:vals.length,min,max,avg:Math.round(avg*100)/100,
      median:Math.round(median*100)/100,
      range:Math.round((max-min)*100)/100
    };
  });

  return j({
    ok:true,
    recordingId,
    fileName:rec.file_name,
    manufacturer:rec.manufacturer,
    protocol:rec.protocol,
    recordCount:rec.record_count,
    parameterCount:params.length,
    statistics:stats
  });
}

// ─── Link to OBD Session ─────────────────────────────────────────
async function handleLinkOBD(req,env,recordingId){
  const b=await req.json().catch(()=>({}));
  const sessionId=b.sessionId;
  if(!sessionId)return j({error:'MISSING_SESSION_ID'},400);

  // Verify both exist
  const rec=await env.DB.prepare('SELECT id FROM thinkdiag_recordings WHERE id=?').bind(recordingId).first();
  if(!rec)return j({error:'RECORDING_NOT_FOUND'},404);
  const sess=await env.DB.prepare('SELECT id FROM obd_sessions WHERE id=?').bind(sessionId).first();
  if(!sess)return j({error:'SESSION_NOT_FOUND'},404);

  await env.DB.prepare(
    'UPDATE thinkdiag_recordings SET linked_obd_session=?, updated_at=? WHERE id=?'
  ).bind(sessionId,now(),recordingId).run();

  return j({ok:true,recordingId,linkedTo:sessionId});
}

// ─── Router ──────────────────────────────────────────────────────
export async function thinkdiagRouter(request,env,path,method){
  const url=new URL(request.url);

  // POST /api/ecu/thinkdiag/import — upload and parse TC file
  if(path==='/api/ecu/thinkdiag/import'&&method==='POST')
    return handleImport(request,env);

  // POST /api/ecu/thinkdiag/decode — parse without storing
  if(path==='/api/ecu/thinkdiag/decode'&&method==='POST')
    return handleDecode(request,env);

  // GET /api/ecu/thinkdiag/recordings — list stored recordings
  if(path==='/api/ecu/thinkdiag/recordings'&&method==='GET')
    return handleListRecordings(env,url);

  // Recording-specific routes
  const recMatch=path.match(/^\/api\/ecu\/thinkdiag\/recordings\/([a-f0-9]+)$/);
  if(recMatch){
    const recId=recMatch[1];
    if(method==='GET')return handleGetRecording(env,recId);
    if(method==='DELETE')return handleDeleteRecording(env,recId);
  }

  // GET /api/ecu/thinkdiag/recordings/:id/csv — export as CSV
  const csvMatch=path.match(/^\/api\/ecu\/thinkdiag\/recordings\/([a-f0-9]+)\/csv$/);
  if(csvMatch&&method==='GET')return handleExportCSV(env,csvMatch[1]);

  // GET /api/ecu/thinkdiag/recordings/:id/analyze — statistical analysis
  const analyzeMatch=path.match(/^\/api\/ecu\/thinkdiag\/recordings\/([a-f0-9]+)\/analyze$/);
  if(analyzeMatch&&method==='GET')return handleAnalyze(env,analyzeMatch[1]);

  // POST /api/ecu/thinkdiag/recordings/:id/link-obd — link to OBD session
  const linkMatch=path.match(/^\/api\/ecu\/thinkdiag\/recordings\/([a-f0-9]+)\/link-obd$/);
  if(linkMatch&&method==='POST')return handleLinkOBD(request,env,linkMatch[1]);

  // GET /api/ecu/thinkdiag/format — format documentation
  if(path==='/api/ecu/thinkdiag/format'&&method==='GET'){
    return j({
      format:'ThinkCar TC',
      magicBytes:['LSX8','LSX9'],
      description:'Binary diagnostic log format from ThinkDiag, ThinkScan, ThinkTool devices and reseller apps (Kingbolen eDiag, Topdon)',
      structure:{
        header:'4-byte magic + metadata offsets',
        stringTable:'1-based indexed string storage (uint16 length + UTF-8 + null terminator)',
        metadata:'strings[1..8]: language, timestamp, region, version, manufacturer, device_id, protocol, session_id',
        parameters:'Record-width array of uint16 string indices',
        unitTable:'Parallel array of uint16 string indices for units',
        records:'Each record = parameter_count × uint32 string-table indices'
      },
      supportedDevices:['ThinkDiag','ThinkDiag+','ThinkDiag 2','ThinkScan Max','ThinkScan Max 2','ThinkTool','Kingbolen eDiag','Topdon ArtiDiag'],
      endpoints:{
        import:'POST /api/ecu/thinkdiag/import (multipart/form-data, field: file)',
        decode:'POST /api/ecu/thinkdiag/decode (parse without storing)',
        list:'GET /api/ecu/thinkdiag/recordings',
        get:'GET /api/ecu/thinkdiag/recordings/:id',
        csv:'GET /api/ecu/thinkdiag/recordings/:id/csv',
        analyze:'GET /api/ecu/thinkdiag/recordings/:id/analyze',
        linkObd:'POST /api/ecu/thinkdiag/recordings/:id/link-obd',
        delete:'DELETE /api/ecu/thinkdiag/recordings/:id'
      }
    });
  }

  return null;
}
