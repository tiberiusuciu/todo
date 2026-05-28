import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootPkg = resolve(__dirname, "../package.json");
const clientPkg = resolve(__dirname, "package.json");
const { version } = JSON.parse(
  readFileSync(existsSync(rootPkg) ? rootPkg : clientPkg, "utf8")
) as { version: string };

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  server: {
    host: true,
    port: 5173,
    watch: {
      usePolling: process.env.CHOKIDAR_USEPOLLING === "true",
    },
    proxy: {
      "/api": process.env.VITE_API_PROXY_TARGET ?? "http://localhost:3001",
    },
  },
});
