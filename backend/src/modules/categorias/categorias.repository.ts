import { prisma } from '../../shared/db/prisma.js';
import { condicionEstado, type FiltroActivos } from '../../shared/http/estado.js';

export const categoriasRepository = {
  listar: (usuarioId: number, filtro: FiltroActivos) =>
    prisma.categoria.findMany({
      where: { usuarioId, ...condicionEstado(filtro) },
      orderBy: { id: 'asc' },
      include: { subcategorias: { select: { id: true, estado: true } } },
    }),

  productosActivosPorSubcategoria: async (usuarioId: number) => {
    const filas = await prisma.producto.groupBy({
      by: ['subcategoriaId'],
      where: { usuarioId, estado: true },
      _count: { _all: true },
    });
    return new Map(filas.map((f) => [f.subcategoriaId, f._count._all]));
  },

  buscar: (id: number, usuarioId: number) =>
    prisma.categoria.findFirst({
      where: { id, usuarioId },
      include: { subcategorias: { select: { id: true, estado: true } } },
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

  contarSubcategoriasActivas: (categoriaId: number) =>
    prisma.subcategoria.count({ where: { categoriaId, estado: true } }),

  cambiarEstado: (id: number, estado: boolean) =>
    prisma.categoria.update({ where: { id }, data: { estado } }),
};
