import { prisma } from '../../shared/db/prisma.js';

export const categoriasRepository = {
  listarActivas: (usuarioId: number) =>
    prisma.categoria.findMany({
      where: { usuarioId, estado: true },
      orderBy: { id: 'asc' },
      include: { _count: { select: { productos: { where: { estado: true } } } } },
    }),

  buscarActiva: (id: number, usuarioId: number) =>
    prisma.categoria.findFirst({
      where: { id, usuarioId, estado: true },
      include: { _count: { select: { productos: { where: { estado: true } } } } },
    }),

  buscarPorNombreActiva: (usuarioId: number, nombre: string) =>
    prisma.categoria.findFirst({
      where: { usuarioId, estado: true, nombre: { equals: nombre, mode: 'insensitive' } },
    }),

  crear: (datos: { usuarioId: number; nombre: string; icono: string }) =>
    prisma.categoria.create({ data: datos }),

  actualizar: (id: number, datos: { nombre?: string | undefined; icono?: string | undefined }) =>
    prisma.categoria.update({
      where: { id },
      data: {
        ...(datos.nombre !== undefined ? { nombre: datos.nombre } : {}),
        ...(datos.icono !== undefined ? { icono: datos.icono } : {}),
      },
    }),

  contarProductosActivos: (categoriaId: number) =>
    prisma.producto.count({ where: { categoriaId, estado: true } }),

  inactivar: (id: number) => prisma.categoria.update({ where: { id }, data: { estado: false } }),
};
