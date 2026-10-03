export class InMemoryChatRepository {
  constructor(){this.conversations=new Map();this.messages=new Map();this.milestones=new Set();}
  async saveConversation(c){this.conversations.set(c.id, structuredClone(c)); return structuredClone(c);}
  async getConversation(id){const c=this.conversations.get(id); return c?structuredClone(c):null;}
  async addMessage(m){const list=this.messages.get(m.conversationId)||[]; list.push(structuredClone(m)); this.messages.set(m.conversationId,list); return structuredClone(m);}
  async listMessages(id){return (this.messages.get(id)||[]).map(item => structuredClone(item));}
  async claimMilestone(key){if(this.milestones.has(key)) return false; this.milestones.add(key); return true;}
}

export class ChatService {
  constructor(repo,{now=()=>new Date().toISOString(), id=()=>crypto.randomUUID()}={}){this.repo=repo;this.now=now;this.id=id;}
  async createConversation(input={}){const now=this.now(); const c={id:this.id(),visitorId:input.visitorId||null,pagePath:input.pagePath||null,faultCode:input.faultCode||null,vehicleProfileKey:input.vehicleProfileKey||null,status:'ai_active',ownerId:null,revision:0,createdAt:now,updatedAt:now}; return this.repo.saveConversation(c);}
  async getConversation(id){const c=await this.repo.getConversation(id); if(!c) throw new Error('CONVERSATION_NOT_FOUND'); return c;}
  async listMessages(id){return this.repo.listMessages(id);}
  async _add(id,role,text,authorId=null){const c=await this.getConversation(id); const msg={id:this.id(),conversationId:id,role,text:String(text),authorId,createdAt:this.now()}; await this.repo.addMessage(msg); c.updatedAt=msg.createdAt; await this.repo.saveConversation(c); return msg;}
  async postVisitorMessage(id,text){if(!String(text||'').trim()) throw new Error('EMPTY_MESSAGE'); return this._add(id,'visitor',String(text).trim());}
  async postAiMessage(id,text){const c=await this.getConversation(id); if(c.status!=='ai_active') throw new Error('AI_NOT_ACTIVE'); return this._add(id,'assistant',text);}
  async beginAiReply(id){const c=await this.getConversation(id); if(c.status!=='ai_active') throw new Error('AI_NOT_ACTIVE'); return {conversationId:id,revision:c.revision};}
  async commitAiReply(id,token,text){const c=await this.getConversation(id); if(c.status!=='ai_active'||token.conversationId!==id||token.revision!==c.revision) return false; await this._add(id,'assistant',text); return true;}
  async takeOver(id,ownerId){const c=await this.getConversation(id); c.status='human_active'; c.ownerId=ownerId; c.revision++; c.updatedAt=this.now(); return this.repo.saveConversation(c);}
  async releaseToAi(id,ownerId){const c=await this.getConversation(id); if(c.ownerId&&c.ownerId!==ownerId) throw new Error('OWNER_MISMATCH'); c.status='ai_active'; c.ownerId=null; c.revision++; c.updatedAt=this.now(); return this.repo.saveConversation(c);}
  async postOwnerMessage(id,ownerId,text){const c=await this.getConversation(id); if(c.status!=='human_active') throw new Error('HUMAN_NOT_ACTIVE'); if(c.ownerId&&c.ownerId!==ownerId) throw new Error('OWNER_MISMATCH'); return this._add(id,'owner',String(text).trim(),ownerId);}
  async claimNotificationMilestone(id,milestone){await this.getConversation(id); return this.repo.claimMilestone(`${id}:${milestone}`);}
}
