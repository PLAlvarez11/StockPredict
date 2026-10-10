import { Router } from 'express';
import { requiereSesion } from '../../shared/http/requiere-sesion.js';
import { idParams } from '../../shared/http/esquemas.js';
import { validar } from '../../shared/http/validate.js';
import { ICONOS_CATEGORIA } from '../../shared/iconos.js';
import {
  crearCategoriaSchema,
  editarCategoriaSchema,
  type CrearCategoriaInput,
  type EditarCategoriaInput,
} from './categorias.schemas.js';
import { categoriasService as servicio } from './categorias.service.js';

export const categoriasRouter = Router();

categoriasRouter.use(requiereSesion);

const usuario = (req: { usuarioId?: number }) => req.usuarioId as number;
const idDe = (req: { params: unknown }) => (req.params as { id: number }).id;

categoriasRouter.get('/iconos', (_req, res) => {
  res.json(ICONOS_CATEGORIA);
});

categoriasRouter.get('/', async (req, res) => {
  res.json(await servicio.listar(usuario(req)));
});

categoriasRouter.post('/', validar({ body: crearCategoriaSchema }), async (req, res) => {
  const categoria = await servicio.crear(usuario(req), req.body as CrearCategoriaInput);
  res.status(201).json(categoria);
});

categoriasRouter.get('/:id', validar({ params: idParams }), async (req, res) => {
  res.json(await servicio.obtener(idDe(req), usuario(req)));
});

categoriasRouter.patch(
  '/:id',
  validar({ params: idParams, body: editarCategoriaSchema }),
  async (req, res) => {
    res.json(await servicio.editar(idDe(req), usuario(req), req.body as EditarCategoriaInput));
  },
);

categoriasRouter.delete('/:id', validar({ params: idParams }), async (req, res) => {
  await servicio.inactivar(idDe(req), usuario(req));
  res.status(204).end();
});
