import { defineConfig } from 'vitest/config'

// Separate from vite.config.js so unit tests don't load the mkcert/PWA dev plugins.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js']
  }
})
