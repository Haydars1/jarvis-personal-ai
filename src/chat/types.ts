import type { Language } from '../i18n/language';
import type { VehicleContext } from '../vehicle/catalog';

export type ChatSender = 'visitor' | 'ai' | 'owner' | 'system';
export type ChatStatus = 'ai_active' | 'human_active' | 'waiting' | 'closed';

export interface ChatMessage {
  id: string;
  sender: ChatSender;
  body: string;
  createdAt?: string;
}

export interface ChatConversation {
  id: string;
  status: ChatStatus;
  messages: ChatMessage[];
}

export interface ChatContextPayload {
  language: Language;
  vehicle: VehicleContext;
  faultCode?: string;
  pagePath?: string;
}

export interface StartConversationPayload extends ChatContextPayload {
  message: string;
}

export interface SendMessagePayload extends ChatContextPayload {
  message: string;
}

export interface ChatApi {
  startConversation(payload: StartConversationPayload): Promise<ChatConversation>;
  sendMessage(conversationId: string, payload: SendMessagePayload): Promise<ChatMessage>;
  getConversation(conversationId: string): Promise<ChatConversation>;
}
