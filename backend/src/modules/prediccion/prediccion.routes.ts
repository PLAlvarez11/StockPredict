import { Router } from 'express';
import { requiereSesion } from '../../shared/http/requiere-sesion.js';
import { validar } from '../../shared/http/validate.js';
import { exportarPrediccion } from './exportacion/exportar.js';
import {
  exportarPrediccionQuery,
  filtrosPrediccionQuery,
  type ExportarQuery,
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

prediccionRouter.get('/exportar', validar({ query: exportarPrediccionQuery }), async (req, res) => {
  const archivo = await exportarPrediccion(
    req.usuarioId as number,
    req.query as unknown as ExportarQuery,
  );
  res.setHeader('Content-Type', archivo.tipo);
  res.setHeader('Content-Disposition', `attachment; filename="${archivo.nombre}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(archivo.contenido);
});

prediccionRouter.post('/simulacion', validar({ body: simulacionSchema }), async (req, res) => {
  res.json(await simularStock(req.usuarioId as number, req.body as SimulacionInput));
});
