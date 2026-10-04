import type { D1Database, D1RunResult } from '../env';
import type {
  AiCommitResult,
  AppendMessageInput,
  Conversation,
  ConversationContextPatch,
  CreateConversationInput,
  Message,
} from './types';

type ConversationRow = {
  id: string;
  created_at: string;
  updated_at: string;
  status: Conversation['status'];
  revision: number;
  language: Conversation['language'];
  page_path: string | null;
  fault_code: string | null;
  vehicle_json: string | null;
  visitor_session_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  preferred_contact: string | null;
  assigned_to: string | null;
  ai_resume_enabled: number;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender: Message['sender'];
  body: string;
  created_at: string;
  idempotency_key: string | null;
};

function changes(result: D1RunResult | undefined): number {
  return Number(result?.meta?.changes ?? 0);
}

function parseVehicle(raw: string | null): Conversation['vehicle'] {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function mapConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    revision: Number(row.revision),
    language: row.language,
    pagePath: row.page_path ?? undefined,
    faultCode: row.fault_code ?? undefined,
    vehicle: parseVehicle(row.vehicle_json),
    visitorSessionId: row.visitor_session_id ?? undefined,
    contactName: row.contact_name ?? undefined,
    contactPhone: row.contact_phone ?? undefined,
    contactEmail: row.contact_email ?? undefined,
    preferredContact: row.preferred_contact ?? undefined,
    assignedTo: row.assigned_to ?? undefined,
    aiResumeEnabled: Boolean(row.ai_resume_enabled),
  };
}

function mapMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    sender: row.sender,
    body: row.body,
    createdAt: row.created_at,
    idempotencyKey: row.idempotency_key ?? undefined,
  };
}

export class ChatRepository {
  constructor(private readonly db: D1Database) {}

  async createConversation(input: CreateConversationInput): Promise<Conversation> {
    const now = new Date().toISOString();
    await this.db.prepare(`
      /* chat:create-conversation */
      INSERT INTO conversations (
        id, created_at, updated_at, status, revision, language, page_path,
        fault_code, vehicle_json, visitor_session_id, ai_resume_enabled
      ) VALUES (?, ?, ?, 'ai_active', 0, ?, ?, ?, ?, ?, 1)
    `).bind(
      input.id,
      now,
      now,
      input.language,
      input.pagePath ?? null,
      input.faultCode ?? null,
      input.vehicle ? JSON.stringify(input.vehicle) : null,
      input.visitorSessionId ?? null,
    ).run();

    const created = await this.getConversation(input.id);
    if (!created) throw new Error('conversation_create_failed');
    return created;
  }

  async getConversation(id: string): Promise<Conversation | null> {
    const row = await this.db.prepare(`
      /* chat:get-conversation */
      SELECT * FROM conversations WHERE id = ? LIMIT 1
    `).bind(id).first<ConversationRow>();
    return row ? mapConversation(row) : null;
  }

  async appendMessage(input: AppendMessageInput): Promise<boolean> {
    const now = new Date().toISOString();
    const result = await this.db.prepare(`
      /* chat:append-message */
      INSERT OR IGNORE INTO messages (
        id, conversation_id, sender, body, created_at, idempotency_key
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      input.id,
      input.conversationId,
      input.sender,
      input.body,
      now,
      input.idempotencyKey ?? null,
    ).run();
    return changes(result) > 0;
  }

  async listMessages(conversationId: string): Promise<Message[]> {
    const { results } = await this.db.prepare(`
      /* chat:list-messages */
      SELECT * FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC, id ASC
    `).bind(conversationId).all<MessageRow>();
    return results.map(mapMessage);
  }

  async updateConversationContext(id: string, patch: ConversationContextPatch): Promise<boolean> {
    const current = await this.getConversation(id);
    if (!current) return false;
    const now = new Date().toISOString();

    const result = await this.db.prepare(`
      /* chat:update-context */
      UPDATE conversations SET
        updated_at = ?,
        language = ?,
        page_path = ?,
        fault_code = ?,
        vehicle_json = ?,
        visitor_session_id = ?,
        contact_name = ?,
        contact_phone = ?,
        contact_email = ?,
        preferred_contact = ?
      WHERE id = ?
    `).bind(
      now,
      patch.language ?? current.language,
      patch.pagePath ?? current.pagePath ?? null,
      patch.faultCode ?? current.faultCode ?? null,
      patch.vehicle ? JSON.stringify(patch.vehicle) : current.vehicle ? JSON.stringify(current.vehicle) : null,
      patch.visitorSessionId ?? current.visitorSessionId ?? null,
      patch.contactName ?? current.contactName ?? null,
      patch.contactPhone ?? current.contactPhone ?? null,
      patch.contactEmail ?? current.contactEmail ?? null,
      patch.preferredContact ?? current.preferredContact ?? null,
      id,
    ).run();

    return changes(result) > 0;
  }

  async claimHumanTakeover(id: string, assignedTo: string): Promise<boolean> {
    const now = new Date().toISOString();
    const result = await this.db.prepare(`
      /* chat:human-takeover */
      UPDATE conversations
      SET status = 'human_active', revision = revision + 1, updated_at = ?, assigned_to = ?
      WHERE id = ? AND status <> 'closed'
    `).bind(now, assignedTo, id).run();
    return changes(result) > 0;
  }

  async releaseHumanTakeover(id: string): Promise<boolean> {
    const now = new Date().toISOString();
    const result = await this.db.prepare(`
      /* chat:release-takeover */
      UPDATE conversations
      SET status = 'ai_active', revision = revision + 1, updated_at = ?, assigned_to = NULL
      WHERE id = ? AND status = 'human_active'
    `).bind(now, id).run();
    return changes(result) > 0;
  }

  async beginAiTurn(id: string): Promise<{ revision: number } | null> {
    const row = await this.db.prepare(`
      /* chat:begin-ai-turn */
      SELECT revision FROM conversations
      WHERE id = ? AND status = 'ai_active' AND ai_resume_enabled = 1
      LIMIT 1
    `).bind(id).first<{ revision: number }>();
    return row ? { revision: Number(row.revision) } : null;
  }

  async commitAiTurn(
    conversationId: string,
    expectedRevision: number,
    messageId: string,
    body: string,
  ): Promise<AiCommitResult> {
    const now = new Date().toISOString();
    const insert = this.db.prepare(`
      /* chat:commit-ai-message */
      INSERT INTO messages (id, conversation_id, sender, body, created_at)
      SELECT ?, ?, 'ai', ?, ?
      FROM conversations
      WHERE id = ? AND status = 'ai_active' AND revision = ? AND ai_resume_enabled = 1
    `).bind(messageId, conversationId, body, now, conversationId, expectedRevision);

    const bump = this.db.prepare(`
      /* chat:bump-ai-revision */
      UPDATE conversations
      SET revision = revision + 1, updated_at = ?
      WHERE id = ? AND status = 'ai_active' AND revision = ? AND ai_resume_enabled = 1
    `).bind(now, conversationId, expectedRevision);

    const [insertResult, bumpResult] = await this.db.batch<D1RunResult>([insert, bump]);
    return changes(insertResult) > 0 && changes(bumpResult) > 0 ? 'sent' : 'stale';
  }

  async recordMilestone(conversationId: string, milestone: string): Promise<boolean> {
    const result = await this.db.prepare(`
      /* chat:record-milestone */
      INSERT OR IGNORE INTO notification_milestones (conversation_id, milestone, created_at)
      VALUES (?, ?, ?)
    `).bind(conversationId, milestone, new Date().toISOString()).run();
    return changes(result) > 0;
  }
}
