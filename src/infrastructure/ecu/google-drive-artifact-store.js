function encodeQueryValue(value){return String(value).replace(/\\/g,'\\\\').replace(/'/g,"\\'");}
async function accessToken(config){
  const body=new URLSearchParams({
    client_id:String(config.clientId||''),
    client_secret:String(config.clientSecret||''),
    refresh_token:String(config.refreshToken||''),
    grant_type:'refresh_token',
  });
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
  if(!response.ok)throw new Error('GOOGLE_DRIVE_TOKEN_FAILED');
  const json=await response.json();
  if(!json?.access_token)throw new Error('GOOGLE_DRIVE_TOKEN_MISSING');
  return json.access_token;
}
async function findFile(token,key){
  const q=`trashed = false and appProperties has { key='jarvisKey' and value='${encodeQueryValue(key)}' }`;
  const url=new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q',q); url.searchParams.set('spaces','drive'); url.searchParams.set('fields','files(id,size,name)');
  const response=await fetch(url,{headers:{authorization:`Bearer ${token}`}});
  if(!response.ok)throw new Error('GOOGLE_DRIVE_LIST_FAILED');
  const json=await response.json();
  return json?.files?.[0]||null;
}
export function createGoogleDriveBackend(config={}){
  if(!config.clientId||!config.clientSecret||!config.refreshToken)throw new Error('GOOGLE_DRIVE_CREDENTIALS_REQUIRED');
  return {
    async head(key){const token=await accessToken(config);const file=await findFile(token,key);return file?{size:Number(file.size||0),id:file.id}:null;},
    async put(key,value,options={}){
      const token=await accessToken(config);
      const existing=await findFile(token,key); if(existing)return;
      const metadata={name:`JARVIS-ECU-${String(key).replace(/[^a-zA-Z0-9._-]+/g,'_')}`,appProperties:{jarvisKey:String(key),...(options.customMetadata||{})}};
      const start=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id',{
        method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json; charset=UTF-8','x-upload-content-type':String(options?.httpMetadata?.contentType||'application/octet-stream')},
        body:JSON.stringify(metadata),
      });
      if(!start.ok)throw new Error('GOOGLE_DRIVE_UPLOAD_INIT_FAILED');
      const location=start.headers.get('location'); if(!location)throw new Error('GOOGLE_DRIVE_UPLOAD_LOCATION_MISSING');
      const bytes=value instanceof Uint8Array?value:new Uint8Array(value);
      const upload=await fetch(location,{method:'PUT',headers:{'content-type':String(options?.httpMetadata?.contentType||'application/octet-stream'),'content-length':String(bytes.byteLength)},body:bytes});
      if(!upload.ok)throw new Error('GOOGLE_DRIVE_UPLOAD_FAILED');
    },
    async get(key){
      const token=await accessToken(config); const file=await findFile(token,key); if(!file)return null;
      const response=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`,{headers:{authorization:`Bearer ${token}`}});
      if(!response.ok)throw new Error('GOOGLE_DRIVE_DOWNLOAD_FAILED');
      const buffer=await response.arrayBuffer(); return {arrayBuffer:async()=>buffer};
    },
  };
}
