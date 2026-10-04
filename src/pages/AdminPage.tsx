import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { configuredApiBaseUrl, createAdminApi, type AdminApi, type AdminConversation } from '../admin/api';
import './AdminPage.css';

function vehicleLabel(conversation: AdminConversation): string {
  const vehicle = conversation.vehicle;
  return [vehicle?.brand, vehicle?.model, vehicle?.body, vehicle?.year, vehicle?.engine].filter(Boolean).join(' · ') || 'Araç bilgisi yok';
}

interface AdminPageProps {
  api?: AdminApi;
  pollIntervalMs?: number;
}

export function AdminPage({ api: injectedApi, pollIntervalMs = 5_000 }: AdminPageProps) {
  const defaultApi = useMemo(() => createAdminApi(configuredApiBaseUrl()), []);
  const api = injectedApi ?? defaultApi;
  const [items, setItems] = useState<AdminConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    let refreshing = false;

    const refresh = async (initial = false) => {
      if (refreshing) return;
      refreshing = true;
      try {
        const rows = await api.listConversations();
        if (!active) return;
        setItems(rows);
        if (initial) setError(undefined);
      } catch (reason) {
        if (active && initial) setError(reason instanceof Error ? reason.message : 'admin_load_failed');
      } finally {
        if (active && initial) setLoading(false);
        refreshing = false;
      }
    };

    void refresh(true);
    const timer = pollIntervalMs > 0
      ? window.setInterval(() => { void refresh(false); }, pollIntervalMs)
      : undefined;

    return () => {
      active = false;
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [api, pollIntervalMs]);

  return (
    <main className="adminPage">
      <header className="adminHeader">
        <Link to="/" className="adminBrand"><strong>6006</strong><span>PERFORMANCE</span></Link>
        <div><span>OWNER CONSOLE</span><h1>Müşteri sohbetleri</h1></div>
      </header>

      {loading && <p className="adminStatus">Yükleniyor…</p>}
      {error && <p className="adminError" role="alert">{error}</p>}
      {!loading && !error && items.length === 0 && <p className="adminStatus">Henüz sohbet yok.</p>}

      <section className="adminConversationList" aria-label="Müşteri sohbetleri">
        {items.map((conversation) => (
          <Link key={conversation.id} to={`/admin/chat/${encodeURIComponent(conversation.id)}`} className="adminConversationCard">
            <div className="adminConversationTopline">
              <span className={`adminState adminState-${conversation.status}`}>{conversation.status}</span>
              <time>{new Date(conversation.updatedAt).toLocaleString('de-DE')}</time>
            </div>
            <h2>{conversation.faultCode || 'Genel destek'}</h2>
            <p>{vehicleLabel(conversation)}</p>
            <div className="adminConversationMeta">
              <span>{conversation.language.toUpperCase()}</span>
              {conversation.contactPhone && <strong>{conversation.contactPhone}</strong>}
              {conversation.contactEmail && <strong>{conversation.contactEmail}</strong>}
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}
