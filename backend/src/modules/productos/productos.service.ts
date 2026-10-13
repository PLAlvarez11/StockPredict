import { env } from '../../config/env.js';
import { esViolacionUnica } from '../../shared/db/errores.js';
import { AppError, noEncontrado } from '../../shared/errors/app-error.js';
import { nivelStock } from '../../shared/stock.js';
import { productosRepository as repo } from './productos.repository.js';
import type {
  CrearProductoInput,
  EditarProductoInput,
  ListarProductosQuery,
} from './productos.schemas.js';

interface FilaProducto {
  id: number;
  nombre: string;
  stock: number;
  categoria: { id: number; nombre: string; icono: string };
}

const aDto = (p: FilaProducto) => ({
  id: p.id,
  nombre: p.nombre,
  stock: p.stock,
  nivelStock: nivelStock(p.stock, env.STOCK_BAJO_UMBRAL),
  categoria: p.categoria,
});

const nombreRepetido = () =>
  new AppError(409, 'DUPLICATE_NAME', 'Nombre repetido', {
    detail: 'Ya tienes un producto con ese nombre.',
    errors: [
      { field: 'nombre', code: 'DUPLICATE_NAME', message: 'Ya tienes un producto con ese nombre.' },
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

export const productosService = {
  async listar(usuarioId: number, query: ListarProductosQuery) {
    const { datos, total, stockBajo } = await repo.listar(usuarioId, {
      categoriaId: query.categoriaId,
      q: query.q,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      umbral: env.STOCK_BAJO_UMBRAL,
    });
    return { datos: datos.map(aDto), total, stockBajo, page: query.page, limit: query.limit };
  },

  async obtener(id: number, usuarioId: number) {
    const producto = await repo.buscarActivo(id, usuarioId);
    if (!producto) throw noEncontrado('El producto no existe.');
    return aDto(producto);
  },

  async crear(usuarioId: number, datos: CrearProductoInput) {
    if (!(await repo.categoriaActiva(datos.categoriaId, usuarioId))) throw categoriaInvalida();
    if (await repo.buscarPorNombreActivo(usuarioId, datos.nombre)) throw nombreRepetido();
    try {
      return aDto(
        await repo.crear({
          usuarioId,
          nombre: datos.nombre,
          categoriaId: datos.categoriaId,
          stock: datos.stockInicial,
        }),
      );
    } catch (error) {
      if (esViolacionUnica(error)) throw nombreRepetido();
      throw error;
    }
  },

  async editar(id: number, usuarioId: number, datos: EditarProductoInput) {
    const actual = await repo.buscarActivo(id, usuarioId);
    if (!actual) throw noEncontrado('El producto no existe.');
    if (
      datos.categoriaId !== undefined &&
      !(await repo.categoriaActiva(datos.categoriaId, usuarioId))
    ) {
      throw categoriaInvalida();
    }
    if (datos.nombre !== undefined && datos.nombre.toLowerCase() !== actual.nombre.toLowerCase()) {
      if (await repo.buscarPorNombreActivo(usuarioId, datos.nombre)) throw nombreRepetido();
    }
    try {
      return aDto(await repo.actualizar(id, datos));
    } catch (error) {
      if (esViolacionUnica(error)) throw nombreRepetido();
      throw error;
    }
  },

  async inactivar(id: number, usuarioId: number) {
    const producto = await repo.buscarActivo(id, usuarioId);
    if (!producto) throw noEncontrado('El producto no existe.');
    await repo.inactivar(id);
  },
};
