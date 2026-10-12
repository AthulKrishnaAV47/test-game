import { defineConfig } from 'vite';

/**
 * Vite configuration for StickLab.
 *
 * The game is a fully client-side bundle (Phaser 3 + Matter.js), so the only
 * thing that needs care here is making the production bundle lean and making
 * sure the dev server accepts the sandbox preview host.
 */
export default defineConfig({
  // Resolve Phaser to its ESM build so dev, production and the headless test
  // harness all use exactly the same module.
  resolve: {
    alias: {
      phaser: 'phaser/dist/phaser.esm.js',
    },
  },
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    // The Arena preview proxies the dev server through a *.e2b.app host.
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    globals: true,
  },
});
