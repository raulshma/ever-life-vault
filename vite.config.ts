import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  build: {
    sourcemap: false,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1200,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-router': ['react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-dnd': ['react-dnd', 'react-dnd-html5-backend'],
          'vendor-charts': ['recharts'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
  server: {
    host: "::",
    port: 8080,
    historyApiFallback: true,
    proxy: {
      // Forward /proxy/* to our Fastify server (running on 8787 by default)
      "/proxy": {
        target: "http://localhost:8787",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy/, ""),
      },
      "/agp": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
      "/dyn": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
      "/integrations": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
      "/aggregations": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
      "/live-share": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
      "/clips": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
      "/rss-proxy": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
      "/steam": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
      "/mal": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
      // SSH/WebTerminal endpoints (HTTP + WebSocket)
      "/ssh": {
        target: "http://localhost:8787",
        changeOrigin: true,
        ws: true,
      },
  // Note: we intentionally do NOT proxy "/infrastructure" here so that
  // SPA historyApiFallback can serve index.html for client-side routes
  // (e.g. /infrastructure) on browser reloads. API endpoints live under
  // /api/infrastructure and are proxied above.
    },
    headers: {
      // Enforce frame-ancestors via server header (meta tag can't enforce it)
      "Content-Security-Policy": "frame-ancestors 'none'; frame-src https://challenges.cloudflare.com; script-src 'self' https://challenges.cloudflare.com 'unsafe-inline';",
    },
  },
  preview: {
    headers: {
      // Enforce frame-ancestors via server header (meta tag can't enforce it)
      "Content-Security-Policy": "frame-ancestors 'none'; frame-src https://challenges.cloudflare.com; script-src 'self' https://challenges.cloudflare.com 'unsafe-inline';",
    },
  },
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler", { target: "19" }]],
      },
      jsxImportSource: undefined,
      // prune propTypes etc. handled by compiler; keep runtime lean with removeConsole in prod
    }),

  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: [
      '@supabase/supabase-js',
      'react-router-dom',
      '@tanstack/react-query',
      'lucide-react',
    ],
  },
}));
