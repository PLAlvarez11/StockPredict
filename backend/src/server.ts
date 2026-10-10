import { crearApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './shared/db/prisma.js';
import { logger } from './shared/logger.js';

const app = crearApp();

const servidor = app.listen(env.PORT, () => {
  logger.info({ puerto: env.PORT, entorno: env.NODE_ENV }, 'API escuchando');
});

let cerrando = false;

async function cerrar(senal: string) {
  if (cerrando) return;
  cerrando = true;
  logger.info({ senal }, 'cerrando');
  servidor.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => void cerrar('SIGINT'));
process.on('SIGTERM', () => void cerrar('SIGTERM'));
