import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  // Load env vars from the monorepo root (new-terminal-hyperx/.env)
  envDir: resolve(__dirname, "../.."),
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;

          if (id.includes("lightweight-charts")) return "vendor-charts";
          if (id.includes("@starknet-io/get-starknet")) return "vendor-wallet";
          if (id.includes("@cartridge/controller")) return "vendor-wallet";
          if (id.includes("starkzap")) return "vendor-starkzap";
          if (id.includes("starknet")) return "vendor-starknet-core";
          if (id.includes("framer-motion")) return "vendor-motion";
          if (id.includes("cmdk")) return "vendor-cmdk";
          if (id.includes("react-router-dom")) return "vendor-router";
          if (id.includes("@tanstack/react-query")) return "vendor-query";
          if (id.includes("@radix-ui")) return "vendor-radix";
          if (id.includes("react-window")) return "vendor-window";
          if (id.includes("sonner")) return "vendor-toast";

          return "vendor";
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "~": resolve(__dirname, "./src"),
    },
  },
});
