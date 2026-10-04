import { Route, Routes } from "react-router-dom";
import { AdminChatPage } from "./pages/AdminChatPage";
import { AdminPage } from "./pages/AdminPage";
import { FaultPage } from "./pages/FaultPage";
import { HomePage } from "./pages/HomePage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/fehlercodes/:code" element={<FaultPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/admin/chat/:conversationId" element={<AdminChatPage />} />
    </Routes>
  );
}
