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

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

async function readJson<T>(response: Response | { ok: boolean; json(): Promise<unknown> }): Promise<T> {
  if (!response.ok) {
    throw new Error('Chat API request failed');
  }
  return response.json() as Promise<T>;
}

export function createChatApi({ baseUrl, fetchImpl = fetch }: ChatApiOptions): ChatApi {
  const root = normalizeBaseUrl(baseUrl);

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
      return request<ChatConversation>('/chat/conversations', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    sendMessage(conversationId: string, payload: SendMessagePayload) {
      return request<ChatMessage>(`/chat/conversations/${encodeURIComponent(conversationId)}/messages`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    getConversation(conversationId: string) {
      return request<ChatConversation>(`/chat/conversations/${encodeURIComponent(conversationId)}`);
    },
  };
}
