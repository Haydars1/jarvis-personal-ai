export type Language = 'de' | 'tr' | 'en';
export type ChatStatus = 'ai_active' | 'human_active' | 'waiting' | 'closed';
export type ChatSender = 'visitor' | 'ai' | 'owner' | 'system';

export interface VehicleContext {
  brand?: string;
  model?: string;
  body?: string;
  year?: number;
  engine?: string;
}

export interface Conversation {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: ChatStatus;
  revision: number;
  language: Language;
  pagePath?: string;
  faultCode?: string;
  vehicle?: VehicleContext;
  visitorSessionId?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  preferredContact?: string;
  assignedTo?: string;
  aiResumeEnabled: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  sender: ChatSender;
  body: string;
  createdAt: string;
  idempotencyKey?: string;
}

export interface CreateConversationInput {
  id: string;
  language: Language;
  pagePath?: string;
  faultCode?: string;
  vehicle?: VehicleContext;
  visitorSessionId?: string;
}

export interface AppendMessageInput {
  id: string;
  conversationId: string;
  sender: ChatSender;
  body: string;
  idempotencyKey?: string;
}

export interface ConversationContextPatch {
  language?: Language;
  pagePath?: string;
  faultCode?: string;
  vehicle?: VehicleContext;
  visitorSessionId?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  preferredContact?: string;
}

export type AiCommitResult = 'sent' | 'stale';
