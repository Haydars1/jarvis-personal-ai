import type {
  AppendMessageInput,
  Conversation,
  ConversationContextPatch,
  CreateConversationInput,
  Message,
} from '../db/types';
import { extractContactPatch } from './contact-extraction';
import type { StartChatPayload, VisitorMessagePayload } from './schemas';

export interface ChatStore {
  createConversation(input: CreateConversationInput): Promise<Conversation>;
  getConversation(id: string): Promise<Conversation | null>;
  appendMessage(input: AppendMessageInput): Promise<boolean>;
  listMessages(conversationId: string): Promise<Message[]>;
  updateConversationContext(id: string, patch: ConversationContextPatch): Promise<boolean>;
}

export interface VisitorConversation {
  id: string;
  status: Conversation['status'];
  language: Conversation['language'];
  pagePath?: string;
  faultCode?: string;
  vehicle?: Conversation['vehicle'];
  messages: Message[];
}

function publicMessage(message: Message): Message {
  const { id, conversationId, sender, body, createdAt } = message;
  return { id, conversationId, sender, body, createdAt };
}

function visitorSafe(conversation: Conversation, messages: Message[]): VisitorConversation {
  return {
    id: conversation.id,
    status: conversation.status,
    language: conversation.language,
    pagePath: conversation.pagePath,
    faultCode: conversation.faultCode,
    vehicle: conversation.vehicle,
    messages: messages.map(publicMessage),
  };
}

function byIdempotency(messages: Message[], key: string): Message | undefined {
  return messages.find((message) => message.idempotencyKey === key);
}

function hasPatchValues(patch: ConversationContextPatch): boolean {
  return Object.values(patch).some((value) => value !== undefined);
}

export class ChatService {
  constructor(private readonly store: ChatStore) {}

  async start(payload: StartChatPayload): Promise<VisitorConversation> {
    const id = crypto.randomUUID();
    await this.store.createConversation({
      id,
      language: payload.language,
      pagePath: payload.pagePath,
      faultCode: payload.faultCode,
      vehicle: payload.vehicle,
      visitorSessionId: payload.visitorSessionId,
    });

    const contactPatch = extractContactPatch(payload.message);
    if (hasPatchValues(contactPatch)) {
      await this.store.updateConversationContext(id, contactPatch);
    }

    await this.store.appendMessage({
      id: crypto.randomUUID(),
      conversationId: id,
      sender: 'visitor',
      body: payload.message,
    });

    const conversation = await this.store.getConversation(id);
    if (!conversation) throw new Error('conversation_missing_after_create');
    return visitorSafe(conversation, await this.store.listMessages(id));
  }

  async get(id: string): Promise<VisitorConversation | null> {
    const conversation = await this.store.getConversation(id);
    if (!conversation) return null;
    return visitorSafe(conversation, await this.store.listMessages(id));
  }

  async postMessage(
    conversationId: string,
    payload: VisitorMessagePayload,
    idempotencyKey: string,
  ): Promise<{ message: Message; duplicate: boolean } | null> {
    const conversation = await this.store.getConversation(conversationId);
    if (!conversation) return null;

    const patch: ConversationContextPatch = {
      language: payload.language,
      ...extractContactPatch(payload.message),
    };
    if (payload.pagePath) patch.pagePath = payload.pagePath;
    if (payload.faultCode) patch.faultCode = payload.faultCode;
    if (payload.vehicle) patch.vehicle = payload.vehicle;
    if (payload.visitorSessionId) patch.visitorSessionId = payload.visitorSessionId;
    await this.store.updateConversationContext(conversationId, patch);

    const before = await this.store.listMessages(conversationId);
    const existing = byIdempotency(before, idempotencyKey);
    if (existing) return { message: publicMessage(existing), duplicate: true };

    const input: AppendMessageInput = {
      id: crypto.randomUUID(),
      conversationId,
      sender: 'visitor',
      body: payload.message,
      idempotencyKey,
    };
    const inserted = await this.store.appendMessage(input);
    const after = await this.store.listMessages(conversationId);
    const stored = byIdempotency(after, idempotencyKey);
    if (!stored) throw new Error(inserted ? 'message_persist_failed' : 'idempotent_message_lookup_failed');
    return { message: publicMessage(stored), duplicate: !inserted };
  }
}
