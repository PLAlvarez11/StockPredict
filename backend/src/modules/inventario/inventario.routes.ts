import { Router } from 'express';
import { requiereSesion } from '../../shared/http/requiere-sesion.js';
import { validar } from '../../shared/http/validate.js';
import {
  crearAjusteSchema,
  crearCompraSchema,
  type CrearAjusteInput,
  type CrearCompraInput,
} from './inventario.schemas.js';
import { inventarioService } from './inventario.service.js';

export const inventarioRouter = Router();

inventarioRouter.use(requiereSesion);

inventarioRouter.post('/compras', validar({ body: crearCompraSchema }), async (req, res) => {
  const resultado = await inventarioService.registrarCompra(
    req.usuarioId as number,
    req.body as CrearCompraInput,
  );
  res.status(201).json(resultado);
});

inventarioRouter.post('/ajustes', validar({ body: crearAjusteSchema }), async (req, res) => {
  const resultado = await inventarioService.registrarAjuste(
    req.usuarioId as number,
    req.body as CrearAjusteInput,
  );
  res.status(201).json(resultado);
});
