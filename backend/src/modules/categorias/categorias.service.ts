import { AppError, noEncontrado } from '../../shared/errors/app-error.js';
import { esViolacionUnica } from '../../shared/db/errores.js';
import { categoriasRepository as repo } from './categorias.repository.js';
import type { CrearCategoriaInput, EditarCategoriaInput } from './categorias.schemas.js';

interface FilaCategoria {
  id: number;
  nombre: string;
  icono: string;
  _count?: { productos: number };
}

const aDto = (c: FilaCategoria) => ({
  id: c.id,
  nombre: c.nombre,
  icono: c.icono,
  totalProductos: c._count?.productos ?? 0,
});

const nombreRepetido = () =>
  new AppError(409, 'DUPLICATE_NAME', 'Nombre repetido', {
    detail: 'Ya tienes una categoría con ese nombre.',
    errors: [
      {
        field: 'nombre',
        code: 'DUPLICATE_NAME',
        message: 'Ya tienes una categoría con ese nombre.',
      },
    ],
  });

export const categoriasService = {
  async listar(usuarioId: number) {
    return (await repo.listarActivas(usuarioId)).map(aDto);
  },

  async obtener(id: number, usuarioId: number) {
    const categoria = await repo.buscarActiva(id, usuarioId);
    if (!categoria) throw noEncontrado('La categoría no existe.');
    return aDto(categoria);
  },

  async crear(usuarioId: number, datos: CrearCategoriaInput) {
    if (await repo.buscarPorNombreActiva(usuarioId, datos.nombre)) throw nombreRepetido();
    try {
      return aDto(await repo.crear({ usuarioId, ...datos }));
    } catch (error) {
      if (esViolacionUnica(error)) throw nombreRepetido();
      throw error;
    }
  },

  async editar(id: number, usuarioId: number, datos: EditarCategoriaInput) {
    const actual = await repo.buscarActiva(id, usuarioId);
    if (!actual) throw noEncontrado('La categoría no existe.');
    if (datos.nombre !== undefined && datos.nombre.toLowerCase() !== actual.nombre.toLowerCase()) {
      if (await repo.buscarPorNombreActiva(usuarioId, datos.nombre)) throw nombreRepetido();
    }
    try {
      const actualizada = await repo.actualizar(id, datos);
      return aDto({ ...actualizada, _count: actual._count });
    } catch (error) {
      if (esViolacionUnica(error)) throw nombreRepetido();
      throw error;
    }
  },

  async inactivar(id: number, usuarioId: number) {
    const categoria = await repo.buscarActiva(id, usuarioId);
    if (!categoria) throw noEncontrado('La categoría no existe.');
    const activos = await repo.contarProductosActivos(id);
    if (activos > 0) {
      throw new AppError(409, 'CATEGORY_HAS_ACTIVE_PRODUCTS', 'Categoría con productos activos', {
        detail: `Tiene ${activos} ${activos === 1 ? 'producto activo' : 'productos activos'}. Muévelos o inactívalos primero.`,
      });
    }
    await repo.inactivar(id);
  },
};
