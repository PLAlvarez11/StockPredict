import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { validacion, type DetalleCampo } from '../errors/app-error.js';

interface Esquemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

export const validar =
  (esquemas: Esquemas): RequestHandler =>
  (req, _res, next) => {
    const errores: DetalleCampo[] = [];

    for (const origen of ['params', 'query', 'body'] as const) {
      const esquema = esquemas[origen];
      if (!esquema) continue;
      const resultado = esquema.safeParse(req[origen]);
      if (resultado.success) {
        if (origen === 'query') {
          Object.defineProperty(req, 'query', { value: resultado.data, configurable: true });
        } else {
          (req as unknown as Record<string, unknown>)[origen] = resultado.data;
        }
      } else {
        for (const issue of resultado.error.issues) {
          errores.push({
            field: issue.path.join('.') || origen,
            code: issue.code.toUpperCase(),
            message: issue.message,
          });
        }
      }
    }

    if (errores.length > 0) {
      next(validacion(errores));
      return;
    }
    next();
  };
