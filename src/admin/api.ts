export type AdminStatus = 'ai_active' | 'human_active' | 'waiting' | 'closed';
export type AdminLanguage = 'de' | 'tr' | 'en';

export interface AdminVehicleContext {
  brand?: string;
  model?: string;
  body?: string;
  year?: number;
  engine?: string;
}

export interface AdminConversation {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: AdminStatus;
  revision: number;
  language: AdminLanguage;
  pagePath?: string;
  faultCode?: string;
  vehicle?: AdminVehicleContext;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  preferredContact?: string;
  assignedTo?: string;
  aiResumeEnabled: boolean;
}

export interface AdminMessage {
  id: string;
  conversationId: string;
  sender: 'visitor' | 'ai' | 'owner' | 'system';
  body: string;
  createdAt: string;
}

export interface AdminConversationDetail {
  conversation: AdminConversation;
  messages: AdminMessage[];
}

export interface AdminApi {
  listConversations(): Promise<AdminConversation[]>;
  getConversation(id: string): Promise<AdminConversationDetail>;
  takeover(id: string): Promise<AdminConversation>;
  release(id: string): Promise<AdminConversation>;
  reply(id: string, message: string): Promise<AdminMessage>;
}

function normalizeApiRoot(value: string): string {
  const root = value.trim().replace(/\/+$/, '');
  return root.endsWith('/api') ? root : `${root}/api`;
}

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = typeof (body as { error?: unknown }).error === 'string'
      ? (body as { error: string }).error
      : 'admin_request_failed';
    throw new Error(error);
  }
  return body as T;
}

export function createAdminApi(baseUrl: string, fetchImpl: typeof fetch = fetch): AdminApi {
  const root = normalizeApiRoot(baseUrl);

  const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetchImpl(`${root}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    return readJson<T>(response);
  };

  return {
    listConversations() {
      return request<AdminConversation[]>('/admin/conversations');
    },
    getConversation(id) {
      return request<AdminConversationDetail>(`/admin/chat/${encodeURIComponent(id)}`);
    },
    async takeover(id) {
      const result = await request<{ conversation: AdminConversation }>(`/admin/chat/${encodeURIComponent(id)}/takeover`, { method: 'POST' });
      return result.conversation;
    },
    async release(id) {
      const result = await request<{ conversation: AdminConversation }>(`/admin/chat/${encodeURIComponent(id)}/release`, { method: 'POST' });
      return result.conversation;
    },
    async reply(id, message) {
      const result = await request<{ message: AdminMessage }>(`/admin/chat/${encodeURIComponent(id)}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
      return result.message;
    },
  };
}

export function configuredApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return configured?.trim() || window.location.origin;
}
