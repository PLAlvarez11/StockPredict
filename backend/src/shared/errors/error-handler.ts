import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError, noEncontrado } from './app-error.js';
import { logger } from '../logger.js';

const BASE = 'https://stockpredict.local/errors';

export const rutaNoEncontrada: RequestHandler = (_req, _res, next) => {
  next(noEncontrado('La ruta solicitada no existe.'));
};

export const manejadorErrores: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = String(req.id ?? '');

  if (err instanceof AppError) {
    if (err.headers) res.set(err.headers);
    res
      .status(err.status)
      .type('application/problem+json')
      .json({
        type: `${BASE}/${err.code.toLowerCase().replaceAll('_', '-')}`,
        title: err.title,
        status: err.status,
        code: err.code,
        ...(err.detail ? { detail: err.detail } : {}),
        ...(err.errors ? { errors: err.errors } : {}),
        requestId,
      });
    return;
  }

  const esJson =
    err instanceof SyntaxError && 'body' in err && (err as { status?: number }).status === 400;
  if (esJson) {
    res
      .status(400)
      .type('application/problem+json')
      .json({
        type: `${BASE}/bad-request`,
        title: 'Solicitud inválida',
        status: 400,
        code: 'BAD_REQUEST',
        detail: 'El cuerpo de la solicitud no es JSON válido.',
        requestId,
      });
    return;
  }

  logger.error({ err, requestId }, 'error no controlado');
  res
    .status(500)
    .type('application/problem+json')
    .json({
      type: `${BASE}/internal-error`,
      title: 'Error interno',
      status: 500,
      code: 'INTERNAL_ERROR',
      detail: 'Ocurrió un error inesperado. Intenta de nuevo.',
      requestId,
    });
};
