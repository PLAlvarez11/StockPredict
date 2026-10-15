import { Router } from 'express';
import { idParams } from '../../shared/http/esquemas.js';
import { requiereSesion } from '../../shared/http/requiere-sesion.js';
import { validar } from '../../shared/http/validate.js';
import {
  comprasQuery,
  crearProductoSchema,
  editarProductoSchema,
  listarProductosQuery,
  type CrearProductoInput,
  type EditarProductoInput,
  type ListarProductosQuery,
} from './productos.schemas.js';
import { productosService as servicio } from './productos.service.js';

export const productosRouter = Router();

productosRouter.use(requiereSesion);

const usuario = (req: { usuarioId?: number }) => req.usuarioId as number;
const idDe = (req: { params: unknown }) => (req.params as { id: number }).id;

productosRouter.get('/', validar({ query: listarProductosQuery }), async (req, res) => {
  res.json(await servicio.listar(usuario(req), req.query as unknown as ListarProductosQuery));
});

productosRouter.post('/', validar({ body: crearProductoSchema }), async (req, res) => {
  res.status(201).json(await servicio.crear(usuario(req), req.body as CrearProductoInput));
});

productosRouter.get('/:id', validar({ params: idParams }), async (req, res) => {
  res.json(await servicio.obtener(idDe(req), usuario(req)));
});

productosRouter.get(
  '/:id/compras',
  validar({ params: idParams, query: comprasQuery }),
  async (req, res) => {
    res.json(await servicio.compras(idDe(req), usuario(req)));
  },
);

productosRouter.patch(
  '/:id',
  validar({ params: idParams, body: editarProductoSchema }),
  async (req, res) => {
    res.json(await servicio.editar(idDe(req), usuario(req), req.body as EditarProductoInput));
  },
);

productosRouter.delete('/:id', validar({ params: idParams }), async (req, res) => {
  await servicio.inactivar(idDe(req), usuario(req));
  res.status(204).end();
});

productosRouter.post('/:id/activar', validar({ params: idParams }), async (req, res) => {
  res.json(await servicio.activar(idDe(req), usuario(req)));
});
