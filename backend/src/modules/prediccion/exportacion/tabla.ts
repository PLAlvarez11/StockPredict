import { diaLocal } from '../../../shared/time/semana.js';
import type { ItemPrediccion, Prediccion } from '../prediccion.service.js';

export const NOMBRE_APP = 'StockPredict';
export const TITULO = 'Predicción de compra';

export const COLUMNAS = [
  'Producto',
  'Categoría',
  'Subcategoría',
  'Stock actual',
  'Stock sugerido',
  'Cantidad a comprar',
  'Necesidad (%)',
  'Estado',
] as const;

export interface FilaExportacion {
  producto: string;
  categoria: string;
  subcategoria: string;
  stockActual: number;
  stockSugerido: number | null;
  cantidadAComprar: number | null;
  necesidadPct: number | null;
  semaforo: ItemPrediccion['semaforo'];
  estado: string;
}

export interface TablaExportacion {
  semanaInicio: string;
  semanaFin: string;
  semanaTexto: string;
  filas: FilaExportacion[];
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export function fechaLarga(dia: string): string {
  const [anio, mes, numero] = dia.split('-').map(Number);
  return `${numero} de ${MESES[(mes ?? 1) - 1] ?? ''} de ${anio}`;
}

export const ESTADO_TEXTO: Record<ItemPrediccion['semaforo'], string> = {
  rojo: 'Rojo: comprar',
  ambar: 'Ámbar: comprar poco',
  verde: 'Verde: stock suficiente',
  neutro: 'Sin historial suficiente',
};

export function construirTabla(prediccion: Prediccion, zona: string): TablaExportacion {
  const semanaInicio = diaLocal(new Date(prediccion.semanaActual.inicio), zona);
  const semanaFin = diaLocal(new Date(new Date(prediccion.semanaActual.fin).getTime() - 1), zona);
  return {
    semanaInicio,
    semanaFin,
    semanaTexto: `${fechaLarga(semanaInicio)} al ${fechaLarga(semanaFin)}`,
    filas: prediccion.items.map((i) => ({
      producto: i.producto.nombre,
      categoria: i.producto.categoria.nombre,
      subcategoria: i.producto.subcategoria.nombre,
      stockActual: i.stockActual,
      stockSugerido: i.stockSugerido,
      cantidadAComprar: i.cantidadAComprar,
      necesidadPct: i.necesidadPct,
      semaforo: i.semaforo,
      estado: ESTADO_TEXTO[i.semaforo],
    })),
  };
}

export function nombreArchivo(tabla: TablaExportacion, extension: string): string {
  return `stockpredict-prediccion-${tabla.semanaInicio}_a_${tabla.semanaFin}.${extension}`;
}
