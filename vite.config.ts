import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

/** Keep the full React runtime + React libraries in one chunk (avoids createContext/forwardRef crashes). */
function isReactVendorModule(id: string): boolean {
  return (
    /node_modules[\\/]react[\\/]/.test(id) ||
    /node_modules[\\/]react-dom[\\/]/.test(id) ||
    /node_modules[\\/]scheduler[\\/]/.test(id) ||
    id.includes("@radix-ui") ||
    id.includes("react-router") ||
    id.includes("@tanstack/") ||
    id.includes("recharts") ||
    id.includes("next-themes") ||
    id.includes("vaul") ||
    id.includes("sonner") ||
    id.includes("@dnd-kit") ||
    id.includes("react-hook-form") ||
    id.includes("react-day-picker") ||
    id.includes("react-colorful") ||
    id.includes("react-easy-crop") ||
    id.includes("react-resizable-panels") ||
    id.includes("embla-carousel-react") ||
    id.includes("lucide-react") ||
    id.includes("cmdk") ||
    id.includes("input-otp") ||
    id.includes("@floating-ui") ||
    id.includes("qrcode.react")
  );
}

function isMapsVendorModule(id: string): boolean {
  return (
    id.includes("/leaflet/") ||
    id.includes("\\leaflet\\") ||
    id.includes("react-leaflet") ||
    id.includes("@react-leaflet")
  );
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    allowedHosts: ['.lvh.me', '.scholarnerve.com', '.localhost', '.edu.localhost', '.schoolsite.localhost'],
    proxy: {
      // Same-origin /api in dev (mirrors production reverse proxy) so the PWA
      // manifest + logo endpoints resolve without the service worker.
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          proxy.on('error', (err: any) => {
            if (err?.code === 'ECONNRESET' || err?.code === 'ECONNABORTED') return;
            console.error('[vite ws proxy error]:', err?.message || err);
          });
          proxy.on('proxyReqWs', (_proxyReq, _req, socket) => {
            socket.on('error', (err: any) => {
              if (err?.code === 'ECONNRESET' || err?.code === 'ECONNABORTED') return;
              console.error('[vite ws socket error]:', err?.message || err);
            });
          });
        },
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true,
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
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["date-fns", "react-day-picker"],
  },
  build: {
    sourcemap: false,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (isReactVendorModule(id)) {
            return "vendor-react";
          }

          if (isMapsVendorModule(id)) {
            return "vendor-maps";
          }

          if (id.includes("firebase")) return "vendor-firebase";

          if (
            id.includes("jspdf") ||
            id.includes("html2canvas") ||
            id.includes("html2pdf") ||
            id.includes("dom-to-image")
          ) {
            return "vendor-pdf";
          }
          if (id.includes("xlsx") || id.includes("jszip")) return "vendor-export";
        },
      },
    },
  },
}));
