import writeExcelFile, { type SheetData } from 'write-excel-file/node';
import { neutralizarFormula } from '../../../shared/texto.js';
import { COLUMNAS, NOMBRE_APP, TITULO, type TablaExportacion } from './tabla.js';

type Valor = { value: string | number; type?: StringConstructor | NumberConstructor } & Record<
  string,
  unknown
>;

const texto = (valor: string, extra: Record<string, unknown> = {}): Valor => ({
  value: neutralizarFormula(valor),
  type: String,
  ...extra,
});
const numero = (valor: number | null, extra: Record<string, unknown> = {}) =>
  valor === null ? null : ({ value: valor, type: Number, ...extra } as Valor);

const ENCABEZADO = { fontWeight: 'bold', backgroundColor: '#6B4653', color: '#FFFFFF' };

export async function generarXlsx(tabla: TablaExportacion): Promise<Buffer> {
  const filas = [
    [texto(NOMBRE_APP, { fontWeight: 'bold', fontSize: 16 })],
    [texto(TITULO, { fontWeight: 'bold' })],
    [texto('Semana'), texto(tabla.semanaTexto)],
    [texto('Productos'), numero(tabla.filas.length)],
    [],
    COLUMNAS.map((c) => texto(c, ENCABEZADO)),
    ...tabla.filas.map((f) => [
      texto(f.producto),
      texto(f.categoria),
      texto(f.subcategoria),
      numero(f.stockActual),
      numero(f.stockSugerido),
      numero(f.cantidadAComprar),
      numero(f.necesidadPct),
      texto(f.estado),
    ]),
  ];
  const buffer = await writeExcelFile(filas as SheetData, {
    sheet: 'Predicción',
    columns: [
      { width: 34 },
      { width: 18 },
      { width: 18 },
      { width: 14 },
      { width: 16 },
      { width: 20 },
      { width: 16 },
      { width: 28 },
    ],
  }).toBuffer();
  return Buffer.from(buffer);
}
