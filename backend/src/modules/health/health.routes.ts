import { Router } from 'express';
import { prisma } from '../../shared/db/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';

export const healthRouter = Router();

healthRouter.get('/live', (_req, res) => {
  res.json({ status: 'ok' });
});

healthRouter.get('/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    throw new AppError(503, 'NOT_READY', 'Base de datos no disponible');
  }
  res.json({ status: 'ok', database: 'up' });
});
