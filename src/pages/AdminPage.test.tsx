import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { AdminApi, AdminConversationDetail } from '../admin/api';
import { AdminChatPage } from './AdminChatPage';
import { AdminPage } from './AdminPage';

const conversation = {
  id: 'c1',
  createdAt: '2026-10-04T12:00:00.000Z',
  updatedAt: '2026-10-04T12:05:00.000Z',
  status: 'ai_active' as const,
  revision: 0,
  language: 'tr' as const,
  faultCode: 'P0299',
  contactPhone: '+491788354756',
  vehicle: { brand: 'Volkswagen', model: 'Passat', body: 'B8', year: 2017, engine: '2.0 TDI CRLB' },
  aiResumeEnabled: true,
};

function adminApi(overrides: Partial<AdminApi> = {}): AdminApi {
  const detail: AdminConversationDetail = { conversation, messages: [] };
  return {
    listConversations: vi.fn().mockResolvedValue([conversation]),
    getConversation: vi.fn().mockResolvedValue(detail),
    takeover: vi.fn().mockResolvedValue({ ...conversation, status: 'human_active' }),
    release: vi.fn().mockResolvedValue(conversation),
    reply: vi.fn().mockResolvedValue({ id: 'm1', conversationId: 'c1', sender: 'owner', body: 'Merhaba.', createdAt: '2026-10-04T12:06:00.000Z' }),
    ...overrides,
  };
}

describe('AdminPage', () => {
  it('renders conversation status, vehicle and fault context', async () => {
    render(<MemoryRouter><AdminPage api={adminApi()} /></MemoryRouter>);
    expect(await screen.findByRole('heading', { level: 2, name: 'P0299' })).toBeInTheDocument();
    expect(screen.getByText(/Volkswagen · Passat · B8/)).toBeInTheDocument();
    expect(screen.getByText(/ai_active/i)).toBeInTheDocument();
  });
});

describe('AdminChatPage', () => {
  it('takes over, accepts owner reply only in human mode, and releases', async () => {
    const takeover = vi.fn().mockResolvedValue({ ...conversation, status: 'human_active' as const });
    const release = vi.fn().mockResolvedValue(conversation);
    const reply = vi.fn().mockResolvedValue({ id: 'm1', conversationId: 'c1', sender: 'owner' as const, body: 'Kontrol ediyorum.', createdAt: '2026-10-04T12:06:00.000Z' });
    const api = adminApi({ takeover, release, reply });

    render(<MemoryRouter><AdminChatPage api={api} conversationId="c1" /></MemoryRouter>);
    expect(await screen.findByRole('heading', { level: 1, name: 'P0299' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /devral/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /gönder/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /devral/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /ai.*devret/i })).toBeInTheDocument());
    expect(takeover).toHaveBeenCalledWith('c1');

    const textbox = screen.getByRole('textbox', { name: /yanıt/i });
    fireEvent.change(textbox, { target: { value: 'Kontrol ediyorum.' } });
    fireEvent.click(screen.getByRole('button', { name: /gönder/i }));
    await waitFor(() => expect(reply).toHaveBeenCalledWith('c1', 'Kontrol ediyorum.'));

    fireEvent.click(screen.getByRole('button', { name: /ai.*devret/i }));
    await waitFor(() => expect(release).toHaveBeenCalledWith('c1'));
  });

  it('polls the active admin chat and shows new visitor messages without reloading', async () => {
    const getConversation = vi.fn()
      .mockResolvedValueOnce({
        conversation: { ...conversation, status: 'human_active' as const },
        messages: [{ id: 'm1', conversationId: 'c1', sender: 'visitor' as const, body: 'İlk mesaj', createdAt: '2026-10-04T12:05:00.000Z' }],
      })
      .mockResolvedValue({
        conversation: { ...conversation, status: 'human_active' as const },
        messages: [
          { id: 'm1', conversationId: 'c1', sender: 'visitor' as const, body: 'İlk mesaj', createdAt: '2026-10-04T12:05:00.000Z' },
          { id: 'm2', conversationId: 'c1', sender: 'visitor' as const, body: 'Yeni mesaj geldi', createdAt: '2026-10-04T12:06:00.000Z' },
        ],
      });
    const api = adminApi({ getConversation });

    render(
      <MemoryRouter>
        <AdminChatPage api={api} conversationId="c1" pollIntervalMs={20} />
      </MemoryRouter>,
    );

    expect(await screen.findByText('İlk mesaj')).toBeInTheDocument();
    await waitFor(() => expect(getConversation.mock.calls.length).toBeGreaterThanOrEqual(2), { timeout: 800 });
    expect(await screen.findByText('Yeni mesaj geldi')).toBeInTheDocument();
  });
});
