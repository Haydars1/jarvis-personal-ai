import { decodeEcuFile, ecuFileError, isBinaryAttachment } from '../../lib/ecu-file.js';
function json(payload,status=200){
  return new Response(JSON.stringify(payload),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
}
const now=()=>Date.now();
const uid=()=>crypto.randomUUID();

async function readJson(req){try{return await req.clone().json();}catch{return {}}}
function likeTerm(q=''){return `%${String(q).trim().toLowerCase().replace(/[%_]/g,'')}%`}
async function channelRow(env,id){
  if(!id)return null;
  return env.DB.prepare('SELECT id,title,file_name,file_sha256,file_size,identity_text,created_at,updated_at FROM ecu_chat_channels WHERE id=?').bind(id).first();
}

async function ensureChannel(env,{channelId,title,file}){
  const ts=now();
  let id=String(channelId||'').trim();
  let hash='';
  const bytes=file?decodeEcuFile(file.base64):null;
  if(bytes){
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    hash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
  }

  let existing=id?await channelRow(env,id):null;
  if(!id&&hash){
    const matched=await env.DB.prepare('SELECT id FROM ecu_chat_channels WHERE file_sha256=? ORDER BY updated_at DESC LIMIT 1').bind(hash).first();
    if(matched?.id){
      id=matched.id;
      existing=await channelRow(env,id);
    }
  }
  if(!id)id=uid();

  const suppliedTitle=String(title||'').trim();
  const fileName=String(file?.name||existing?.file_name||'');
  const fileSize=bytes?.length||Number(existing?.file_size||0);
  const fileHash=hash||String(existing?.file_sha256||'');
  const identityText=String(existing?.identity_text||'');
  const channelTitle=String(suppliedTitle||existing?.title||fileName||'ECU Sohbeti').slice(0,180);
  const createdAt=Number(existing?.created_at||ts);

  await env.DB.prepare(`INSERT INTO ecu_chat_channels(id,title,file_name,file_sha256,file_size,identity_text,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      title=CASE WHEN excluded.title<>'' THEN excluded.title ELSE ecu_chat_channels.title END,
      file_name=CASE WHEN excluded.file_name<>'' THEN excluded.file_name ELSE ecu_chat_channels.file_name END,
      file_sha256=CASE WHEN excluded.file_sha256<>'' THEN excluded.file_sha256 ELSE ecu_chat_channels.file_sha256 END,
      file_size=CASE WHEN excluded.file_size>0 THEN excluded.file_size ELSE ecu_chat_channels.file_size END,
      identity_text=CASE WHEN excluded.identity_text<>'' THEN excluded.identity_text ELSE ecu_chat_channels.identity_text END,
      updated_at=excluded.updated_at`)
    .bind(id,channelTitle,fileName,fileHash,fileSize,identityText,createdAt,ts).run();

  const current=await channelRow(env,id);
  return {
    id,
    hash:String(current?.file_sha256||fileHash),
    fileName:String(current?.file_name||fileName),
    fileSize:Number(current?.file_size||fileSize||0),
    title:String(current?.title||channelTitle),
    identityText:String(current?.identity_text||identityText)
  };
}

async function saveMessage(env,channelId,role,content,provider=null,createdAt=now()){
  if(!channelId||!content)return;
  await env.DB.prepare('INSERT INTO ecu_chat_messages(id,channel_id,role,content,provider,created_at) VALUES(?,?,?,?,?,?)')
    .bind(uid(),channelId,role,String(content),provider,createdAt).run();
  await env.DB.prepare('UPDATE ecu_chat_channels SET updated_at=? WHERE id=?').bind(createdAt,channelId).run();
}

async function listChannels(env,q=''){
  const term=String(q||'').trim();
  if(!term){
    const rows=(await env.DB.prepare(`SELECT c.id,c.title,c.file_name,c.file_sha256,c.file_size,c.identity_text,c.created_at,c.updated_at,
      (SELECT content FROM ecu_chat_messages m WHERE m.channel_id=c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message
      FROM ecu_chat_channels c ORDER BY c.updated_at DESC LIMIT 200`).all()).results||[];
    return rows;
  }
  const like=likeTerm(term);
  const rows=(await env.DB.prepare(`SELECT DISTINCT c.id,c.title,c.file_name,c.file_sha256,c.file_size,c.identity_text,c.created_at,c.updated_at,
      (SELECT content FROM ecu_chat_messages m2 WHERE m2.channel_id=c.id AND lower(m2.content) LIKE ? ORDER BY m2.created_at DESC LIMIT 1) AS match_message,
      (SELECT content FROM ecu_chat_messages m3 WHERE m3.channel_id=c.id ORDER BY m3.created_at DESC LIMIT 1) AS last_message
      FROM ecu_chat_channels c
      LEFT JOIN ecu_chat_messages m ON m.channel_id=c.id
      WHERE lower(c.title) LIKE ? OR lower(c.file_name) LIKE ? OR lower(c.file_sha256) LIKE ? OR lower(c.identity_text) LIKE ? OR lower(m.content) LIKE ?
      ORDER BY c.updated_at DESC LIMIT 200`).bind(like,like,like,like,like,like).all()).results||[];
  return rows;
}

async function messages(env,id){
  return (await env.DB.prepare('SELECT role,content,provider,created_at FROM (SELECT rowid AS sequence,role,content,provider,created_at FROM ecu_chat_messages WHERE channel_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1000) ORDER BY created_at ASC,sequence ASC').bind(id).all()).results||[];
}

async function renameChannel(env,id,title){
  await env.DB.prepare('UPDATE ecu_chat_channels SET title=?,updated_at=? WHERE id=?').bind(String(title||'').slice(0,180),now(),id).run();
}

export function createEcuChannelStore(core){
  if(!core?.fetch)throw new Error('ECU_CHANNEL_CORE_REQUIRED');
  return {
    async fetch(req,env,ctx){
      const url=new URL(req.url);

      if(url.pathname==='/api/ecu/channels'&&req.method==='GET'){
        return json({channels:await listChannels(env,url.searchParams.get('q')||'')});
      }
      if(url.pathname==='/api/ecu/channels'&&req.method==='POST'){
        const body=await readJson(req);
        const channel=await ensureChannel(env,{channelId:body.id,title:body.title,file:null});
        return json({channel});
      }
      const msgMatch=url.pathname.match(/^\/api\/ecu\/channels\/([^/]+)\/messages$/);
      if(msgMatch&&req.method==='GET'){
        const id=decodeURIComponent(msgMatch[1]);
        return json({messages:await messages(env,id)});
      }
      const channelMatch=url.pathname.match(/^\/api\/ecu\/channels\/([^/]+)$/);
      if(channelMatch&&req.method==='PATCH'){
        const id=decodeURIComponent(channelMatch[1]),body=await readJson(req);
        await renameChannel(env,id,body.title||'');
        return json({ok:true});
      }

      if(url.pathname==='/api/chat/send'&&req.method==='POST'){
        const body=await readJson(req);
        if(String(body?.channel||'').toLowerCase()!=='ecu')return core.fetch(req,env,ctx);

        const files=(Array.isArray(body.attachments)?body.attachments:[]);
        const primary=files.find(isBinaryAttachment)||null;
        let channel;
        try { channel=await ensureChannel(env,{
          channelId:body.channelId||body.threadId,
          title:body.channelTitle,
          file:primary
        }); } catch(error) {
          if(String(error?.message||'').startsWith('ECU_FILE_'))return json({reply:ecuFileError(error),error:error.message},400);
          throw error;
        }

        const text=String(body.text||'').trim();
        const userVisible=primary?`${text}\n📎 ${files.map(x=>x.name).join(', ')}`:text;
        await saveMessage(env,channel.id,'user',userVisible,null,now());

        const ecuContext=channel.fileName?{
          channelId:channel.id,
          fileName:channel.fileName,
          fileSize:channel.fileSize,
          sha256:channel.hash,
          identityText:channel.identityText
        }:undefined;
        const forwardedBody={...body,channelId:channel.id,...(ecuContext?{ecuContext}:{})};
        const forwarded=new Request(req,{body:JSON.stringify(forwardedBody)});
        const response=await core.fetch(forwarded,env,ctx);
        let payload=null;
        try{payload=await response.clone().json();}catch{}
        if(payload?.reply){
          await saveMessage(env,channel.id,'assistant',payload.reply,payload.provider||'JARVIS ECU Brain',now());
          payload.channelId=channel.id;
          payload.channel={id:channel.id,title:channel.title,file_name:channel.fileName,file_sha256:channel.hash,file_size:channel.fileSize};
          payload.history=await messages(env,channel.id);
          return json(payload,response.status);
        }
        return response;
      }

      return core.fetch(req,env,ctx);
    },
    scheduled(event,env,ctx){return core.scheduled?.(event,env,ctx);}
  };
}
