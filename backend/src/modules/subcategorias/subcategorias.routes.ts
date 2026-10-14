import { Router } from 'express';
import { idParams } from '../../shared/http/esquemas.js';
import { requiereSesion } from '../../shared/http/requiere-sesion.js';
import { validar } from '../../shared/http/validate.js';
import {
  crearSubcategoriaSchema,
  editarSubcategoriaSchema,
  listarSubcategoriasQuery,
  type CrearSubcategoriaInput,
  type EditarSubcategoriaInput,
  type ListarSubcategoriasQuery,
} from './subcategorias.schemas.js';
import { subcategoriasService as servicio } from './subcategorias.service.js';

export const subcategoriasRouter = Router();

subcategoriasRouter.use(requiereSesion);

const usuario = (req: { usuarioId?: number }) => req.usuarioId as number;
const idDe = (req: { params: unknown }) => (req.params as { id: number }).id;

subcategoriasRouter.get('/', validar({ query: listarSubcategoriasQuery }), async (req, res) => {
  const { categoriaId, estado } = req.query as unknown as ListarSubcategoriasQuery;
  res.json(await servicio.listar(usuario(req), { categoriaId, estado }));
});

subcategoriasRouter.post('/', validar({ body: crearSubcategoriaSchema }), async (req, res) => {
  res.status(201).json(await servicio.crear(usuario(req), req.body as CrearSubcategoriaInput));
});

subcategoriasRouter.get('/:id', validar({ params: idParams }), async (req, res) => {
  res.json(await servicio.obtener(idDe(req), usuario(req)));
});

subcategoriasRouter.patch(
  '/:id',
  validar({ params: idParams, body: editarSubcategoriaSchema }),
  async (req, res) => {
    res.json(await servicio.editar(idDe(req), usuario(req), req.body as EditarSubcategoriaInput));
  },
);

subcategoriasRouter.delete('/:id', validar({ params: idParams }), async (req, res) => {
  await servicio.inactivar(idDe(req), usuario(req));
  res.status(204).end();
});

subcategoriasRouter.post('/:id/activar', validar({ params: idParams }), async (req, res) => {
  res.json(await servicio.activar(idDe(req), usuario(req)));
});
