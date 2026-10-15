import { Router } from 'express';
import { requiereSesion } from '../../shared/http/requiere-sesion.js';
import { validar } from '../../shared/http/validate.js';
import {
  filtrosPrediccionQuery,
  simulacionSchema,
  type FiltrosPrediccion,
  type SimulacionInput,
} from './prediccion.schemas.js';
import { calcularPrediccion, simularStock } from './prediccion.service.js';

export const prediccionRouter = Router();

prediccionRouter.use(requiereSesion);

prediccionRouter.get('/', validar({ query: filtrosPrediccionQuery }), async (req, res) => {
  res.json(
    await calcularPrediccion(
      req.usuarioId as number,
      new Date(),
      undefined,
      req.query as unknown as FiltrosPrediccion,
    ),
  );
});

prediccionRouter.post('/simulacion', validar({ body: simulacionSchema }), async (req, res) => {
  res.json(await simularStock(req.usuarioId as number, req.body as SimulacionInput));
});
