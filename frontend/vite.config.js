import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    strictPort: true,
    hmr: {
      // For ngrok: use the ngrok domain for HMR WebSocket connections
      host: "affirmably-chymous-lorenza.ngrok-free.dev",
      protocol: "wss",
      clientPort: 443,
    },
  },
});
