import type { Language, Message, VehicleContext } from '../db/types';

export interface AiReplyInput {
  language: Language;
  prompt: string;
  faultCode?: string;
  vehicle?: VehicleContext;
  messages: Message[];
}

export interface AiReply {
  body: string;
}

export interface AiProvider {
  reply(input: AiReplyInput): Promise<AiReply>;
}
