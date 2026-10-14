import { prisma } from '../../shared/db/prisma.js';
import { condicionEstado, type FiltroActivos } from '../../shared/http/estado.js';

const conCategoria = {
  categoria: { select: { id: true, nombre: true, icono: true, estado: true } },
} as const;

export const subcategoriasRepository = {
  listar: (
    usuarioId: number,
    filtros: { categoriaId: number | undefined; estado: FiltroActivos },
  ) =>
    prisma.subcategoria.findMany({
      where: {
        usuarioId,
        ...condicionEstado(filtros.estado),
        ...(filtros.categoriaId !== undefined ? { categoriaId: filtros.categoriaId } : {}),
      },
      orderBy: { id: 'asc' },
      include: conCategoria,
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
    prisma.subcategoria.findFirst({ where: { id, usuarioId }, include: conCategoria }),

  categoriaActiva: (id: number, usuarioId: number) =>
    prisma.categoria.findFirst({ where: { id, usuarioId, estado: true } }),

  buscarPorNombreActiva: (categoriaId: number, nombre: string) =>
    prisma.subcategoria.findFirst({
      where: { categoriaId, estado: true, nombre: { equals: nombre, mode: 'insensitive' } },
    }),

  crear: (datos: {
    usuarioId: number;
    categoriaId: number;
    nombre: string;
    icono: string | null;
  }) => prisma.subcategoria.create({ data: datos }),

  actualizar: (
    id: number,
    datos: { nombre?: string | undefined; icono?: string | null | undefined },
  ) =>
    prisma.subcategoria.update({
      where: { id },
      data: {
        ...(datos.nombre !== undefined ? { nombre: datos.nombre } : {}),
        ...(datos.icono !== undefined ? { icono: datos.icono } : {}),
      },
    }),

  contarProductosActivos: (subcategoriaId: number) =>
    prisma.producto.count({ where: { subcategoriaId, estado: true } }),

  cambiarEstado: (id: number, estado: boolean) =>
    prisma.subcategoria.update({ where: { id }, data: { estado } }),
};
