import { Router } from 'express';
import { requiereSesion } from '../../shared/http/requiere-sesion.js';
import { calcularPrediccion } from './prediccion.service.js';

export const prediccionRouter = Router();

prediccionRouter.use(requiereSesion);

prediccionRouter.get('/', async (req, res) => {
  res.json(await calcularPrediccion(req.usuarioId as number));
});
