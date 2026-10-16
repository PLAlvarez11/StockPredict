import PDFDocument from 'pdfkit';
import {
  COLUMNAS,
  NOMBRE_APP,
  TITULO,
  type FilaExportacion,
  type TablaExportacion,
} from './tabla.js';

const MARGEN = 36;
const ANCHO_PAGINA = 595.28;
const ALTO_PAGINA = 841.89;
const ANCHO = ANCHO_PAGINA - 2 * MARGEN;
const PIE = 30;

const COLUMNAS_PDF = [
  { titulo: 'Producto', ancho: 183, alinear: 'left' as const },
  { titulo: COLUMNAS[3], ancho: 58, alinear: 'center' as const },
  { titulo: COLUMNAS[4], ancho: 58, alinear: 'center' as const },
  { titulo: COLUMNAS[5], ancho: 62, alinear: 'center' as const },
  { titulo: COLUMNAS[6], ancho: 56, alinear: 'center' as const },
  { titulo: COLUMNAS[7], ancho: ANCHO - 183 - 58 - 58 - 62 - 56, alinear: 'left' as const },
];

const COLOR_ESTADO: Record<FilaExportacion['semaforo'], string> = {
  rojo: '#B33F31',
  ambar: '#8A6316',
  verde: '#4E6E56',
  neutro: '#5F5550',
};

const TEXTO = '#2E2227';
const SUAVE = '#5F5550';
const ENCABEZADO = '#6B4653';

const EXTRA_WIN_ANSI = new Set([
  0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2026, 0x20ac,
]);

export function aWinAnsi(texto: string): string {
  return Array.from(texto, (c) => {
    const n = c.codePointAt(0) ?? 0;
    const valido = (n >= 0x20 && n <= 0x7e) || (n >= 0xa0 && n <= 0xff) || EXTRA_WIN_ANSI.has(n);
    return valido ? c : '?';
  }).join('');
}

const numero = (valor: number | null) => (valor === null ? '—' : String(valor));

export interface OpcionesPdf {
  comprimir?: boolean;
  fechaDocumento?: Date;
}

export function generarPdf(tabla: TablaExportacion, opciones: OpcionesPdf = {}): Promise<Buffer> {
  return new Promise((resolver, rechazar) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MARGEN, bottom: MARGEN + PIE, left: MARGEN, right: MARGEN },
      bufferPages: true,
      compress: opciones.comprimir ?? true,
      info: {
        Title: `${NOMBRE_APP}: ${TITULO}`,
        Author: NOMBRE_APP,
        Subject: `Semana del ${tabla.semanaInicio} al ${tabla.semanaFin}`,
        CreationDate: opciones.fechaDocumento ?? new Date(`${tabla.semanaInicio}T12:00:00Z`),
      },
    });
    const trozos: Buffer[] = [];
    doc.on('data', (t: Buffer) => trozos.push(t));
    doc.on('end', () => resolver(Buffer.concat(trozos)));
    doc.on('error', rechazar);

    const limiteY = ALTO_PAGINA - MARGEN - PIE;

    doc.fillColor(ENCABEZADO).font('Helvetica-Bold').fontSize(22).text(NOMBRE_APP, MARGEN, MARGEN);
    doc.fillColor(TEXTO).font('Helvetica-Bold').fontSize(16).text(TITULO);
    doc
      .fillColor(SUAVE)
      .font('Helvetica')
      .fontSize(12)
      .text(`Semana del ${aWinAnsi(tabla.semanaTexto)}`)
      .text(`${tabla.filas.length} ${tabla.filas.length === 1 ? 'producto' : 'productos'}`);
    doc.moveDown(0.8);

    let y = doc.y;

    const dibujarEncabezado = () => {
      const alto = 30;
      doc.rect(MARGEN, y, ANCHO, alto).fill(ENCABEZADO);
      let x = MARGEN;
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9.5);
      for (const c of COLUMNAS_PDF) {
        doc.text(c.titulo, x + 4, y + 5, { width: c.ancho - 8, align: c.alinear, lineBreak: true });
        x += c.ancho;
      }
      y += alto;
    };

    const alturaFila = (f: FilaExportacion) => {
      doc.font('Helvetica-Bold').fontSize(11.5);
      const nombre = doc.heightOfString(aWinAnsi(f.producto), {
        width: (COLUMNAS_PDF[0]?.ancho ?? 180) - 8,
      });
      doc.font('Helvetica').fontSize(9.5);
      const detalle =
        doc.heightOfString(`Categoría: ${aWinAnsi(f.categoria)}`, {
          width: (COLUMNAS_PDF[0]?.ancho ?? 180) - 8,
        }) +
        doc.heightOfString(`Subcategoría: ${aWinAnsi(f.subcategoria)}`, {
          width: (COLUMNAS_PDF[0]?.ancho ?? 180) - 8,
        });
      doc.font('Helvetica-Bold').fontSize(10.5);
      const estado = doc.heightOfString(f.estado, {
        width: (COLUMNAS_PDF[5]?.ancho ?? 100) - 8,
      });
      return Math.max(nombre + detalle + 14, estado + 14, 38);
    };

    if (tabla.filas.length === 0) {
      doc
        .fillColor(SUAVE)
        .font('Helvetica')
        .fontSize(12)
        .text('No hay productos con los filtros elegidos.', MARGEN, y + 6);
    } else {
      dibujarEncabezado();
    }

    tabla.filas.forEach((f, indice) => {
      const alto = alturaFila(f);
      if (y + alto > limiteY) {
        doc.addPage();
        y = MARGEN;
        dibujarEncabezado();
      }
      if (indice % 2 === 1) doc.rect(MARGEN, y, ANCHO, alto).fill('#F5EDE8');
      const [producto, actual, sugerido, comprar, necesidad, estado] = COLUMNAS_PDF;
      if (!producto || !actual || !sugerido || !comprar || !necesidad || !estado) return;
      let x = MARGEN;
      doc.fillColor(TEXTO).font('Helvetica-Bold').fontSize(11.5);
      doc.text(aWinAnsi(f.producto), x + 4, y + 6, { width: producto.ancho - 8 });
      doc.fillColor(SUAVE).font('Helvetica').fontSize(9.5);
      doc.text(`Categoría: ${aWinAnsi(f.categoria)}`, x + 4, doc.y, { width: producto.ancho - 8 });
      doc.text(`Subcategoría: ${aWinAnsi(f.subcategoria)}`, x + 4, doc.y, {
        width: producto.ancho - 8,
      });
      x += producto.ancho;
      const valores: [typeof actual, string][] = [
        [actual, numero(f.stockActual)],
        [sugerido, numero(f.stockSugerido)],
        [comprar, numero(f.cantidadAComprar)],
        [necesidad, f.necesidadPct === null ? '—' : `${f.necesidadPct} %`],
      ];
      for (const [col, valor] of valores) {
        doc.fillColor(TEXTO).font('Helvetica').fontSize(12);
        doc.text(valor, x + 2, y + 8, { width: col.ancho - 4, align: 'center' });
        x += col.ancho;
      }
      doc.fillColor(COLOR_ESTADO[f.semaforo]).font('Helvetica-Bold').fontSize(10.5);
      doc.text(f.estado, x + 4, y + 8, { width: estado.ancho - 8 });
      doc
        .moveTo(MARGEN, y + alto)
        .lineTo(MARGEN + ANCHO, y + alto)
        .lineWidth(0.5)
        .strokeColor('#EADCD5')
        .stroke();
      y += alto;
    });

    const rango = doc.bufferedPageRange();
    for (let i = 0; i < rango.count; i += 1) {
      doc.switchToPage(rango.start + i);
      doc.page.margins.bottom = 0;
      doc
        .fillColor(SUAVE)
        .font('Helvetica')
        .fontSize(9)
        .text(
          `${NOMBRE_APP} · ${TITULO} · ${tabla.semanaInicio} a ${tabla.semanaFin} · Página ${i + 1} de ${rango.count}`,
          MARGEN,
          ALTO_PAGINA - MARGEN - 8,
          { width: ANCHO, align: 'center', lineBreak: false },
        );
    }
    doc.end();
  });
}
