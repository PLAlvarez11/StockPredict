import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import lighthouse from 'lighthouse';
import puppeteer from 'puppeteer-core';
import {
  DATOS,
  URL_DEMO,
  iniciarBackend,
  iniciarFrontend,
  pausa,
  rutaChrome,
} from './servidores.ts';

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const PUERTO_API = 3100;
const PUERTO_WEB = 5173;
const PUERTO_CHROME = 9341;
const BASE = `http://localhost:${PUERTO_WEB}`;

interface Pantalla {
  nombre: string;
  ruta: string;
  privada: boolean;
}

interface ResultadoPantalla {
  nombre: string;
  ruta: string;
  accesibilidad: number;
  buenasPracticas: number;
  fallosLighthouse: string[];
  axeViolaciones: number;
  axeDetalle: string[];
  axePorRevisar: number;
  axeReglasQuePasaron: number;
}

const backend = await iniciarBackend(PUERTO_API, URL_DEMO);
const web = await iniciarFrontend(PUERTO_WEB, PUERTO_API);
const navegador = await puppeteer.launch({
  executablePath: rutaChrome(),
  headless: true,
  args: [`--remote-debugging-port=${PUERTO_CHROME}`, '--no-first-run'],
  defaultViewport: {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
});
const pagina = await navegador.newPage();

async function medir(p: Pantalla, ruta: string): Promise<ResultadoPantalla> {
  await pagina.goto(BASE + ruta, { waitUntil: 'networkidle0' });
  await pausa(600);
  await pagina.evaluate(axeSource);
  const axe = (await pagina.evaluate(async () => {
    const r = await (
      globalThis as unknown as {
        axe: { run: (c: unknown, o: unknown) => Promise<Record<string, unknown[]>> };
      }
    ).axe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
      },
    });
    const viol = r['violations'] as { id: string; nodes: { target: string[] }[] }[];
    return {
      violaciones: viol.map(
        (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
      ),
      porRevisar: (r['incomplete'] as unknown[]).length,
      pasaron: (r['passes'] as unknown[]).length,
    };
  })) as { violaciones: string[]; porRevisar: number; pasaron: number };
  const lh = await lighthouse(BASE + ruta, {
    port: PUERTO_CHROME,
    output: 'json',
    logLevel: 'error',
    onlyCategories: ['accessibility', 'best-practices'],
    formFactor: 'mobile',
    screenEmulation: {
      mobile: true,
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      disabled: false,
    },
    throttlingMethod: 'provided',
    disableStorageReset: true,
  });
  const c = lh!.lhr.categories;
  const resultado: ResultadoPantalla = {
    nombre: p.nombre,
    ruta: p.ruta,
    accesibilidad: Math.round((c['accessibility']?.score ?? 0) * 100),
    buenasPracticas: Math.round((c['best-practices']?.score ?? 0) * 100),
    fallosLighthouse: Object.values(lh!.lhr.audits)
      .filter((a) => a.score !== null && a.score < 1 && a.scoreDisplayMode === 'binary')
      .map((a) => a.title),
    axeViolaciones: axe.violaciones.length,
    axeDetalle: axe.violaciones,
    axePorRevisar: axe.porRevisar,
    axeReglasQuePasaron: axe.pasaron,
  };
  console.log(
    `${p.nombre}: accesibilidad ${resultado.accesibilidad}, buenas prácticas ${resultado.buenasPracticas}, axe ${resultado.axeViolaciones} violaciones`,
  );
  return resultado;
}

const publicas: Pantalla[] = [
  { nombre: 'Iniciar sesión', ruta: '/login', privada: false },
  { nombre: 'Registro', ruta: '/registro', privada: false },
  { nombre: 'Recuperar contraseña', ruta: '/recuperar', privada: false },
];
const resultados: ResultadoPantalla[] = [];
for (const p of publicas) resultados.push(await medir(p, p.ruta));

await pagina.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
await pagina.type('input[type=email]', 'demo@stockpredict.local');
await pagina.type('input[type=password]', 'Demo1234!');
await pagina.click('button[type=submit]');
await pagina.waitForNavigation({ waitUntil: 'networkidle0' });
const idBlusa = await pagina.evaluate(async () => {
  const r = await fetch('/api/v1/productos?q=Blusa%20floral');
  const j = (await r.json()) as { datos: { id: number }[] };
  return j.datos[0]?.id;
});

const privadas: Pantalla[] = [
  { nombre: 'Inicio', ruta: '/', privada: true },
  { nombre: 'Categorías', ruta: '/categorias', privada: true },
  { nombre: 'Nueva categoría', ruta: '/categorias/nueva', privada: true },
  { nombre: 'Productos', ruta: '/productos', privada: true },
  { nombre: 'Nuevo producto', ruta: '/productos/nuevo', privada: true },
  { nombre: 'Detalle de producto', ruta: `/productos/${idBlusa}`, privada: true },
  { nombre: 'Inventario', ruta: '/inventario', privada: true },
  { nombre: 'Registrar compra', ruta: '/inventario/compra', privada: true },
  { nombre: 'Ajustar stock', ruta: '/inventario/ajuste', privada: true },
  { nombre: 'Registrar venta', ruta: '/ventas/nueva', privada: true },
  { nombre: 'Predicción', ruta: '/prediccion', privada: true },
  { nombre: 'Simulador', ruta: '/simulador', privada: true },
];
for (const p of privadas) resultados.push(await medir(p, p.ruta));

const versiones = {
  lighthouse: require('lighthouse/package.json').version as string,
  axe: require('axe-core/package.json').version as string,
  chrome: await navegador.version(),
};
writeFileSync(
  join(DATOS, 'accesibilidad.json'),
  JSON.stringify(
    { generado: new Date().toISOString(), viewport: '390x844', versiones, pantallas: resultados },
    null,
    2,
  ),
);

await navegador.close();
web.close();
backend.kill();
process.exit(0);
