// Safe, deterministic source review; this is NOT an external SKILL.md executor.
export const AUDIT_RULES=Object.freeze([
 {id:'img-alt',kind:'accessibility',severity:'medium',ext:['.html','.jsx','.tsx'],pattern:/<img\b(?![^>]*\balt\s*=)[^>]*>/ig,message:'Görsel için alt metin eksik'},
 {id:'blank-target',kind:'security',severity:'medium',ext:['.html','.jsx','.tsx'],pattern:/<a\b(?=[^>]*target\s*=\s*["']_blank["'])(?![^>]*rel\s*=\s*["'][^"']*noopener)[^>]*>/ig,message:'Yeni sekme bağlantısında rel=noopener eksik'},
 {id:'document-title',kind:'seo',severity:'low',ext:['.html'],pattern:/<head\b[^>]*>(?:(?!<title\b)[\s\S])*?<\/head>/ig,message:'HTML head bölümünde title bulunamadı'},
 {id:'debugger-statement',kind:'maintainability',severity:'low',ext:['.js','.jsx','.ts','.tsx'],pattern:/^\s*debugger\s*;/gm,message:'Kodda debugger ifadesi bulundu'}
]);
export function reviewSourceFile(filename,content,{limit=20}={}){
 const file=String(filename||'');
 const ext=file.toLowerCase().match(/\.[a-z0-9]+$/)?.[0]||'';
 if(!['.html','.jsx','.tsx','.js','.ts'].includes(ext)||typeof content!=='string'||content.length>250000)return [];
 const findings=[];
 for(const rule of AUDIT_RULES){
  if(!rule.ext.includes(ext))continue;
  for(const match of content.matchAll(rule.pattern)){
   const line=content.slice(0,match.index).split('\n').length;
   findings.push({rule:rule.id,category:rule.kind,severity:rule.severity,file,line,message:rule.message});
   if(findings.length>=limit)return findings;
  }
 }
 return findings;
}
