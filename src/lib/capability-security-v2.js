export const CAPABILITY_POLICY_CLASSES=Object.freeze([
  'reference-only',
  'pure-read',
  'network-read',
  'workspace-readwrite',
  'sandbox-network-readwrite',
  'device-read',
  'device-write-confirmed',
  'production-prohibited'
]);

const RULES=Object.freeze([
  {kind:'destructive-command',severity:'critical',patterns:[/\brm\s+-rf\b/i,/\bformat\s+[a-z]:/i,/\bdel\s+\/f\s+\/s\s+\/q\b/i,/\bdrop\s+(?:table|database)\b/i,/\btruncate\s+table\b/i]},
  {kind:'privilege-escalation',severity:'critical',patterns:[/\bsudo\b/i,/\bdoas\b/i,/\bsetuid\b/i,/\bchmod\s+777\b/i]},
  {kind:'secret-access',severity:'high',patterns:[/\bprocess\.env\b/i,/\bos\.environ\b/i,/\.aws\/credentials/i,/\.ssh\//i,/keychain/i,/credential(?:s|_store)?/i]},
  {kind:'browser-profile-access',severity:'high',patterns:[/profile-dir/i,/browser\s+profile/i,/cookie\s*(?:db|store|jar)/i,/login\s*data/i,/local\s*state/i]},
  {kind:'shell-execution',severity:'high',patterns:[/child_process/i,/\bexecFile\s*\(/i,/\bexec\s*\(/i,/\bspawn\s*\(/i,/shell\s*=\s*true/i,/subprocess\.(?:run|popen|call)/i]},
  {kind:'prompt-injection',severity:'high',patterns:[/ignore\s+(?:all\s+)?previous\s+instructions/i,/system\s+prompt/i,/jailbreak/i,/override\s+(?:the\s+)?instructions/i]},
  {kind:'postinstall-hook',severity:'medium',patterns:[/["']postinstall["']\s*:/i,/\bpostinstall\b/i]},
  {kind:'network-upload',severity:'medium',patterns:[/curl\b[^\n]*\s(?:-x\s+post|-d\s|--data)/i,/requests\.post\s*\(/i,/fetch\s*\([^\n]+method\s*:\s*["']post/i,/upload(?:File|_file|\s+file)/i]},
  {kind:'filesystem-traversal',severity:'medium',patterns:[/(?:\.\.\/){2,}/,/\bHOME\b|~\//]},
  {kind:'self-modifying',severity:'medium',patterns:[/git\s+push/i,/auto.?merge/i,/self.?update/i,/modify\s+(?:its|own)\s+(?:code|files)/i]},
  {kind:'telemetry',severity:'low',patterns:[/telemetry/i,/analytics/i,/sentry/i]}
]);

const SEVERITY_WEIGHT=Object.freeze({low:1,medium:2,high:3,critical:4});

function textOf(input={}){
  const snippets=input?.snippets&&typeof input.snippets==='object'?Object.values(input.snippets):[];
  const files=Array.isArray(input?.files)?input.files:[];
  const manifests=input?.manifest&&typeof input.manifest==='object'?[JSON.stringify(input.manifest)]:[];
  return [input?.text||input?.content||input?.readme||'',...snippets,...files,...manifests].map(String).join('\n');
}

function uniqueFindings(findings){
  const map=new Map();
  for(const finding of findings){
    const key=`${finding.kind}:${finding.evidence}`;
    if(!map.has(key))map.set(key,finding);
  }
  return [...map.values()];
}

export function scanCapabilitySource(input={}){
  const text=textOf(input);
  const findings=[];
  for(const rule of RULES){
    for(const pattern of rule.patterns){
      const match=text.match(pattern);
      if(match){
        findings.push({
          id:`finding:${rule.kind}:${findings.length+1}`,
          kind:rule.kind,
          severity:rule.severity,
          evidence:String(match[0]).slice(0,160)
        });
      }
    }
  }
  return uniqueFindings(findings);
}

function maxSeverity(findings=[]){
  let severity='low';
  for(const finding of findings){
    if((SEVERITY_WEIGHT[finding?.severity]||0)>(SEVERITY_WEIGHT[severity]||0))severity=finding.severity;
  }
  return severity;
}

function explicitPolicy(input={}){
  const value=String(input.policyClass??input.policy_class??'').trim().toLowerCase();
  return CAPABILITY_POLICY_CLASSES.includes(value)?value:null;
}

function requirements(input={}){
  const values=new Set(Array.isArray(input.requirements)?input.requirements.map(String):[]);
  if(input.network===true)values.add('network');
  if(input.workspaceWrite===true)values.add('workspace-write');
  if(input.device===true||input.deviceRead===true||input.deviceWrite===true)values.add('device');
  if(input.hostBridge===true)values.add('host-bridge');
  if(input.requiresPaidApi===true||input.requires_paid_api===true)values.add('paid-api');
  if(input.requiresCredentials===true||input.requires_credentials===true)values.add('credentials');
  return [...values].sort();
}

function derivedPolicyClass(input={}){
  const explicit=explicitPolicy(input);if(explicit)return explicit;
  if(input.production===true||input.productionWrite===true)return 'production-prohibited';
  if(input.deviceWrite===true)return 'device-write-confirmed';
  if(input.device===true||input.deviceRead===true)return 'device-read';
  if(input.workspaceWrite===true&&input.network===true)return 'sandbox-network-readwrite';
  if(input.workspaceWrite===true)return 'workspace-readwrite';
  if(input.network===true)return 'network-read';
  return 'pure-read';
}

export function classifyCapabilityPolicy(input={}){
  const findings=Array.isArray(input.findings)?input.findings:scanCapabilitySource(input);
  const risk=maxSeverity(findings);
  const req=requirements(input);
  const kinds=new Set(findings.map(item=>item.kind));
  const requested=derivedPolicyClass(input);
  const explicitRestriction=String(input.restriction||'').trim();
  const paidOrCredential=req.includes('paid-api')||req.includes('credentials');
  const critical=findings.some(item=>item.severity==='critical');
  const secretAndNetwork=kinds.has('secret-access')&&(input.network===true||kinds.has('network-upload'));
  const promptAndExecution=kinds.has('prompt-injection')&&(kinds.has('shell-execution')||input.workspaceWrite===true||input.network===true);

  let policyClass=requested;
  let decision='approved';
  let reason='policy_approved';
  let requiresConfirmation=requested==='device-write-confirmed';

  if(critical||secretAndNetwork||promptAndExecution){
    policyClass='production-prohibited';
    decision='blocked';
    reason=critical?'critical_static_finding':secretAndNetwork?'secret_exfiltration_risk':'prompt_injection_execution_risk';
    requiresConfirmation=false;
  }else if(input.autoExecute===false||explicitRestriction||paidOrCredential){
    policyClass='reference-only';
    decision='reference_only';
    reason=paidOrCredential?'external_prerequisite_not_configured':explicitRestriction?'explicit_restriction':'auto_execution_disabled';
    requiresConfirmation=false;
  }else if(risk==='high'&&requested!=='device-read'&&requested!=='device-write-confirmed'){
    policyClass='reference-only';
    decision='reference_only';
    reason='high_risk_static_finding';
    requiresConfirmation=false;
  }

  return {
    policy_class:policyClass,
    decision,
    risk,
    requires_confirmation:requiresConfirmation,
    requirements:req,
    findings:findings.map(item=>({...item})),
    reason
  };
}

export function isPolicyExecutable(policy={}){
  const policyClass=String(policy?.policy_class||'');
  return policy?.decision==='approved'&&CAPABILITY_POLICY_CLASSES.includes(policyClass)&&!['reference-only','production-prohibited'].includes(policyClass);
}

export const CAPABILITY_SECURITY_RULES=RULES;
