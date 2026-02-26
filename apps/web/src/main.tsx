import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import { Toaster } from "@/components/ui/sonner";
import { startClientServices } from "@/services/startup";
import "~/styles/globals.css";

const queryClient = new QueryClient();

export function AppRoot() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
    startClientServices();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>
);
