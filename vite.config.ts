import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [tailwindcss(), preact()],
  resolve: {
    alias: {
      '@app': resolve(__dirname, 'src/app'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@storage': resolve(__dirname, 'src/storage'),
      '@services': resolve(__dirname, 'src/services'),
    },
  },
})
