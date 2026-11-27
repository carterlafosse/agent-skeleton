import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves the demo from /<repo-name>/, so the deploy workflow
  // sets VITE_BASE to that. Locally it stays at the site root.
  base: process.env.VITE_BASE ?? '/',
})
