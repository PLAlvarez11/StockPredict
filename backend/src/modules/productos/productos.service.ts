import { env } from '../../config/env.js';
import { esViolacionUnica } from '../../shared/db/errores.js';
import { AppError, noEncontrado } from '../../shared/errors/app-error.js';
import { nivelStock } from '../../shared/stock.js';
import { diaLocal, ultimasSemanas } from '../../shared/time/semana.js';
import { productosRepository as repo } from './productos.repository.js';
import type {
  CrearProductoInput,
  EditarProductoInput,
  ListarProductosQuery,
} from './productos.schemas.js';

interface FilaProducto {
  id: number;
  nombre: string;
  descripcion: string | null;
  stock: number;
  estado: boolean;
  subcategoria: {
    id: number;
    nombre: string;
    icono: string | null;
    categoria: { id: number; nombre: string; icono: string };
  };
}

const aDto = (p: FilaProducto) => ({
  id: p.id,
  nombre: p.nombre,
  descripcion: p.descripcion,
  stock: p.stock,
  estado: p.estado,
  nivelStock: nivelStock(p.stock, env.STOCK_BAJO_UMBRAL),
  categoria: {
    id: p.subcategoria.categoria.id,
    nombre: p.subcategoria.categoria.nombre,
    icono: p.subcategoria.categoria.icono,
  },
  subcategoria: {
    id: p.subcategoria.id,
    nombre: p.subcategoria.nombre,
    icono: p.subcategoria.icono ?? p.subcategoria.categoria.icono,
  },
});

const SEMANAS_DE_COMPRAS = 12;

const nombreRepetido = () =>
  new AppError(409, 'DUPLICATE_NAME', 'Nombre repetido', {
    detail: 'Ya tienes un producto activo con ese nombre.',
    errors: [
      {
        field: 'nombre',
        code: 'DUPLICATE_NAME',
        message: 'Ya tienes un producto activo con ese nombre.',
      },
    ],
  });

const subcategoriaInvalida = () =>
  new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', {
    detail: 'Revisa los campos marcados.',
    errors: [
      {
        field: 'subcategoriaId',
        code: 'INVALID_SUBCATEGORY',
        message: 'La subcategoría no existe o está inactiva.',
      },
    ],
  });

export const productosService = {
  async listar(usuarioId: number, query: ListarProductosQuery) {
    const { datos, total, stockBajo } = await repo.listar(usuarioId, {
      categoriaId: query.categoriaId,
      subcategoriaId: query.subcategoriaId,
      estado: query.estado,
      q: query.q,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      umbral: env.STOCK_BAJO_UMBRAL,
    });
    return { datos: datos.map(aDto), total, stockBajo, page: query.page, limit: query.limit };
  },

  async obtener(id: number, usuarioId: number) {
    const producto = await repo.buscar(id, usuarioId);
    if (!producto) throw noEncontrado('El producto no existe.');
    return aDto(producto);
  },

  async crear(usuarioId: number, datos: CrearProductoInput) {
    if (!(await repo.subcategoriaActiva(datos.subcategoriaId, usuarioId))) {
      throw subcategoriaInvalida();
    }
    const estado = datos.estado ?? true;
    if (estado && (await repo.buscarPorNombreActivo(usuarioId, datos.nombre))) {
      throw nombreRepetido();
    }
    try {
      return aDto(
        await repo.crear({
          usuarioId,
          nombre: datos.nombre,
          subcategoriaId: datos.subcategoriaId,
          descripcion: datos.descripcion ?? null,
          stock: datos.stockInicial,
          estado,
        }),
      );
    } catch (error) {
      if (esViolacionUnica(error)) throw nombreRepetido();
      throw error;
    }
  },

  async editar(id: number, usuarioId: number, datos: EditarProductoInput) {
    const actual = await repo.buscar(id, usuarioId);
    if (!actual) throw noEncontrado('El producto no existe.');
    if (
      datos.subcategoriaId !== undefined &&
      !(await repo.subcategoriaActiva(datos.subcategoriaId, usuarioId))
    ) {
      throw subcategoriaInvalida();
    }
    if (
      actual.estado &&
      datos.nombre !== undefined &&
      datos.nombre.toLowerCase() !== actual.nombre.toLowerCase()
    ) {
      if (await repo.buscarPorNombreActivo(usuarioId, datos.nombre)) throw nombreRepetido();
    }
    try {
      return aDto(await repo.actualizar(id, datos));
    } catch (error) {
      if (esViolacionUnica(error)) throw nombreRepetido();
      throw error;
    }
  },

  async compras(
    id: number,
    usuarioId: number,
    ahora: Date = new Date(),
    zona: string = env.TIMEZONE,
  ) {
    const producto = await repo.buscar(id, usuarioId);
    if (!producto) throw noEncontrado('El producto no existe.');
    const semanas = ultimasSemanas(ahora, zona, SEMANAS_DE_COMPRAS);
    const primera = semanas[0];
    const ultima = semanas[semanas.length - 1];
    if (!primera || !ultima) throw new Error('No se pudieron calcular las semanas');
    const movimientos = await repo.comprasEntre(id, usuarioId, primera.inicio, ultima.fin);
    const cantidades = semanas.map(() => 0);
    for (const m of movimientos) {
      const t = m.fecha.getTime();
      const i = semanas.findIndex((s) => t >= s.inicio.getTime() && t < s.fin.getTime());
      if (i >= 0) cantidades[i] = (cantidades[i] ?? 0) + m.cantidad;
    }
    const detalle = semanas.map((s, i) => ({
      inicio: diaLocal(s.inicio, zona),
      fin: diaLocal(new Date(s.fin.getTime() - 1), zona),
      cantidad: cantidades[i] ?? 0,
      enCurso: i === semanas.length - 1,
    }));
    const total = detalle.reduce((suma, s) => suma + s.cantidad, 0);
    let mayor: (typeof detalle)[number] | null = null;
    for (const s of detalle) {
      if (s.cantidad > 0 && (mayor === null || s.cantidad > mayor.cantidad)) mayor = s;
    }
    return { semanas: detalle, total, semanaMayor: mayor };
  },

  async inactivar(id: number, usuarioId: number) {
    const producto = await repo.buscar(id, usuarioId);
    if (!producto || !producto.estado) throw noEncontrado('El producto no existe.');
    await repo.cambiarEstado(id, false);
  },

  async activar(id: number, usuarioId: number) {
    const producto = await repo.buscar(id, usuarioId);
    if (!producto) throw noEncontrado('El producto no existe.');
    if (producto.estado) return aDto(producto);

    if (!producto.subcategoria.estado || !producto.subcategoria.categoria.estado) {
      throw new AppError(422, 'INACTIVE_RESOURCE', 'Subcategoría inactiva', {
        detail: `La subcategoría «${producto.subcategoria.nombre}» o su categoría está inactiva. Actívala primero.`,
      });
    }
    if (await repo.buscarPorNombreActivo(usuarioId, producto.nombre)) throw nombreRepetido();
    try {
      await repo.cambiarEstado(id, true);
    } catch (error) {
      if (esViolacionUnica(error)) throw nombreRepetido();
      throw error;
    }
    const activado = await repo.buscar(id, usuarioId);
    if (!activado) throw noEncontrado('El producto no existe.');
    return aDto(activado);
  },
};
