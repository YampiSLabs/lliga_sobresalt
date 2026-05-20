import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import preact from "@astrojs/preact";
import mdx from "@astrojs/mdx";

const site = process.env.PUBLIC_SITE_URL || "https://beatrizagent.github.io/lliga_sobresalt";
const base = process.env.PUBLIC_BASE_PATH || "/";

export default defineConfig({
  site,
  base,
  output: "static",
  i18n: {
    defaultLocale: "ca",
    locales: ["ca", "es", "en"],
    routing: {
      prefixDefaultLocale: false,
    },
  },
  integrations: [sitemap(), preact(), mdx()],
  vite: {
    plugins: [tailwindcss()],
    server: {
      proxy: {
        "/api": {
          target: "http://localhost:8000",
          changeOrigin: true,
        },
        "/media": {
          target: "http://localhost:8000",
          changeOrigin: true,
        },
      },
    },
  },
});
