import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/db/prisma.js';
import { condicionEstado, type FiltroActivos } from '../../shared/http/estado.js';

export const conSubcategoria = {
  subcategoria: {
    select: {
      id: true,
      nombre: true,
      icono: true,
      estado: true,
      categoria: { select: { id: true, nombre: true, icono: true, estado: true } },
    },
  },
} as const;

export interface FiltrosListado {
  categoriaId: number | undefined;
  subcategoriaId: number | undefined;
  estado: FiltroActivos;
  skip: number;
  take: number;
  umbral: number;
}

export const productosRepository = {
  async listar(usuarioId: number, filtros: FiltrosListado) {
    const base: Prisma.ProductoWhereInput = {
      usuarioId,
      ...(filtros.subcategoriaId !== undefined ? { subcategoriaId: filtros.subcategoriaId } : {}),
      ...(filtros.categoriaId !== undefined
        ? { subcategoria: { categoriaId: filtros.categoriaId } }
        : {}),
    };
    const where: Prisma.ProductoWhereInput = { ...base, ...condicionEstado(filtros.estado) };
    const [datos, total, stockBajo] = await Promise.all([
      prisma.producto.findMany({
        where,
        orderBy: { id: 'asc' },
        skip: filtros.skip,
        take: filtros.take,
        include: conSubcategoria,
      }),
      prisma.producto.count({ where }),
      prisma.producto.count({ where: { ...base, estado: true, stock: { lte: filtros.umbral } } }),
    ]);
    return { datos, total, stockBajo };
  },

  listarTodos: (
    usuarioId: number,
    categoriaId: number | undefined,
    subcategoriaId: number | undefined,
  ) =>
    prisma.producto.findMany({
      where: {
        usuarioId,
        ...(subcategoriaId !== undefined ? { subcategoriaId } : {}),
        ...(categoriaId !== undefined ? { subcategoria: { categoriaId } } : {}),
      },
      orderBy: { id: 'asc' },
      include: conSubcategoria,
    }),

  buscar: (id: number, usuarioId: number) =>
    prisma.producto.findFirst({ where: { id, usuarioId }, include: conSubcategoria }),

  comprasEntre: (productoId: number, usuarioId: number, desde: Date, hasta: Date) =>
    prisma.movimientoInventario.findMany({
      where: {
        productoId,
        tipo: 'compra',
        fecha: { gte: desde, lt: hasta },
        producto: { usuarioId },
      },
      select: { cantidad: true, fecha: true },
    }),

  buscarPorNombreActivo: (usuarioId: number, nombre: string) =>
    prisma.producto.findFirst({
      where: { usuarioId, estado: true, nombre: { equals: nombre, mode: 'insensitive' } },
    }),

  subcategoriaActiva: (id: number, usuarioId: number) =>
    prisma.subcategoria.findFirst({
      where: { id, usuarioId, estado: true, categoria: { estado: true } },
    }),

  crear: (datos: {
    usuarioId: number;
    nombre: string;
    subcategoriaId: number;
    descripcion: string | null;
    stock: number;
    estado: boolean;
  }) => prisma.producto.create({ data: datos, include: conSubcategoria }),

  actualizar: (
    id: number,
    datos: {
      nombre?: string | undefined;
      subcategoriaId?: number | undefined;
      descripcion?: string | null | undefined;
    },
  ) =>
    prisma.producto.update({
      where: { id },
      data: {
        ...(datos.nombre !== undefined ? { nombre: datos.nombre } : {}),
        ...(datos.subcategoriaId !== undefined ? { subcategoriaId: datos.subcategoriaId } : {}),
        ...(datos.descripcion !== undefined ? { descripcion: datos.descripcion } : {}),
      },
      include: conSubcategoria,
    }),

  cambiarEstado: (id: number, estado: boolean) =>
    prisma.producto.update({ where: { id }, data: { estado } }),
};
