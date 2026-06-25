import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Vitest's transform pipeline doesn't pick up the automatic JSX runtime
  // for .test.jsx files the same way the real Vite build/dev server does —
  // inject the React import explicitly so test files can use JSX without
  // each one needing its own import. Harmless in production builds (an
  // unused import gets tree-shaken).
  esbuild: {
    jsxInject: `import React from 'react'`,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    port: 3000,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.js'],
    globals: true,
  },
})
