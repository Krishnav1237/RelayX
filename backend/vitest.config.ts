import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    exclude: ['dist/**', 'node_modules/**'],
    testTimeout: 30000,
  },
});
