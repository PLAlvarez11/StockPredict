import { neutralizarFormula } from '../../../shared/texto.js';
import { COLUMNAS, NOMBRE_APP, TITULO, type TablaExportacion } from './tabla.js';

const BOM = String.fromCharCode(0xfeff);

function celda(valor: string | number | null): string {
  if (valor === null) return '';
  const texto = typeof valor === 'number' ? String(valor) : neutralizarFormula(valor);
  return /[",\r\n]/.test(texto) || texto !== texto.trim()
    ? `"${texto.replace(/"/g, '""')}"`
    : texto;
}

const linea = (valores: (string | number | null)[]) => valores.map(celda).join(',');

export function generarCsv(tabla: TablaExportacion): Buffer {
  const lineas = [
    linea([NOMBRE_APP]),
    linea([TITULO]),
    linea(['Semana', tabla.semanaTexto]),
    linea(['Productos', tabla.filas.length]),
    '',
    linea([...COLUMNAS]),
    ...tabla.filas.map((f) =>
      linea([
        f.producto,
        f.categoria,
        f.subcategoria,
        f.stockActual,
        f.stockSugerido,
        f.cantidadAComprar,
        f.necesidadPct,
        f.estado,
      ]),
    ),
  ];
  return Buffer.from(BOM + lineas.join('\r\n') + '\r\n', 'utf8');
}
