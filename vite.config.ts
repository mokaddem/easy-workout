/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Latin covers French and English text; Latin Extended (œ, €…) is precached too.
const FIRST_SCREEN_FONT = /archivo-latin-wdth-normal-[\w-]+\.woff2$/;

/** Preloads the font the first screen needs, so numerals never render in a wide fallback. */
function preloadFont(match: RegExp): Plugin {
  let base = '/';
  return {
    name: 'preload-font',
    apply: 'build',
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml(_html, ctx) {
      const file = Object.keys(ctx.bundle ?? {}).find((name) => match.test(name));
      if (!file) return [];
      return [
        {
          tag: 'link',
          attrs: {
            rel: 'preload',
            as: 'font',
            type: 'font/woff2',
            href: base + file,
            crossorigin: '',
          },
          injectTo: 'head',
        },
      ];
    },
  };
}

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    preloadFont(FIRST_SCREEN_FONT),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      workbox: {
        globPatterns: ['**/*.{js,wasm,css,html}', '**/archivo-latin*-wdth-normal-*.woff2'],
      },
      manifest: {
        name: 'Easy Workout',
        short_name: 'Workout',
        display: 'standalone',
        start_url: '/',
        background_color: '#11131A',
        theme_color: '#11131A',
        // TODO: final icons
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
    }),
  ],
  test: {
    // Each worker loads the whole catalogue and a DOM: a few at a time keeps memory in check.
    maxWorkers: 4,
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
