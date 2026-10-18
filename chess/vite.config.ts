import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the build works from any static path and inside
  // Capacitor's native WebViews (capacitor://localhost, https://localhost).
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 0,
    rolldownOptions: {
      output: {
        // Long-lived vendor chunks cache across app updates (and keep the app chunk small).
        codeSplitting: {
          groups: [
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 30 },
            { name: 'board-vendor', test: /node_modules[\\/](react-chessboard|@dnd-kit|chess\.js)[\\/]/, priority: 20 },
            { name: 'ui-vendor', test: /node_modules[\\/](lucide-react|@capacitor)[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
  server: {
    host: true,
  },
})
