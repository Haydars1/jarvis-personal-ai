import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createChatApi } from '../chat/api';
import type { ChatApi, ChatConversation, ChatMessage } from '../chat/types';
import { SupportChat } from './SupportChat';

const vehicle = {
  brand: 'Volkswagen',
  model: 'Passat',
  body: 'B8',
  year: '2017',
  engine: '2.0 TDI CRLB',
};

function conversation(messages: ChatMessage[] = []): ChatConversation {
  return {
    id: 'conv-1',
    status: 'ai_active',
    messages,
  };
}

describe('backend neutral chat API', () => {
  it('prefixes requests with the configured baseUrl', async () => {
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
      'https://chat.example.test/api/chat/conversations',
      expect.objectContaining({ method: 'POST' }),
    );
    vi.unstubAllGlobals();
  });
});

describe('SupportChat', () => {
  it('includes language and vehicle/fault context in start and send payloads and renders replies', async () => {
    const startConversation = vi.fn().mockResolvedValue(conversation([
      { id: 'm1', sender: 'ai', body: 'Belirtileri biraz daha anlatır mısınız?' },
    ]));
    const sendMessage = vi.fn().mockResolvedValue({
      id: 'm2',
      sender: 'ai',
      body: 'Önce basınç hattı ve kaçak kontrolü yapılmalı.',
    });
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
