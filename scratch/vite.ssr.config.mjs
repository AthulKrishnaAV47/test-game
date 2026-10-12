import { defineConfig } from 'vite';

// Builds the game for Node/jsdom so the integration harness can boot it.
export default defineConfig({
  configFile: false,
  logLevel: 'warn',
  define: { 'process.env.NODE_ENV': '"test"' },
  resolve: { conditions: ['browser', 'module', 'default'], mainFields: ['browser', 'module', 'main'] },
  ssr: { noExternal: true, target: 'node' },
  build: {
    ssr: 'scratch/ssr_entry.mjs',
    outDir: 'scratch/build',
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
  },
});
