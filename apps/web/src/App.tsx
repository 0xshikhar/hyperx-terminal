import { Navigate, Route, Routes } from "react-router-dom";
import { TerminalLayout } from "@/components/layout/TerminalLayout";
import { TerminalPage } from "@/pages/TerminalPage";
import { MarketsPage } from "@/pages/MarketsPage";
import { PortfolioPage } from "@/pages/PortfolioPage";
import { LoginPage } from "@/pages/LoginPage";
import { LeaderboardPage } from "@/pages/LeaderboardPage";
import { OnboardPage } from "@/pages/OnboardPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/terminal" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/onboard" element={<OnboardPage />} />
      <Route element={<TerminalLayout />}>
        <Route path="/terminal" element={<TerminalPage />} />
        <Route path="/markets" element={<MarketsPage />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/terminal" replace />} />
    </Routes>
  );
}

export default App;
