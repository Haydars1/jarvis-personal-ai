import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatApiError, createChatApi } from '../chat/api';
import type { ChatApi, ChatConversation, ChatMessage } from '../chat/types';
import { SupportChat } from './SupportChat';

const vehicle = {
  brand: 'Volkswagen',
  model: 'Passat',
  body: 'B8',
  year: 2017,
  engine: '2.0 TDI CRLB',
};

function conversation(messages: ChatMessage[] = []): ChatConversation {
  return {
    id: 'conv-1',
    status: 'ai_active',
    messages,
  };
}

beforeEach(() => {
  window.sessionStorage.clear();
});

describe('backend neutral chat API', () => {
  it('prefixes requests with the configured API root', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => conversation(),
    });
    vi.stubGlobal('fetch', fetchMock);

    const api = createChatApi({ baseUrl: 'https://chat.example.test/api/' });
    await api.startConversation({
      language: 'tr',
      vehicle,
      faultCode: 'P0299',
      message: 'Turbo basıncı düşük.',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://chat.example.test/api/chat/start',
      expect.objectContaining({ method: 'POST' }),
    );
    vi.unstubAllGlobals();
  });

  it('sends visitor messages to the Worker route with an idempotency key', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => conversation([{ id: 'm1', sender: 'ai', body: 'reply' }]),
    });
    const api = createChatApi({ baseUrl: 'https://chat.example.test', fetchImpl: fetchMock as typeof fetch });

    await api.sendMessage('conv-1', {
      language: 'en', vehicle, faultCode: 'P0299', message: 'Power drops uphill.',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://chat.example.test/api/chat/conv-1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'idempotency-key': expect.any(String) }),
      }),
    );
  });

  it('exposes HTTP status when the Worker rejects a request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'conversation_not_found' }),
    });
    const api = createChatApi({ baseUrl: 'https://chat.example.test', fetchImpl: fetchMock as typeof fetch });

    await expect(api.getConversation('expired')).rejects.toMatchObject({
      name: 'ChatApiError',
      status: 404,
    });
  });
});

describe('SupportChat', () => {
  it('includes language and vehicle/fault context in start and send payloads and renders replies', async () => {
    const startConversation = vi.fn().mockResolvedValue(conversation([
      { id: 'm1', sender: 'ai', body: 'Belirtileri biraz daha anlatır mısınız?' },
    ]));
    const sendMessage = vi.fn().mockResolvedValue(conversation([
      { id: 'm1', sender: 'ai', body: 'Belirtileri biraz daha anlatır mısınız?' },
      { id: 'm2', sender: 'visitor', body: 'Yokuşta güç düşüyor.' },
      { id: 'm3', sender: 'ai', body: 'Önce basınç hattı ve kaçak kontrolü yapılmalı.' },
    ]));
    const api: ChatApi = {
      startConversation,
      sendMessage,
      getConversation: vi.fn().mockResolvedValue(conversation()),
    };

    render(<SupportChat api={api} language="tr" vehicle={vehicle} faultCode="P0299" />);

    fireEvent.click(screen.getByRole('button', { name: /teşhis sohbet/i }));
    const input = screen.getByRole('textbox', { name: /mesaj/i });
    fireEvent.change(input, { target: { value: 'Turbo basıncı düşük.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gönder' }));

    await waitFor(() => expect(startConversation).toHaveBeenCalledWith(expect.objectContaining({
      language: 'tr',
      vehicle,
      faultCode: 'P0299',
      message: 'Turbo basıncı düşük.',
    })));
    expect(window.sessionStorage.getItem('6006_chat_conversation')).toBe('conv-1');
    expect(await screen.findByText('Belirtileri biraz daha anlatır mısınız?')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'Yokuşta güç düşüyor.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gönder' }));

    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith('conv-1', expect.objectContaining({
      language: 'tr',
      vehicle,
      faultCode: 'P0299',
      message: 'Yokuşta güç düşüyor.',
    })));
    expect(await screen.findByText('Önce basınç hattı ve kaçak kontrolü yapılmalı.')).toBeInTheDocument();
  });

  it('restores an active conversation and polls owner replies without another visitor message', async () => {
    window.sessionStorage.setItem('6006_chat_conversation', 'conv-1');
    const getConversation = vi.fn()
      .mockResolvedValueOnce(conversation([{ id: 'm1', sender: 'visitor', body: 'Merhaba' }]))
      .mockResolvedValue(conversation([
        { id: 'm1', sender: 'visitor', body: 'Merhaba' },
        { id: 'm2', sender: 'owner', body: 'Merhaba, aracınızın detaylarını görüyorum.' },
      ]));
    const api: ChatApi = {
      startConversation: vi.fn(),
      sendMessage: vi.fn(),
      getConversation,
    };

    render(
      <SupportChat
        api={api}
        language="tr"
        vehicle={vehicle}
        faultCode="P0299"
        pollIntervalMs={20}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /teşhis sohbet/i }));
    expect(await screen.findByText('Merhaba')).toBeInTheDocument();
    await waitFor(() => expect(getConversation.mock.calls.length).toBeGreaterThanOrEqual(2), { timeout: 800 });
    expect(await screen.findByText('Merhaba, aracınızın detaylarını görüyorum.')).toBeInTheDocument();
  });

  it('clears an expired restored conversation and lets the next message start a fresh chat', async () => {
    window.sessionStorage.setItem('6006_chat_conversation', 'expired-conv');
    const startConversation = vi.fn().mockResolvedValue(conversation([
      { id: 'm-new', sender: 'visitor', body: 'Yeni sohbet başlasın.' },
    ]));
    const api: ChatApi = {
      startConversation,
      sendMessage: vi.fn(),
      getConversation: vi.fn().mockRejectedValue(new ChatApiError(404, 'conversation_not_found')),
    };

    render(<SupportChat api={api} language="tr" vehicle={vehicle} pollIntervalMs={20} />);
    fireEvent.click(screen.getByRole('button', { name: /teşhis sohbet/i }));

    await waitFor(() => expect(window.sessionStorage.getItem('6006_chat_conversation')).toBeNull());
    const input = screen.getByRole('textbox', { name: /mesaj/i });
    fireEvent.change(input, { target: { value: 'Yeni sohbet başlasın.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gönder' }));

    await waitFor(() => expect(startConversation).toHaveBeenCalledTimes(1));
    expect(window.sessionStorage.getItem('6006_chat_conversation')).toBe('conv-1');
  });

  it('keeps typed text when the API fails and shows a recoverable status', async () => {
    const api: ChatApi = {
      startConversation: vi.fn().mockRejectedValue(new Error('offline')),
      sendMessage: vi.fn(),
      getConversation: vi.fn(),
    };

    render(<SupportChat api={api} language="de" vehicle={{}} faultCode="P0299" />);
    fireEvent.click(screen.getByRole('button', { name: /diagnose-chat/i }));

    const input = screen.getByRole('textbox', { name: /nachricht/i });
    fireEvent.change(input, { target: { value: 'Mein Text darf nicht verloren gehen.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Senden' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/nicht gesendet/i);
    expect(input).toHaveValue('Mein Text darf nicht verloren gehen.');
  });
});