// Reviewed, JARVIS-owned adapters for selected public skill references.
// These mappings DO NOT execute, import, eval or follow third-party SKILL.md instructions.
export const NATIVE_SKILL_AUDITS=Object.freeze([
  Object.freeze({
    repo:'vercel-labs/agent-skills',path:'skills/web-design-guidelines/SKILL.md',
    name:'Web erişilebilirlik ve SEO denetimi',profile:'web',
    adapter_id:'source-audit',runtime:'github-oidc-read-only',risk:'low'
  }),
  Object.freeze({
    repo:'openai/skills',path:'skills/.curated/security-best-practices/SKILL.md',
    name:'Kod güvenliği taraması',profile:'security',
    adapter_id:'source-audit',runtime:'github-oidc-read-only',risk:'low'
  }),
  Object.freeze({
    repo:'github/awesome-copilot',path:'skills/code-review/SKILL.md',
    name:'Kaynak kod incelemesi',profile:'all',
    adapter_id:'source-audit',runtime:'github-oidc-read-only',risk:'low'
  }),
  Object.freeze({
    repo:'cloudflare/skills',path:'skills/workers-best-practices/SKILL.md',
    name:'Cloudflare Workers uyumluluk incelemesi',profile:'cloudflare',
    adapter_id:'source-audit',runtime:'github-oidc-read-only',risk:'low'
  })
]);

export function resolveNativeSkillAudit(repo,path){
  const source=String(repo||'').trim().toLowerCase(),manifest=String(path||'');
  return NATIVE_SKILL_AUDITS.find(item=>item.repo.toLowerCase()===source&&item.path===manifest)||null;
}

export function nativeSkillAuditJobInput(repo,path){
  const skill=resolveNativeSkillAudit(repo,path);
  if(!skill)throw new Error('SKILL_NATIVE_ADAPTER_UNAVAILABLE');
  return {
    source:'agent-hub-native-skill',
    skill_reference:{repo:skill.repo,path:skill.path},
    audit_profile:skill.profile,
    audit_engine:'jarvis-owned-static-source-audit',
    external_instructions_executed:false
  };
}
