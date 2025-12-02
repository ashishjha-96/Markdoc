import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../priv/static',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/socket': {
        target: 'ws://localhost:4000',
        ws: true,
      },
    },
  },
})
