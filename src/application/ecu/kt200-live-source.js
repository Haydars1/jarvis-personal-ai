// Read-only, on-demand check of the publicly published KT200 II support table.
// This does not depend on undocumented vendor APIs or scrape full lists into our database.
export const KT200_LIVE_URL = 'https://kt200ii.com/support-list/';
const MAX_HTML = 4_000_000;
function clean(text) {
  return String(text || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g,' ')
    .replace(/&nbsp;|&#160;/gi,' ')
    .replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
    .replace(/&quot;|&#34;/gi,'"').replace(/&#39;|&apos;/gi,"'")
    .replace(/\s+/g,' ').trim().slice(0,250);
}
export function classifyKt200Connection(value) {
  const raw = String(value || '').toUpperCase();
  const methods = ['OBD','BENCH','BOOT','JTAG','BDM'].filter(m => new RegExp('\\b' + m + '\\b').test(raw));
  let access = 'UNKNOWN';
  if (/\bVR\s*\/\s*W\b|VIRTUAL\s*READ/i.test(raw)) access = 'VIRTUAL_READ_AND_WRITE';
  else if (/\bR\s*\/\s*W\b/i.test(raw)) access = 'READ_WRITE_LISTED';
  else if (/\bR\b/.test(raw) && !/\bW\b/.test(raw)) access = 'READ_LISTED';
  else if (/\bW\b/.test(raw) && !/\bR\b/.test(raw)) access = 'WRITE_ONLY_LISTED';
  return { methods, access, source_text: String(value || '').slice(0,160) };
}
export function parseKt200HtmlRows(html) {
  const results=[];
  if (String(html).length > MAX_HTML) throw Error('VENDOR_RESPONSE_TOO_LARGE');
  const rows=String(html).match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || [];
  for(const htmlRow of rows.slice(0,10000)) {
    const td=[...htmlRow.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(match=>clean(match[1]));
    if(td.length < 9 || !/^(ECU|TCU)$/i.test(td[0]))continue;
    const [category,brand,vehicle_type,model,engine,ecu_manufacturer,ecu_type,micro,connection,source]=td;
    results.push({category,brand,vehicle_type,model,engine,ecu_manufacturer,ecu_type,micro,connection,
      ...classifyKt200Connection(connection),source_url:KT200_LIVE_URL, source_kind:'LIVE_VENDOR_TABLE',source_column:source||''});
  }
  return results;
}
function equalish(a,b) {return String(a||'').toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g,'');}
function words(value){return String(value||'').toLocaleLowerCase('en-US').match(/[\p{L}0-9]+/gu)||[];}
function includesField(value,want) {
  if (!want) return true;
  const v=equalish(value),w=equalish(want);
  if (!v || v==='all')return true;
  return v.includes(w) || w.includes(v);
}
export function filterKt200Rows(rows,params={}) {
  const brand=equalish(params.brand)==='vw'?'volkswagen':params.brand;
  const ecu=equalish(params.ecu_type);
  return rows.filter(row=>{
    if(row.category !== 'ECU')return false;
    if(brand && !includesField(row.brand,brand))return false;
    if(params.model && !includesField(row.model,params.model))return false;
    if(params.engine && !includesField(row.engine,params.engine)){
      // Manufacturer often lists engine abbreviations rather than full user input.
      if(!words(params.engine).some(w=>w.length>=3 && words(row.engine).includes(w)))return false;
    }
    if(ecu && !equalish(row.ecu_type).includes(ecu))return false;
    return true;
  }).slice(0,40);
}
export async function checkKt200Live(params, fetcher=fetch) {
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),5000);
  try{
    const response=await fetcher(KT200_LIVE_URL,{
      headers:{accept:'text/html'},signal:controller.signal,redirect:'follow'
    });
    if(!response.ok)return {status:'VENDOR_HTTP_ERROR',results:[],source_url:KT200_LIVE_URL};
    const length=Number(response.headers.get('content-length')||0);
    if(length > MAX_HTML)return {status:'VENDOR_RESPONSE_TOO_LARGE',results:[],source_url:KT200_LIVE_URL};
    const html=await response.text();
    const records=parseKt200HtmlRows(html);
    if(!records.length)return {status:'VENDOR_TABLE_NOT_MACHINE_READABLE',results:[],source_url:KT200_LIVE_URL,
      note:'Site tabloyu JavaScript ile gösteriyor olabilir; kayıtları API olarak sunduğu doğrulanmadı.'};
    return {
      status:'LIVE_VENDOR_TABLE_PARTIAL_VIEW',results:filterKt200Rows(records,params),rows_on_page:records.length,
      source_url:KT200_LIVE_URL,
      note:'Sayfada gelen kayıtlar tarandı. Sitenin tüm protokol veri kümesinin alındığı anlamına gelmez.'
    };
  }catch(error) {
    return {status:'VENDOR_UNAVAILABLE',results:[],source_url:KT200_LIVE_URL,
      error:String(error?.name||'FETCH_FAILED').slice(0,50)};
  } finally{clearTimeout(timeout);}
}
