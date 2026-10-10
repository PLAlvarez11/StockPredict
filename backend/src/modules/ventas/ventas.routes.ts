import { Router } from 'express';
import { requiereSesion } from '../../shared/http/requiere-sesion.js';
import { validar } from '../../shared/http/validate.js';
import { crearVentaSchema, type CrearVentaInput } from './ventas.schemas.js';
import { ventasService } from './ventas.service.js';

export const ventasRouter = Router();

ventasRouter.use(requiereSesion);

ventasRouter.post('/', validar({ body: crearVentaSchema }), async (req, res) => {
  const resultado = await ventasService.registrar(
    req.usuarioId as number,
    req.body as CrearVentaInput,
  );
  res.status(201).json(resultado);
});
