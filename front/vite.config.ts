import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode, ssrBuild }) => ({
  server: {
    host: "::",
    port: 3000,
    watch: process.env.VITE_PROXY_API_TARGET ? { usePolling: true } : undefined,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": {
        target: process.env.VITE_PROXY_API_TARGET ?? "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  build: {
    manifest: !ssrBuild,
    ssrManifest: !ssrBuild,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
