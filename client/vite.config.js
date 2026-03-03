import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { execSync } from "child_process";

const commitHash = process.env.COMMIT_SHA
  || (() => { try { return execSync("git rev-parse --short HEAD").toString().trim(); } catch { return "dev"; } })();

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
  server: {
    proxy: { "/api": "http://localhost:9092" }
  }
});
