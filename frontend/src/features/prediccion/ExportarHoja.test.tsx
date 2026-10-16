import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AvisosProvider } from '../../components/layout/Avisos';
import { PrediccionPage } from './PrediccionPage';

const prediccion = {
  semanasBase: [],
  semanaActual: { inicio: '2026-10-12T06:00:00.000Z', fin: '2026-10-19T06:00:00.000Z' },
  totalActivos: 1,
  totalAComprar: 1,
  totalFiltrados: 1,
  items: [
    {
      producto: {
        id: 1,
        nombre: 'Blusa floral',
        categoria: { id: 1, nombre: 'Ropa', icono: 't-shirt' },
        subcategoria: { id: 10, nombre: 'Blusas', icono: 't-shirt' },
      },
      stockActual: 3,
      estado: 'comprar',
      semaforo: 'rojo',
      origen: 'producto',
      necesidadPct: 70,
      stockSugerido: 10,
      cantidadAComprar: 7,
      calculo: null,
    },
  ],
};

interface Llamada {
  ruta: string;
}

function simular(opciones: { exportacion?: () => Response; espera?: Promise<void> } = {}) {
  const llamadas: Llamada[] = [];
  const exportacion =
    opciones.exportacion ??
    (() =>
      new Response(new Blob(['%PDF-1.3 prueba'], { type: 'application/pdf' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition':
            'attachment; filename="stockpredict-prediccion-2026-10-12_a_2026-10-18.pdf"',
        },
      }));
  const falso = vi.fn((url: string) => {
    const ruta = url.replace('/api/v1', '');
    llamadas.push({ ruta });
    if (ruta.startsWith('/prediccion/exportar')) {
      return opciones.espera ? opciones.espera.then(exportacion) : Promise.resolve(exportacion());
    }
    const cuerpo = ruta.startsWith('/prediccion')
      ? prediccion
      : ruta.startsWith('/categorias')
        ? [
            {
              id: 1,
              nombre: 'Ropa',
              icono: 't-shirt',
              estado: true,
              totalSubcategorias: 1,
              totalProductos: 1,
            },
          ]
        : [];
    return Promise.resolve(
      new Response(JSON.stringify(cuerpo), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
  vi.stubGlobal('fetch', falso);
  return llamadas;
}

function montar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={cliente}>
      <AvisosProvider>
        <MemoryRouter>
          <PrediccionPage />
        </MemoryRouter>
      </AvisosProvider>
    </QueryClientProvider>,
  );
}

const abrir = async () => {
  await userEvent.click(await screen.findByRole('button', { name: /Compartir \/ exportar lista/ }));
  return screen.findByRole('dialog', { name: 'Exportar lista de predicción' });
};

function definirNavigator(compartir: unknown, puede?: unknown) {
  Object.defineProperty(navigator, 'share', {
    value: compartir,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(navigator, 'canShare', {
    value: puede,
    configurable: true,
    writable: true,
  });
}

let descargas: { nombre: string }[];

beforeEach(() => {
  descargas = [];
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn(() => 'blob:prueba'),
    configurable: true,
    writable: true,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: vi.fn(),
    configurable: true,
    writable: true,
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(
    this: HTMLAnchorElement,
  ) {
    descargas.push({ nombre: this.download });
  });
  definirNavigator(undefined, undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Hoja de compartir y exportar', () => {
  it('SH01: el botón abre la hoja con PDF, Excel, CSV y "Compartir", y ya no dice "Próximamente"', async () => {
    simular();
    montar();
    expect(screen.queryByText('Próximamente')).not.toBeInTheDocument();
    const hoja = await abrir();
    const formatos = within(hoja).getByRole('group', { name: 'Formato del archivo' });
    expect(
      within(formatos)
        .getAllByRole('radio')
        .map((r) => (r as HTMLInputElement).value),
    ).toEqual(['pdf', 'xlsx', 'csv']);
    expect(within(hoja).getByText('PDF')).toBeInTheDocument();
    expect(within(hoja).getByText('Excel')).toBeInTheDocument();
    expect(within(hoja).getByText('CSV')).toBeInTheDocument();
    expect(await within(hoja).findByRole('button', { name: 'Compartir' })).toBeEnabled();
  });

  it('SH02: la hoja se carga solo al abrirla: sin abrir no se pide ningún archivo', async () => {
    const llamadas = simular();
    montar();
    await screen.findByText('Blusa floral');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(llamadas.some((l) => l.ruta.startsWith('/prediccion/exportar'))).toBe(false);
    await abrir();
    await waitFor(() =>
      expect(llamadas.some((l) => l.ruta.startsWith('/prediccion/exportar'))).toBe(true),
    );
  });

  it('SH03: pide cada formato con los mismos filtros que la pantalla', async () => {
    const llamadas = simular();
    montar();
    await userEvent.type(await screen.findByRole('searchbox'), 'blusa');
    await userEvent.click(screen.getByRole('button', { name: 'Rojo' }));
    await waitFor(() =>
      expect(llamadas.some((l) => l.ruta === '/prediccion?q=blusa&estado=rojo')).toBe(true),
    );
    const hoja = await abrir();
    await waitFor(() =>
      expect(
        llamadas.some((l) => l.ruta === '/prediccion/exportar?q=blusa&estado=rojo&formato=pdf'),
      ).toBe(true),
    );
    await userEvent.click(within(hoja).getByLabelText('Excel'));
    await waitFor(() =>
      expect(
        llamadas.some((l) => l.ruta === '/prediccion/exportar?q=blusa&estado=rojo&formato=xlsx'),
      ).toBe(true),
    );
    await userEvent.click(within(hoja).getByLabelText('CSV'));
    await waitFor(() =>
      expect(
        llamadas.some((l) => l.ruta === '/prediccion/exportar?q=blusa&estado=rojo&formato=csv'),
      ).toBe(true),
    );
  });

  it('SH04: mientras prepara el archivo el botón está deshabilitado y avisa "Preparando el archivo…"', async () => {
    let liberar: () => void = () => undefined;
    simular({ espera: new Promise<void>((resolver) => (liberar = resolver)) });
    montar();
    const hoja = await abrir();
    const boton = within(hoja).getByRole('button', { name: /Preparando el archivo/ });
    expect(boton).toBeDisabled();
    expect(boton).toHaveAttribute('aria-busy', 'true');
    liberar();
    expect(await within(hoja).findByRole('button', { name: 'Compartir' })).toBeEnabled();
  });

  it('SH05: Compartir usa el menú del teléfono con el archivo y avisa en la región viva', async () => {
    simular();
    const compartir = vi.fn().mockResolvedValue(undefined);
    definirNavigator(
      compartir,
      vi.fn(() => true),
    );
    montar();
    const hoja = await abrir();
    expect(within(hoja).getByText(/Se abrirá el menú de tu teléfono/)).toBeInTheDocument();
    await userEvent.click(await within(hoja).findByRole('button', { name: 'Compartir' }));
    await waitFor(() => expect(compartir).toHaveBeenCalledTimes(1));
    const datos = compartir.mock.calls[0]?.[0] as { files: File[] };
    expect(datos.files).toHaveLength(1);
    expect(datos.files[0]?.name).toBe('stockpredict-prediccion-2026-10-12_a_2026-10-18.pdf');
    expect(datos.files[0]?.type).toBe('application/pdf');
    expect(descargas).toEqual([]);
    expect(await screen.findByRole('status')).toHaveTextContent('Lista compartida');
  });

  it('SH06: sin menú de compartir descarga el archivo y lo explica con un mensaje simple', async () => {
    simular();
    montar();
    const hoja = await abrir();
    expect(
      within(hoja).getByText(/no puede abrir el menú de compartir: se descargará/),
    ).toBeInTheDocument();
    await userEvent.click(await within(hoja).findByRole('button', { name: 'Compartir' }));
    await waitFor(() => expect(descargas).toHaveLength(1));
    expect(descargas[0]?.nombre).toBe('stockpredict-prediccion-2026-10-12_a_2026-10-18.pdf');
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Este navegador no puede abrir el menú de compartir, así que se descargó el archivo',
    );
  });

  it('SH07: si el navegador no puede compartir archivos (canShare falso) también descarga', async () => {
    simular();
    const compartir = vi.fn();
    definirNavigator(
      compartir,
      vi.fn(() => false),
    );
    montar();
    const hoja = await abrir();
    await userEvent.click(await within(hoja).findByRole('button', { name: 'Compartir' }));
    await waitFor(() => expect(descargas).toHaveLength(1));
    expect(compartir).not.toHaveBeenCalled();
  });

  it('SH08: si la usuaria cancela el menú de compartir no se descarga nada ni se avisa', async () => {
    simular();
    const compartir = vi.fn().mockRejectedValue(new DOMException('cancelado', 'AbortError'));
    definirNavigator(
      compartir,
      vi.fn(() => true),
    );
    montar();
    const hoja = await abrir();
    await userEvent.click(await within(hoja).findByRole('button', { name: 'Compartir' }));
    await waitFor(() => expect(compartir).toHaveBeenCalled());
    expect(descargas).toEqual([]);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(within(hoja).getByRole('button', { name: 'Compartir' })).toBeEnabled();
  });

  it('SH09: si compartir falla por otra razón (permiso o tiempo), descarga el archivo', async () => {
    simular();
    const compartir = vi
      .fn()
      .mockRejectedValue(new DOMException('no permitido', 'NotAllowedError'));
    definirNavigator(
      compartir,
      vi.fn(() => true),
    );
    montar();
    const hoja = await abrir();
    await userEvent.click(await within(hoja).findByRole('button', { name: 'Compartir' }));
    await waitFor(() => expect(descargas).toHaveLength(1));
  });

  it('SH10: un error del servidor muestra un mensaje amable y permite intentar de nuevo', async () => {
    let intento = 0;
    simular({
      exportacion: () => {
        intento += 1;
        return intento === 1
          ? new Response(JSON.stringify({ code: 'INTERNAL', detail: 'Falló' }), { status: 500 })
          : new Response(new Blob(['%PDF-1.3']), {
              status: 200,
              headers: { 'Content-Disposition': 'attachment; filename="a.pdf"' },
            });
      },
    });
    montar();
    const hoja = await abrir();
    expect(await within(hoja).findByRole('alert')).toHaveTextContent('Falló');
    expect(within(hoja).getByRole('button', { name: 'Compartir' })).toBeDisabled();
    await userEvent.click(within(hoja).getByRole('button', { name: 'Intentar de nuevo' }));
    expect(await within(hoja).findByRole('button', { name: 'Compartir' })).toBeEnabled();
    expect(within(hoja).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('SH11: sin conexión explica que no hay conexión', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        String(url).includes('/exportar')
          ? Promise.reject(new TypeError('red'))
          : Promise.resolve(
              new Response(JSON.stringify(String(url).includes('/prediccion') ? prediccion : []), {
                status: 200,
              }),
            ),
      ),
    );
    montar();
    const hoja = await abrir();
    expect(await within(hoja).findByRole('alert')).toHaveTextContent(
      'No hay conexión con el servidor',
    );
  });

  it('SH12: "Cancelar" cierra la hoja sin pedir nada más', async () => {
    simular();
    montar();
    const hoja = await abrir();
    await userEvent.click(within(hoja).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Exportar lista de predicción' }),
      ).not.toBeInTheDocument(),
    );
  });
});
