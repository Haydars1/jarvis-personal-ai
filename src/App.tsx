import { Route, Routes } from "react-router-dom";
import { FaultPage } from "./pages/FaultPage";
import { HomePage } from "./pages/HomePage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/fehlercodes/:code" element={<FaultPage />} />
    </Routes>
  );
}
