import { prisma } from '../../shared/db/prisma.js';

export const prediccionRepository = {
  productosActivos: (usuarioId: number) =>
    prisma.producto.findMany({
      where: { usuarioId, estado: true },
      orderBy: { id: 'asc' },
      include: {
        subcategoria: {
          select: {
            id: true,
            nombre: true,
            icono: true,
            categoria: { select: { id: true, nombre: true, icono: true } },
          },
        },
      },
    }),

  ventasEntre: (productoIds: number[], desde: Date, hasta: Date) =>
    prisma.venta.findMany({
      where: { productoId: { in: productoIds }, fecha: { gte: desde, lt: hasta } },
      select: { productoId: true, cantidad: true, fecha: true },
    }),
};
