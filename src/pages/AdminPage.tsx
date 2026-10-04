import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { configuredApiBaseUrl, createAdminApi, type AdminApi, type AdminConversation } from '../admin/api';
import './AdminPage.css';

function vehicleLabel(conversation: AdminConversation): string {
  const vehicle = conversation.vehicle;
  return [vehicle?.brand, vehicle?.model, vehicle?.body, vehicle?.year, vehicle?.engine].filter(Boolean).join(' · ') || 'Araç bilgisi yok';
}

export function AdminPage({ api: injectedApi }: { api?: AdminApi }) {
  const defaultApi = useMemo(() => createAdminApi(configuredApiBaseUrl()), []);
  const api = injectedApi ?? defaultApi;
  const [items, setItems] = useState<AdminConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    api.listConversations()
      .then((rows) => { if (active) setItems(rows); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'admin_load_failed'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api]);

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
