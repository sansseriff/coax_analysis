import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Relative base so one build works both at a domain root (the Docker server)
  // and under the GitHub Pages project subpath /coax_analysis/.
  base: './',
  plugins: [svelte(), tailwindcss()],
})
