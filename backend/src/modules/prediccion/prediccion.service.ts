import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import { semanaDe, semanasCerradas, type Semana } from '../../shared/time/semana.js';
import {
  compararPredicciones,
  necesidadPorcentual,
  normalizarTexto,
  semaforoDe,
  type EstadoPrediccion,
  type Semaforo,
} from './orden.js';
import {
  calcularPts,
  cantidadAComprar,
  MARGEN_PROPIO_PCT,
  MARGEN_RESPALDO_PCT,
  type ResultadoPts,
} from './pts.js';
import { prediccionRepository as repo } from './prediccion.repository.js';
import type { FiltrosPrediccion, SimulacionInput } from './prediccion.schemas.js';

export type { EstadoPrediccion, Semaforo } from './orden.js';
export type OrigenHistorial = 'producto' | 'subcategoria' | 'categoria';

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
  semaforo: Semaforo;
  origen: OrigenHistorial | null;
  necesidadPct: number | null;
  stockSugerido: number | null;
  cantidadAComprar: number | null;
  calculo: CalculoDetalle | null;
}

export interface Prediccion {
  semanasBase: { inicio: string; fin: string }[];
  semanaActual: { inicio: string; fin: string };
  totalActivos: number;
  totalAComprar: number;
  totalFiltrados: number;
  items: ItemPrediccion[];
}

type VentasPorSemana = [number, number, number];

interface ProductoBase {
  id: number;
  nombre: string;
  stock: number;
  creadoEn: Date;
  categoria: { id: number; nombre: string; icono: string };
  subcategoriaDto: { id: number; nombre: string; icono: string };
}

interface Base {
  semanas: Semana[];
  productos: ProductoBase[];
  porProducto: Map<number, VentasPorSemana>;
  tieneHistorial: (creadoEn: Date) => boolean;
}

interface Consulta {
  id?: number;
  categoriaId: number;
  subcategoriaId: number;
  propio: boolean;
}

interface Estimacion {
  origen: OrigenHistorial;
  pts: ResultadoPts;
  productosBase: number;
}

const aIso = (s: Semana) => ({ inicio: s.inicio.toISOString(), fin: s.fin.toISOString() });

function indiceSemana(fecha: Date, semanas: Semana[]): number {
  const t = fecha.getTime();
  return semanas.findIndex((s) => t >= s.inicio.getTime() && t < s.fin.getTime());
}

async function cargarBase(usuarioId: number, ahora: Date, zona: string): Promise<Base> {
  const semanas = semanasCerradas(ahora, zona, 3);
  const [w1, , w3] = semanas;
  if (!w1 || !w3) throw new Error('No se pudieron calcular las semanas');

  const productos: ProductoBase[] = (await repo.productosActivos(usuarioId)).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    stock: p.stock,
    creadoEn: p.creadoEn,
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

  return {
    semanas,
    productos,
    porProducto,
    tieneHistorial: (creadoEn) => creadoEn.getTime() < w3.inicio.getTime(),
  };
}

function sumarVentas(base: Base, productos: ProductoBase[]): VentasPorSemana {
  const suma: VentasPorSemana = [0, 0, 0];
  for (const o of productos) {
    const v = base.porProducto.get(o.id) ?? [0, 0, 0];
    suma[0] += v[0];
    suma[1] += v[1];
    suma[2] += v[2];
  }
  return suma;
}

function estimar(base: Base, consulta: Consulta): Estimacion | null {
  if (consulta.propio && consulta.id !== undefined) {
    const [v1, v2, v3] = base.porProducto.get(consulta.id) ?? [0, 0, 0];
    return {
      origen: 'producto',
      pts: calcularPts({ v1, v2, v3, margenPorCiento: MARGEN_PROPIO_PCT }),
      productosBase: 1,
    };
  }

  const candidatos = base.productos.filter(
    (o) => o.id !== consulta.id && base.tieneHistorial(o.creadoEn),
  );
  const niveles: { origen: OrigenHistorial; productos: ProductoBase[] }[] = [
    {
      origen: 'subcategoria',
      productos: candidatos.filter((o) => o.subcategoriaDto.id === consulta.subcategoriaId),
    },
    {
      origen: 'categoria',
      productos: candidatos.filter((o) => o.categoria.id === consulta.categoriaId),
    },
  ];
  for (const { origen, productos } of niveles) {
    if (productos.length === 0) continue;
    const [v1, v2, v3] = sumarVentas(base, productos);
    if (v1 + v2 + v3 === 0) continue;
    return {
      origen,
      pts: calcularPts({
        v1,
        v2,
        v3,
        divisor: productos.length,
        margenPorCiento: MARGEN_RESPALDO_PCT,
      }),
      productosBase: productos.length,
    };
  }
  return null;
}

function armarItem(base: Base, p: ProductoBase): ItemPrediccion {
  const comun = {
    producto: {
      id: p.id,
      nombre: p.nombre,
      categoria: p.categoria,
      subcategoria: p.subcategoriaDto,
    },
    stockActual: p.stock,
  };
  const estimacion = estimar(base, {
    id: p.id,
    categoriaId: p.categoria.id,
    subcategoriaId: p.subcategoriaDto.id,
    propio: base.tieneHistorial(p.creadoEn),
  });
  if (!estimacion) {
    return {
      ...comun,
      estado: 'sin_historial',
      semaforo: semaforoDe('sin_historial', null),
      origen: null,
      necesidadPct: null,
      stockSugerido: null,
      cantidadAComprar: null,
      calculo: null,
    };
  }
  const comprar = cantidadAComprar(estimacion.pts.stockSugerido, p.stock);
  const estado = comprar > 0 ? 'comprar' : 'suficiente';
  const necesidadPct = necesidadPorcentual(comprar, estimacion.pts.stockSugerido);
  return {
    ...comun,
    estado,
    semaforo: semaforoDe(estado, necesidadPct),
    origen: estimacion.origen,
    necesidadPct,
    stockSugerido: estimacion.pts.stockSugerido,
    cantidadAComprar: comprar,
    calculo: {
      ...estimacion.pts,
      cantidadAComprar: comprar,
      productosBase: estimacion.productosBase,
    },
  };
}

const ordenable = (i: ItemPrediccion) => ({
  estado: i.estado,
  necesidadPct: i.necesidadPct,
  cantidadAComprar: i.cantidadAComprar,
  nombre: i.producto.nombre,
});

export function filtrarItems(
  items: ItemPrediccion[],
  filtros: FiltrosPrediccion,
): ItemPrediccion[] {
  const q = filtros.q === undefined ? '' : normalizarTexto(filtros.q);
  return items.filter((i) => {
    if (filtros.categoriaId !== undefined && i.producto.categoria.id !== filtros.categoriaId) {
      return false;
    }
    if (
      filtros.subcategoriaId !== undefined &&
      i.producto.subcategoria.id !== filtros.subcategoriaId
    ) {
      return false;
    }
    if (filtros.estado !== 'todos' && i.semaforo !== filtros.estado) return false;
    if (q === '') return true;
    return [i.producto.nombre, i.producto.categoria.nombre, i.producto.subcategoria.nombre].some(
      (t) => normalizarTexto(t).includes(q),
    );
  });
}

const SIN_FILTROS: FiltrosPrediccion = { estado: 'todos' };

export async function calcularPrediccion(
  usuarioId: number,
  ahora: Date = new Date(),
  zona: string = env.TIMEZONE,
  filtros: FiltrosPrediccion = SIN_FILTROS,
): Promise<Prediccion> {
  const base = await cargarBase(usuarioId, ahora, zona);
  const items = base.productos
    .map((p) => armarItem(base, p))
    .sort((a, b) => compararPredicciones(ordenable(a), ordenable(b)));
  const filtrados = filtrarItems(items, filtros);

  return {
    semanasBase: base.semanas.map(aIso),
    semanaActual: aIso(semanaDe(ahora, zona)),
    totalActivos: items.length,
    totalAComprar: items.filter((i) => i.estado === 'comprar').length,
    totalFiltrados: filtrados.length,
    items: filtrados,
  };
}

const referenciaInvalida = (campo: string, mensaje: string) =>
  new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', {
    detail: 'Revisa los campos marcados.',
    errors: [{ field: campo, code: 'INVALID_REFERENCE', message: mensaje }],
  });

export async function simularStock(
  usuarioId: number,
  datos: SimulacionInput,
  ahora: Date = new Date(),
  zona: string = env.TIMEZONE,
) {
  const categoria = await repo.categoriaActiva(datos.categoriaId, usuarioId);
  if (!categoria)
    throw referenciaInvalida('categoriaId', 'La categoría no existe o está inactiva.');
  let subcategoria: { id: number; nombre: string } | null = null;
  if (datos.subcategoriaId !== undefined) {
    subcategoria = await repo.subcategoriaActiva(datos.subcategoriaId, categoria.id, usuarioId);
    if (!subcategoria) {
      throw referenciaInvalida(
        'subcategoriaId',
        'La subcategoría no existe, está inactiva o no es de esa categoría.',
      );
    }
  }

  const base = await cargarBase(usuarioId, ahora, zona);
  const estimacion = estimar(base, {
    categoriaId: categoria.id,
    subcategoriaId: subcategoria?.id ?? -1,
    propio: false,
  });
  const stockActual = datos.stockActual ?? null;
  const respuesta = {
    nombre: datos.nombre ?? null,
    categoria: { id: categoria.id, nombre: categoria.nombre },
    subcategoria,
    stockActual,
  };
  if (!estimacion) {
    return {
      ...respuesta,
      estado: 'sin_historial' as const,
      origen: null,
      stockSugerido: null,
      cantidadAComprar: null,
      necesidadPct: null,
      calculo: null,
    };
  }
  const comprar =
    stockActual === null ? null : cantidadAComprar(estimacion.pts.stockSugerido, stockActual);
  return {
    ...respuesta,
    estado: 'estimado' as const,
    origen: estimacion.origen,
    stockSugerido: estimacion.pts.stockSugerido,
    cantidadAComprar: comprar,
    necesidadPct:
      comprar === null ? null : necesidadPorcentual(comprar, estimacion.pts.stockSugerido),
    calculo: {
      ...estimacion.pts,
      cantidadAComprar: comprar ?? 0,
      productosBase: estimacion.productosBase,
    },
  };
}
