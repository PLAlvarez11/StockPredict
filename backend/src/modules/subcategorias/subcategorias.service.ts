import { coincideBusqueda } from '../../shared/texto.js';
import { esViolacionUnica } from '../../shared/db/errores.js';
import { AppError, noEncontrado } from '../../shared/errors/app-error.js';
import type { FiltroActivos } from '../../shared/http/estado.js';
import { subcategoriasRepository as repo } from './subcategorias.repository.js';
import type { CrearSubcategoriaInput, EditarSubcategoriaInput } from './subcategorias.schemas.js';

interface FilaSubcategoria {
  id: number;
  categoriaId: number;
  nombre: string;
  icono: string | null;
  estado: boolean;
  categoria: { id: number; nombre: string; icono: string; estado: boolean };
}

const aDto = (s: FilaSubcategoria, productos: number) => ({
  id: s.id,
  categoriaId: s.categoriaId,
  categoriaNombre: s.categoria.nombre,
  nombre: s.nombre,
  icono: s.icono ?? s.categoria.icono,
  iconoPropio: s.icono,
  estado: s.estado,
  totalProductos: productos,
});

const nombreRepetido = () =>
  new AppError(409, 'DUPLICATE_NAME', 'Nombre repetido', {
    detail: 'Ya existe una subcategoría con ese nombre en esta categoría.',
    errors: [
      {
        field: 'nombre',
        code: 'DUPLICATE_NAME',
        message: 'Ya existe una subcategoría con ese nombre en esta categoría.',
      },
    ],
  });

const categoriaInvalida = () =>
  new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', {
    detail: 'Revisa los campos marcados.',
    errors: [
      {
        field: 'categoriaId',
        code: 'INVALID_CATEGORY',
        message: 'La categoría no existe o está inactiva.',
      },
    ],
  });

async function dto(usuarioId: number, id: number) {
  const subcategoria = await repo.buscar(id, usuarioId);
  if (!subcategoria) throw noEncontrado('La subcategoría no existe.');
  const productos = await repo.contarProductosActivos(id);
  return aDto(subcategoria, productos);
}

export const subcategoriasService = {
  async listar(
    usuarioId: number,
    filtros: { categoriaId: number | undefined; estado: FiltroActivos; q?: string | undefined },
  ) {
    const [filas, productos] = await Promise.all([
      repo.listar(usuarioId, filtros),
      repo.productosActivosPorSubcategoria(usuarioId),
    ]);
    return filas
      .filter((s) => coincideBusqueda(filtros.q, s.nombre, s.categoria.nombre))
      .map((s) => aDto(s, productos.get(s.id) ?? 0));
  },

  async obtener(id: number, usuarioId: number) {
    return dto(usuarioId, id);
  },

  async crear(usuarioId: number, datos: CrearSubcategoriaInput) {
    if (!(await repo.categoriaActiva(datos.categoriaId, usuarioId))) throw categoriaInvalida();
    if (await repo.buscarPorNombreActiva(datos.categoriaId, datos.nombre)) throw nombreRepetido();
    try {
      const creada = await repo.crear({
        usuarioId,
        categoriaId: datos.categoriaId,
        nombre: datos.nombre,
        icono: datos.icono ?? null,
      });
      return dto(usuarioId, creada.id);
    } catch (error) {
      if (esViolacionUnica(error)) throw nombreRepetido();
      throw error;
    }
  },

  async editar(id: number, usuarioId: number, datos: EditarSubcategoriaInput) {
    const actual = await repo.buscar(id, usuarioId);
    if (!actual || !actual.estado) throw noEncontrado('La subcategoría no existe.');
    if (datos.nombre !== undefined && datos.nombre.toLowerCase() !== actual.nombre.toLowerCase()) {
      if (await repo.buscarPorNombreActiva(actual.categoriaId, datos.nombre))
        throw nombreRepetido();
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
    const subcategoria = await repo.buscar(id, usuarioId);
    if (!subcategoria || !subcategoria.estado) throw noEncontrado('La subcategoría no existe.');
    const activos = await repo.contarProductosActivos(id);
    if (activos > 0) {
      throw new AppError(
        409,
        'SUBCATEGORY_HAS_ACTIVE_PRODUCTS',
        'Subcategoría con productos activos',
        {
          detail: `Tiene ${activos} ${activos === 1 ? 'producto activo' : 'productos activos'}. Desactívalos o muévelos primero.`,
        },
      );
    }
    await repo.cambiarEstado(id, false);
  },

  async activar(id: number, usuarioId: number) {
    const subcategoria = await repo.buscar(id, usuarioId);
    if (!subcategoria) throw noEncontrado('La subcategoría no existe.');
    if (!subcategoria.estado) {
      if (!subcategoria.categoria.estado) {
        throw new AppError(422, 'INACTIVE_RESOURCE', 'Categoría inactiva', {
          detail: `La categoría «${subcategoria.categoria.nombre}» está inactiva. Actívala primero.`,
        });
      }
      if (await repo.buscarPorNombreActiva(subcategoria.categoriaId, subcategoria.nombre)) {
        throw nombreRepetido();
      }
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
