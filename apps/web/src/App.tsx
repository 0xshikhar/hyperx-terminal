import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { TerminalLayout } from "@/components/layout/TerminalLayout";

const TerminalPage = lazy(() => import("@/pages/TerminalPage").then((module) => ({ default: module.TerminalPage })));
const MarketsPage = lazy(() => import("@/pages/MarketsPage").then((module) => ({ default: module.MarketsPage })));
const PortfolioPage = lazy(() => import("@/pages/PortfolioPage").then((module) => ({ default: module.PortfolioPage })));
const LoginPage = lazy(() => import("@/pages/LoginPage").then((module) => ({ default: module.LoginPage })));
const LeaderboardPage = lazy(() => import("@/pages/LeaderboardPage").then((module) => ({ default: module.LeaderboardPage })));
const OnboardPage = lazy(() => import("@/pages/OnboardPage").then((module) => ({ default: module.OnboardPage })));

function App() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-sm text-muted-foreground">Loading terminal…</div>}>
      <Routes>
        <Route path="/" element={<Navigate to="/terminal" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/onboard" element={<OnboardPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<TerminalLayout />}>
            <Route path="/terminal" element={<TerminalPage />} />
            <Route path="/markets" element={<MarketsPage />} />
            <Route path="/portfolio" element={<PortfolioPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/terminal" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
