import type {
  ChatApi,
  ChatConversation,
  ChatMessage,
  SendMessagePayload,
  StartConversationPayload,
} from './types';

export interface ChatApiOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

function normalizeApiRoot(value: string): string {
  const root = value.trim().replace(/\/+$/, '');
  return root.endsWith('/api') ? root : `${root}/api`;
}

async function readJson<T>(response: Response | { ok: boolean; json(): Promise<unknown> }): Promise<T> {
  if (!response.ok) {
    throw new Error('Chat API request failed');
  }
  return response.json() as Promise<T>;
}

export function createChatApi({ baseUrl, fetchImpl = fetch }: ChatApiOptions): ChatApi {
  const root = normalizeApiRoot(baseUrl);

  const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetchImpl(`${root}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    return readJson<T>(response);
  };

  return {
    startConversation(payload: StartConversationPayload) {
      return request<ChatConversation>('/chat/start', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    sendMessage(conversationId: string, payload: SendMessagePayload) {
      return request<ChatMessage>(`/chat/${encodeURIComponent(conversationId)}/messages`, {
        method: 'POST',
        headers: { 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify(payload),
      });
    },

    getConversation(conversationId: string) {
      return request<ChatConversation>(`/chat/${encodeURIComponent(conversationId)}`);
    },
  };
}
