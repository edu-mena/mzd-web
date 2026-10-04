import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Data da compilação, mostrada em Administração → Estado do sistema.
  define: { __BUILD__: JSON.stringify(new Date().toISOString()) },
})
