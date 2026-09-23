const EFFECTFUL = /(send|publish|upload|delete|remove|install|purchase|pay|transfer|message|email|post|tap|click|write|update|create)/i;
const HIGH_RISK = /(pay|purchase|transfer|delete|remove|credential|secret|token|password|deploy.production|merge.main)/i;

export function decideAgentAction(action = {}, context = {}) {
  const name = String(action.name || action.type || '');
  const effectful = action.effectful === true || EFFECTFUL.test(name);
  if (!effectful) return { allowed: true, confirmation: false, reason: 'read_only' };

  if (HIGH_RISK.test(name) || action.risk === 'high') {
    return { allowed: false, confirmation: true, reason: 'high_risk_confirmation_required' };
  }

  const capability = String(action.capability || name).toLowerCase();
  const authorized = new Set((context.authorizedCapabilities || []).map(value => String(value).toLowerCase()));
  if (!authorized.has(capability)) {
    return { allowed: false, confirmation: false, reason: 'capability_not_authorized' };
  }

  return { allowed: true, confirmation: false, reason: 'pre_authorized_capability' };
}
