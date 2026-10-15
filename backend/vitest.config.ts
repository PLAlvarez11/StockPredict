import { defineConfig } from 'vitest/config';
import { ENTORNO_PRUEBAS } from './test/entorno.ts';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/detector-suspension.ts'],
    env: ENTORNO_PRUEBAS,
    fileParallelism: false,
  },
});
