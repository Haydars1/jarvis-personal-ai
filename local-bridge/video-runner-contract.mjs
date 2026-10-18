import {createHmac,timingSafeEqual} from 'node:crypto';

function signature(secret,payload){return createHmac('sha256',secret).update(payload).digest('hex')}
export function createVideoJob(input,{secret,runnerUrl}={}){
  if(!secret||!runnerUrl)throw new Error('Runner configuration missing');
  if(!/^https:\/\//.test(runnerUrl))throw new Error('HTTPS runner URL required');
  const topic=String(input?.topic??'').trim();
  if(!topic||topic.length>500)throw new TypeError('Topic must be 1-500 characters');
  const aspect=input.aspect??'9:16';
  if(!['9:16','16:9','1:1'].includes(aspect))throw new TypeError('Unsupported aspect');
  const language=String(input.language??'tr').slice(0,12);
  const duration=Math.min(180,Math.max(10,Number(input.duration??30)));
  if(!Number.isFinite(duration))throw new TypeError('Invalid duration');
  const payload=JSON.stringify({topic,aspect,language,duration,auto_publish:false,allow_paid_services:false});
  return {url:new URL('/jobs',runnerUrl).toString(),method:'POST',headers:{'content-type':'application/json','x-jarvis-signature':'sha256='+signature(secret,payload)},body:payload};
}
export function verifyVideoJobSignature(secret,payload,header){
  if(!secret||typeof payload!=='string'||typeof header!=='string'||!/^sha256=[a-f0-9]{64}$/.test(header))return false;
  const expected=Buffer.from(signature(secret,payload),'hex'),actual=Buffer.from(header.slice(7),'hex');
  return timingSafeEqual(expected,actual);
}
