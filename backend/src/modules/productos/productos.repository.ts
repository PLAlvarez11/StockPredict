import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/db/prisma.js';

const conCategoria = { categoria: { select: { id: true, nombre: true, icono: true } } } as const;

export const productosRepository = {
  async listar(
    usuarioId: number,
    filtros: {
      categoriaId: number | undefined;
      q: string | undefined;
      skip: number;
      take: number;
      umbral: number;
    },
  ) {
    const where: Prisma.ProductoWhereInput = {
      usuarioId,
      estado: true,
      ...(filtros.categoriaId !== undefined ? { categoriaId: filtros.categoriaId } : {}),
      ...(filtros.q ? { nombre: { contains: filtros.q, mode: 'insensitive' } } : {}),
    };
    const [datos, total, stockBajo] = await Promise.all([
      prisma.producto.findMany({
        where,
        orderBy: { id: 'asc' },
        skip: filtros.skip,
        take: filtros.take,
        include: conCategoria,
      }),
      prisma.producto.count({ where }),
      prisma.producto.count({ where: { ...where, stock: { lte: filtros.umbral } } }),
    ]);
    return { datos, total, stockBajo };
  },

  buscarActivo: (id: number, usuarioId: number) =>
    prisma.producto.findFirst({ where: { id, usuarioId, estado: true }, include: conCategoria }),

  buscarPorNombreActivo: (usuarioId: number, nombre: string) =>
    prisma.producto.findFirst({
      where: { usuarioId, estado: true, nombre: { equals: nombre, mode: 'insensitive' } },
    }),

  categoriaActiva: (id: number, usuarioId: number) =>
    prisma.categoria.findFirst({ where: { id, usuarioId, estado: true } }),

  crear: (datos: { usuarioId: number; nombre: string; categoriaId: number; stock: number }) =>
    prisma.producto.create({ data: datos, include: conCategoria }),

  actualizar: (
    id: number,
    datos: { nombre?: string | undefined; categoriaId?: number | undefined },
  ) =>
    prisma.producto.update({
      where: { id },
      data: {
        ...(datos.nombre !== undefined ? { nombre: datos.nombre } : {}),
        ...(datos.categoriaId !== undefined ? { categoriaId: datos.categoriaId } : {}),
      },
      include: conCategoria,
    }),

  inactivar: (id: number) => prisma.producto.update({ where: { id }, data: { estado: false } }),
};
