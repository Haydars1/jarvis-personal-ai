import { OAuthProvider, AuthorizationError, CimdFetchError, authorizationErrorRedirect } from "@cloudflare/workers-oauth-provider";
import { handleMcp } from "./protocol.js";

const esc=(s)=>String(s).replace(/[&<>"']/g,c=>`&#${c.charCodeAt(0)};`);
const txt=(message,status=400)=>new Response(message,{status,headers:{"content-type":"text/plain; charset=utf-8","cache-control":"no-store"}});
const callbackUrl=(request)=>new URL("/callback",request.url).toString();
const authHandler={
 async fetch(request,env){
  const oauth=env.OAUTH_PROVIDER;
  const url=new URL(request.url);
  try {
   if(url.pathname==="/authorize"&&request.method==="GET"){
    const auth=await oauth.parseAuthRequest(request);
    const details=await oauth.describeConsent(auth);
    const consent=await oauth.beginConsent(auth);
    const scopes=details.scope.map(scope=>`<label><input type="checkbox" name="scope" value="${esc(scope)}" checked> ${esc(scope)}</label>`).join("<br>");
    const html=`<!doctype html><html><head><meta charset="utf-8"><title>Authorize MCP</title></head><body><h1>Allow ${esc(details.clientName)}?</h1><p>${details.clientDomain?`Verified client domain: ${esc(details.clientDomain)}`:"Client name is not verified."}</p><p>Redirect destination: ${esc(details.redirectHost)}</p>${details.redirectIsLoopback?"<p>Local application: approve only if you initiated this login.</p>":""}<form method="post"><input type="hidden" name="handle" value="${esc(consent.handle)}">${scopes}<p><button name="decision" value="approve">Allow</button> <button name="decision" value="deny">Deny</button></p></form></body></html>`;
    consent.headers.set("content-type","text/html; charset=utf-8");
    return new Response(html,{headers:consent.headers});
   }
   if(url.pathname==="/authorize"&&request.method==="POST"){
    const form=await request.formData();
    const handle=String(form.get("handle")||"");
    if(form.get("decision")!=="approve"){
     const denied=await oauth.denyConsent(request,handle);
     return new Response(null,{status:302,headers:denied.headers});
    }
    const approved=await oauth.approveConsent(request,handle,{scope:form.getAll("scope").map(String)});
    const {state,headers}=await oauth.beginUpstream(approved.request,{headers:approved.headers});
    const gh=new URL("https://github.com/login/oauth/authorize");
    gh.searchParams.set("client_id",env.GITHUB_OAUTH_CLIENT_ID);
    gh.searchParams.set("redirect_uri",callbackUrl(request));
    gh.searchParams.set("state",state);
    // Identity only: no repository permissions requested.
    headers.set("Location",gh.toString());
    return new Response(null,{status:302,headers});
   }
   if(url.pathname==="/callback"&&request.method==="GET"){
    const {request:original,headers}=await oauth.finishUpstream(request);
    if(url.searchParams.has("error")){
     headers.set("Location",authorizationErrorRedirect(original,"access_denied"));
     return new Response(null,{status:302,headers});
    }
    const code=url.searchParams.get("code");
    if(!code)return txt("Missing GitHub authorization code");
    const tokenResponse=await fetch("https://github.com/login/oauth/access_token",{
     method:"POST",headers:{"accept":"application/json","content-type":"application/json"},
     body:JSON.stringify({client_id:env.GITHUB_OAUTH_CLIENT_ID,client_secret:env.GITHUB_OAUTH_CLIENT_SECRET,code,redirect_uri:callbackUrl(request)})
    });
    if(!tokenResponse.ok)return txt("GitHub sign-in unavailable",502);
    const token=await tokenResponse.json();
    if(!token.access_token)return txt("GitHub sign-in rejected",403);
    const userResponse=await fetch("https://api.github.com/user",{headers:{"authorization":`Bearer ${token.access_token}`,"accept":"application/vnd.github+json","user-agent":"hayirlievlad-mcp"}});
    if(!userResponse.ok)return txt("GitHub identity lookup failed",502);
    const user=await userResponse.json();
    if(!Number.isSafeInteger(user.id)||String(user.id)!==String(env.ALLOWED_GITHUB_USER_ID))return txt("GitHub account not authorized",403);
    const completed=await oauth.completeAuthorization({request:original,userId:`github-${user.id}`,metadata:{},scope:original.scope,props:{githubUserId:user.id}});
    headers.set("Location",completed.redirectTo);
    return new Response(null,{status:302,headers});
   }
   return txt("Not found",404);
  }catch(error){
   if(error instanceof AuthorizationError&&error.redirectTo)return Response.redirect(error.redirectTo,302);
   if(error instanceof AuthorizationError||error instanceof CimdFetchError)return txt("Authorization request invalid or expired",400);
   throw error;
  }
 }
};
const apiHandler={
 async fetch(request,env,ctx){
  if(!ctx.auth?.scope?.includes("mcp:read"))return txt("Insufficient scope",403);
  if(String(ctx.props?.githubUserId)!==String(env.ALLOWED_GITHUB_USER_ID))return txt("Forbidden",403);
  return handleMcp(request);
 }
};
export default new OAuthProvider({
 apiRoute:"/mcp",apiHandler,defaultHandler:authHandler,
 authorizeEndpoint:"/authorize",tokenEndpoint:"/oauth/token",
 clientRegistrationEndpoint:"/oauth/register",
 scopesSupported:["mcp:read"],requiredScopes:["mcp:read"],
 resourceMetadata:{resource:"https://hayirlievlad-shared-mcp.haydojarvis.workers.dev/mcp",authorization_servers:["https://hayirlievlad-shared-mcp.haydojarvis.workers.dev"]},
 clientIdMetadataDocumentEnabled:false
});
