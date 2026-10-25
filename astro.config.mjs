// @ts-check
import { defineConfig } from 'astro/config';

// GitHub Pages: SITE_URL = https://<user>.github.io, BASE_PATH = /<repo>/
// Both are injected by the deploy workflow; local dev serves from /.
const site = process.env.SITE_URL || 'https://example.github.io';
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  output: 'static',
  build: { inlineStylesheets: 'auto' },
  vite: {
    build: { target: 'es2020', chunkSizeWarningLimit: 900 },
  },
});
