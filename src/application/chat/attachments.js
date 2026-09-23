const te = new TextEncoder();
const td = new TextDecoder();

function jsonCloneRequest(req, payload) {
  const headers = new Headers(req.headers);
  headers.set('content-type', 'application/json');
  return new Request(req.url, {
    method: req.method,
    headers,
    body: JSON.stringify(payload),
  });
}

function decodeBase64(value='') {
  const raw=atob(String(value||''));
  const out=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++) out[i]=raw.charCodeAt(i);
  return out;
}

function hex(bytes) {
  return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
}

async function sha256(bytes) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
}

function safeName(value='file') {
  return String(value||'file').replace(/[\\/\0]/g,'_').slice(0,180)||'file';
}

function isTextLike(type='',name='') {
  const t=String(type).toLowerCase(), n=String(name).toLowerCase();
  return t.startsWith('text/') || /json|xml|javascript|yaml|csv|markdown/.test(t) || /\.(txt|md|json|csv|xml|yaml|yml|js|ts|tsx|jsx|css|html|ini|log|sql)$/i.test(n);
}

function textPreview(bytes,max=12000) {
  try {
    const text=td.decode(bytes.slice(0,max));
    const printable=[...text].filter(ch=>ch==='\n'||ch==='\r'||ch==='\t'||ch.charCodeAt(0)>=32).length;
    if(!text.length || printable/text.length<0.8) return '';
    return text.slice(0,max);
  } catch { return ''; }
}

function binaryDiff(a,b) {
  if(!a||!b) return null;
  const max=Math.max(a.bytes.length,b.bytes.length);
  let changed=0,start=-1,ranges=[];
  for(let i=0;i<max;i++){
    const av=i<a.bytes.length?a.bytes[i]:null,bv=i<b.bytes.length?b.bytes[i]:null;
    if(av!==bv){
      changed++;
      if(start<0)start=i;
    } else if(start>=0){
      ranges.push([start,i-1]); start=-1;
    }
  }
  if(start>=0) ranges.push([start,max-1]);
  return {
    sameSize:a.bytes.length===b.bytes.length,
    sizeA:a.bytes.length,sizeB:b.bytes.length,
    changedBytes:changed,
    rangeCount:ranges.length,
    ranges:ranges.slice(0,40),
    changedPercent:max?Number((changed/max*100).toFixed(4)):0,
  };
}

async function storeAttachment(env,file) {
  if(!env.FILES?.put) return null;
  const key=`chat/${Date.now()}-${crypto.randomUUID()}-${safeName(file.name)}`;
  await env.FILES.put(key,file.bytes,{
    httpMetadata:{contentType:file.type||'application/octet-stream'},
    customMetadata:{sha256:file.sha256,source:'chat-attachment'}
  });
  return key;
}

export async function prepareChatAttachments(req,env) {
  if(req.method!=='POST' || new URL(req.url).pathname!=='/api/chat/send') return {request:req,summary:null};
  let body;
  try { body=await req.clone().json(); } catch { return {request:req,summary:null}; }
  const incoming=Array.isArray(body?.attachments)?body.attachments.slice(0,4):[];
  if(!incoming.length) return {request:req,summary:null};

  const files=[];
  for(const raw of incoming){
    const name=safeName(raw?.name),type=String(raw?.type||'application/octet-stream').slice(0,120);
    let bytes;
    try { bytes=decodeBase64(raw?.base64||''); } catch { continue; }
    if(bytes.byteLength>50*1024*1024) continue;
    const digest=await sha256(bytes);
    const preview=isTextLike(type,name)?textPreview(bytes):'';
    const file={name,type,bytes,sha256:digest,preview};
    try { file.storageKey=await storeAttachment(env,file); } catch {}
    files.push(file);
  }
  if(!files.length) return {request:req,summary:null};

  const lines=['[JARVIS_ATTACHMENT_CONTEXT]','Kullanıcı bu mesajla gerçek dosya ekledi. Dosya yokmuş gibi cevap verme.'];
  for(const [i,file] of files.entries()){
    lines.push(`Dosya ${i+1}: ${file.name} | tür=${file.type} | boyut=${file.bytes.length} bayt | sha256=${file.sha256}`);
    if(file.preview) lines.push(`İçerik önizlemesi:\n${file.preview}\n[/İçerik önizlemesi]`);
  }
  const compareIntent=/değiş|fark|compare|karşılaştır/i.test(String(body.text||''));
  let directReply='';
  if(files.length===2){
    const d=binaryDiff(files[0],files[1]);
    lines.push(`İki dosya byte karşılaştırması: aynı_boyut=${d.sameSize}; değişen_byte=${d.changedBytes}; değişim_oranı=%${d.changedPercent}; değişim_aralığı_sayısı=${d.rangeCount}`);
    if(d.ranges.length) lines.push('İlk değişim aralıkları: '+d.ranges.map(([a,b])=>`0x${a.toString(16)}-0x${b.toString(16)}`).join(', '));
    if(compareIntent){
      directReply=[
        `İki dosyayı gerçekten aldım ve byte-byte karşılaştırdım.`,
        `• ${files[0].name}: ${files[0].bytes.length} bayt`,
        `• ${files[1].name}: ${files[1].bytes.length} bayt`,
        `• Değişen byte: ${d.changedBytes}`,
        `• Değişim oranı: %${d.changedPercent}`,
        `• Değişim bölgesi: ${d.rangeCount}`,
        d.ranges.length?`• İlk değişim aralıkları: ${d.ranges.slice(0,12).map(([a,b])=>`0x${a.toString(16)}–0x${b.toString(16)}`).join(', ')}`:'',
        `Bu ham byte farkıdır; hangi ECU haritalarının değiştiğini söylemek için ECU Brain/map analizi ayrıca gerekir.`
      ].filter(Boolean).join('\n');
    }
  } else if(files.length===1 && (compareIntent || /incele|kontrol et|analiz|ne olmuş|neler olmuş|sonucu ver/i.test(String(body.text||'')))) {
    lines.push('Not: Yalnızca tek dosya eklendi. Dosyanın kendisi alındı ve hash/boyut bilgisi doğrulandı; hangi byteların değiştiğini söylemek için referans/ORI/eski sürüm de gerekir.');
    directReply=[
      `Dosyayı gerçekten aldım: ${files[0].name}`,
      `• Boyut: ${files[0].bytes.length} bayt`,
      `• SHA-256: ${files[0].sha256}`,
      `Bu tek dosyada hangi değişikliklerin yapıldığını kesin söylemek için karşılaştırma referansı gerekiyor. Aracın ORI/eski .bin dosyasını da birlikte yükle; iki dosyayı byte-byte karşılaştırıp değişen byte sayısını, oranını ve adres aralıklarını çıkaracağım.`
    ].join('\n');
  }
  lines.push('[/JARVIS_ATTACHMENT_CONTEXT]');
  const attachmentContext=lines.join('\n');
  const text=String(body.text||'').trim();
  const next={...body,text,attachmentContext,attachmentDirectReply:directReply||null,attachmentMeta:files.map(f=>({name:f.name,type:f.type,size:f.bytes.length,sha256:f.sha256,storageKey:f.storageKey||null}))};
  return {request:jsonCloneRequest(req,next),summary:{count:files.length,files:next.attachmentMeta,directReply:Boolean(directReply)}};
}
