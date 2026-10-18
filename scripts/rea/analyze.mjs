import crypto from 'node:crypto';

const SENSITIVE=/\b(password|secret|token|authorization|api[_-]?key|cookie|session[_-]?id)\b/i;
const CONTROL=/\b(delete|purchase|payment|unlock|disable|flash|deploy|send|factory reset)\b/i;
export function analyzeTarget(input) {
  if (!input || typeof input !== 'object') throw new TypeError('Target object required');
  const {name,platform='web',authorization,observations=[]}=input;
  if (!name || typeof name !== 'string') throw new TypeError('Target name required');
  if (!authorization || authorization.approved !== true || !authorization.scope) throw new Error('Authorized scope required');
  if (!Array.isArray(observations)) throw new TypeError('Observations must be an array');
  const evidence=observations.map((item,index)=>{
    if (!item || typeof item !== 'object' || !item.source || !item.description) throw new TypeError('Evidence source and description required');
    const description=String(item.description).slice(0,2000);
    const source=String(item.source).slice(0,500);
    return {id:'e'+(index+1),source,description:SENSITIVE.test(description)?'[redacted: possible credential or secret]':description,confidence:item.confidence==='verified'?'verified':'unverified'};
  });
  const features=evidence.filter(x=>!CONTROL.test(x.description)).map(x=>({name:x.description.slice(0,100),evidence:[x.id],status:x.confidence}));
  const unknowns=evidence.filter(x=>x.confidence!=='verified').map(x=>x.id);
  const fingerprint=crypto.createHash('sha256').update(JSON.stringify({name,platform,evidence})).digest('hex');
  return {schema_version:1,target:{name,platform},scope:authorization.scope,analysis_id:fingerprint.slice(0,20),evidence,features,unknowns,implementation:{mode:'original-clean-room',device_driver:'mock-until-verified',live_connection:false},next_steps:['Identify documented APIs and supported protocols','Create original UI and mock adapter','Test with explicit authorization and actual device']};
}
export function generateAppStarter(analysis) {
  if (!analysis?.analysis_id || analysis?.implementation?.mode!=='original-clean-room') throw new TypeError('Valid analysis required');
  return {
    'package.json':JSON.stringify({name:'original-device-app',private:true,type:'module',scripts:{start:'node server.mjs'}},null,2),
    'server.mjs':`import http from 'node:http';\nconst port=Number(process.env.PORT||3000);\nconst state={connected:false,mode:'mock',features:${JSON.stringify(analysis.features.map(x=>x.name))}};\nhttp.createServer((req,res)=>{res.setHeader('content-type','application/json');res.setHeader('cache-control','no-store');if(req.method!=='GET'){res.writeHead(405);return res.end(JSON.stringify({error:'read-only mock'}))}res.end(JSON.stringify(state))}).listen(port,'127.0.0.1');\n`,
    'analysis.json':JSON.stringify(analysis,null,2)
  };
}
