import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/audit':          { target: 'http://localhost:8000', changeOrigin: true, proxyTimeout: 600_000, timeout: 600_000 },
      '/stations':       { target: 'http://localhost:8000', changeOrigin: true },
      '/recettes':       { target: 'http://localhost:8000', changeOrigin: true, proxyTimeout: 120_000, timeout: 120_000 },
      '/analyser-excel': { target: 'http://localhost:8000', changeOrigin: true, proxyTimeout: 600_000, timeout: 600_000 },
      '/comparer':       { target: 'http://localhost:8000', changeOrigin: true, proxyTimeout: 60_000,  timeout: 60_000 },
      '/comparer-totaux':{ target: 'http://localhost:8000', changeOrigin: true, proxyTimeout: 60_000,  timeout: 60_000 },
    },
  },
})
