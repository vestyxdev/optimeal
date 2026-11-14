import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // vendor chunky se mění jen při upgradeu závislostí → dlouhá cache,
        // aplikační kód se mění při každém release
        advancedChunks: {
          groups: [
            { name: "react-vendor", test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: "supabase", test: /node_modules[\\/]@supabase[\\/]/ },
            { name: "query-vendor", test: /node_modules[\\/]@tanstack[\\/]/ },
            { name: "router", test: /node_modules[\\/]react-router/ },
            { name: "forms", test: /node_modules[\\/](react-hook-form|@hookform|zod)[\\/]/ },
          ],
        },
      },
    },
  },
  // Vitest – testy čisté logiky (výživa, generátor, ceny) + komponenty
  // (komponentní testy si přepnou na jsdom přes pragma v souboru)
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
