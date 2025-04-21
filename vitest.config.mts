import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      exclude: [
        // Configuration files
        'next.config.ts',
        'tailwind.config.mjs',
        'postcss.config.mjs',
        'eslint.config.mjs',
        'vitest.config.mts',
        // Type definitions
        '**/*.d.ts',
        // Test files
        '**/*.test.ts',
        '**/*.test.tsx',
        'test/**',
        // UI components (shadcn)
        'components/ui/**',
        // Utility files
        'lib/utils.ts',
        // Next.js build output
        '.next/**',
        '**/.next/**',
        // Node modules
        'node_modules/**',
      ],
      include: ['app/**', 'components/**', 'lib/**'],
      reporter: ['text', 'json', 'html'],
      all: true,
    },
  },
});
