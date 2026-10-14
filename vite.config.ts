import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Relativní base: stejný build funguje na GitHub Pages (/<repo>/) i lokálně.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      // Nová verze se nenačte sama (zabila by rozehranou hru); aplikace nabídne tlačítko Obnovit.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon.svg'],
      manifest: {
        name: "Poker – Texas Hold'em",
        short_name: 'Poker',
        description: "Texas Hold'em turnaj proti botům i s přáteli.",
        lang: 'cs',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#0e0a0a',
        theme_color: '#0e0a0a',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        // Všechny soubory včetně písma, aby hra šla spustit bez internetu.
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
