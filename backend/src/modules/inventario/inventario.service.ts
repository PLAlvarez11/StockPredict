import { prisma } from '../../shared/db/prisma.js';
import { AppError, noEncontrado } from '../../shared/errors/app-error.js';
import type { CrearAjusteInput, CrearCompraInput } from './inventario.schemas.js';

export const inventarioService = {
  async registrarCompra(usuarioId: number, { productoId, cantidad }: CrearCompraInput) {
    return prisma.$transaction(async (tx) => {
      const sumado = await tx.producto.updateMany({
        where: { id: productoId, usuarioId, estado: true },
        data: { stock: { increment: cantidad } },
      });
      if (sumado.count !== 1) {
        const producto = await tx.producto.findFirst({ where: { id: productoId, usuarioId } });
        if (!producto) throw noEncontrado('El producto no existe.');
        throw new AppError(422, 'INACTIVE_RESOURCE', 'Producto inactivo', {
          detail: 'El producto está inactivo.',
          errors: [
            {
              field: 'productoId',
              code: 'INACTIVE_RESOURCE',
              message: 'El producto está inactivo.',
            },
          ],
        });
      }
      const producto = await tx.producto.findUniqueOrThrow({ where: { id: productoId } });
      const movimiento = await tx.movimientoInventario.create({
        data: {
          productoId,
          tipo: 'compra',
          cantidad,
          stockAnterior: producto.stock - cantidad,
        },
      });
      return {
        movimiento: {
          id: movimiento.id,
          productoId,
          tipo: movimiento.tipo,
          cantidad,
          stockAnterior: movimiento.stockAnterior,
        },
        stockActual: producto.stock,
      };
    });
  },

  async registrarAjuste(usuarioId: number, { productoId, cantidad }: CrearAjusteInput) {
    return prisma.$transaction(async (tx) => {
      const filas = await tx.$queryRaw<{ stock: number; estado: boolean }[]>`
        SELECT stock, estado FROM producto
        WHERE id = ${productoId} AND usuario_id = ${usuarioId}
        FOR UPDATE
      `;
      const actual = filas[0];
      if (!actual) throw noEncontrado('El producto no existe.');
      if (!actual.estado) {
        throw new AppError(422, 'INACTIVE_RESOURCE', 'Producto inactivo', {
          detail: 'El producto está inactivo.',
          errors: [
            {
              field: 'productoId',
              code: 'INACTIVE_RESOURCE',
              message: 'El producto está inactivo.',
            },
          ],
        });
      }
      await tx.producto.update({ where: { id: productoId }, data: { stock: cantidad } });
      const movimiento = await tx.movimientoInventario.create({
        data: { productoId, tipo: 'ajuste', cantidad, stockAnterior: actual.stock },
      });
      return {
        movimiento: {
          id: movimiento.id,
          productoId,
          tipo: movimiento.tipo,
          cantidad,
          stockAnterior: movimiento.stockAnterior,
        },
        stockActual: cantidad,
      };
    });
  },
};
