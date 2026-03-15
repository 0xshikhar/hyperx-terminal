import { Navigate, Outlet, useLocation } from "react-router-dom";
import { runtimeConfig } from "@/config/runtime";
import { useAuthStore } from "@/store/authStore";

export function ProtectedRoute() {
  const location = useLocation();
  const authReady = useAuthStore((state) => state.authReady);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!runtimeConfig.protectionGateEnabled) {
    return <Outlet />;
  }

  if (!authReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-background px-6 text-center">
        <div className="space-y-2">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Protection Gate
          </div>
          <div className="text-sm text-foreground">Validating session before terminal access.</div>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Outlet />;
  }

  const next = `${location.pathname}${location.search}${location.hash}`;
  const redirect = `${runtimeConfig.protectionGateRedirectPath}?next=${encodeURIComponent(next)}`;
  return <Navigate to={redirect} replace />;
}
