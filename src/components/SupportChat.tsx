import { FormEvent, useMemo, useState } from 'react';
import type { ChatApi, ChatMessage } from '../chat/types';
import { t, type Language } from '../i18n/language';
import type { VehicleContext } from '../vehicle/catalog';
import './SupportChat.css';

interface SupportChatProps {
  api: ChatApi;
  language: Language;
  vehicle: VehicleContext;
  faultCode?: string;
  pagePath?: string;
}

const statusCopy: Record<Language, { failed: string; sending: string; online: string }> = {
  de: {
    failed: 'Nachricht nicht gesendet. Bitte erneut versuchen.',
    sending: 'Nachricht wird gesendet …',
    online: 'Direkter Diagnose-Chat',
  },
  tr: {
    failed: 'Mesaj gönderilemedi. Lütfen tekrar deneyin.',
    sending: 'Mesaj gönderiliyor …',
    online: 'Doğrudan teşhis sohbeti',
  },
  en: {
    failed: 'Message not sent. Please try again.',
    sending: 'Sending message …',
    online: 'Direct diagnostics chat',
  },
};

function messageKey(message: ChatMessage, index: number): string {
  return message.id || `${message.sender}-${index}-${message.body}`;
}

export function SupportChat({
  api,
  language,
  vehicle,
  faultCode,
  pagePath = typeof window === 'undefined' ? '/' : window.location.pathname,
}: SupportChatProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [conversationId, setConversationId] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const status = statusCopy[language];

  const vehicleSummary = useMemo(
    () => [vehicle.brand, vehicle.model, vehicle.body, vehicle.year, vehicle.engine].filter(Boolean).join(' · '),
    [vehicle],
  );

  const context = useMemo(() => ({
    language,
    vehicle,
    faultCode,
    pagePath,
  }), [faultCode, language, pagePath, vehicle]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || sending) return;

    setSending(true);
    setError(undefined);

    try {
      if (!conversationId) {
        const conversation = await api.startConversation({ ...context, message });
        setConversationId(conversation.id);
        setMessages(conversation.messages ?? []);
      } else {
        const conversation = await api.sendMessage(conversationId, { ...context, message });
        setMessages(conversation.messages ?? []);
      }
      setDraft('');
    } catch {
      setError(status.failed);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="supportChat">
      {!open ? (
        <button className="supportChatLauncher" type="button" onClick={() => setOpen(true)}>
          <span className="supportChatPulse" aria-hidden="true" />
          {t(language, 'chat.launch')}
        </button>
      ) : (
        <section className="supportChatPanel" aria-label={t(language, 'chat.panelAria')}>
          <header className="supportChatHeader">
            <div>
              <small>6006 / LIVE SUPPORT</small>
              <h2>{t(language, 'chat.title')}</h2>
              <p>{status.online}</p>
            </div>
            <button
              type="button"
              className="supportChatClose"
              aria-label={t(language, 'chat.close')}
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </header>

          {(vehicleSummary || faultCode) && (
            <div className="supportChatContext" aria-label="chat context">
              {vehicleSummary && <span>{vehicleSummary}</span>}
              {faultCode && <strong>{faultCode}</strong>}
            </div>
          )}

          <div className="supportChatMessages" aria-live="polite">
            {messages.map((message, index) => (
              <p key={messageKey(message, index)} className={`supportChatMessage supportChatMessage-${message.sender}`}>
                {message.body}
              </p>
            ))}
          </div>

          {error && <p className="supportChatError" role="alert">{error}</p>}
          {sending && <p className="supportChatSending" role="status">{status.sending}</p>}

          <form className="supportChatForm" onSubmit={submit}>
            <textarea
              aria-label={t(language, 'chat.placeholder')}
              placeholder={t(language, 'chat.placeholder')}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={3}
            />
            <button type="submit" disabled={sending || !draft.trim()}>
              {t(language, 'chat.send')}
            </button>
          </form>

          <p className="supportChatPrivacy">{t(language, 'chat.privacy')}</p>
        </section>
      )}
    </div>
  );
}
