// Safe, deterministic source review; this is NOT an external SKILL.md executor.
export const AUDIT_RULES=Object.freeze([
 {id:'img-alt',kind:'accessibility',severity:'medium',ext:['.html','.jsx','.tsx'],pattern:/<img\b(?![^>]*\balt\s*=)[^>]*>/ig,message:'Görsel için alt metin eksik'},
 {id:'blank-target',kind:'security',severity:'medium',ext:['.html','.jsx','.tsx'],pattern:/<a\b(?=[^>]*target\s*=\s*["']_blank["'])(?![^>]*rel\s*=\s*["'][^"']*noopener)[^>]*>/ig,message:'Yeni sekme bağlantısında rel=noopener eksik'},
 {id:'document-title',kind:'seo',severity:'low',ext:['.html'],pattern:/<head\b[^>]*>(?:(?!<title\b)[\s\S])*?<\/head>/ig,message:'HTML head bölümünde title bulunamadı'},
 {id:'debugger-statement',kind:'maintainability',severity:'low',ext:['.js','.jsx','.ts','.tsx'],pattern:/^\s*debugger\s*;/gm,message:'Kodda debugger ifadesi bulundu'},
 {id:'dynamic-eval',kind:'security',severity:'high',ext:['.js','.jsx','.ts','.tsx'],pattern:/\b(?:eval\s*\(|new\s+Function\s*\()/g,message:'Dinamik kod çalıştırma: elle güvenlik incelemesi gerekli'},
 {id:'innerhtml-write',kind:'security',severity:'medium',ext:['.js','.jsx','.ts','.tsx'],pattern:/\.innerHTML\s*=(?!=)/g,message:'innerHTML ataması: XSS için güvenilir veri/sanitizasyon kontrolü gerekli'},
 {id:'sensitive-console',kind:'security',severity:'medium',ext:['.js','.jsx','.ts','.tsx'],pattern:/\bconsole\.(?:log|debug|info)\s*\(\s*(?:env\b|process\.env\b|request\.headers\b)/g,message:'Konsola hassas ortam/istek bilgisi yazılıyor olabilir'},
 {id:'workers-process-env',kind:'cloudflare',severity:'low',ext:['.js','.jsx','.ts','.tsx'],pattern:/\bprocess\.env\b/g,message:'Cloudflare Workers üzerinde Node uyumluluğunu ve env binding erişimini kontrol et'},
 {id:'workers-sync-io',kind:'cloudflare',severity:'medium',ext:['.js','.jsx','.ts','.tsx'],pattern:/\b(?:readFileSync|writeFileSync|execSync|spawnSync)\s*\(/g,message:'Eşzamanlı dosya/süreç çağrısı: Workers çalışma ortamı uyumluluğunu kontrol et'},
 {id:'actions-unpinned',kind:'github-actions',severity:'medium',ext:['.yml','.yaml'],pattern:/^\s*(?:-\s*)?uses:\s*(?![^\r\n]*@[a-fA-F0-9]{40}(?:\s|#|$))[^\r\n]+/gm,message:'GitHub Action tam commit SHA ile sabitlenmemiş; tedarik zinciri riskini incele'},
 {id:'actions-privileged',kind:'github-actions',severity:'high',ext:['.yml','.yaml'],pattern:/^\s*permissions:\s*write-all\s*$/gm,message:'Workflow tüm yazma izinlerini istiyor'},
 {id:'actions-pr-target',kind:'github-actions',severity:'high',ext:['.yml','.yaml'],pattern:/^\s*pull_request_target\s*:/gm,message:'pull_request_target: güvenilmeyen PR kodunun çalıştırılmasını denetle'},
 {id:'actions-merge',kind:'github-actions',severity:'high',ext:['.yml','.yaml'],pattern:/\b(?:gh\s+pr\s+merge|git\s+push\s+(?:origin\s+)?(?:main|master))\b/g,message:'Otomatik merge veya ana dala push komutu: kullanıcı onayı gerekir'},
 {id:'actions-deploy',kind:'github-actions',severity:'medium',ext:['.yml','.yaml'],pattern:/\b(?:wrangler\s+deploy|npm\s+run\s+deploy)\b/g,message:'Dağıtım komutu mevcut; production yetkisini ve tetikleyiciyi incele'}
]);
// Profiles select local analyzers only; external SKILL.md documents are never interpreted.
export const SOURCE_AUDIT_PROFILES=Object.freeze({
 all:null,
 web:Object.freeze(['img-alt','blank-target','document-title','innerhtml-write']),
 security:Object.freeze(['blank-target','dynamic-eval','innerhtml-write','sensitive-console']),
 cloudflare:Object.freeze(['dynamic-eval','sensitive-console','workers-process-env','workers-sync-io']),
 'github-actions':Object.freeze(['actions-unpinned','actions-privileged','actions-pr-target','actions-merge','actions-deploy'])
});
export function reviewSourceFile(filename,content,{limit=20,profile='all'}={}){
 if(!Object.hasOwn(SOURCE_AUDIT_PROFILES,profile))throw new Error('SOURCE_AUDIT_PROFILE_NOT_ALLOWED');
 const selected=SOURCE_AUDIT_PROFILES[profile];
 const file=String(filename||'');
 const ext=file.toLowerCase().match(/\.[a-z0-9]+$/)?.[0]||'';
 if(!['.html','.jsx','.tsx','.js','.ts','.yml','.yaml'].includes(ext)||typeof content!=='string'||content.length>250000)return [];
 const findings=[];
 for(const rule of AUDIT_RULES){
  if(selected&&!selected.includes(rule.id))continue;
  if(!rule.ext.includes(ext))continue;
  for(const match of content.matchAll(rule.pattern)){
   const line=content.slice(0,match.index).split('\n').length;
   findings.push({rule:rule.id,category:rule.kind,severity:rule.severity,file,line,message:rule.message});
   if(findings.length>=limit)return findings;
  }
 }
 return findings;
}
