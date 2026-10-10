import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'prisma/config';

const envPath = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env['DATABASE_URL'] ?? '',
  },
});
