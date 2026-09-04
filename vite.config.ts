import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Tale Dives is a client-only SPA (Blueprint §1.1) — no server, no backend.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
  },
  // Relative base so the build works from any subpath (e.g. a GitHub Pages
  // project page at /tale-dives/) without hardcoding the repo name — safe
  // here since there's no URL-based router, just in-app screen state.
  base: './',
})
