import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  configuredApiBaseUrl,
  createAdminApi,
  type AdminApi,
  type AdminConversation,
  type AdminMessage,
} from '../admin/api';
import './AdminPage.css';

function vehicleLabel(conversation?: AdminConversation): string {
  const vehicle = conversation?.vehicle;
  return [vehicle?.brand, vehicle?.model, vehicle?.body, vehicle?.year, vehicle?.engine].filter(Boolean).join(' · ') || 'Araç bilgisi yok';
}

export function AdminChatPage({ api: injectedApi, conversationId }: { api?: AdminApi; conversationId?: string }) {
  const params = useParams<{ conversationId: string }>();
  const id = conversationId ?? params.conversationId ?? '';
  const defaultApi = useMemo(() => createAdminApi(configuredApiBaseUrl()), []);
  const api = injectedApi ?? defaultApi;
  const [conversation, setConversation] = useState<AdminConversation>();
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!id) return;
    let active = true;
    api.getConversation(id)
      .then((detail) => {
        if (!active) return;
        setConversation(detail.conversation);
        setMessages(detail.messages);
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'admin_load_failed'); });
    return () => { active = false; };
  }, [api, id]);

  const takeover = async () => {
    if (!conversation || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      setConversation(await api.takeover(conversation.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'takeover_failed');
    } finally {
      setBusy(false);
    }
  };

  const release = async () => {
    if (!conversation || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      setConversation(await api.release(conversation.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'release_failed');
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async (event: FormEvent) => {
    event.preventDefault();
    if (!conversation || conversation.status !== 'human_active' || busy || !draft.trim()) return;
    const message = draft.trim();
    setBusy(true);
    setError(undefined);
    try {
      const stored = await api.reply(conversation.id, message);
      setMessages((current) => [...current, stored]);
      setDraft('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'reply_failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="adminPage adminChatPage">
      <header className="adminHeader">
        <Link to="/admin" className="adminBack">← Sohbetler</Link>
        <div><span>OWNER CONSOLE</span><h1>{conversation?.faultCode || 'Müşteri sohbeti'}</h1></div>
      </header>

      {error && <p className="adminError" role="alert">{error}</p>}
      {!conversation && !error && <p className="adminStatus">Yükleniyor…</p>}

      {conversation && (
        <>
          <section className="adminContextGrid">
            <article><span>Durum</span><strong>{conversation.status}</strong></article>
            <article><span>Araç</span><strong>{vehicleLabel(conversation)}</strong></article>
            <article><span>Arıza</span><strong>{conversation.faultCode || '—'}</strong></article>
            <article><span>Dil</span><strong>{conversation.language.toUpperCase()}</strong></article>
            <article><span>Telefon</span><strong>{conversation.contactPhone || '—'}</strong></article>
            <article><span>E-posta</span><strong>{conversation.contactEmail || '—'}</strong></article>
          </section>

          <section className="adminTakeoverBar">
            {conversation.status === 'human_active' ? (
              <button type="button" onClick={release} disabled={busy}>AI'ya devret</button>
            ) : (
              <button type="button" onClick={takeover} disabled={busy}>Sohbeti devral</button>
            )}
            <span>{conversation.assignedTo ? `Atanan: ${conversation.assignedTo}` : 'AI aktif'}</span>
          </section>

          <section className="adminMessages" aria-label="Mesajlar">
            {messages.length === 0 && <p className="adminStatus">Henüz mesaj yok.</p>}
            {messages.map((message) => (
              <article key={message.id} className={`adminMessage adminMessage-${message.sender}`}>
                <small>{message.sender}</small>
                <p>{message.body}</p>
              </article>
            ))}
          </section>

          <form className="adminReplyForm" onSubmit={sendReply}>
            <textarea
              aria-label="Yanıt"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={conversation.status === 'human_active' ? 'Müşteriye yanıt yaz…' : 'Yanıt yazmak için sohbeti devral'}
              disabled={conversation.status !== 'human_active' || busy}
              rows={4}
            />
            <button type="submit" disabled={conversation.status !== 'human_active' || busy || !draft.trim()}>Gönder</button>
          </form>
        </>
      )}
    </main>
  );
}
