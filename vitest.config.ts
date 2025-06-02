import * as path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'packages/*/src/**/*.test.ts',
      'packages/*/tests/**/*.test.ts',
      'packages/*/tests/**/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['packages/*/src/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.d.ts',
        '**/node_modules/**',
        '**/dist/**',
        '**/types/**/*.ts',
        '**/scripts/**',
        '**/examples/**',
        '**/mocks/**',
        '**/*.config.ts',
      ],
      all: true,
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
    typecheck: {
      enabled: true,
      tsconfig: './tsconfig.json',
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    restoreMocks: true,
    mockReset: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
  // Configure module aliases to resolve workspace dependencies
  resolve: {
    alias: {
      '@aship/core': path.resolve(__dirname, 'packages/core/src'),
      '@aship/cli': path.resolve(__dirname, 'packages/cli/src'),
    },
  },
});
