import { env } from '../src/config/env.js';
import { prisma } from '../src/shared/db/prisma.js';
import { CONTRASENA_DEMO, CORREO_DEMO, sembrarDemo } from './demo.js';

async function main() {
  if (env.NODE_ENV === 'production') throw new Error('No se ejecuta en producción');
  const base = new URL(env.DATABASE_URL).pathname.slice(1);
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE usuario, categoria, producto, venta, movimiento_inventario, token_recuperacion RESTART IDENTITY CASCADE',
  );
  await sembrarDemo();
  console.log(`Base "${base}" reiniciada con los datos de la demo.`);
  console.log(`Entrar con ${CORREO_DEMO} / ${CONTRASENA_DEMO}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
