export const MODULOS = [
  'Autenticación',
  'Categorías y subcategorías',
  'Productos y búsqueda',
  'Ventas',
  'Compras',
  'Ajuste de stock',
  'Predicción y PTS',
  'Simulador',
  'Exportación',
  'Inicio y avisos',
  'Base y configuración',
] as const;

export type Modulo = (typeof MODULOS)[number];

const POR_PREFIJO: [RegExp, Modulo][] = [
  [/^AU\d/, 'Autenticación'],
  [/^SC\d/, 'Categorías y subcategorías'],
  [/^C\d/, 'Categorías y subcategorías'],
  [/^(P\d|PD\d|CP\d|BU\d)/, 'Productos y búsqueda'],
  [/^(V\d|VS\d)/, 'Ventas'],
  [/^CO\d/, 'Compras'],
  [/^A\d/, 'Ajuste de stock'],
  [/^PR\d/, 'Predicción y PTS'],
  [/^SM\d/, 'Simulador'],
  [/^(EX\d|SH\d)/, 'Exportación'],
  [/^(DB\d|AV\d|RF2[79])/, 'Inicio y avisos'],
  [/^RNF/, 'Base y configuración'],
];

const POR_ARCHIVO: [RegExp, Modulo][] = [
  [/auth\//, 'Autenticación'],
  [/categorias|subcategorias|Subcategorias/, 'Categorías y subcategorías'],
  [/productos|busqueda/, 'Productos y búsqueda'],
  [/ventas/, 'Ventas'],
  [/inventario\/Ajuste/, 'Ajuste de stock'],
  [/inventario/, 'Compras'],
  [/prediccion\/exportacion|ExportarHoja/, 'Exportación'],
  [/prediccion|semana\.test/, 'Predicción y PTS'],
  [/dashboard/, 'Inicio y avisos'],
];

export function moduloDe(archivo: string, nombre: string): Modulo {
  const id = /\b((?:AU|SC|CO|SM|SH|EX|PR|PD|CP|BU|VS|DB|AV|RNF|RF|[ACPV])\d{2,3})\b/.exec(
    nombre,
  )?.[1];
  if (id) {
    const porId = POR_PREFIJO.find(([r]) => r.test(id));
    if (porId && !id.startsWith('RF')) return porId[1];
    if (id === 'RF27' || id === 'RF29') return 'Inicio y avisos';
  }
  const porArchivo = POR_ARCHIVO.find(([r]) => r.test(archivo));
  return porArchivo ? porArchivo[1] : 'Base y configuración';
}

export const IDS_SEGURIDAD: Record<string, string[]> = {
  'Aislamiento entre usuarios (un usuario no ve datos de otro)': [
    'A05',
    'P16',
    'P19',
    'SC11',
    'CP06',
    'CP07',
    'PR15',
    'EX10',
    'EX11',
    'BU06',
    'BU11',
    'VS05',
  ],
  'Sesión, contraseñas y límite de intentos': [
    'AU05',
    'AU06',
    'AU08',
    'AU09',
    'P17',
    'SC12',
    'SM01',
    'VS06',
    'BU07',
    'EX12',
  ],
  'Validación estricta de lo que llega al servidor': ['SC04', 'SM08', 'SM09', 'CP08', 'EX13'],
  'Archivos exportados (inyección de fórmulas y datos de más)': ['EX07', 'EX08'],
};

export interface Requisito {
  ids: string[];
  archivos?: string[];
}

export const RF: Record<string, Requisito> = {
  RF01: { ids: ['AU01'] },
  RF02: { ids: ['AU02', 'AU05'] },
  RF03: { ids: ['AU03', 'AU06'] },
  RF04: { ids: ['AU03'] },
  RF05: { ids: ['AU04', 'AU08'] },
  RF06: { ids: ['C01', 'C07'] },
  RF07: { ids: ['C02', 'C03'] },
  RF08: { ids: ['C04', 'C08'] },
  RF09: { ids: ['C05', 'C09', 'C10'] },
  RF10: { ids: ['P01', 'P06', 'P07', 'P08', 'P09', 'P10', 'P14'] },
  RF11: { ids: ['P02', 'P03', 'P19'] },
  RF12: { ids: ['P04', 'P11', 'P12'] },
  RF13: { ids: ['P05', 'BU03'] },
  RF14: { ids: ['SC01', 'SC03'] },
  RF15: { ids: ['V01', 'V04', 'V05', 'V06', 'V07'] },
  RF16: { ids: ['V03'] },
  RF17: { ids: ['V02'] },
  RF18: { ids: ['PR01', 'PR07'] },
  RF19: { ids: ['CO01', 'CO02', 'CO03', 'CO04'] },
  RF20: { ids: ['A01', 'A02', 'A03', 'A04', 'A05'] },
  RF21: { ids: ['BU18', 'BU19'] },
  RF22: { ids: ['PR01', 'PR06', 'PR09'] },
  RF23: { ids: ['PR02', 'PR05', 'PR10', 'PR11', 'PR12'] },
  RF24: { ids: ['PR03'] },
  RF25: { ids: ['PR04'] },
  RF26: { ids: ['PR16', 'PR17'] },
  RF27: { ids: ['RF27'] },
  RF28: { ids: ['RF28', 'P13'] },
  RF29: { ids: ['RF29', 'DB04'] },
  RF30: { ids: ['PD01'] },
  RF31: { ids: ['SC01', 'SC02', 'SC04', 'SC05', 'SC06'] },
  RF32: { ids: ['SC03', 'SC07'] },
  RF33: { ids: ['SC08', 'SC10'] },
  RF34: { ids: ['SC09'] },
  RF35: { ids: ['PR13', 'PR16'] },
  RF36: { ids: ['PR08'] },
  RF37: { ids: ['PR14', 'PR18'] },
  RF38: { ids: ['PR16'] },
  RF39: { ids: ['SM02', 'SM03', 'SM07', 'SM11', 'SM12'] },
  RF40: { ids: ['SH01'] },
  RF41: { ids: ['PD01'] },
  RF42: { ids: ['P15', 'PD02', 'PD03', 'PD04'] },
  RF43: { ids: ['PD05', 'PD06'] },
  RF44: { ids: ['PD07'] },
  RF45: { ids: ['P18', 'PD10'] },
  RF46: { ids: ['CP01', 'CP02', 'PD08', 'PD09'] },
  RF47: { ids: ['BU01', 'BU02', 'BU12', 'BU13', 'BU20'] },
  RF48: { ids: ['BU03', 'BU17', 'BU18'] },
  RF49: { ids: ['BU14', 'BU19', 'BU21'] },
  RF50: { ids: ['BU05', 'BU16'] },
  RF51: { ids: ['DB01', 'DB02', 'VS01', 'VS02'] },
  RF52: { ids: ['SH01', 'SH02'] },
  RF53: { ids: ['EX01', 'EX03', 'EX04', 'EX09'] },
  RF54: { ids: ['EX06'] },
  RF55: { ids: ['SH05', 'SH06', 'SH07'] },
  RF56: { ids: ['EX11'] },
};

export const RNF: Record<
  string,
  {
    estado: 'cumplido' | 'medido' | 'pendiente';
    nota: string;
    ids?: string[];
    archivos?: string[];
    patron?: string;
  }
> = {
  RNF01: {
    estado: 'cumplido',
    nota: 'Diseño pensado para celular; revisado a 390, 320 y 195 px (accesibilidad.md)',
  },
  RNF02: {
    estado: 'medido',
    nota: 'Medido en el equipo de desarrollo, sin red real',
    ids: ['RNF02'],
  },
  RNF03: { estado: 'cumplido', nota: 'Un solo tipo de usuario' },
  RNF04: {
    estado: 'cumplido',
    nota: 'Fórmula PTS con reglas matemáticas, sin IA',
    ids: ['PR01', 'PR09'],
  },
  RNF05: { estado: 'pendiente', nota: 'Depende de publicar el sistema' },
  RNF06: { estado: 'cumplido', nota: 'No hay WhatsApp, notificaciones ni pagos integrados' },
  RNF07: { estado: 'pendiente', nota: 'Falta la prueba con la usuaria final' },
  RNF08: { estado: 'cumplido', nota: 'DAD 1.2, ADR y README' },
  RNF09: { estado: 'cumplido', nota: 'bcrypt', ids: ['AU01'] },
  RNF10: { estado: 'cumplido', nota: 'Cookie httpOnly y SameSite', ids: ['AU02'] },
  RNF11: { estado: 'cumplido', nota: 'Validación estricta con zod', ids: ['SC04', 'SM08', 'CP08'] },
  RNF12: {
    estado: 'cumplido',
    nota: 'Aislamiento por usuario',
    ids: ['P16', 'SC11', 'PR15', 'CP07'],
  },
  RNF13: { estado: 'cumplido', nota: 'Límite de intentos', ids: ['AU09'] },
  RNF14: { estado: 'cumplido', nota: 'Mensajes que no revelan correos', ids: ['AU06'] },
  RNF15: {
    estado: 'cumplido',
    nota: 'Enlace con hash, 30 minutos y un solo uso',
    ids: ['AU03', 'AU08'],
  },
  RNF16: {
    estado: 'cumplido',
    nota: 'Verificación de origen en pruebas; las cabeceras de seguridad y CORS no tienen prueba propia',
    patron: 'origen no permitido|origen configurado',
  },
  RNF17: { estado: 'cumplido', nota: 'Stock nunca negativo', ids: ['V07', 'V04'] },
  RNF18: { estado: 'cumplido', nota: 'Logs estructurados y vigilante de lentitud', ids: ['RNF02'] },
  RNF19: {
    estado: 'cumplido',
    nota: 'Configuración por variables de entorno',
    archivos: ['env.test.ts'],
  },
  RNF20: { estado: 'cumplido', nota: 'Consulta de estado', archivos: ['health.test.ts'] },
  RNF21: {
    estado: 'cumplido',
    nota: 'Texto de 17 px y botones de 48 px, revisado con el navegador (sin prueba automática)',
  },
  RNF22: {
    estado: 'cumplido',
    nota: 'Exportación sin inyección de fórmulas',
    ids: ['EX07', 'EX08'],
  },
};

export type EstadoAdr = 'implementado' | 'parcial' | 'diferido';

export const ESTADO_ADR: Record<number, { estado: EstadoAdr; nota: string }> = {
  1: { estado: 'implementado', nota: 'Stack y monorepo' },
  2: { estado: 'implementado', nota: 'Huecos del DAD resueltos' },
  3: { estado: 'implementado', nota: 'Modelo de datos y migraciones' },
  4: { estado: 'implementado', nota: 'Sesión y autenticación' },
  5: { estado: 'implementado', nota: 'Fórmula PTS y semanas' },
  6: {
    estado: 'implementado',
    nota: 'Stock con CHECK y transacciones (el ADR sigue como "Propuesto")',
  },
  7: { estado: 'parcial', nota: 'Solo las bases de lo futuro' },
  8: { estado: 'implementado', nota: 'Sistema de diseño y tema' },
  9: { estado: 'diferido', nota: 'Auditoría de eventos' },
  10: { estado: 'parcial', nota: 'Solo el tiempo de respuesta de la recuperación' },
  11: {
    estado: 'parcial',
    nota: 'Pruebas de IDOR y campos extra en cada módulo; sin conjunto único',
  },
  12: { estado: 'diferido', nota: 'Subida de archivos' },
  13: { estado: 'diferido', nota: 'Seguridad en CI' },
  14: { estado: 'diferido', nota: 'Endurecimiento del VPS' },
  15: { estado: 'diferido', nota: 'Contenedores' },
  16: { estado: 'diferido', nota: 'Kubernetes' },
  17: { estado: 'diferido', nota: 'ASVS y pentest' },
  18: { estado: 'diferido', nota: 'Copias de seguridad' },
  19: { estado: 'parcial', nota: 'Análisis hecho; mitigaciones pendientes diferidas' },
  20: { estado: 'implementado', nota: 'Definition of Done por slice' },
  21: { estado: 'parcial', nota: 'Sin cola de sincronización; consulta sin conexión diferida' },
  22: { estado: 'parcial', nota: 'Exportar la predicción hecho; ventas y compras diferidas' },
  23: { estado: 'parcial', nota: 'Zona horaria hecha; moneda diferida' },
  24: { estado: 'diferido', nota: 'Pruebas de carga con k6' },
  25: { estado: 'parcial', nota: 'Versiones congeladas; herramienta automática diferida' },
  26: { estado: 'implementado', nota: 'Subcategorías' },
  27: { estado: 'implementado', nota: 'PTS v1.1' },
  28: { estado: 'implementado', nota: 'Necesidad porcentual, orden, filtros y simulador' },
  29: { estado: 'implementado', nota: 'Detalle de producto y compras' },
  30: { estado: 'implementado', nota: 'Buscador y tipografía' },
  31: { estado: 'implementado', nota: 'Exportar y compartir la predicción' },
  32: { estado: 'diferido', nota: 'Precios y calculadora' },
  33: { estado: 'diferido', nota: 'Historial de compras por producto' },
  34: { estado: 'diferido', nota: 'Fotos del producto' },
  35: { estado: 'diferido', nota: 'Sugerencias de precio y liquidación' },
  36: { estado: 'diferido', nota: 'Mensaje promocional' },
  37: { estado: 'diferido', nota: 'Catálogo en PDF' },
  38: { estado: 'diferido', nota: 'Gráficas en Inventario' },
  39: { estado: 'diferido', nota: 'Exportar ventas y compras' },
};
