import { esViolacionUnica } from '../../shared/db/errores.js';
import { AppError, noEncontrado } from '../../shared/errors/app-error.js';
import type { FiltroActivos } from '../../shared/http/estado.js';
import { categoriasRepository as repo } from './categorias.repository.js';
import type { CrearCategoriaInput, EditarCategoriaInput } from './categorias.schemas.js';

interface FilaCategoria {
  id: number;
  nombre: string;
  icono: string;
  estado: boolean;
  subcategorias: { id: number; estado: boolean }[];
}

const aDto = (c: FilaCategoria, productosPorSubcategoria: Map<number, number>) => {
  const activas = c.subcategorias.filter((s) => s.estado);
  return {
    id: c.id,
    nombre: c.nombre,
    icono: c.icono,
    estado: c.estado,
    totalSubcategorias: activas.length,
    totalProductos: activas.reduce(
      (suma, s) => suma + (productosPorSubcategoria.get(s.id) ?? 0),
      0,
    ),
  };
};

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

async function dto(usuarioId: number, id: number) {
  const categoria = await repo.buscar(id, usuarioId);
  if (!categoria) throw noEncontrado('La categoría no existe.');
  return aDto(categoria, await repo.productosActivosPorSubcategoria(usuarioId));
}

export const categoriasService = {
  async listar(usuarioId: number, filtro: FiltroActivos) {
    const [categorias, productos] = await Promise.all([
      repo.listar(usuarioId, filtro),
      repo.productosActivosPorSubcategoria(usuarioId),
    ]);
    return categorias.map((c) => aDto(c, productos));
  },

  async obtener(id: number, usuarioId: number) {
    return dto(usuarioId, id);
  },

  async crear(usuarioId: number, datos: CrearCategoriaInput) {
    if (await repo.buscarPorNombreActiva(usuarioId, datos.nombre)) throw nombreRepetido();
    try {
      const creada = await repo.crear({ usuarioId, ...datos });
      return dto(usuarioId, creada.id);
    } catch (error) {
      if (esViolacionUnica(error)) throw nombreRepetido();
      throw error;
    }
  },

  async editar(id: number, usuarioId: number, datos: EditarCategoriaInput) {
    const actual = await repo.buscar(id, usuarioId);
    if (!actual || !actual.estado) throw noEncontrado('La categoría no existe.');
    if (datos.nombre !== undefined && datos.nombre.toLowerCase() !== actual.nombre.toLowerCase()) {
      if (await repo.buscarPorNombreActiva(usuarioId, datos.nombre)) throw nombreRepetido();
    }
    try {
      await repo.actualizar(id, datos);
    } catch (error) {
      if (esViolacionUnica(error)) throw nombreRepetido();
      throw error;
    }
    return dto(usuarioId, id);
  },

  async inactivar(id: number, usuarioId: number) {
    const categoria = await repo.buscar(id, usuarioId);
    if (!categoria || !categoria.estado) throw noEncontrado('La categoría no existe.');
    const activas = await repo.contarSubcategoriasActivas(id);
    if (activas > 0) {
      throw new AppError(
        409,
        'CATEGORY_HAS_ACTIVE_SUBCATEGORIES',
        'Categoría con subcategorías activas',
        {
          detail: `Tiene ${activas} ${activas === 1 ? 'subcategoría activa' : 'subcategorías activas'}. Desactívalas primero.`,
        },
      );
    }
    await repo.cambiarEstado(id, false);
  },

  async activar(id: number, usuarioId: number) {
    const categoria = await repo.buscar(id, usuarioId);
    if (!categoria) throw noEncontrado('La categoría no existe.');
    if (!categoria.estado) {
      if (await repo.buscarPorNombreActiva(usuarioId, categoria.nombre)) throw nombreRepetido();
      try {
        await repo.cambiarEstado(id, true);
      } catch (error) {
        if (esViolacionUnica(error)) throw nombreRepetido();
        throw error;
      }
    }
    return dto(usuarioId, id);
  },
};
