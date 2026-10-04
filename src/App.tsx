import { Route, Routes, useParams } from "react-router-dom";
import { HomePage } from "./pages/HomePage";

function FaultPagePlaceholder() {
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
      <Route path="/fehlercodes/:code" element={<FaultPagePlaceholder />} />
    </Routes>
  );
}
