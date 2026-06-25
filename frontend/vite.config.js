import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Theme selection is build-time config (VITE_THEME env var), not a UI
// toggle — defaults to the existing default theme if unset. main.jsx
// imports the bare specifier 'theme-active', aliased here to whichever
// theme file this build was configured for, so there's no runtime
// branching/flicker: the right CSS is baked in at build time.
const theme = process.env.VITE_THEME || 'default'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'theme-active': path.resolve(__dirname, `src/themes/${theme}.css`),
    },
  },
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
