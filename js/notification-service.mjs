export class NotificationService {
  constructor({claim,push,email}){this.claim=claim;this.push=push;this.email=email;}
  async notify(milestone,payload){
    const key=`${payload.conversationId}:${milestone}`;
    if(!(await this.claim(key))) return false;
    const title=milestone==='qualified_lead'?'6006: qualifizierte Anfrage':'6006: neuer Kundenchat';
    const body=[payload.faultCode,payload.vehicleLabel].filter(Boolean).join(' · ')||'Neue Unterhaltung';
    const message={title,body,url:`/admin/chat/${encodeURIComponent(payload.conversationId)}`,conversationId:payload.conversationId,milestone};
    await Promise.allSettled([this.push?.(message),this.email?.(message)]);
    return true;
  }
}
