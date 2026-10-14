import { env } from '../../config/env.js';
import { semanasCerradas, type Semana } from '../../shared/time/semana.js';
import { calcularPts, cantidadAComprar, type ResultadoPts } from './pts.js';
import { prediccionRepository as repo } from './prediccion.repository.js';

export type EstadoPrediccion = 'comprar' | 'suficiente' | 'sin_historial';
export type OrigenHistorial = 'producto' | 'categoria';

export interface CalculoDetalle extends ResultadoPts {
  cantidadAComprar: number;
  productosBase: number;
}

export interface ItemPrediccion {
  producto: {
    id: number;
    nombre: string;
    categoria: { id: number; nombre: string; icono: string };
    subcategoria: { id: number; nombre: string; icono: string };
  };
  stockActual: number;
  estado: EstadoPrediccion;
  origen: OrigenHistorial | null;
  stockSugerido: number | null;
  cantidadAComprar: number | null;
  calculo: CalculoDetalle | null;
}

export interface Prediccion {
  semanasBase: { inicio: string; fin: string }[];
  totalActivos: number;
  totalAComprar: number;
  items: ItemPrediccion[];
}

type VentasPorSemana = [number, number, number];

function indiceSemana(fecha: Date, semanas: Semana[]): number {
  const t = fecha.getTime();
  return semanas.findIndex((s) => t >= s.inicio.getTime() && t < s.fin.getTime());
}

const ORDEN: Record<EstadoPrediccion, number> = { comprar: 0, suficiente: 1, sin_historial: 2 };

export async function calcularPrediccion(
  usuarioId: number,
  ahora: Date = new Date(),
  zona: string = env.TIMEZONE,
): Promise<Prediccion> {
  const semanas = semanasCerradas(ahora, zona, 3);
  const [w1, , w3] = semanas;
  if (!w1 || !w3) throw new Error('No se pudieron calcular las semanas');

  const productos = (await repo.productosActivos(usuarioId)).map((p) => ({
    ...p,
    categoria: p.subcategoria.categoria,
    subcategoriaDto: {
      id: p.subcategoria.id,
      nombre: p.subcategoria.nombre,
      icono: p.subcategoria.icono ?? p.subcategoria.categoria.icono,
    },
  }));
  const ventas =
    productos.length === 0
      ? []
      : await repo.ventasEntre(
          productos.map((p) => p.id),
          w3.inicio,
          w1.fin,
        );

  const porProducto = new Map<number, VentasPorSemana>();
  for (const p of productos) porProducto.set(p.id, [0, 0, 0]);
  for (const v of ventas) {
    const semana = indiceSemana(v.fecha, semanas);
    const acumulado = porProducto.get(v.productoId);
    if (semana >= 0 && acumulado) acumulado[semana] = (acumulado[semana] ?? 0) + v.cantidad;
  }

  const tieneHistorial = (creadoEn: Date) => creadoEn.getTime() < w3.inicio.getTime();

  const items: ItemPrediccion[] = productos.map((p) => {
    const base = {
      producto: {
        id: p.id,
        nombre: p.nombre,
        categoria: p.categoria,
        subcategoria: p.subcategoriaDto,
      },
      stockActual: p.stock,
    };
    let semanasVentas: VentasPorSemana | null = null;
    let divisor = 1;
    let origen: OrigenHistorial | null = null;

    if (tieneHistorial(p.creadoEn)) {
      semanasVentas = porProducto.get(p.id) ?? [0, 0, 0];
      origen = 'producto';
    } else {
      const otros = productos.filter(
        (o) => o.id !== p.id && o.categoria.id === p.categoria.id && tieneHistorial(o.creadoEn),
      );
      const suma: VentasPorSemana = [0, 0, 0];
      for (const o of otros) {
        const v = porProducto.get(o.id) ?? [0, 0, 0];
        suma[0] += v[0];
        suma[1] += v[1];
        suma[2] += v[2];
      }
      if (otros.length > 0 && suma[0] + suma[1] + suma[2] > 0) {
        semanasVentas = suma;
        divisor = otros.length;
        origen = 'categoria';
      }
    }

    if (!semanasVentas || !origen) {
      return {
        ...base,
        estado: 'sin_historial' as const,
        origen: null,
        stockSugerido: null,
        cantidadAComprar: null,
        calculo: null,
      };
    }

    const pts = calcularPts({
      v1: semanasVentas[0],
      v2: semanasVentas[1],
      v3: semanasVentas[2],
      divisor,
    });
    const comprar = cantidadAComprar(pts.stockSugerido, p.stock);
    return {
      ...base,
      estado: comprar > 0 ? ('comprar' as const) : ('suficiente' as const),
      origen,
      stockSugerido: pts.stockSugerido,
      cantidadAComprar: comprar,
      calculo: { ...pts, cantidadAComprar: comprar, productosBase: divisor },
    };
  });

  items.sort(
    (a, b) =>
      ORDEN[a.estado] - ORDEN[b.estado] ||
      (b.cantidadAComprar ?? 0) - (a.cantidadAComprar ?? 0) ||
      a.producto.nombre.localeCompare(b.producto.nombre, 'es'),
  );

  return {
    semanasBase: semanas.map((s) => ({ inicio: s.inicio.toISOString(), fin: s.fin.toISOString() })),
    totalActivos: items.length,
    totalAComprar: items.filter((i) => i.estado === 'comprar').length,
    items,
  };
}
