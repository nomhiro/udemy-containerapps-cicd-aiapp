import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
        // Next.js の tsconfig.json の paths と揃える
        '@': path.resolve(__dirname, 'src'),
        '@/styles': path.resolve(__dirname, 'src/app/globals.css')
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    css: false,
    mockReset: true,
    deps: { inline: [/react/, /next/] },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: './coverage'
    }
  }
})
