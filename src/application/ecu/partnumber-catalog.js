import { execute, jsonResponse, queryAll, queryOne } from '../../lib/runtime.js';
// Isolated opt-in module. Never modifies ECU binary, tuning, coding, or other tables.
export const CATALOG_GROUPS = Object.freeze(['bosch','ford','mazda','vag','peugeot','citroen','man']);
export const CATALOG_SOURCE = 'https://www.controlunits.info/partnumbers/';
const MAX_BATCH = 200;
export function normalizePartNumber(value) {
  return String(value ?? '').normalize('NFKC').trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,80);
}
export function normalizeCatalogRecord(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('INVALID_RECORD');
  const group=String(input.group || input.category || '').trim().toLowerCase();
  if (!CATALOG_GROUPS.includes(group)) throw Error('INVALID_GROUP');
  const part_number=String(input.part_number ?? input.partNumber ?? input.number ?? '').trim().slice(0,100);
  const normalized=normalizePartNumber(part_number);
  if(normalized.length<4)throw Error('INVALID_PART_NUMBER');
  const get=(...keys)=>String(keys.map(k=>input[k]).find(x=>x!=null)??'').trim().slice(0,500);
  const source_url=get('source_url','sourceUrl');
  if(source_url){try{const u=new URL(source_url);if(!['https:','http:'].includes(u.protocol))throw Error();}catch{throw Error('INVALID_SOURCE_URL');}}
  return {id:group+':'+normalized,group,part_number,normalized,ecu_type:get('ecu_type','ecuType'),manufacturer:get('manufacturer'),brand:get('brand'),model:get('model'),engine:get('engine'),software_part_number:get('software_part_number','softwarePartNumber'),software_version:get('software_version','softwareVersion'),description:get('description'),source_url,notes:get('notes')};
}
async function ensureSchema(env){
  await execute(env,"CREATE TABLE IF NOT EXISTS ecu_part_catalog (id TEXT PRIMARY KEY,group_name TEXT NOT NULL,part_number TEXT NOT NULL,normalized_number TEXT NOT NULL,ecu_type TEXT NOT NULL DEFAULT '',manufacturer TEXT NOT NULL DEFAULT '',brand TEXT NOT NULL DEFAULT '',model TEXT NOT NULL DEFAULT '',engine TEXT NOT NULL DEFAULT '',software_part_number TEXT NOT NULL DEFAULT '',software_version TEXT NOT NULL DEFAULT '',description TEXT NOT NULL DEFAULT '',source_url TEXT NOT NULL DEFAULT '',notes TEXT NOT NULL DEFAULT '',rights_basis TEXT NOT NULL,imported_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)");
  await execute(env,'CREATE INDEX IF NOT EXISTS ecu_part_catalog_number_idx ON ecu_part_catalog(normalized_number)');
  await execute(env,'CREATE INDEX IF NOT EXISTS ecu_part_catalog_group_idx ON ecu_part_catalog(group_name,normalized_number)');
}
async function authenticated(core,req,env,ctx){
  const status=await core.fetch(new Request(new URL('/api/auth/status',req.url),{headers:req.headers}),env,ctx);
  if(!status.ok)return false;
  try{return (await status.json()).authenticated===true;}catch{return false;}
}
const error=(message,status=400)=>jsonResponse({ok:false,error:message},status);
export function createEcuPartnumberCatalog(core){
  if(!core?.fetch)throw Error('ECU_PARTNUMBER_CORE_REQUIRED');
  return {
    async fetch(req,env,ctx){
      const url=new URL(req.url),path=url.pathname,method=req.method;
      if(!path.startsWith('/api/ecu/partnumbers/'))return core.fetch(req,env,ctx);
      if(!(await authenticated(core,req,env,ctx)))return error('AUTH_REQUIRED',401);
      if(!env.DB)return error('D1_NOT_BOUND',503);
      try{
        await ensureSchema(env);
        if(path==='/api/ecu/partnumbers/stats'&&method==='GET'){
          const total=await queryOne(env,'SELECT COUNT(*) AS total FROM ecu_part_catalog');
          const groups=await queryAll(env,'SELECT group_name AS "group", COUNT(*) AS count FROM ecu_part_catalog GROUP BY group_name ORDER BY group_name');
          return jsonResponse({ok:true,total:Number(total?.total||0),groups,source:CATALOG_SOURCE,available_groups:CATALOG_GROUPS,licensed_import_only:true});
        }
        if(path==='/api/ecu/partnumbers/search'&&method==='GET'){
          const query=normalizePartNumber(url.searchParams.get('q')||'');
          const group=String(url.searchParams.get('group')||'').toLowerCase();
          if(group&&!CATALOG_GROUPS.includes(group))return error('INVALID_GROUP');
          const limit=Math.max(1,Math.min(100,Number(url.searchParams.get('limit')||40)||40));
          if(!query&&!group)return jsonResponse({ok:true,results:[],message:'ENTER_QUERY_OR_GROUP'});
          const clauses=[],values=[];
          if(group){clauses.push('group_name=?');values.push(group);}
          if(query){clauses.push('(normalized_number LIKE ? OR UPPER(ecu_type) LIKE ? OR UPPER(manufacturer) LIKE ? OR UPPER(brand) LIKE ? OR UPPER(model) LIKE ? OR UPPER(engine) LIKE ?)');values.push(query+'%',...Array(5).fill('%'+query+'%'));}
          const sql='SELECT id,group_name AS "group",part_number,ecu_type,manufacturer,brand,model,engine,software_part_number,software_version,description,source_url,notes FROM ecu_part_catalog WHERE '+clauses.join(' AND ')+' ORDER BY CASE WHEN normalized_number=? THEN 0 WHEN normalized_number LIKE ? THEN 1 ELSE 2 END,part_number LIMIT ?';
          const results=await queryAll(env,sql,...values,query,query+'%',limit);
          return jsonResponse({ok:true,results,query,group});
        }
        if(path==='/api/ecu/partnumbers/import'&&method==='POST'){
          const size=Number(req.headers.get('content-length')||0);
          if(size>900000)return error('IMPORT_TOO_LARGE',413);
          const raw=await req.text();
          if(raw.length>900000)return error('IMPORT_TOO_LARGE',413);
          let payload;try{payload=JSON.parse(raw);}catch{return error('INVALID_JSON');}
          if(payload?.authorized!==true||!String(payload?.rights_basis||'').trim())return error('IMPORT_REQUIRES_RIGHTS_CONFIRMATION',403);
          if(!Array.isArray(payload.records)||payload.records.length<1||payload.records.length>MAX_BATCH)return error('INVALID_BATCH_SIZE');
          let records;try{records=payload.records.map(normalizeCatalogRecord);}catch(e){return error(e.message);}
          const rights=String(payload.rights_basis).trim().slice(0,300),ts=Date.now();
          const sql="INSERT INTO ecu_part_catalog(id,group_name,part_number,normalized_number,ecu_type,manufacturer,brand,model,engine,software_part_number,software_version,description,source_url,notes,rights_basis,imported_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET part_number=excluded.part_number,ecu_type=excluded.ecu_type,manufacturer=excluded.manufacturer,brand=excluded.brand,model=excluded.model,engine=excluded.engine,software_part_number=excluded.software_part_number,software_version=excluded.software_version,description=excluded.description,source_url=excluded.source_url,notes=excluded.notes,rights_basis=excluded.rights_basis,updated_at=excluded.updated_at";
          const batch=records.map(r=>env.DB.prepare(sql).bind(r.id,r.group,r.part_number,r.normalized,r.ecu_type,r.manufacturer,r.brand,r.model,r.engine,r.software_part_number,r.software_version,r.description,r.source_url,r.notes,rights,ts,ts));
          await env.DB.batch(batch);
          const total=await queryOne(env,'SELECT COUNT(*) AS n FROM ecu_part_catalog');
          return jsonResponse({ok:true,imported:records.length,total:Number(total?.n||0)});
        }
        return error('NOT_FOUND',404);
      }catch(e){return error('CATALOG_DATABASE_ERROR:'+String(e.message||e).slice(0,150),500);}
    },
    scheduled(event,env,ctx){return core.scheduled?.(event,env,ctx);}
  };
}
