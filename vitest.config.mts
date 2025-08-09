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
        // Exclude seed and generated files
        'prisma/seed.ts',
        'prisma/seed/**',
        'generated/**',
        // Exclude Prisma client setup
        'lib/db.ts',
        // Auth framework wiring (covered via integration/e2e instead)
        'auth.ts',
        // Exclude NextAuth API routes directory (bracket folder needs glob)
        'app/api/auth/**',
        'middleware.ts',
        // Logger infra (optional to unit test)
        'lib/logger.ts',
      ],
      reporter: ['text', 'json', 'html'],
      all: true,
    },
  },
});
