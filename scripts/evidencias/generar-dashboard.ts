import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ESTADO_ADR, IDS_SEGURIDAD, MODULOS, RF, RNF, moduloDe, type Modulo } from './catalogo.ts';
import { DATOS, RAIZ } from './servidores.ts';

const VERSION = 'v1.0-beta';
const SALIDA = join(RAIZ, 'docs', 'evidencias', 'dashboard-beta.html');

const C = {
  bg: '#fff8f5',
  surface: '#f5ede8',
  text: '#6b4653',
  muted: '#736560',
  divider: '#eadcd5',
  strong: '#8f7b74',
  accent: '#e8927c',
  accentText: '#a3543e',
  accentTint: '#fbe6df',
  okText: '#4e6e56',
  okIcon: '#5a7d63',
  okBg: '#eaf1eb',
  warnText: '#8a6316',
  warnBg: '#fbefd6',
  dangerText: '#b33f31',
  dangerBg: '#fbdeda',
  hero: '#6b4653',
  onHero: '#fff8f5',
  serie1: '#a3543e',
  serie2: '#2f78b5',
};

const leer = <T>(archivo: string): T => JSON.parse(readFileSync(join(DATOS, archivo), 'utf8')) as T;

interface Aserto {
  fullName: string;
  status: string;
}
interface ReporteVitest {
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  testResults: { name: string; assertionResults: Aserto[] }[];
  startTime?: number;
}
interface ResumenCobertura {
  [archivo: string]: Record<
    'lines' | 'statements' | 'functions' | 'branches',
    { total: number; covered: number; pct: number }
  >;
}
interface Pantalla {
  nombre: string;
  ruta: string;
  accesibilidad: number;
  buenasPracticas: number;
  fallosLighthouse: string[];
  axeViolaciones: number;
  axePorRevisar: number;
  axeReglasQuePasaron: number;
}
interface Accesibilidad {
  generado: string;
  versiones: { lighthouse: string; axe: string; chrome: string };
  pantallas: Pantalla[];
}
interface Medicion {
  productosEnLaRespuesta: number;
  solicitudes: number;
  medianaMs: number;
  p95Ms: number;
  p99Ms: number;
  maximoMs: number;
  bytesRespuesta: number;
}
interface Rendimiento {
  entorno: { nota: string; node: string; solicitudesPorMedicion: number };
  demo: Medicion;
  con200Productos: Medicion & { ventasSembradas: number };
}
interface PesoJs {
  inicial: { jsBytes: number; jsGzipBytes: number; jsBrotliBytes: number };
  metaInternaGzipBytes: number;
  cargadosBajoDemanda: { archivo: string; bytes: number; gzipBytes: number }[];
}
interface FilaRetro {
  producto: string;
  semana: string;
  real: number;
  ptsSugerido: number;
  ojoSugerido: number;
  historial: [number, number, number];
}
interface MetricasRetro {
  semanasEvaluadas: number;
  semanasCubiertas: number;
  porcentajeCubierto: number;
  unidadesFaltantes: number;
  unidadesSobrantes: number;
  unidadesCompradas: number;
  unidadesVendidas: number;
}
interface Retro {
  origen: string;
  esDemostracion: boolean;
  archivo: string | null;
  productos: number;
  excluidos: string[];
  supuestos: string[];
  pts: MetricasRetro;
  ojo: MetricasRetro;
  filas: FilaRetro[];
}

const esc = (s: string | number) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const num = (n: number, d = 0) =>
  n.toLocaleString('es-GT', { minimumFractionDigits: d, maximumFractionDigits: d });
const kb = (b: number) => `${num(b / 1024, 1)} KB`;
const rel = (r: string) => r.replace(/^.*StockPredict[\\/]/, '').replace(/\\/g, '/');

const servidor = leer<ReporteVitest>('tests-servidor.json');
const interfaz = leer<ReporteVitest>('tests-ui.json');
const covServidor = leer<ResumenCobertura>('cobertura-servidor/coverage-summary.json');
const covUi = leer<ResumenCobertura>('cobertura-ui/coverage-summary.json');
const acc = leer<Accesibilidad>('accesibilidad.json');
const rend = leer<Rendimiento>('rendimiento.json');
const peso = leer<PesoJs>('peso-js.json');
const audit = leer<{
  metadata?: {
    vulnerabilities: Record<string, number>;
    dependencies: { total: number; prod: number; dev: number };
  };
}>('npm-audit.json');
const retro = leer<Retro>('retrospectiva.json');

interface Prueba {
  id: string;
  nombre: string;
  archivo: string;
  origen: 'servidor' | 'interfaz';
  paso: boolean;
  modulo: Modulo;
  ids: string[];
}
const pruebas: Prueba[] = [];
for (const [origen, rep] of [
  ['servidor', servidor],
  ['interfaz', interfaz],
] as const) {
  for (const t of rep.testResults) {
    const archivo = rel(t.name);
    for (const a of t.assertionResults) {
      pruebas.push({
        id: `${archivo}::${a.fullName}`,
        nombre: a.fullName,
        archivo,
        origen,
        paso: a.status === 'passed',
        modulo: moduloDe(archivo, a.fullName),
        ids:
          a.fullName.match(
            /\b(?:AU|SC|CO|SM|SH|EX|PR|PD|CP|BU|VS|DB|AV|RNF|RF|[ACPV])\d{2,3}\b/g,
          ) ?? [],
      });
    }
  }
}
const total = pruebas.length;
const pasan = pruebas.filter((p) => p.paso).length;

const porModulo = MODULOS.map((m) => {
  const ps = pruebas.filter((p) => p.modulo === m);
  return {
    modulo: m,
    servidor: ps.filter((p) => p.origen === 'servidor').length,
    interfaz: ps.filter((p) => p.origen === 'interfaz').length,
    fallan: ps.filter((p) => !p.paso).length,
  };
});

const idsConPrueba = new Map<string, { total: number; pasan: number }>();
for (const p of pruebas) {
  for (const id of new Set(p.ids)) {
    const e = idsConPrueba.get(id) ?? { total: 0, pasan: 0 };
    e.total += 1;
    if (p.paso) e.pasan += 1;
    idsConPrueba.set(id, e);
  }
}

const seguridad = Object.entries(IDS_SEGURIDAD).map(([nombre, ids]) => {
  const ps = pruebas.filter((p) => p.ids.some((i) => ids.includes(i)));
  return { nombre, total: ps.length, pasan: ps.filter((p) => p.paso).length };
});

function idsRequisito(r: { ids?: string[]; archivos?: string[]; patron?: string }) {
  const ps = pruebas.filter(
    (p) =>
      (r.ids ?? []).some((i) => p.ids.includes(i)) ||
      (r.archivos ?? []).some((a) => p.archivo.endsWith(a)) ||
      (r.patron ? new RegExp(r.patron).test(p.nombre) : false),
  );
  return { total: ps.length, pasan: ps.filter((p) => p.paso).length };
}

const dadRuta = join(RAIZ, 'docs', 'DAD.md');
const dad = existsSync(dadRuta) ? readFileSync(dadRuta, 'utf8') : '';
const tituloReq = (id: string) => {
  const m = new RegExp(`^- ${id}: (.+)$`, 'm').exec(dad);
  if (!m) return '';
  const t = m[1]!.replace(/^El sistema debe /, '').replace(/^La interfaz debe /, '');
  return t.length > 105 ? `${t.slice(0, 102)}…` : t;
};

const reqRf = Object.entries(RF).map(([id, r]) => ({
  id,
  ...idsRequisito(r),
  titulo: tituloReq(id),
}));
const rfConPrueba = reqRf.filter((r) => r.total > 0 && r.pasan === r.total).length;
const rfSinPrueba = reqRf.length - rfConPrueba;
const reqRnf = Object.entries(RNF).map(([id, r]) => ({
  id,
  ...r,
  ...idsRequisito(r),
  titulo: tituloReq(id),
}));

const adrNombres = new Map<number, string>();
const adrIndice = join(RAIZ, 'docs', 'adr', 'README.md');
if (existsSync(adrIndice)) {
  for (const l of readFileSync(adrIndice, 'utf8').split('\n')) {
    const m = /^\| \[(\d{4})\]\([^)]*\) \| ([^|]+) \|/.exec(l);
    if (m) adrNombres.set(Number(m[1]), m[2]!.trim());
  }
}
const adrs = Object.entries(ESTADO_ADR).map(([n, v]) => ({
  n: Number(n),
  ...v,
  titulo: adrNombres.get(Number(n)) ?? v.nota,
}));
const cuentaAdr = {
  implementado: adrs.filter((a) => a.estado === 'implementado').length,
  parcial: adrs.filter((a) => a.estado === 'parcial').length,
  diferido: adrs.filter((a) => a.estado === 'diferido').length,
};

const minAcc = Math.min(...acc.pantallas.map((p) => p.accesibilidad));
const minBp = Math.min(...acc.pantallas.map((p) => p.buenasPracticas));
const axeTotal = acc.pantallas.reduce((a, p) => a + p.axeViolaciones, 0);
const vulns = audit.metadata?.vulnerabilities;
const vulnsTotal = vulns ? Object.values(vulns).reduce((a, b) => a + b, 0) : null;
const fecha = new Date();
const fechaTexto = new Intl.DateTimeFormat('es-GT', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'America/Guatemala',
}).format(fecha);

const kpi = (
  valor: string,
  etiqueta: string,
  detalle: string,
  tono: 'ok' | 'neutro' | 'aviso' = 'neutro',
) =>
  `<div class="kpi kpi-${tono}"><div class="kpi-valor">${valor}</div><div class="kpi-etiqueta">${esc(etiqueta)}</div><div class="kpi-detalle">${detalle}</div></div>`;

function barrasH(
  filas: {
    etiqueta: string;
    valores: { v: number; color: string; nombre: string }[];
    texto: string;
  }[],
  maximo: number,
  opciones: { anchoEtiqueta?: number; ancho?: number; marca?: { v: number; texto: string } } = {},
): string {
  const aE = opciones.anchoEtiqueta ?? 250;
  const ancho = opciones.ancho ?? 1000;
  const aT = 130;
  const area = ancho - aE - aT;
  const alto = 34;
  const h = filas.length * alto + (opciones.marca ? 30 : 6);
  let svg = `<svg viewBox="0 0 ${ancho} ${h}" width="100%" role="img" aria-label="Gráfica de barras horizontales" class="grafica">`;
  filas.forEach((f, i) => {
    const y = i * alto + 4;
    svg += `<text x="${aE - 12}" y="${y + 19}" text-anchor="end" class="eje">${esc(f.etiqueta)}</text>`;
    let x = aE;
    f.valores.forEach((val) => {
      const w = maximo === 0 ? 0 : Math.max(val.v > 0 ? 3 : 0, (val.v / maximo) * area);
      if (w > 0) {
        svg += `<rect x="${x}" y="${y + 3}" width="${Math.max(w - 2, 1)}" height="22" rx="4" fill="${val.color}"><title>${esc(f.etiqueta)} · ${esc(val.nombre)}: ${num(val.v)}</title></rect>`;
      }
      x += w;
    });
    svg += `<text x="${x + 10}" y="${y + 19}" class="valor">${esc(f.texto)}</text>`;
  });
  if (opciones.marca) {
    const x = aE + (opciones.marca.v / maximo) * area;
    svg += `<line x1="${x}" x2="${x}" y1="0" y2="${filas.length * alto + 2}" stroke="${C.dangerText}" stroke-width="2" stroke-dasharray="5 4"/><text x="${x}" y="${filas.length * alto + 22}" text-anchor="middle" class="eje" fill="${C.dangerText}">${esc(opciones.marca.texto)}</text>`;
  }
  return `${svg}</svg>`;
}

const leyenda = (items: { color: string; texto: string }[]) =>
  `<ul class="leyenda">${items.map((i) => `<li><span class="muestra" style="background:${i.color}"></span>${esc(i.texto)}</li>`).join('')}</ul>`;

function tabla(cabeza: string[], filas: string[][], clase = ''): string {
  return `<div class="tabla-envoltura"><table class="${clase}"><thead><tr>${cabeza.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${filas.map((f) => `<tr>${f.join('')}</tr>`).join('')}</tbody></table></div>`;
}
const td = (x: string | number, c = '') =>
  `<td${c ? ` class="${c}"` : ''}>${typeof x === 'number' ? num(x) : x}</td>`;
const etiqueta = (texto: string, tono: 'ok' | 'aviso' | 'malo' | 'neutro') =>
  `<span class="tag tag-${tono}">${esc(texto)}</span>`;

function seccion(id: string, titulo: string, intro: string, cuerpo: string): string {
  return `<section id="${id}"><h2>${esc(titulo)}</h2><p class="intro">${intro}</p>${cuerpo}</section>`;
}

const bloque = (titulo: string, cuerpo: string, pie = '') =>
  `<figure class="bloque"><figcaption>${titulo}</figcaption>${cuerpo}${pie ? `<p class="pie">${pie}</p>` : ''}</figure>`;

const modConPruebas = porModulo.filter((m) => m.servidor + m.interfaz > 0);
const mayorModulo = [...modConPruebas].sort(
  (a, b) => b.servidor + b.interfaz - (a.servidor + a.interfaz),
)[0]!;
const resumenKpis = [
  kpi(
    `${pasan}/${total}`,
    'pruebas automáticas que pasan',
    `${num(servidor.numPassedTests)} del servidor y ${num(interfaz.numPassedTests)} de la interfaz`,
    pasan === total ? 'ok' : 'aviso',
  ),
  kpi(
    `${num(covServidor['total']!.lines.pct, 1)} %`,
    'cobertura del servidor',
    `líneas; la interfaz cubre ${num(covUi['total']!.lines.pct, 1)} %`,
    'neutro',
  ),
  kpi(
    `${minAcc}`,
    'accesibilidad mínima (Lighthouse)',
    `en ${acc.pantallas.length} pantallas a 390×844; axe: ${axeTotal} violaciones`,
    minAcc === 100 && axeTotal === 0 ? 'ok' : 'aviso',
  ),
  kpi(
    `${num(rend.demo.p95Ms)} ms`,
    'GET /prediccion, p95 con la demo',
    `con 200 productos: ${num(rend.con200Productos.p95Ms)} ms; la meta es 2 000 ms`,
    'ok',
  ),
  kpi(
    `${num(peso.inicial.jsGzipBytes / 1024)} KB`,
    'JavaScript inicial comprimido',
    `${num(peso.inicial.jsBytes / 1024)} KB sin comprimir; la meta interna es 150 KB`,
    peso.inicial.jsGzipBytes > peso.metaInternaGzipBytes ? 'aviso' : 'ok',
  ),
  kpi(
    `${vulnsTotal ?? 'sin dato'}`,
    'vulnerabilidades en npm audit',
    `${audit.metadata ? num(audit.metadata.dependencies.total) : '?'} dependencias revisadas`,
    vulnsTotal === 0 ? 'ok' : 'aviso',
  ),
  kpi(
    `${reqRf.length}/${reqRf.length}`,
    'requerimientos funcionales construidos',
    `${rfConPrueba} con prueba automática que pasa`,
    'ok',
  ),
  kpi(
    `${retro.pts.semanasCubiertas}/${retro.pts.semanasEvaluadas}`,
    'semanas cubiertas con PTS (demo)',
    `a ojo: ${retro.ojo.semanasCubiertas}/${retro.ojo.semanasEvaluadas}. Datos de demostración`,
    'neutro',
  ),
].join('');

const sPruebas = seccion(
  'pruebas',
  'Pruebas por módulo',
  `${pruebas.filter((p) => p.ids.length > 0).length} de las ${total} pruebas llevan en su nombre el ID de un caso del DAD (las demás verifican configuración, utilidades y comportamientos sin un caso propio en el DAD). Se ejecutaron hoy contra una base de datos de pruebas aparte de la de trabajo.`,
  bloque(
    `${pasan === total ? 'Todas las pruebas pasan' : `Pasan ${pasan} de ${total}`}: ${total} en total, y ${esc(mayorModulo.modulo)} es el módulo con más (${mayorModulo.servidor + mayorModulo.interfaz})`,
    `${barrasH(
      modConPruebas.map((m) => ({
        etiqueta: m.modulo,
        valores: [
          { v: m.servidor, color: C.serie1, nombre: 'servidor' },
          { v: m.interfaz, color: C.serie2, nombre: 'interfaz' },
        ],
        texto: `${m.servidor + m.interfaz}${m.fallan ? ` (${m.fallan} fallan)` : ' pasan'}`,
      })),
      Math.max(...modConPruebas.map((m) => m.servidor + m.interfaz)),
    )}${leyenda([
      { color: C.serie1, texto: `Servidor (${servidor.numTotalTests})` },
      { color: C.serie2, texto: `Interfaz (${interfaz.numTotalTests})` },
    ])}`,
    'Un módulo sin pruebas de interfaz solo tiene pruebas de la API. Algunas pruebas de seguridad se cuentan también aquí, en su módulo.',
  ) +
    `<details><summary>Ver la tabla de números</summary>${tabla(
      ['Módulo', 'Servidor', 'Interfaz', 'Total', 'Fallan'],
      modConPruebas.map((m) => [
        td(esc(m.modulo)),
        td(m.servidor),
        td(m.interfaz),
        td(m.servidor + m.interfaz),
        td(m.fallan),
      ]),
    )}</details>`,
);

const grupos = (['lines', 'statements', 'functions', 'branches'] as const).map((k) => ({
  k,
  nombre: {
    lines: 'Líneas',
    statements: 'Sentencias',
    functions: 'Funciones',
    branches: 'Ramas (if y otros caminos)',
  }[k],
}));
const debiles = Object.entries(covServidor)
  .filter(([k]) => k !== 'total')
  .map(([k, v]) => ({ archivo: rel(k), pct: v.lines.pct, lineas: v.lines.total }))
  .filter((x) => x.lineas >= 10)
  .sort((a, b) => a.pct - b.pct)
  .slice(0, 6);
const debilesUi = Object.entries(covUi)
  .filter(([k]) => k !== 'total')
  .map(([k, v]) => ({ archivo: rel(k), pct: v.lines.pct, lineas: v.lines.total }))
  .filter((x) => x.lineas >= 20)
  .sort((a, b) => a.pct - b.pct)
  .slice(0, 6);
const sCobertura = seccion(
  'cobertura',
  'Cobertura de código',
  'La cobertura dice qué parte del código se ejecutó al correr las pruebas. No prueba que el código esté bien, pero un número bajo muestra dónde no se ha mirado.',
  bloque(
    `El servidor se ejercita casi todo (${num(covServidor['total']!.lines.pct, 1)} % de las líneas); la interfaz, un poco más de dos tercios (${num(covUi['total']!.lines.pct, 1)} %)`,
    `${barrasH(
      grupos.flatMap((g) => [
        {
          etiqueta: `${g.nombre} · servidor`,
          valores: [{ v: covServidor['total']![g.k].pct, color: C.serie1, nombre: 'servidor' }],
          texto: `${num(covServidor['total']![g.k].pct, 1)} %`,
        },
        {
          etiqueta: `${g.nombre} · interfaz`,
          valores: [{ v: covUi['total']![g.k].pct, color: C.serie2, nombre: 'interfaz' }],
          texto: `${num(covUi['total']![g.k].pct, 1)} %`,
        },
      ]),
      100,
      { anchoEtiqueta: 300 },
    )}${leyenda([
      { color: C.serie1, texto: 'Servidor' },
      { color: C.serie2, texto: 'Interfaz' },
    ])}`,
    'Medida con V8 (Vitest). El servidor incluye todo backend/src; la interfaz, todo frontend/src, sin los archivos de prueba.',
  ) +
    `<div class="dos-col"><div><h3>Archivos del servidor con menos líneas cubiertas</h3>${tabla(
      ['Archivo', 'Líneas'],
      debiles.map((d) => [td(esc(d.archivo)), td(`${num(d.pct, 1)} %`)]),
    )}</div><div><h3>Archivos de la interfaz con menos líneas cubiertas</h3>${tabla(
      ['Archivo', 'Líneas'],
      debilesUi.map((d) => [td(esc(d.archivo)), td(`${num(d.pct, 1)} %`)]),
    )}</div></div>`,
);

const celda = (v: number) => td(`${v}`, v === 100 ? 'c-ok' : 'c-aviso');
const sAcc = seccion(
  'accesibilidad',
  'Accesibilidad por pantalla',
  `Medida en un celular simulado de 390×844 con Lighthouse ${esc(acc.versiones.lighthouse)} y axe-core ${esc(acc.versiones.axe)} (${esc(acc.versiones.chrome)}), con los datos de la demo.`,
  bloque(
    `${minAcc === 100 ? 'Las' : 'Casi todas las'} ${acc.pantallas.length} pantallas sacan ${minAcc === 100 ? '100' : `al menos ${minAcc}`} en accesibilidad y axe encontró ${axeTotal} violaciones`,
    tabla(
      ['Pantalla', 'Accesibilidad', 'Buenas prácticas', 'Violaciones de axe', 'Por revisar (axe)'],
      acc.pantallas.map((p) => [
        td(`${esc(p.nombre)} <span class="ruta">${esc(p.ruta)}</span>`),
        celda(p.accesibilidad),
        celda(p.buenasPracticas),
        td(p.axeViolaciones, p.axeViolaciones === 0 ? 'c-ok' : 'c-malo'),
        td(p.axePorRevisar),
      ]),
      'tabla-pantallas',
    ),
    `Buenas prácticas llega a ${minBp} en: ${esc(
      acc.pantallas
        .filter((p) => p.buenasPracticas < 100)
        .map((p) => `${p.nombre} (${p.fallosLighthouse.join(', ') || 'sin detalle'})`)
        .join('; ') || 'ninguna pantalla',
    )}. "Por revisar" son casos que axe no puede decidir solo, casi siempre de contraste dentro de un SVG o un diálogo.`,
  ),
);

const sRend = seccion(
  'rendimiento',
  'Rendimiento',
  'Tiempo de respuesta de la API de predicción y peso de la aplicación. El requerimiento RNF02 pide que cada pantalla cargue en menos de 2 segundos.',
  `<div class="dos-col">${bloque(
    `La predicción responde en ${num(rend.demo.medianaMs)} ms con la demo y en ${num(rend.con200Productos.medianaMs)} ms con 200 productos, muy por debajo de los 2 000 ms`,
    barrasH(
      [
        {
          etiqueta: 'Demo (14 productos) · mediana',
          valores: [{ v: rend.demo.medianaMs, color: C.serie1, nombre: 'mediana' }],
          texto: `${num(rend.demo.medianaMs, 1)} ms`,
        },
        {
          etiqueta: 'Demo (14 productos) · p95',
          valores: [{ v: rend.demo.p95Ms, color: C.serie1, nombre: 'p95' }],
          texto: `${num(rend.demo.p95Ms, 1)} ms`,
        },
        {
          etiqueta: '200 productos · mediana',
          valores: [{ v: rend.con200Productos.medianaMs, color: C.serie2, nombre: 'mediana' }],
          texto: `${num(rend.con200Productos.medianaMs, 1)} ms`,
        },
        {
          etiqueta: '200 productos · p95',
          valores: [{ v: rend.con200Productos.p95Ms, color: C.serie2, nombre: 'p95' }],
          texto: `${num(rend.con200Productos.p95Ms, 1)} ms`,
        },
      ],
      2000,
      { ancho: 540, anchoEtiqueta: 215, marca: { v: 2000, texto: 'meta: 2 000 ms' } },
    ),
    `${rend.demo.solicitudes} solicitudes por medición. p95 = el 95 % de las respuestas fue igual o más rápido. Máximo: ${num(rend.demo.maximoMs, 1)} ms con la demo y ${num(rend.con200Productos.maximoMs, 1)} ms con 200 productos.`,
  )}${bloque(
    `El JavaScript que baja al abrir la app pesa ${num(peso.inicial.jsGzipBytes / 1024)} KB comprimido: ${peso.inicial.jsGzipBytes > peso.metaInternaGzipBytes ? 'pasa de la meta interna de 150 KB' : 'dentro de la meta interna'}`,
    barrasH(
      [
        {
          etiqueta: 'Sin comprimir',
          valores: [{ v: peso.inicial.jsBytes / 1024, color: C.strong, nombre: 'sin comprimir' }],
          texto: kb(peso.inicial.jsBytes),
        },
        {
          etiqueta: 'gzip',
          valores: [{ v: peso.inicial.jsGzipBytes / 1024, color: C.serie1, nombre: 'gzip' }],
          texto: kb(peso.inicial.jsGzipBytes),
        },
        {
          etiqueta: 'brotli',
          valores: [{ v: peso.inicial.jsBrotliBytes / 1024, color: C.serie2, nombre: 'brotli' }],
          texto: kb(peso.inicial.jsBrotliBytes),
        },
      ],
      Math.ceil(peso.inicial.jsBytes / 1024 / 100) * 100,
      {
        ancho: 540,
        anchoEtiqueta: 150,
        marca: { v: peso.metaInternaGzipBytes / 1024, texto: 'meta gzip: 150 KB' },
      },
    ),
    `Las pantallas de detalle, las gráficas y la hoja de exportar se descargan aparte, solo cuando se usan (${peso.cargadosBajoDemanda.length} archivos, ${kb(peso.cargadosBajoDemanda.reduce((a, x) => a + x.gzipBytes, 0))} comprimidos en total).`,
  )}</div>
  <p class="nota">Medido en el equipo de desarrollo, con el servidor compilado y la base de datos local. Es el tiempo de la API; no incluye red móvil ni el sistema publicado.</p>`,
);

const sSeg = seccion(
  'seguridad',
  'Seguridad',
  'Lo que se pudo medir hoy: vulnerabilidades de dependencias y pruebas automáticas de seguridad. No es una auditoría ni un pentest.',
  `<div class="dos-col">${bloque(
    `npm audit encontró ${vulnsTotal ?? 'sin dato'} vulnerabilidades en ${audit.metadata ? num(audit.metadata.dependencies.total) : '?'} dependencias`,
    `<div class="kpi-fila">${kpi(`${vulns?.critical ?? '?'}`, 'críticas', '', vulnsTotal === 0 ? 'ok' : 'aviso')}${kpi(`${vulns?.high ?? '?'}`, 'altas', '', vulnsTotal === 0 ? 'ok' : 'aviso')}${kpi(`${vulns?.moderate ?? '?'}`, 'moderadas', '', 'ok')}${kpi(`${vulns?.low ?? '?'}`, 'bajas', '', 'ok')}</div>`,
    'En esta etapa se subió Prisma de 7.10.0 a 7.10.1, que cerró 4 vulnerabilidades altas de la herramienta de línea de comandos.',
  )}${bloque(
    `${num(seguridad.reduce((a, s) => a + s.total, 0))} pruebas de seguridad, todas ${seguridad.every((s) => s.pasan === s.total) ? 'pasan' : 'revisar: hay fallas'}`,
    barrasH(
      seguridad.map((s) => ({
        etiqueta: s.nombre.split(' (')[0]!,
        valores: [{ v: s.total, color: C.serie1, nombre: 'pruebas' }],
        texto: `${s.pasan}/${s.total}`,
      })),
      Math.max(...seguridad.map((s) => s.total)),
      { ancho: 540, anchoEtiqueta: 275 },
    ),
    'Se cuentan las pruebas de los casos del DAD sobre aislamiento, sesión, validación y archivos. Cada una se cuenta también en su módulo.',
  )}</div>
  <div class="aviso-caja"><strong>Todavía no se ha hecho:</strong> auditoría de eventos, revisión ASVS y pruebas de ataque, análisis automático en cada cambio, HTTPS y protección del servidor, y copias de seguridad. Están registradas como diferidas (ADR 0009 a 0018).</div>`,
);

const rfRows = reqRf.map((r) => [
  td(r.id),
  td(esc(r.titulo)),
  td(
    r.total === 0
      ? etiqueta('sin prueba', 'aviso')
      : r.pasan === r.total
        ? etiqueta(`${r.pasan} pasan`, 'ok')
        : etiqueta(`${r.total - r.pasan} fallan`, 'malo'),
  ),
]);
const rnfRows = reqRnf.map((r) => [
  td(r.id),
  td(esc(r.nota)),
  td(
    r.estado === 'pendiente'
      ? etiqueta('pendiente', 'aviso')
      : r.estado === 'medido'
        ? etiqueta('medido', 'neutro')
        : etiqueta('cumplido', 'ok'),
  ),
  td(r.total > 0 ? `${r.pasan}/${r.total}` : '—'),
]);
const adrFila = (estado: 'implementado' | 'parcial' | 'diferido') =>
  adrs
    .filter((a) => a.estado === estado)
    .map((a) => `<li><strong>${String(a.n).padStart(4, '0')}</strong> ${esc(a.nota)}</li>`)
    .join('');
const rnfPend = reqRnf.filter((r) => r.estado === 'pendiente').length;
const sReq = seccion(
  'requisitos',
  'Requerimientos y decisiones (ADR)',
  'Estado de los requerimientos del DAD 1.2 y de las decisiones de arquitectura. "Con prueba" significa que hay al menos una prueba automática enlazada al requerimiento y que todas pasan.',
  `<div class="dos-col">${bloque(
    `Los ${reqRf.length} requerimientos funcionales están construidos; ${rfConPrueba} tienen prueba automática que pasa${rfSinPrueba ? ` y ${rfSinPrueba} no` : ''}`,
    barrasH(
      [
        {
          etiqueta: 'Funcionales (RF)',
          valores: [
            { v: rfConPrueba, color: C.serie1, nombre: 'construidos con prueba' },
            { v: rfSinPrueba, color: C.warnText, nombre: 'construidos sin prueba enlazada' },
          ],
          texto: `${rfConPrueba} con prueba`,
        },
        {
          etiqueta: 'No funcionales (RNF)',
          valores: [
            { v: reqRnf.length - rnfPend, color: C.serie2, nombre: 'cumplidos o medidos' },
            { v: rnfPend, color: C.warnText, nombre: 'pendientes' },
          ],
          texto: `${reqRnf.length - rnfPend} de ${reqRnf.length}`,
        },
      ],
      Math.max(reqRf.length, reqRnf.length),
      { ancho: 540, anchoEtiqueta: 175 },
    ) +
      leyenda([
        { color: C.serie1, texto: 'RF con prueba' },
        { color: C.serie2, texto: 'RNF cumplidos o medidos' },
        { color: C.warnText, texto: 'Sin prueba enlazada / pendientes' },
      ]),
    `Diferidos: no hay RF diferidos; lo diferido son las mejoras a futuro (ADR 0032 a 0039) y varios requerimientos de seguridad. RNF pendientes: ${esc(
      reqRnf
        .filter((r) => r.estado === 'pendiente')
        .map((r) => r.id)
        .join(', '),
    )} (necesitan publicar el sistema o probar con la usuaria).`,
  )}${bloque(
    `De ${adrs.length} decisiones, ${cuentaAdr.implementado} están implementadas, ${cuentaAdr.parcial} a medias y ${cuentaAdr.diferido} diferidas`,
    barrasH(
      [
        {
          etiqueta: 'Implementadas',
          valores: [{ v: cuentaAdr.implementado, color: C.okIcon, nombre: 'implementadas' }],
          texto: `${cuentaAdr.implementado}`,
        },
        {
          etiqueta: 'Parciales',
          valores: [{ v: cuentaAdr.parcial, color: C.warnText, nombre: 'parciales' }],
          texto: `${cuentaAdr.parcial}`,
        },
        {
          etiqueta: 'Diferidas',
          valores: [{ v: cuentaAdr.diferido, color: C.strong, nombre: 'diferidas' }],
          texto: `${cuentaAdr.diferido}`,
        },
      ],
      Math.max(cuentaAdr.implementado, cuentaAdr.parcial, cuentaAdr.diferido),
      { ancho: 540, anchoEtiqueta: 170 },
    ),
    'Las diferidas son sobre todo seguridad de despliegue (0009 a 0018, 0024) y las ocho mejoras a futuro (0032 a 0039); casi todas necesitan precios, fotos o HTTPS, que aún no existen.',
  )}</div>
  <details><summary>Ver los ${reqRf.length} requerimientos funcionales</summary>${tabla(['RF', 'Qué pide', 'Prueba'], rfRows)}</details>
  <details><summary>Ver los ${reqRnf.length} requerimientos no funcionales</summary>${tabla(['RNF', 'Estado y evidencia', 'Estado', 'Pruebas'], rnfRows)}</details>
  <details><summary>Ver las decisiones (ADR) por estado</summary><div class="tres-col"><div><h3>Implementadas</h3><ul class="lista-adr">${adrFila('implementado')}</ul></div><div><h3>Parciales</h3><ul class="lista-adr">${adrFila('parcial')}</ul></div><div><h3>Diferidas</h3><ul class="lista-adr">${adrFila('diferido')}</ul></div></div></details>`,
);

const peorPts = retro.filas.filter((f) => f.ptsSugerido < f.real && f.ojoSugerido >= f.real);
const sobraMas = retro.filas.filter(
  (f) => Math.max(f.ptsSugerido - f.real, 0) > Math.max(f.ojoSugerido - f.real, 0),
);
const cortoPts = retro.filas.filter((f) => f.ptsSugerido < f.real);
const sRetro = seccion(
  'pts',
  'Prueba retrospectiva de la fórmula PTS',
  `Se rehizo el pasado: para cada producto y semana con 3 semanas previas se calculó cuánto habría sugerido PTS (la función real del sistema) y se comparó con lo que realmente se vendió. Se compara contra "a ojo": repetir lo vendido la semana anterior.`,
  `<div class="alerta-demo"><strong>${retro.esDemostracion ? 'DATOS DE DEMOSTRACIÓN.' : 'DATOS REALES.'}</strong> ${
    retro.esDemostracion
      ? `Las ventas de la demo las inventó el desarrollador para probar el sistema; no son ventas reales de ninguna tienda. Hay ${retro.productos} productos con solo 4 semanas cerradas, así que cada producto aporta una sola semana evaluable (${retro.pts.semanasEvaluadas} en total). Es una muestra muy pequeña: sirve para ver cómo se comportan los dos métodos, no para demostrar que uno es mejor.`
      : `Archivo: ${esc(retro.archivo ?? '')}. ${retro.productos} productos y ${retro.pts.semanasEvaluadas} producto-semana evaluados.`
  }</div>
  <div class="dos-col">${bloque(
    `Con PTS le alcanzó el stock en ${retro.pts.semanasCubiertas} de ${retro.pts.semanasEvaluadas} semanas; a ojo, en ${retro.ojo.semanasCubiertas} de ${retro.ojo.semanasEvaluadas}`,
    barrasH(
      [
        {
          etiqueta: 'PTS',
          valores: [{ v: retro.pts.porcentajeCubierto, color: C.serie1, nombre: 'PTS' }],
          texto: `${num(retro.pts.porcentajeCubierto, 1)} %`,
        },
        {
          etiqueta: 'A ojo',
          valores: [{ v: retro.ojo.porcentajeCubierto, color: C.serie2, nombre: 'a ojo' }],
          texto: `${num(retro.ojo.porcentajeCubierto, 1)} %`,
        },
      ],
      100,
      { ancho: 540, anchoEtiqueta: 90 },
    ),
    'Una semana cuenta como cubierta si lo comprado fue mayor o igual a lo vendido.',
  )}${bloque(
    `PTS dejó sin cubrir ${retro.pts.unidadesFaltantes} unidades y a ojo ${retro.ojo.unidadesFaltantes}; pero PTS compró de más ${retro.pts.unidadesSobrantes} y a ojo ${retro.ojo.unidadesSobrantes}`,
    barrasH(
      [
        {
          etiqueta: 'Faltaron · PTS',
          valores: [{ v: retro.pts.unidadesFaltantes, color: C.serie1, nombre: 'PTS' }],
          texto: `${retro.pts.unidadesFaltantes} u.`,
        },
        {
          etiqueta: 'Faltaron · a ojo',
          valores: [{ v: retro.ojo.unidadesFaltantes, color: C.serie2, nombre: 'a ojo' }],
          texto: `${retro.ojo.unidadesFaltantes} u.`,
        },
        {
          etiqueta: 'Sobraron · PTS',
          valores: [{ v: retro.pts.unidadesSobrantes, color: C.serie1, nombre: 'PTS' }],
          texto: `${retro.pts.unidadesSobrantes} u.`,
        },
        {
          etiqueta: 'Sobraron · a ojo',
          valores: [{ v: retro.ojo.unidadesSobrantes, color: C.serie2, nombre: 'a ojo' }],
          texto: `${retro.ojo.unidadesSobrantes} u.`,
        },
      ],
      Math.max(
        retro.pts.unidadesFaltantes,
        retro.ojo.unidadesFaltantes,
        retro.pts.unidadesSobrantes,
        retro.ojo.unidadesSobrantes,
      ),
      { ancho: 540, anchoEtiqueta: 190 },
    ) +
      leyenda([
        { color: C.serie1, texto: 'PTS' },
        { color: C.serie2, texto: 'A ojo' },
      ]),
    `Se vendieron ${retro.pts.unidadesVendidas} unidades. PTS "compró" ${retro.pts.unidadesCompradas} y a ojo ${retro.ojo.unidadesCompradas}. PTS incluye una reserva extra de 20 % a propósito, por eso tiende a sobrar más.`,
  )}</div>
  ${bloque(
    'Lo que PTS no hizo mejor, tal cual salió',
    `<ul class="lista">
      <li>PTS compró más unidades que se vendieron (${retro.pts.unidadesCompradas} contra ${retro.pts.unidadesVendidas}); a ojo compró menos de lo vendido (${retro.ojo.unidadesCompradas}). Cubrir más semanas tuvo ese costo: ${retro.pts.unidadesSobrantes - retro.ojo.unidadesSobrantes > 0 ? `${retro.pts.unidadesSobrantes - retro.ojo.unidadesSobrantes} unidades más de sobrante` : 'no hubo más sobrante'}.</li>
      <li>${peorPts.length === 0 ? 'No hubo semanas en que a ojo cubriera y PTS no.' : `En ${peorPts.length} ${peorPts.length === 1 ? 'caso' : 'casos'} a ojo cubrió la venta y PTS no: ${esc(peorPts.map((f) => `${f.producto} (vendió ${f.real}, PTS sugirió ${f.ptsSugerido}, a ojo ${f.ojoSugerido})`).join('; '))}.`}</li>
      <li>${cortoPts.length === 0 ? 'PTS cubrió todas las semanas.' : `PTS se quedó corto en ${cortoPts.length} de ${retro.filas.length} productos: ${esc(cortoPts.map((f) => `${f.producto} (vendió ${f.real}, sugirió ${f.ptsSugerido})`).join('; '))}.`}</li>
      <li>${sobraMas.length === 0 ? '' : `PTS dejó más sobrante que a ojo en ${sobraMas.length} de ${retro.filas.length} productos.`}</li>
      <li>El método no tiene tope de tendencia (limitación conocida del DAD): cuando las ventas bajan de golpe o suben de golpe, sigue la tendencia de las semanas previas y puede fallar en cualquier dirección.</li>
    </ul>`,
  )}
  <details open><summary>Ver el detalle por producto (${retro.filas.length} semanas evaluadas)</summary>${tabla(
    [
      'Producto',
      'Semana (lunes)',
      'Semanas previas (V1, V2, V3)',
      'Vendió',
      'PTS sugirió',
      'A ojo',
      'PTS',
      'A ojo',
    ],
    retro.filas.map((f) => [
      td(esc(f.producto)),
      td(f.semana),
      td(f.historial.join(', ')),
      td(f.real),
      td(f.ptsSugerido),
      td(f.ojoSugerido),
      td(
        f.ptsSugerido >= f.real
          ? etiqueta(
              f.ptsSugerido === f.real ? 'justo' : `sobran ${f.ptsSugerido - f.real}`,
              'aviso',
            )
          : etiqueta(`faltan ${f.real - f.ptsSugerido}`, 'malo'),
      ),
      td(
        f.ojoSugerido >= f.real
          ? etiqueta(
              f.ojoSugerido === f.real ? 'justo' : `sobran ${f.ojoSugerido - f.real}`,
              'aviso',
            )
          : etiqueta(`faltan ${f.real - f.ojoSugerido}`, 'malo'),
      ),
    ]),
  )}</details>
  <details><summary>Supuestos y productos que no entraron</summary><ul class="lista">${retro.supuestos.map((s) => `<li>${esc(s)}</li>`).join('')}${retro.excluidos.map((s) => `<li>No entró: ${esc(s)}</li>`).join('')}</ul>
  <p class="nota">Para correrlo con datos reales: <code>npm run evidencias:retrospectiva -- --csv ruta/ventas.csv</code>, con las columnas <code>producto,semana,unidades</code> (semana = una fecha cualquiera de esa semana, AAAA-MM-DD).</p></details>`,
);

const css = `
:root{--bg:${C.bg};--surface:${C.surface};--text:${C.text};--muted:${C.muted};--divider:${C.divider};--strong:${C.strong};--accent:${C.accent};--accent-text:${C.accentText};--accent-tint:${C.accentTint};--ok-text:${C.okText};--ok-bg:${C.okBg};--warn-text:${C.warnText};--warn-bg:${C.warnBg};--danger-text:${C.dangerText};--danger-bg:${C.dangerBg};--hero:${C.hero};--on-hero:${C.onHero}}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:70px}
body{margin:0;background:var(--bg);color:var(--text);font-family:'Inter Variable',system-ui,-apple-system,'Segoe UI',sans-serif;font-size:17px;line-height:1.5}
header.hero{background:var(--hero);color:var(--on-hero);padding:28px 40px 30px}
.hero-fila{max-width:1280px;margin:0 auto;display:flex;justify-content:space-between;align-items:flex-end;gap:24px;flex-wrap:wrap}
.hero h1{margin:0;font-size:34px;font-weight:600;letter-spacing:-.01em}
.hero p{margin:6px 0 0;font-size:17px;opacity:.9}
.sello{background:var(--accent);color:#4f313b;font-weight:600;border-radius:999px;padding:6px 16px;font-size:15px;white-space:nowrap}
.meta{font-size:15px;opacity:.9;text-align:right}
nav{position:sticky;top:0;z-index:5;background:var(--surface);border-bottom:1px solid var(--divider)}
nav ul{max-width:1280px;margin:0 auto;padding:0 40px;list-style:none;display:flex;gap:4px;overflow-x:auto}
nav a{display:block;padding:14px 14px;color:var(--text);text-decoration:none;font-weight:500;font-size:15px;white-space:nowrap;border-bottom:3px solid transparent}
nav a:hover,nav a:focus-visible{border-bottom-color:var(--accent);outline:none}
main{max-width:1280px;margin:0 auto;padding:12px 40px 60px}
section{padding-top:36px}
h2{font-size:28px;font-weight:600;margin:0 0 6px}
h3{font-size:18px;font-weight:600;margin:18px 0 8px}
.intro{margin:0 0 18px;color:var(--muted);max-width:980px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:28px}
.kpi{background:#fff;border:1px solid var(--divider);border-radius:14px;padding:18px 20px;box-shadow:0 6px 16px rgba(107,70,83,.07)}
.kpi-valor{font-size:40px;font-weight:700;letter-spacing:-.02em;line-height:1.1;color:var(--text)}
.kpi-etiqueta{font-weight:600;margin-top:6px}
.kpi-detalle{color:var(--muted);font-size:14.5px;margin-top:4px}
.kpi-ok{border-left:6px solid var(--ok-text)}
.kpi-aviso{border-left:6px solid var(--warn-text)}
.kpi-neutro{border-left:6px solid var(--accent)}
.kpi-fila{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.kpi-fila .kpi-valor{font-size:34px}
.bloque{margin:0 0 20px;background:#fff;border:1px solid var(--divider);border-radius:14px;padding:18px 22px}
.bloque figcaption{font-size:19px;font-weight:600;margin-bottom:12px;line-height:1.35}
.pie,.nota{color:var(--muted);font-size:14.5px;margin:10px 0 0}
.dos-col{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start}
.tres-col{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.grafica{display:block;overflow:visible}
.grafica .eje{font-size:14.5px;fill:var(--muted)}
.grafica .valor{font-size:15px;font-weight:600;fill:var(--text)}
.leyenda{list-style:none;margin:10px 0 0;padding:0;display:flex;gap:20px;flex-wrap:wrap;font-size:14.5px}
.muestra{display:inline-block;width:14px;height:14px;border-radius:3px;margin-right:8px;vertical-align:-2px}
.tabla-envoltura{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:15px}
th{text-align:left;font-weight:600;background:var(--surface);padding:9px 12px;border-bottom:2px solid var(--divider);white-space:nowrap}
td{padding:8px 12px;border-bottom:1px solid var(--divider);vertical-align:top}
td.c-ok{background:var(--ok-bg);color:var(--ok-text);font-weight:600}
td.c-aviso{background:var(--warn-bg);color:var(--warn-text);font-weight:600}
td.c-malo{background:var(--danger-bg);color:var(--danger-text);font-weight:600}
.ruta{color:var(--muted);font-size:13px;margin-left:6px}
.tag{display:inline-block;border-radius:999px;padding:2px 12px;font-size:14px;font-weight:600;white-space:nowrap}
.tag-ok{background:var(--ok-bg);color:var(--ok-text)}
.tag-aviso{background:var(--warn-bg);color:var(--warn-text)}
.tag-malo{background:var(--danger-bg);color:var(--danger-text)}
.tag-neutro{background:var(--surface);color:var(--muted)}
details{margin:0 0 16px;background:#fff;border:1px solid var(--divider);border-radius:14px;padding:12px 22px}
summary{cursor:pointer;font-weight:600;padding:4px 0}
details[open] summary{margin-bottom:10px}
.alerta-demo{background:var(--warn-bg);border:2px solid var(--warn-text);color:#5c410a;border-radius:14px;padding:14px 20px;margin-bottom:18px;font-size:17px}
.aviso-caja{background:var(--surface);border-left:6px solid var(--strong);border-radius:10px;padding:12px 18px;margin-bottom:16px}
.lista{margin:0;padding-left:22px}.lista li{margin:6px 0}
.lista-adr{margin:0;padding-left:0;list-style:none;font-size:15px}.lista-adr li{margin:4px 0}
code{background:var(--surface);padding:1px 6px;border-radius:4px;font-size:14.5px}
footer{max-width:1280px;margin:0 auto;padding:10px 40px 50px;color:var(--muted);font-size:14.5px}
footer h3{color:var(--text)}
@media (max-width:1100px){.kpis{grid-template-columns:repeat(2,1fr)}.dos-col,.tres-col{grid-template-columns:1fr}}
@media print{nav{display:none}details{break-inside:avoid}}
`;

const fuente = (() => {
  const ruta = join(
    RAIZ,
    'node_modules',
    '@fontsource-variable',
    'inter',
    'files',
    'inter-latin-wght-normal.woff2',
  );
  if (!existsSync(ruta)) return '';
  return `@font-face{font-family:'Inter Variable';font-style:normal;font-weight:100 900;font-display:swap;src:url(data:font/woff2;base64,${readFileSync(ruta).toString('base64')}) format('woff2')}`;
})();

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Evidencias de la beta · StockPredict</title>
<style>${fuente}${css}</style>
</head>
<body>
<header class="hero"><div class="hero-fila"><div><h1>StockPredict · Evidencias de la versión beta</h1><p>Datos reales de pruebas, calidad y de la fórmula PTS, medidos sobre el sistema construido.</p></div><div class="meta"><span class="sello">${VERSION}</span><br>Generado el ${esc(fechaTexto)}</div></div></header>
<nav aria-label="Secciones"><ul>
<li><a href="#resumen">Resumen</a></li><li><a href="#pruebas">Pruebas</a></li><li><a href="#cobertura">Cobertura</a></li><li><a href="#accesibilidad">Accesibilidad</a></li><li><a href="#rendimiento">Rendimiento</a></li><li><a href="#seguridad">Seguridad</a></li><li><a href="#requisitos">Requerimientos y ADR</a></li><li><a href="#pts">PTS vs a ojo</a></li><li><a href="#limites">Límites</a></li>
</ul></nav>
<main>
<section id="resumen"><h2>Resumen</h2><p class="intro">Los números más importantes de esta versión. Cada sección de abajo explica de dónde sale cada uno.</p><div class="kpis">${resumenKpis}</div></section>
${sPruebas}
${sCobertura}
${sAcc}
${sRend}
${sSeg}
${sReq}
${sRetro}
</main>
<footer id="limites"><h3>Límites de esta evidencia</h3>
<ul class="lista">
<li>Todo se midió en el equipo de desarrollo, sobre localhost y con datos de demostración. No se midió con red móvil, con el sistema publicado ni con la usuaria final.</li>
<li>Falta la prueba con lector de pantalla y en un celular real; el menú de compartir del teléfono no se pudo probar porque necesita HTTPS.</li>
<li>Lighthouse de rendimiento no se corrió; el rendimiento se midió con tiempos de la API y con el peso del JavaScript.</li>
<li>La prueba retrospectiva de PTS es una muestra pequeña con ventas de demostración. Para evaluarla de verdad hacen falta ventas reales de varias semanas.</li>
<li>El enlace entre requerimientos y pruebas lo mantiene el autor en <code>scripts/evidencias/catalogo.ts</code>; los números de pruebas, cobertura, accesibilidad y rendimiento salen de las herramientas.</li>
</ul>
<p>Datos crudos en <code>docs/evidencias/datos/</code>. Para regenerar todo: <code>npm run evidencias</code>.</p></footer>
</body>
</html>`;

writeFileSync(SALIDA, html);
console.log(`Dashboard: ${SALIDA} (${num(Buffer.byteLength(html) / 1024)} KB)`);
