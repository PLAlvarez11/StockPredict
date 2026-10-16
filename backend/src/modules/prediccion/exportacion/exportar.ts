import { env } from '../../../config/env.js';
import { calcularPrediccion } from '../prediccion.service.js';
import type { ExportarQuery } from '../prediccion.schemas.js';
import { generarCsv } from './csv.js';
import { generarPdf } from './pdf.js';
import { construirTabla, nombreArchivo } from './tabla.js';
import { generarXlsx } from './xlsx.js';

export const TIPOS_CONTENIDO = {
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
} as const;

export async function exportarPrediccion(
  usuarioId: number,
  { formato, ...filtros }: ExportarQuery,
  ahora: Date = new Date(),
  zona: string = env.TIMEZONE,
) {
  const prediccion = await calcularPrediccion(usuarioId, ahora, zona, filtros);
  const tabla = construirTabla(prediccion, zona);
  const contenido =
    formato === 'csv'
      ? generarCsv(tabla)
      : formato === 'xlsx'
        ? await generarXlsx(tabla)
        : await generarPdf(tabla);
  return { contenido, tipo: TIPOS_CONTENIDO[formato], nombre: nombreArchivo(tabla, formato) };
}
