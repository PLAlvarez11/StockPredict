import { descargarArchivo } from '../../lib/descarga';
import { consulta, type FiltrosPrediccion, type FormatoExportacion } from './api';

export function exportarPrediccion(filtros: FiltrosPrediccion, formato: FormatoExportacion) {
  const filtrosTexto = consulta(filtros);
  const ruta = `/prediccion/exportar${filtrosTexto === '' ? '?' : `${filtrosTexto}&`}formato=${formato}`;
  return descargarArchivo(ruta);
}
