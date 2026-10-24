import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { DATOS, RAIZ, ejecutar } from './servidores.ts';

const HERRAMIENTAS = join(RAIZ, 'scripts', 'evidencias');
const COBERTURA = '@vitest/coverage-v8@5.0.3';

async function paso(titulo: string, comando: string, args: string[], cwd = RAIZ, tolerar = false) {
  const inicio = Date.now();
  process.stdout.write(`\n▶ ${titulo}\n`);
  const r = await ejecutar(comando, args, { cwd });
  const segundos = ((Date.now() - inicio) / 1000).toFixed(0);
  if (r.codigo !== 0 && !tolerar) {
    process.stdout.write(r.salida.split('\n').slice(-25).join('\n'));
    throw new Error(`Falló: ${titulo}`);
  }
  process.stdout.write(
    `  listo en ${segundos} s${r.codigo !== 0 ? ` (código ${r.codigo}, se registra en el JSON)` : ''}\n`,
  );
}

mkdirSync(DATOS, { recursive: true });
await paso('Levantar PostgreSQL y Mailpit', 'npm', ['run', 'db:up']);
if (!existsSync(join(HERRAMIENTAS, 'node_modules', 'lighthouse'))) {
  await paso(
    'Instalar Lighthouse, axe y puppeteer (solo para las evidencias)',
    'npm',
    ['install', '--no-audit', '--no-fund'],
    HERRAMIENTAS,
  );
}
if (!existsSync(join(RAIZ, 'node_modules', '@vitest', 'coverage-v8'))) {
  await paso('Instalar el medidor de cobertura sin tocar package.json', 'npm', [
    'install',
    '--no-save',
    '--no-audit',
    '--no-fund',
    COBERTURA,
  ]);
}
await paso('Dejar la demo con datos frescos', 'npm', ['run', 'db:reset-demo']);

for (const carpeta of ['cobertura-servidor', 'cobertura-ui'])
  rmSync(join(DATOS, carpeta), { recursive: true, force: true });
await paso(
  'Pruebas y cobertura del servidor',
  'npx',
  [
    'vitest',
    'run',
    '--reporter=json',
    '--outputFile=../docs/evidencias/datos/tests-servidor.json',
    '--coverage',
    '--coverage.provider=v8',
    '--coverage.reporter=json-summary',
    '--coverage.reporter=json',
    '--coverage.reportsDirectory=../docs/evidencias/datos/cobertura-servidor',
    '--coverage.include=src/**/*.ts',
    '--coverage.exclude=src/**/*.test.ts',
    '--coverage.exclude=src/generated/**',
  ],
  join(RAIZ, 'backend'),
  true,
);
await paso(
  'Pruebas y cobertura de la interfaz',
  'npx',
  [
    'vitest',
    'run',
    '--reporter=json',
    '--outputFile=../docs/evidencias/datos/tests-ui.json',
    '--coverage',
    '--coverage.provider=v8',
    '--coverage.reporter=json-summary',
    '--coverage.reporter=json',
    '--coverage.reportsDirectory=../docs/evidencias/datos/cobertura-ui',
    '--coverage.include=src/**/*.{ts,tsx}',
    '--coverage.exclude=src/**/*.test.{ts,tsx}',
    '--coverage.exclude=src/test/**',
  ],
  join(RAIZ, 'frontend'),
  true,
);
await paso('Compilar la aplicación', 'npm', ['run', 'build']);
await paso('Prueba retrospectiva de PTS (demo)', 'npx', [
  'tsx',
  'scripts/evidencias/retrospectiva.ts',
]);
await paso('Accesibilidad: Lighthouse y axe en 15 pantallas', 'npx', [
  'tsx',
  'scripts/evidencias/accesibilidad.ts',
]);
await paso('Rendimiento, peso del JavaScript y npm audit', 'npx', [
  'tsx',
  'scripts/evidencias/rendimiento.ts',
]);
await paso('Generar el dashboard', 'npx', ['tsx', 'scripts/evidencias/generar-dashboard.ts']);
await paso('Dejar la demo lista', 'npm', ['run', 'db:reset-demo']);
process.stdout.write('\nListo: docs/evidencias/dashboard-beta.html\n');
