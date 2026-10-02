export const YOUTUBE_TEACHING_REPO='artemnovitckii/notebooklm-coach';

const YOUTUBE_HOSTS=new Set(['youtube.com','www.youtube.com','m.youtube.com','youtu.be']);
const USER_AGENT='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130 Safari/537.36';

function decodeXml(value=''){
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'");
}

export function parseYouTubeResourceUrl(value=''){
  let url;
  try{url=new URL(String(value||'').trim());}catch{return null;}
  if(url.protocol!=='https:'||!YOUTUBE_HOSTS.has(url.hostname.toLowerCase()))return null;
  const host=url.hostname.toLowerCase(),parts=url.pathname.split('/').filter(Boolean);
  let videoId='';
  if(host==='youtu.be')videoId=parts[0]||'';
  else if(url.pathname==='/watch')videoId=url.searchParams.get('v')||'';
  else if(['shorts','embed','live'].includes(parts[0]))videoId=parts[1]||'';
  if(/^[A-Za-z0-9_-]{6,20}$/.test(videoId))return {type:'video',url:url.href,videoId};
  const channelId=parts[0]==='channel'&&/^UC[A-Za-z0-9_-]+$/.test(parts[1]||'')?parts[1]:null;
  if(channelId||String(parts[0]||'').startsWith('@')||parts[0]==='c'||parts[0]==='user')return {type:'channel',url:url.href,channelId};
  return null;
}

function extractJsonArrayAfter(html,marker){
  const at=html.indexOf(marker);if(at<0)return null;
  let start=html.indexOf('[',at+marker.length);if(start<0)return null;
  let depth=0,inString=false,escaped=false;
  for(let i=start;i<html.length;i++){
    const ch=html[i];
    if(inString){
      if(escaped){escaped=false;continue;}
      if(ch==='\\'){escaped=true;continue;}
      if(ch==='"')inString=false;
      continue;
    }
    if(ch==='"'){inString=true;continue;}
    if(ch==='[')depth++;
    else if(ch===']'){
      depth--;
      if(depth===0){
        try{return JSON.parse(html.slice(start,i+1));}catch{return null;}
      }
    }
  }
  return null;
}

export function captionTextFromJson3(payload={}){
  const events=Array.isArray(payload?.events)?payload.events:[];
  const lines=[];
  for(const event of events){
    const segs=Array.isArray(event?.segs)?event.segs:[];
    const text=segs.map(seg=>String(seg?.utf8||'')).join('').replace(/\s+/g,' ').trim();
    if(text)lines.push(text);
  }
  return lines.join('\n').trim();
}

export function parseYouTubeFeedXml(xml='',limit=50){
  const out=[];
  const entries=String(xml).match(/<entry>[\s\S]*?<\/entry>/g)||[];
  for(const entry of entries){
    const id=(entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)||[])[1];
    const title=(entry.match(/<title>([\s\S]*?)<\/title>/)||[])[1];
    const published=(entry.match(/<published>([^<]+)<\/published>/)||[])[1]||null;
    if(!id||!title)continue;
    out.push({id,title:decodeXml(title).trim(),published,url:`https://www.youtube.com/watch?v=${id}`});
    if(out.length>=Math.max(1,Math.min(100,Number(limit)||50)))break;
  }
  return out;
}

async function textFetch(url,fetchImpl){
  const response=await fetchImpl(url,{headers:{'user-agent':USER_AGENT,'accept-language':'tr-TR,tr;q=0.9,en;q=0.8'}});
  if(!response?.ok)throw new Error(`YOUTUBE_HTTP_${response?.status||0}`);
  return response.text();
}

function pageTitle(html=''){
  const raw=(String(html).match(/<title>([\s\S]*?)<\/title>/i)||[])[1]||'';
  return decodeXml(raw).replace(/\s*-\s*YouTube\s*$/i,'').trim();
}

export async function fetchYouTubeTranscript(resourceUrl,{fetchImpl=fetch,maxChars=120000}={}){
  const parsed=parseYouTubeResourceUrl(resourceUrl);
  if(!parsed||parsed.type!=='video')throw new Error('YOUTUBE_VIDEO_URL_REQUIRED');
  const watchUrl=`https://www.youtube.com/watch?v=${encodeURIComponent(parsed.videoId)}&hl=tr`;
  const html=await textFetch(watchUrl,fetchImpl);
  const tracks=extractJsonArrayAfter(html,'"captionTracks":')||[];
  const preferred=tracks.find(track=>/^tr(?:-|$)/i.test(String(track?.languageCode||'')))
    ||tracks.find(track=>/^en(?:-|$)/i.test(String(track?.languageCode||'')))
    ||tracks[0];
  if(!preferred?.baseUrl){
    return {kind:'video',source_url:parsed.url,video_id:parsed.videoId,title:pageTitle(html),captions_available:false,transcript:'',language:null};
  }
  const captionsUrl=new URL(String(preferred.baseUrl));
  captionsUrl.searchParams.set('fmt','json3');
  const response=await fetchImpl(captionsUrl.href,{headers:{'user-agent':USER_AGENT}});
  if(!response?.ok)throw new Error(`YOUTUBE_CAPTIONS_HTTP_${response?.status||0}`);
  const payload=await response.json();
  const transcript=captionTextFromJson3(payload).slice(0,Math.max(1000,Math.min(250000,Number(maxChars)||120000)));
  return {
    kind:'video',source_url:parsed.url,video_id:parsed.videoId,title:pageTitle(html),
    captions_available:Boolean(transcript),transcript,language:String(preferred.languageCode||preferred.name?.simpleText||'')||null
  };
}

function channelIdFromHtml(html=''){
  for(const pattern of [/"channelId":"(UC[A-Za-z0-9_-]+)"/,/"externalId":"(UC[A-Za-z0-9_-]+)"/,/channel_id=(UC[A-Za-z0-9_-]+)/]){
    const match=String(html).match(pattern);if(match?.[1])return match[1];
  }
  return null;
}

export async function fetchYouTubeChannelIndex(resourceUrl,{fetchImpl=fetch,limit=50}={}){
  const parsed=parseYouTubeResourceUrl(resourceUrl);
  if(!parsed||parsed.type!=='channel')throw new Error('YOUTUBE_CHANNEL_URL_REQUIRED');
  let channelId=parsed.channelId;
  if(!channelId){
    const html=await textFetch(parsed.url,fetchImpl);
    channelId=channelIdFromHtml(html);
  }
  if(!channelId)throw new Error('YOUTUBE_CHANNEL_ID_NOT_FOUND');
  const feedUrl=`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
  const xml=await textFetch(feedUrl,fetchImpl);
  const videos=parseYouTubeFeedXml(xml,limit);
  return {kind:'channel',source_url:parsed.url,channel_id:channelId,index_scope:'latest-feed',video_count:videos.length,videos};
}

export async function runYouTubeTeaching(resourceUrl,options={}){
  const parsed=parseYouTubeResourceUrl(resourceUrl);
  if(!parsed)throw new Error('YOUTUBE_URL_INVALID');
  return parsed.type==='video'
    ? fetchYouTubeTranscript(resourceUrl,options)
    : fetchYouTubeChannelIndex(resourceUrl,options);
}
