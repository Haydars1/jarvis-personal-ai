import { describe, expect, it } from 'vitest';
import type { D1Database, D1PreparedStatement, D1RunResult } from '../env';
import { ChatRepository } from './chat-repository';

type Row = Record<string, unknown>;

class MemoryStatement implements D1PreparedStatement {
  private values: unknown[] = [];

  constructor(private readonly db: MemoryD1, private readonly sql: string) {}

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async first<T = Row>(): Promise<T | null> {
    return this.db.first(this.sql, this.values) as T | null;
  }

  async all<T = Row>(): Promise<{ results: T[] }> {
    return { results: this.db.all(this.sql, this.values) as T[] };
  }

  async run(): Promise<D1RunResult> {
    return this.db.run(this.sql, this.values);
  }
}

class MemoryD1 implements D1Database {
  conversations = new Map<string, Row>();
  messages: Row[] = [];
  milestones = new Set<string>();

  prepare(query: string): D1PreparedStatement {
    return new MemoryStatement(this, query);
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<T[]> {
    const results: unknown[] = [];
    for (const statement of statements) results.push(await statement.run());
    return results as T[];
  }

  first(sql: string, values: unknown[]): Row | null {
    if (sql.includes('chat:get-conversation')) {
      return this.conversations.get(String(values[0])) ?? null;
    }
    if (sql.includes('chat:begin-ai-turn')) {
      const row = this.conversations.get(String(values[0]));
      if (!row || row.status !== 'ai_active') return null;
      return { revision: row.revision };
    }
    return null;
  }

  all(_sql: string, _values: unknown[]): Row[] {
    return [];
  }

  run(sql: string, values: unknown[]): D1RunResult {
    if (sql.includes('chat:create-conversation')) {
      const [id, createdAt, updatedAt, language, pagePath, faultCode, vehicleJson, visitorSessionId] = values;
      this.conversations.set(String(id), {
        id, created_at: createdAt, updated_at: updatedAt, status: 'ai_active', revision: 0,
        language, page_path: pagePath, fault_code: faultCode, vehicle_json: vehicleJson,
        visitor_session_id: visitorSessionId, contact_name: null, contact_phone: null,
        contact_email: null, preferred_contact: null, assigned_to: null, ai_resume_enabled: 1,
      });
      return { success: true, meta: { changes: 1 } };
    }

    if (sql.includes('chat:human-takeover')) {
      const [updatedAt, assignedTo, id] = values;
      const row = this.conversations.get(String(id));
      if (!row) return { success: true, meta: { changes: 0 } };
      row.status = 'human_active';
      row.revision = Number(row.revision) + 1;
      row.updated_at = updatedAt;
      row.assigned_to = assignedTo;
      return { success: true, meta: { changes: 1 } };
    }

    if (sql.includes('chat:release-takeover')) {
      const [updatedAt, id] = values;
      const row = this.conversations.get(String(id));
      if (!row) return { success: true, meta: { changes: 0 } };
      row.status = 'ai_active';
      row.revision = Number(row.revision) + 1;
      row.updated_at = updatedAt;
      row.assigned_to = null;
      return { success: true, meta: { changes: 1 } };
    }

    if (sql.includes('chat:commit-ai-message')) {
      const [messageId, conversationId, body, createdAt, expectedRevision] = values;
      const row = this.conversations.get(String(conversationId));
      if (!row || row.status !== 'ai_active' || row.revision !== expectedRevision) {
        return { success: true, meta: { changes: 0 } };
      }
      this.messages.push({ id: messageId, conversation_id: conversationId, sender: 'ai', body, created_at: createdAt });
      return { success: true, meta: { changes: 1 } };
    }

    if (sql.includes('chat:bump-ai-revision')) {
      const [updatedAt, id, expectedRevision] = values;
      const row = this.conversations.get(String(id));
      if (!row || row.status !== 'ai_active' || row.revision !== expectedRevision) {
        return { success: true, meta: { changes: 0 } };
      }
      row.revision = Number(row.revision) + 1;
      row.updated_at = updatedAt;
      return { success: true, meta: { changes: 1 } };
    }

    if (sql.includes('chat:record-milestone')) {
      const [conversationId, milestone] = values;
      const key = `${conversationId}:${milestone}`;
      if (this.milestones.has(key)) return { success: true, meta: { changes: 0 } };
      this.milestones.add(key);
      return { success: true, meta: { changes: 1 } };
    }

    return { success: true, meta: { changes: 0 } };
  }
}

function makeRepo() {
  const db = new MemoryD1();
  return { db, repo: new ChatRepository(db) };
}

describe('ChatRepository', () => {
  it('creates conversations in ai_active state', async () => {
    const { repo } = makeRepo();
    const created = await repo.createConversation({
      id: 'c1', language: 'tr', pagePath: '/fehlercodes/P0299', faultCode: 'P0299',
      vehicle: { brand: 'Volkswagen', model: 'Passat', body: 'B8', year: 2017, engine: '2.0 TDI CRLB' },
      visitorSessionId: 'visitor-1',
    });

    expect(created.status).toBe('ai_active');
    expect(created.revision).toBe(0);
    expect(created.language).toBe('tr');
  });

  it('human takeover changes state and invalidates an in-flight AI revision', async () => {
    const { db, repo } = makeRepo();
    await repo.createConversation({ id: 'c1', language: 'de' });
    const turn = await repo.beginAiTurn('c1');
    expect(turn).toEqual({ revision: 0 });

    expect(await repo.claimHumanTakeover('c1', 'owner@example.test')).toBe(true);
    const result = await repo.commitAiTurn('c1', turn!.revision, 'ai-1', 'Das wäre eine AI-Antwort.');

    expect(result).toBe('stale');
    expect(db.messages).toHaveLength(0);
    expect((await repo.getConversation('c1'))?.status).toBe('human_active');
  });

  it('release returns the conversation to ai_active with a new revision', async () => {
    const { repo } = makeRepo();
    await repo.createConversation({ id: 'c1', language: 'de' });
    await repo.claimHumanTakeover('c1', 'owner@example.test');

    expect(await repo.releaseHumanTakeover('c1')).toBe(true);
    const conversation = await repo.getConversation('c1');
    expect(conversation?.status).toBe('ai_active');
    expect(conversation?.revision).toBe(2);
  });

  it('deduplicates notification milestones per conversation', async () => {
    const { repo } = makeRepo();
    await repo.createConversation({ id: 'c1', language: 'en' });

    expect(await repo.recordMilestone('c1', 'vehicle_complete')).toBe(true);
    expect(await repo.recordMilestone('c1', 'vehicle_complete')).toBe(false);
  });
});
