const ADAPTERS=Object.freeze([
  {
    id:'ecu-binary-inspector',
    capabilities:['ecu-file-analysis','binary-analysis'],
    lane:'worker',
    risk:'high',
    route:'/api/chat/send',
    notes:'Existing JARVIS byte-level BIN/ORI/MOD inspector with SHA256, entropy, hexdump and diff support.'
  },
  {
    id:'device-bridge',
    capabilities:['vehicle-diagnostics','uds','can-bus'],
    lane:'device-bridge',
    risk:'high',
    route:'/api/ecu/device/jobs',
    notes:'Physical vehicle work remains confirmation-gated and requires a compatible local diagnostic interface.'
  },
  {
    id:'social-growth',
    capabilities:['social-automation'],
    lane:'worker',
    risk:'medium',
    route:'/api/social',
    notes:'Existing campaign, cadence, Meta publishing and social queue capability.'
  },
  {
    id:'repo-cloud-tools',
    capabilities:['repository-knowledge','web-scraping'],
    lane:'cloud-runner',
    risk:'low',
    route:'/api/tools/cloud/jobs',
    notes:'Read-only repository inspection/search execution on GitHub-hosted runners.'
  }
]);

export function resolveNativeSkillAdapter(skill={}){
  if(String(skill.repo||'').toLowerCase()==='cubigato/thinkcar-tc-reader')return {id:'thinkdiag-tc-import',capabilities:['diagnostic-recording'],matched_capabilities:['diagnostic-recording'],lane:'worker',risk:'low',route:'/api/ecu/thinkdiag/import',status:'ready',notes:'TC recording parser; does not control Bluetooth or a vehicle.'};
  const caps=new Set(Array.isArray(skill.capabilities)?skill.capabilities.map(String):[]);
  for(const adapter of ADAPTERS){
    const matched=adapter.capabilities.filter(cap=>caps.has(cap));
    if(matched.length)return {...adapter,matched_capabilities:matched,status:'ready'};
  }
  return null;
}

export function hasNativeSkillAdapter(skill={}){return Boolean(resolveNativeSkillAdapter(skill));}

export const NATIVE_SKILL_ADAPTERS=ADAPTERS;
