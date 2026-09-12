const CACHE='jarvis-v7.9-capability-runtime-20260912';
const STATIC=['/','/app.css','/app.js','/credential-autotest.js','/integrations-ui.js','/higgsfield-ui.js','/provider-catalog.js','/navigation-state.js','/google-search-ui.js','/chat-enhancements.js','/jarvis-os-ui.js','/social-growth-ui.js','/video-pool-ui.js','/execution-trace-ui.js','/manifest.webmanifest','/icon.svg'];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(STATIC);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin) return;
  if(url.pathname.startsWith('/api/')) return;
  if(req.method!=='GET') return;

  const isNavigation=req.mode==='navigate';
  const isFreshCode=/\.(?:js|css)$/.test(url.pathname)||url.pathname==='/'||url.pathname==='/index.html';

  if(isNavigation||isFreshCode){
    event.respondWith((async()=>{
      try{
        const fresh=await fetch(req,{cache:'no-store'});
        if(fresh.ok){
          const cache=await caches.open(CACHE);
          cache.put(req,fresh.clone()).catch(()=>{});
        }
        return fresh;
      }catch{
        return (await caches.match(req)) || (isNavigation ? caches.match('/') : Response.error());
      }
    })());
    return;
  }

  event.respondWith((async()=>{
    const cached=await caches.match(req);
    const network=fetch(req).then(async res=>{
      if(res.ok){const cache=await caches.open(CACHE);cache.put(req,res.clone()).catch(()=>{});}
      return res;
    }).catch(()=>null);
    return cached || await network || Response.error();
  })());
});
