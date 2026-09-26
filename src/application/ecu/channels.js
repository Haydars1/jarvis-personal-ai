function json(payload,status=200){
  return new Response(JSON.stringify(payload),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
}
const now=()=>Date.now();
const uid=()=>crypto.randomUUID();

async function readJson(req){try{return await req.clone().json();}catch{return {}}}
function likeTerm(q=''){return `%${String(q).trim().toLowerCase().replace(/[%_]/g,'')}%`}

async function sha256Base64(value=''){
  if(!value)return '';
  const raw=atob(String(value));
  const bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  const d=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('');
}

async function ensureChannel(env,{channelId,title,file}){
  const ts=now();
  let id=String(channelId||'').trim();
  let hash='';
  if(file?.base64)hash=await sha256Base64(file.base64);
  if(!id&&hash){
    const existing=await env.DB.prepare('SELECT id FROM ecu_chat_channels WHERE file_sha256=? ORDER BY updated_at DESC LIMIT 1').bind(hash).first();
    if(existing?.id)id=existing.id;
  }
  if(!id)id=uid();
  const fileName=String(file?.name||'');
  const fileSize=file?.base64?Math.floor(String(file.base64).length*3/4):0;
  const channelTitle=String(title||fileName||'ECU Sohbeti').slice(0,180);
  await env.DB.prepare(`INSERT INTO ecu_chat_channels(id,title,file_name,file_sha256,file_size,identity_text,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      title=CASE WHEN excluded.title<>'' THEN excluded.title ELSE ecu_chat_channels.title END,
      file_name=CASE WHEN excluded.file_name<>'' THEN excluded.file_name ELSE ecu_chat_channels.file_name END,
      file_sha256=CASE WHEN excluded.file_sha256<>'' THEN excluded.file_sha256 ELSE ecu_chat_channels.file_sha256 END,
      file_size=CASE WHEN excluded.file_size>0 THEN excluded.file_size ELSE ecu_chat_channels.file_size END,
      updated_at=excluded.updated_at`)
    .bind(id,channelTitle,fileName,hash,fileSize,'',ts,ts).run();
  return {id,hash,fileName,title:channelTitle};
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
  return (await env.DB.prepare('SELECT role,content,provider,created_at FROM ecu_chat_messages WHERE channel_id=? ORDER BY created_at ASC LIMIT 1000').bind(id).all()).results||[];
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
        const primary=files[0]||null;
        const channel=await ensureChannel(env,{
          channelId:body.channelId||body.threadId,
          title:body.channelTitle,
          file:primary
        });

        const text=String(body.text||'').trim();
        const userVisible=primary?`${text}\n📎 ${files.map(x=>x.name).join(', ')}`:text;
        await saveMessage(env,channel.id,'user',userVisible,null,now());

        const forwarded=new Request(req,{body:JSON.stringify({...body,channelId:channel.id})});
        const response=await core.fetch(forwarded,env,ctx);
        let payload=null;
        try{payload=await response.clone().json();}catch{}
        if(payload?.reply){
          await saveMessage(env,channel.id,'assistant',payload.reply,payload.provider||'JARVIS ECU Brain',now());
          payload.channelId=channel.id;
          payload.channel={id:channel.id,title:channel.title,file_name:channel.fileName,file_sha256:channel.hash};
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
