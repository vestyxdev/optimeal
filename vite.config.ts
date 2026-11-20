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
        // verzovaná cesta assetů – otočí VŠECHNY url chunků najednou,
        // takže prohlížečem otrávené cache záznamy (např. text/html
        // uložený pod starou url s immutable hlavičkou) přestanou vadit
        entryFileNames: "assets/v2/[name]-[hash].js",
        chunkFileNames: "assets/v2/[name]-[hash].js",
        assetFileNames: "assets/v2/[name]-[hash][extname]",
        // vendor chunky se mění jen při upgradeu závislostí → dlouhá cache,
        // aplikační kód se mění při každém release
        codeSplitting: {
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
