function json(payload,status=200){
  return new Response(JSON.stringify(payload),{
    status,
    headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},
  });
}

export function createEcuAuthGuard(core,{isOwnerAuthenticated}={}){
  if(!core?.fetch)throw new Error('ECU_AUTH_CORE_REQUIRED');
  if(typeof isOwnerAuthenticated!=='function')throw new Error('ECU_OWNER_AUTH_REQUIRED');

  return {
    async fetch(req,env,ctx){
      const path=new URL(req.url).pathname;
      if(!path.startsWith('/api/ecu/'))return core.fetch(req,env,ctx);
      if(path.startsWith('/api/ecu/internal/'))return core.fetch(req,env,ctx);
      if(!(await isOwnerAuthenticated(req,env)))return json({error:'AUTH_REQUIRED'},401);
      return core.fetch(req,env,ctx);
    },
    scheduled(event,env,ctx){
      return core.scheduled?.(event,env,ctx);
    },
  };
}
