import { DurableObject } from 'cloudflare:workers';
export class EcuComputeContainer extends DurableObject {
  async fetch() { return new Response('retired', { status: 410 }); }
}
export default {
  async fetch(request, env) {
    const path=new URL(request.url).pathname;
    if(path==='/api/health') return Response.json({ok:true,diagnostic:true,db_bound:!!env.DB,ai_bound:!!env.AI,assets_bound:!!env.ASSETS});
    return new Response('Diagnostic-only Worker Version URL', {status:200,headers:{'cache-control':'no-store'}});
  }
};