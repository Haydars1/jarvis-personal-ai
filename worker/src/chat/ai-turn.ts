import type { AiProvider } from '../ai/provider';
import { buildAiPrompt } from '../ai/prompt';
import type { Conversation, Message } from '../db/types';

export interface AiTurnRepository {
  getConversation(id: string): Promise<Conversation | null>;
  listMessages(conversationId: string): Promise<Message[]>;
  beginAiTurn(id: string): Promise<{ revision: number } | null>;
  commitAiTurn(
    conversationId: string,
    expectedRevision: number,
    messageId: string,
    body: string,
  ): Promise<'sent' | 'stale'>;
}

export async function runAiTurn(
  repository: AiTurnRepository,
  provider: AiProvider,
  conversationId: string,
): Promise<'sent' | 'stale' | 'disabled'> {
  const turn = await repository.beginAiTurn(conversationId);
  if (!turn) return 'disabled';

  const conversation = await repository.getConversation(conversationId);
  if (!conversation || conversation.status !== 'ai_active' || !conversation.aiResumeEnabled) {
    return 'disabled';
  }

  const messages = await repository.listMessages(conversationId);
  const prompt = buildAiPrompt({
    language: conversation.language,
    faultCode: conversation.faultCode,
    vehicle: conversation.vehicle,
    messages,
  });

  const reply = await provider.reply({
    language: conversation.language,
    prompt,
    faultCode: conversation.faultCode,
    vehicle: conversation.vehicle,
    messages,
  });

  return repository.commitAiTurn(
    conversationId,
    turn.revision,
    crypto.randomUUID(),
    reply.body,
  );
}
