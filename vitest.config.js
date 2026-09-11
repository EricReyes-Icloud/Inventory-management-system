import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    root: 'backend',
    include: ['tests/**/*.test.*'],
    globals: true,
    environment: 'node',
  },
})
