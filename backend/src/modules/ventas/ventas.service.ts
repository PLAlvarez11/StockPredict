import { prisma } from '../../shared/db/prisma.js';
import { AppError, noEncontrado } from '../../shared/errors/app-error.js';
import type { CrearVentaInput } from './ventas.schemas.js';

export const ventasService = {
  async registrar(usuarioId: number, { productoId, cantidad }: CrearVentaInput) {
    return prisma.$transaction(async (tx) => {
      const descontado = await tx.producto.updateMany({
        where: { id: productoId, usuarioId, estado: true, stock: { gte: cantidad } },
        data: { stock: { decrement: cantidad } },
      });

      if (descontado.count !== 1) {
        const producto = await tx.producto.findFirst({ where: { id: productoId, usuarioId } });
        if (!producto) throw noEncontrado('El producto no existe.');
        if (!producto.estado) {
          throw new AppError(422, 'INACTIVE_RESOURCE', 'Producto inactivo', {
            detail: 'El producto está inactivo y no se puede vender.',
            errors: [
              {
                field: 'productoId',
                code: 'INACTIVE_RESOURCE',
                message: 'El producto está inactivo.',
              },
            ],
          });
        }
        const mensaje =
          producto.stock === 0
            ? 'Este producto no tiene unidades disponibles.'
            : `Solo hay ${producto.stock} ${producto.stock === 1 ? 'unidad disponible' : 'unidades disponibles'}.`;
        throw new AppError(422, 'INSUFFICIENT_STOCK', 'Stock insuficiente', {
          detail: mensaje,
          errors: [{ field: 'cantidad', code: 'INSUFFICIENT_STOCK', message: mensaje }],
        });
      }

      const venta = await tx.venta.create({ data: { productoId, cantidad } });
      const producto = await tx.producto.findUniqueOrThrow({ where: { id: productoId } });
      return {
        venta: { id: venta.id, productoId, cantidad },
        stockActual: producto.stock,
      };
    });
  },
};
