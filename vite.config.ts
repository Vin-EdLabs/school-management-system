import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    allowedHosts: ['.lvh.me', '.scholarnerve.com', '.localhost'],
    proxy: {
      "/pwa-icon-192.png": {
        target: "http://localhost:3001",
        changeOrigin: true,
        rewrite: (path) => {
          const [, search = ""] = path.split("?");
          const params = new URLSearchParams(search);
          params.set("size", "192");
          return `/api/pwa/logo?${params.toString()}`;
        },
      },
      "/pwa-icon-512.png": {
        target: "http://localhost:3001",
        changeOrigin: true,
        rewrite: (path) => {
          const [, search = ""] = path.split("?");
          const params = new URLSearchParams(search);
          params.set("size", "512");
          return `/api/pwa/logo?${params.toString()}`;
        },
      },
    },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
