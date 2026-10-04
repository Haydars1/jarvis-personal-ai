import { Route, Routes, useParams } from 'react-router-dom';

function HomePage() {
  return (
    <main>
      <p className="eyebrow">DIAGNOSE · CODIERUNG · SOFTWARE</p>
      <h1>6006 PERFORMANCE</h1>
      <p>Standalone Cloudflare runtime is active.</p>
    </main>
  );
}

function FaultPage() {
  const { code } = useParams<{ code: string }>();
  return (
    <main>
      <p>6006 PERFORMANCE</p>
      <h1>Fehlercode {code?.toUpperCase()}</h1>
    </main>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/fehlercodes/:code" element={<FaultPage />} />
    </Routes>
  );
}
