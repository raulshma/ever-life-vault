import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
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
      "/aggregations": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
      "/live-share": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
    headers: {
      // Enforce frame-ancestors via server header (meta tag can't enforce it)
      "Content-Security-Policy": "frame-ancestors 'none'",
    },
  },
  preview: {
    headers: {
      "Content-Security-Policy": "frame-ancestors 'none'",
    },
  },
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler", { target: "19" }]],
      },
    }),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
