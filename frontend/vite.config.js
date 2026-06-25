import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Vitest's transform pipeline doesn't pick up the automatic JSX runtime
  // for .test.jsx files the same way the real Vite build/dev server does —
  // inject the React import explicitly so test files can use JSX without
  // each one needing its own import. Scoped to Vitest only (process.env.VITEST):
  // applying this globally broke `vite dev`'s dependency scan, since
  // main.jsx already explicitly imports React itself — the inject made
  // that a duplicate declaration. `vite build` happened to not hit this
  // (it uses oxc, not esbuild, for the real build), but dev's pre-bundling
  // scan does still go through esbuild regardless of that switch.
  esbuild: process.env.VITEST ? { jsxInject: `import React from 'react'` } : undefined,
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
