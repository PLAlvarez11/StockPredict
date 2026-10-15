import { prisma } from '../../shared/db/prisma.js';
import { AppError, noEncontrado } from '../../shared/errors/app-error.js';
import { env } from '../../config/env.js';
import { diaLocal, semanaDe } from '../../shared/time/semana.js';
import type { CrearVentaInput } from './ventas.schemas.js';

const DIA_MS = 86_400_000;

export const ventasService = {
  async semana(usuarioId: number, ahora: Date = new Date(), zona: string = env.TIMEZONE) {
    const semana = semanaDe(ahora, zona);
    const ventas = await prisma.venta.findMany({
      where: {
        fecha: { gte: semana.inicio, lt: semana.fin },
        producto: { usuarioId, estado: true },
      },
      select: { cantidad: true, fecha: true },
    });
    const porDia = new Map<string, number>();
    for (const v of ventas) {
      const dia = diaLocal(v.fecha, zona);
      porDia.set(dia, (porDia.get(dia) ?? 0) + v.cantidad);
    }
    const hoy = diaLocal(ahora, zona);
    const dias = Array.from({ length: 7 }, (_, i) => {
      const fecha = diaLocal(new Date(semana.inicio.getTime() + i * DIA_MS + DIA_MS / 2), zona);
      return { fecha, cantidad: porDia.get(fecha) ?? 0, esHoy: fecha === hoy };
    });
    const total = dias.reduce((suma, d) => suma + d.cantidad, 0);
    let diaMayor: (typeof dias)[number] | null = null;
    for (const d of dias) {
      if (d.cantidad > 0 && (diaMayor === null || d.cantidad > diaMayor.cantidad)) diaMayor = d;
    }
    return {
      inicio: dias[0]?.fecha ?? hoy,
      fin: dias[6]?.fecha ?? hoy,
      dias,
      total,
      diaMayor,
    };
  },

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
