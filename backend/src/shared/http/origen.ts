import type { RequestHandler } from 'express';
import { env } from '../../config/env.js';
import { AppError } from '../errors/app-error.js';

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const verificarOrigen: RequestHandler = (req, _res, next) => {
  if (METODOS_SEGUROS.has(req.method)) {
    next();
    return;
  }
  const origen = req.headers.origin;
  if (origen && !env.CORS_ORIGINS.includes(origen)) {
    next(new AppError(403, 'ORIGIN_NOT_ALLOWED', 'Origen no permitido'));
    return;
  }
  next();
};
