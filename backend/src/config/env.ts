import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const envPath = fileURLToPath(new URL('../../../.env', import.meta.url));
if (process.env['NODE_ENV'] !== 'test' && existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const entero = (por: number) => z.coerce.number().int().default(por);

const esquema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: entero(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  SESSION_DAYS: entero(7),
  BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(12),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  APP_BASE_URL: z.string().url().default('http://localhost:5173'),
  STOCK_BAJO_UMBRAL: z.coerce.number().int().min(0).default(3),
  TIMEZONE: z.string().default('America/Guatemala'),
  RESET_TOKEN_MINUTES: entero(30),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: entero(1025),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  MAIL_FROM: z.string().default('StockPredict <no-reply@stockpredict.local>'),
  RATE_LIMIT_LOGIN_MAX: entero(5),
  RATE_LIMIT_LOGIN_WINDOW_MIN: entero(15),
  RATE_LIMIT_RECOVER_MAX: entero(3),
  RATE_LIMIT_RECOVER_WINDOW_MIN: entero(60),
});

const resultado = esquema.safeParse(process.env);

if (!resultado.success) {
  const detalle = resultado.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Variables de entorno inválidas:\n${detalle}`);
}

if (resultado.data.NODE_ENV === 'production' && resultado.data.JWT_SECRET.includes('cambia-esto')) {
  throw new Error('JWT_SECRET sigue con el valor de ejemplo');
}

export const env = resultado.data;
export type Env = typeof env;
