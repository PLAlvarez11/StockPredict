import { unzipSync, strFromU8 } from 'fflate';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../../app.js';
import { prisma } from '../../../shared/db/prisma.js';
import { semanaDe, semanasCerradas, diaLocal } from '../../../shared/time/semana.js';
import {
  crearCatalogoDePrueba,
  crearMailerFalso,
  iniciarSesionDePrueba,
  limpiarBase,
  type Catalogo,
} from '../../../../test/helpers.js';
import { generarCsv } from './csv.js';
import { generarPdf } from './pdf.js';
import { construirTabla } from './tabla.js';
import type { Prediccion } from '../prediccion.service.js';

const ZONA = 'America/Guatemala';
const CORREO = 'prueba@ejemplo.com';
const app = crearApp({ mailer: crearMailerFalso() });

let agente: Awaited<ReturnType<typeof iniciarSesionDePrueba>>;
let blusas: Catalogo;
let bolsos: Catalogo;

async function crearProducto(
  a: typeof agente,
  catalogo: Catalogo,
  nombre: string,
  stock: number,
  ventas?: [number, number, number],
) {
  const res = await a
    .post('/api/v1/productos')
    .send({ nombre, subcategoriaId: catalogo.subcategoria.id, stockInicial: stock });
  expect(res.status).toBe(201);
  const id = res.body.id as number;
  if (ventas) {
    const [reciente, media, antigua] = semanasCerradas(new Date(), ZONA, 3);
    if (!reciente || !media || !antigua) throw new Error('Faltan semanas');
    const medio = (s: { inicio: Date; fin: Date }) =>
      new Date((s.inicio.getTime() + s.fin.getTime()) / 2);
    await prisma.producto.update({
      where: { id },
      data: { creadoEn: new Date(antigua.inicio.getTime() - 86_400_000) },
    });
    await prisma.venta.createMany({
      data: [
        { productoId: id, cantidad: ventas[0], fecha: medio(reciente) },
        { productoId: id, cantidad: ventas[1], fecha: medio(media) },
        { productoId: id, cantidad: ventas[2], fecha: medio(antigua) },
      ],
    });
  }
  return id;
}

const binario = (res: request.Response) => Buffer.from(res.body as Buffer);
const exportar = (formato: string, consulta = '', a: { get: typeof agente.get } = agente) =>
  a
    .get(`/api/v1/prediccion/exportar?formato=${formato}${consulta}`)
    .buffer(true)
    .parse((r, cb) => {
      const trozos: Buffer[] = [];
      r.on('data', (t: Buffer) => trozos.push(t));
      r.on('end', () => cb(null, Buffer.concat(trozos)));
    });

function leerCsv(contenido: Buffer): string[][] {
  const bruto = contenido.toString('utf8');
  const texto = bruto.startsWith(String.fromCharCode(0xfeff)) ? bruto.slice(1) : bruto;
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let entrecomillado = false;
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i];
    if (entrecomillado) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i += 1;
      } else if (c === '"') entrecomillado = false;
      else campo += c;
    } else if (c === '"') entrecomillado = true;
    else if (c === ',') {
      fila.push(campo);
      campo = '';
    } else if (c === '\r' && texto[i + 1] === '\n') {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = '';
      i += 1;
    } else campo += c;
  }
  return filas;
}

function textoPdf(pdf: Buffer): string[] {
  const texto = pdf.toString('latin1');
  const lineas: string[] = [];
  for (const m of texto.matchAll(/\[([^\]]*)\] TJ/g)) {
    const partes = [...(m[1] ?? '').matchAll(/<([0-9a-f]*)>/g)].map((h) =>
      Buffer.from(h[1] ?? '', 'hex').toString('latin1'),
    );
    lineas.push(partes.join(''));
  }
  return lineas;
}

function textosXlsx(contenido: Buffer): { todo: string; compartidas: string } {
  const archivos = unzipSync(new Uint8Array(contenido));
  const todo = Object.values(archivos)
    .map((a) => strFromU8(a))
    .join('\n');
  const compartidas = archivos['xl/sharedStrings.xml'];
  return { todo, compartidas: compartidas ? strFromU8(compartidas) : '' };
}

beforeEach(async () => {
  await limpiarBase();
  agente = await iniciarSesionDePrueba(app, CORREO);
  blusas = await crearCatalogoDePrueba(agente, 'Ropa', 'Blusas', 't-shirt');
  bolsos = await crearCatalogoDePrueba(agente, 'Bolsos', 'Totes', 'handbag-simple');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/v1/prediccion/exportar', () => {
  it('EX01: CSV legible, con BOM UTF-8, encabezado, semana y las columnas pedidas; Blusa floral 3, 10, 7', async () => {
    await crearProducto(agente, blusas, 'Blusa floral', 3, [8, 6, 5]);
    const res = await exportar('csv');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const bytes = binario(res);
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const filas = leerCsv(bytes);
    const semana = semanaDe(new Date(), ZONA);
    const inicio = diaLocal(semana.inicio, ZONA);
    expect(filas[0]).toEqual(['StockPredict']);
    expect(filas[1]).toEqual(['Predicción de compra']);
    expect(filas[2]?.[0]).toBe('Semana');
    expect(filas[2]?.[1]).toMatch(/^\d+ de \w+ de \d{4} al \d+ de \w+ de \d{4}$/);
    expect(filas[3]).toEqual(['Productos', '1']);
    expect(filas[5]).toEqual([
      'Producto',
      'Categoría',
      'Subcategoría',
      'Stock actual',
      'Stock sugerido',
      'Cantidad a comprar',
      'Necesidad (%)',
      'Estado',
    ]);
    expect(filas[6]).toEqual([
      'Blusa floral',
      'Ropa',
      'Blusas',
      '3',
      '10',
      '7',
      '70',
      'Rojo: comprar',
    ]);
    expect(res.headers['content-disposition']).toContain(`stockpredict-prediccion-${inicio}_a_`);
  });

  it('EX02: el nombre del archivo lleva el rango de la semana: lunes_a_domingo, solo fechas', async () => {
    const semana = semanaDe(new Date(), ZONA);
    const lunes = diaLocal(semana.inicio, ZONA);
    const domingo = diaLocal(new Date(semana.fin.getTime() - 1), ZONA);
    for (const [formato, ext] of [
      ['csv', 'csv'],
      ['xlsx', 'xlsx'],
      ['pdf', 'pdf'],
    ] as const) {
      const res = await exportar(formato);
      expect(res.headers['content-disposition']).toBe(
        `attachment; filename="stockpredict-prediccion-${lunes}_a_${domingo}.${ext}"`,
      );
      expect(res.headers['cache-control']).toBe('no-store');
    }
  });

  it('EX03: el Excel es un .xlsx válido con las columnas, el encabezado y los datos', async () => {
    await crearProducto(agente, blusas, 'Blusa floral', 3, [8, 6, 5]);
    const res = await exportar('xlsx');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
    const bytes = binario(res);
    expect(bytes.subarray(0, 2).toString('latin1')).toBe('PK');
    const { todo, compartidas } = textosXlsx(bytes);
    for (const texto of [
      'StockPredict',
      'Predicción de compra',
      'Semana',
      'Producto',
      'Categoría',
      'Subcategoría',
      'Stock actual',
      'Stock sugerido',
      'Cantidad a comprar',
      'Necesidad (%)',
      'Estado',
      'Blusa floral',
      'Rojo: comprar',
    ]) {
      expect(compartidas, texto).toContain(texto);
    }
    expect(todo).toContain('<v>10</v>');
    expect(todo).toContain('<v>7</v>');
    expect(todo).toContain('<v>70</v>');
  });

  it('EX04: el PDF empieza con %PDF, termina con %%EOF y tiene contenido', async () => {
    await crearProducto(agente, blusas, 'Blusa floral', 3, [8, 6, 5]);
    const res = await exportar('pdf');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    const bytes = binario(res);
    expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(bytes.subarray(-8).toString('latin1')).toContain('%%EOF');
    expect(bytes.length).toBeGreaterThan(1500);
  });

  it('EX05: el PDF trae título, semana, columnas, tildes y datos; se pagina con encabezado repetido y pie', async () => {
    const prediccion: Prediccion = {
      semanasBase: [],
      semanaActual: { inicio: '2026-10-12T06:00:00.000Z', fin: '2026-10-19T06:00:00.000Z' },
      totalActivos: 60,
      totalAComprar: 60,
      totalFiltrados: 60,
      items: Array.from({ length: 60 }, (_, i) => ({
        producto: {
          id: i + 1,
          nombre: i === 0 ? 'Blusa floral ñandú' : `Producto ${i + 1}`,
          categoria: { id: 1, nombre: 'Ropa', icono: 't-shirt' },
          subcategoria: { id: 1, nombre: 'Blusas', icono: 't-shirt' },
        },
        stockActual: 3,
        estado: i === 59 ? ('sin_historial' as const) : ('comprar' as const),
        semaforo: i === 59 ? ('neutro' as const) : ('rojo' as const),
        origen: i === 59 ? null : ('producto' as const),
        necesidadPct: i === 59 ? null : 70,
        stockSugerido: i === 59 ? null : 10,
        cantidadAComprar: i === 59 ? null : 7,
        calculo: null,
      })),
    };
    const tabla = construirTabla(prediccion, ZONA);
    const pdf = await generarPdf(tabla, { comprimir: false });
    const lineas = textoPdf(pdf);
    const crudo = pdf.toString('latin1');
    const paginas = crudo.split('/Type /Page').length - crudo.split('/Type /Pages').length;
    expect(paginas).toBeGreaterThanOrEqual(2);
    for (const t of [
      'StockPredict',
      'Predicción de compra',
      'Blusa floral ñandú',
      'Sin historial suficiente',
      'Categoría: Ropa',
      'Subcategoría: Blusas',
      'Rojo: comprar',
    ]) {
      expect(lineas.join(' ').replace(/ +/g, ' '), t).toContain(t);
    }
    expect(lineas.some((l) => l.startsWith('Semana del 12 de octubre de 2026'))).toBe(true);
    expect(lineas.filter((l) => l === 'Estado')).toHaveLength(paginas);
    expect(lineas.filter((l) => l === 'Producto')).toHaveLength(paginas);
    for (let i = 1; i <= paginas; i += 1) {
      expect(
        lineas.some((l) => l.endsWith(`Página ${i} de ${paginas}`)),
        `pie ${i}`,
      ).toBe(true);
    }
  });

  it('EX06: un producto sin historial dice "Sin historial suficiente" y no inventa números', async () => {
    await crearProducto(agente, bolsos, 'Tote lona', 5);
    const filas = leerCsv(binario(await exportar('csv')));
    expect(filas[6]).toEqual([
      'Tote lona',
      'Bolsos',
      'Totes',
      '5',
      '',
      '',
      '',
      'Sin historial suficiente',
    ]);
    const { compartidas } = textosXlsx(binario(await exportar('xlsx')));
    expect(compartidas).toContain('Sin historial suficiente');
  });

  it('EX07: las celdas que empiezan con =, +, - o @ no se pueden ejecutar como fórmula en CSV ni en Excel', async () => {
    const nombres = ['=HYPERLINK("http://x","y")', '+1+1', '-2+3', '@SUMA(1)', '\t=1'];
    for (const nombre of nombres) await crearProducto(agente, blusas, nombre, 1, [1, 1, 1]);
    const filas = leerCsv(binario(await exportar('csv'))).slice(6);
    expect(filas).toHaveLength(nombres.length);
    for (const fila of filas) {
      for (const celda of fila.slice(0, 3)) expect(celda).not.toMatch(/^[=+\-@\t\r]/);
    }
    const productos = filas.map((f) => f[0]);
    expect(productos).toContain('\'=HYPERLINK("http://x","y")');
    expect(productos).toContain("'+1+1");
    expect(productos).toContain("'-2+3");
    expect(productos).toContain("'@SUMA(1)");
    const { todo, compartidas } = textosXlsx(binario(await exportar('xlsx')));
    expect(compartidas).toContain("<t>'+1+1</t>");
    expect(compartidas).not.toMatch(/<t[^>]*>[=+\-@]/);
    expect(todo).not.toContain('<f>');
  });

  it('EX08: el CSV escapa comas, comillas y saltos de línea', async () => {
    await crearProducto(agente, blusas, 'Blusa "floral", talla M', 1, [1, 1, 1]);
    const filas = leerCsv(binario(await exportar('csv')));
    expect(filas[6]?.[0]).toBe('Blusa "floral", talla M');
    expect(filas[6]).toHaveLength(8);
  });

  it('EX09: respeta los filtros y el orden de la pantalla (búsqueda, categoría, subcategoría y estado)', async () => {
    await crearProducto(agente, blusas, 'Blusa alta', 1, [8, 6, 5]);
    await crearProducto(agente, blusas, 'Blusa media', 6, [8, 6, 5]);
    await crearProducto(agente, blusas, 'Blusa llena', 80, [8, 6, 5]);
    await crearProducto(agente, bolsos, 'Tote lona', 5);
    const consultas = [
      '',
      '&q=BLUSA',
      '&q=totes',
      `&categoriaId=${blusas.categoria.id}`,
      `&subcategoriaId=${bolsos.subcategoria.id}`,
      '&estado=rojo',
      '&estado=ambar',
      '&estado=verde',
      '&estado=neutro',
      `&categoriaId=${blusas.categoria.id}&estado=verde&q=llena`,
    ];
    for (const consulta of consultas) {
      const pantalla = await agente.get(`/api/v1/prediccion?${consulta.slice(1)}`);
      const esperado = (pantalla.body.items as { producto: { nombre: string } }[]).map(
        (i) => i.producto.nombre,
      );
      for (const formato of ['csv', 'xlsx']) {
        const res = await exportar(formato, consulta);
        expect(res.status, consulta).toBe(200);
        if (formato === 'csv') {
          const nombres = leerCsv(binario(res))
            .slice(6)
            .map((f) => f[0])
            .filter((n) => n !== undefined && n !== '');
          expect(nombres, consulta).toEqual(esperado);
        } else {
          const { compartidas } = textosXlsx(binario(res));
          const orden = esperado.map((n) => compartidas.indexOf(n));
          expect(
            orden.every((p) => p >= 0),
            consulta,
          ).toBe(true);
          expect(
            [...orden].sort((a, b) => a - b),
            consulta,
          ).toEqual(orden);
        }
      }
    }
  });

  it('EX10: los productos desactivados no salen en ningún formato', async () => {
    const viejo = await crearProducto(agente, blusas, 'Blusa descontinuada', 1, [9, 9, 9]);
    await crearProducto(agente, blusas, 'Blusa activa', 1, [8, 6, 5]);
    await agente.delete(`/api/v1/productos/${viejo}`);
    for (const formato of ['csv', 'xlsx']) {
      const bytes = binario(await exportar(formato));
      const texto = formato === 'csv' ? bytes.toString('utf8') : textosXlsx(bytes).compartidas;
      expect(texto).toContain('Blusa activa');
      expect(texto).not.toContain('Blusa descontinuada');
    }
  });

  it('EX11: no incluye productos de otro usuario ni datos del usuario (correo, nombre, identificadores)', async () => {
    const otro = await iniciarSesionDePrueba(app, 'otro@ejemplo.com');
    const ajeno = await crearCatalogoDePrueba(otro, 'Ropa', 'Blusas', 't-shirt');
    await crearProducto(otro, ajeno, 'Blusa ajena secreta', 1, [8, 6, 5]);
    await crearProducto(agente, blusas, 'Blusa propia', 1, [8, 6, 5]);
    for (const formato of ['csv', 'xlsx', 'pdf']) {
      const res = await exportar(formato);
      const bytes = binario(res);
      const todo = formato === 'xlsx' ? textosXlsx(bytes).todo : bytes.toString('latin1');
      expect(todo, formato).not.toContain('Blusa ajena secreta');
      expect(todo, formato).not.toContain('otro@ejemplo.com');
      expect(todo, formato).not.toContain(CORREO);
      expect(todo, formato).not.toContain('Prueba');
      expect(todo, formato).not.toMatch(/usuario|usuarioId|"id"/i);
    }
    const csv = binario(await exportar('csv')).toString('utf8');
    expect(csv).toContain('Blusa propia');
    const ajenoFiltrado = await exportar('csv', `&categoriaId=${ajeno.categoria.id}`);
    expect(
      leerCsv(binario(ajenoFiltrado))
        .slice(6)
        .filter((f) => f[0]),
    ).toEqual([]);
  });

  it('EX12: sin sesión responde 401 en los tres formatos', async () => {
    for (const formato of ['csv', 'xlsx', 'pdf']) {
      const res = await request(app).get(`/api/v1/prediccion/exportar?formato=${formato}`);
      expect(res.status).toBe(401);
    }
  });

  it('EX13: rechaza formatos y parámetros inválidos con 422 (zod estricto)', async () => {
    const invalidas = [
      '',
      '?formato=docx',
      '?formato=',
      '?formato=csv&formato=pdf',
      '?formato=csv&usuarioId=1',
      '?formato=csv&estado=azul',
      '?formato=csv&categoriaId=abc',
      '?formato=csv&categoriaId=-1',
      `?formato=csv&q=${'a'.repeat(151)}`,
      '?formato=CSV',
    ];
    for (const consulta of invalidas) {
      const res = await agente.get(`/api/v1/prediccion/exportar${consulta}`);
      expect(res.status, consulta).toBe(422);
    }
  });

  it('EX14: con una lista vacía los tres formatos se generan igual, solo con el encabezado', async () => {
    const csv = leerCsv(binario(await exportar('csv')));
    expect(csv[3]).toEqual(['Productos', '0']);
    expect(csv).toHaveLength(6);
    expect(
      binario(await exportar('xlsx'))
        .subarray(0, 2)
        .toString('latin1'),
    ).toBe('PK');
    expect(
      binario(await exportar('pdf'))
        .subarray(0, 4)
        .toString('latin1'),
    ).toBe('%PDF');
  });

  it('EX15: generarCsv usa saltos CRLF y termina en salto de línea', () => {
    const tabla = {
      semanaInicio: '2026-10-12',
      semanaFin: '2026-10-18',
      semanaTexto: '12 de octubre de 2026 al 18 de octubre de 2026',
      filas: [],
    };
    const texto = generarCsv(tabla).toString('utf8');
    expect(texto.endsWith('\r\n')).toBe(true);
    expect(texto.split('\r\n').length).toBeGreaterThan(5);
  });
});
