import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode, ssrBuild }) => {
  const isDockerDev = Boolean(process.env.VITE_PROXY_API_TARGET);

  return {
    server: {
      host: "::",
      port: 3000,
      watch: isDockerDev ? { usePolling: true } : undefined,
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
    optimizeDeps: {
      // Docker keeps node_modules in a named volume, so stale prebundled chunks
      // can survive rebuilds and break the dev server with 404s.
      force: isDockerDev,
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
  };
});
