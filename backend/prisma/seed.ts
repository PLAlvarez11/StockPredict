import { prisma } from '../src/shared/db/prisma.js';
import { CONTRASENA_DEMO, CORREO_DEMO, sembrarDemo } from './demo.js';

sembrarDemo()
  .then(() => console.log(`Seed listo: ${CORREO_DEMO} / ${CONTRASENA_DEMO}`))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
