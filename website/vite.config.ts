import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const root = new URL(".", import.meta.url).pathname;

// In development, serve the single-page web app for every /app route (Vercel does
// the same with the rewrite in vercel.json).
function appRoutes(): Plugin {
  return {
    name: "rightful-app-routes",
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        const url = request.url ?? "";
        if (url === "/app" || url.startsWith("/app/") || url.startsWith("/app?")) {
          request.url = "/app.html";
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), appRoutes()],
  appType: "mpa",
  build: {
    rollupOptions: {
      input: {
        main: `${root}index.html`,
        app: `${root}app.html`,
        privacy: `${root}privacy.html`,
        terms: `${root}terms.html`,
        support: `${root}support.html`,
      },
    },
  },
  server: { port: 5173 },
});
