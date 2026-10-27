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
  // only the file pages ask for a prefetch (the next file, as the reader nears it); no link prefetches by itself
  prefetch: { prefetchAll: false },
  vite: {
    // NOMINIFY=1 keeps function names readable, for profiling (scripts/switch-profile.mjs)
    build: { target: 'es2020', chunkSizeWarningLimit: 900, minify: process.env.NOMINIFY ? false : 'esbuild' },
  },
});
