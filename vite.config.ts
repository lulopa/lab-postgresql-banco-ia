/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: {
    rollupOptions: {
      output: {
        // Vendors en archivos aparte: se cachean entre despliegues y se evalúan en tareas más cortas (menos TBT).
        manualChunks: {
          react: ['react', 'react-dom'],
          router: ['react-router-dom'],
          data: ['@tanstack/react-query', 'zustand'],
          i18n: ['i18next', 'react-i18next'],
        },
      },
    },
  },
  server: {
    // En desarrollo el BFF se sirve por el mismo origen para que la cookie
    // SameSite=Strict del refresh token funcione sin CORS.
    proxy: {
      '/api': { target: process.env.BFF_URL ?? 'http://localhost:8080', changeOrigin: false },
      // Login de desarrollo del BFF (solo existe con DEV_LOGIN=true)
      '/dev-idp': { target: process.env.BFF_URL ?? 'http://localhost:8080', changeOrigin: false },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}', 'bff/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html'],
      // Umbral sobre la lógica de negocio (utils, hooks, servicios) y componentes de interacción.
      include: [
        'src/utils/**',
        'src/hooks/**',
        'src/services/**',
        'src/store/**',
        'src/components/ui/Modal.tsx',
        'src/pages/cliente/transferencias/**',
      ],
      exclude: ['**/*.test.*', 'src/test/**'],
      thresholds: { lines: 75, functions: 70, statements: 75 },
    },
  },
});
