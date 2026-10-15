import { Router } from 'express';
import { z } from 'zod';
import { requiereSesion } from '../../shared/http/requiere-sesion.js';
import { validar } from '../../shared/http/validate.js';
import { crearVentaSchema, type CrearVentaInput } from './ventas.schemas.js';
import { ventasService } from './ventas.service.js';

export const ventasRouter = Router();

ventasRouter.use(requiereSesion);

ventasRouter.get('/semana', validar({ query: z.object({}).strict() }), async (req, res) => {
  res.json(await ventasService.semana(req.usuarioId as number));
});

ventasRouter.post('/', validar({ body: crearVentaSchema }), async (req, res) => {
  const resultado = await ventasService.registrar(
    req.usuarioId as number,
    req.body as CrearVentaInput,
  );
  res.status(201).json(resultado);
});
