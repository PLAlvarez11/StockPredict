import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AvisosProvider, useAviso } from '../../components/layout/Avisos';
import { simularApi } from '../../test/mockFetch';
import { InicioPage } from './InicioPage';

const yo = { id: 1, nombre: 'Valesca', correo: 'v@ejemplo.com' };
const sinPrediccion = {
  semanasBase: [],
  semanaActual: { inicio: '2026-10-12T06:00:00.000Z', fin: '2026-10-19T06:00:00.000Z' },
  totalActivos: 0,
  totalAComprar: 0,
  totalFiltrados: 0,
  items: [],
};
const listado = { datos: [], total: 12, stockBajo: 6, page: 1, limit: 100 };

const dia = (i: number, cantidad: number, esHoy = false) => ({
  fecha: new Date(Date.UTC(2026, 9, 12 + i)).toISOString().slice(0, 10),
  cantidad,
  esHoy,
});
const semana = (cantidades: number[]) => {
  const dias = cantidades.map((c, i) => dia(i, c, i === 3));
  const total = cantidades.reduce((a, b) => a + b, 0);
  const mayor = dias.reduce<(typeof dias)[number] | null>(
    (m, d) => (d.cantidad > 0 && (m === null || d.cantidad > m.cantidad) ? d : m),
    null,
  );
  return { inicio: dias[0]?.fecha, fin: dias[6]?.fecha, dias, total, diaMayor: mayor };
};

function montar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={cliente}>
      <AvisosProvider>
        <MemoryRouter>
          <InicioPage />
        </MemoryRouter>
      </AvisosProvider>
    </QueryClientProvider>,
  );
}

const base = (ventas: unknown) => ({
  'GET /auth/me': yo,
  'GET /productos': listado,
  'GET /prediccion': sinPrediccion,
  'GET /ventas/semana': ventas,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Inicio: gráfica de ventas de la semana', () => {
  it('DB01: con datos muestra el total, las 7 iniciales y un resumen accesible con el día de mayor venta', async () => {
    simularApi(base(semana([4, 7, 3, 9, 12, 6, 2])));
    montar();
    const region = await screen.findByRole('region', { name: 'Ventas de la semana' });
    const grafica = await within(region).findByRole('img', { name: /Total vendido: 43 u\./ });
    expect(grafica).toHaveAccessibleName(/Día de mayor venta: viernes .* 12 u\./);
    expect(within(region).getByText('43 u.', { selector: '.grafica-total' })).toBeInTheDocument();
    const tabla = within(region).getByRole('table', { name: /Unidades vendidas por día/ });
    expect(within(tabla).getAllByRole('row')).toHaveLength(8);
    expect(within(tabla).getByText(/\(hoy\)/)).toBeInTheDocument();
    expect(grafica.querySelectorAll('.grafica-barra')).toHaveLength(7);
    expect(grafica.querySelectorAll('.grafica-barra-mayor')).toHaveLength(1);
  });

  it('DB02: sin ventas esta semana muestra un mensaje amable y no dibuja la gráfica', async () => {
    simularApi(base(semana([0, 0, 0, 0, 0, 0, 0])));
    montar();
    expect(await screen.findByText(/Todavía no hay ventas esta semana/)).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Total vendido/ })).not.toBeInTheDocument();
  });

  it('DB03: si el servicio falla ofrece reintentar sin romper el resto del Inicio', async () => {
    simularApi({
      ...base(undefined),
      'GET /ventas/semana': { __estado: 500, cuerpo: { code: 'INTERNAL', detail: 'Error' } },
    });
    montar();
    expect(await screen.findByRole('heading', { name: 'Valesca' })).toBeInTheDocument();
    const region = await screen.findByRole('region', { name: 'Ventas de la semana' });
    expect(await within(region).findByRole('button', { name: /Reintentar/ })).toBeInTheDocument();
  });

  it('DB04: los atajos incluyen "Simular stock" y no repiten las pestañas de la barra inferior', async () => {
    simularApi(base(semana([1, 0, 0, 0, 0, 0, 0])));
    montar();
    const atajos = await screen.findByRole('navigation', { name: 'Accesos rápidos' });
    const rutas = within(atajos)
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'));
    expect(rutas).toContain('/simulador');
    expect(within(atajos).getByRole('link', { name: 'Simular stock' })).toBeInTheDocument();
    for (const pestana of ['/', '/categorias', '/productos', '/inventario', '/prediccion']) {
      expect(rutas).not.toContain(pestana);
    }
  });
});

function Emisor() {
  const avisar = useAviso();
  const navegar = useNavigate();
  return (
    <>
      <button type="button" onClick={() => avisar('Producto guardado')}>
        guardar
      </button>
      <button
        type="button"
        onClick={() => {
          avisar('Categoría guardada');
          navegar('/otra');
        }}
      >
        guardar e ir
      </button>
    </>
  );
}

function montarAvisos() {
  render(
    <AvisosProvider>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<Emisor />} />
          <Route path="/otra" element={<p>Otra pantalla</p>} />
        </Routes>
      </MemoryRouter>
    </AvisosProvider>,
  );
}

describe('Avisos de éxito (región viva)', () => {
  it('AV01: la región viva existe antes del aviso, es educada y atómica', () => {
    montarAvisos();
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-atomic', 'true');
    expect(region).toBeEmptyDOMElement();
  });

  it('AV02: el aviso se anuncia dentro de la región ya montada', async () => {
    montarAvisos();
    const region = screen.getByRole('status');
    await userEvent.click(screen.getByRole('button', { name: 'guardar' }));
    expect(screen.getByRole('status')).toBe(region);
    expect(within(region).getByText('Producto guardado')).toBeInTheDocument();
  });

  it('AV03: no se pierde al cambiar de pantalla y no se duplica', async () => {
    montarAvisos();
    await userEvent.click(screen.getByRole('button', { name: 'guardar e ir' }));
    expect(screen.getByText('Otra pantalla')).toBeInTheDocument();
    expect(screen.getAllByText('Categoría guardada')).toHaveLength(1);
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('AV04: un segundo aviso igual se vuelve a anunciar (nuevo nodo) y se puede cerrar', async () => {
    montarAvisos();
    await userEvent.click(screen.getByRole('button', { name: 'guardar' }));
    const primero = screen.getByText('Producto guardado');
    await userEvent.click(screen.getByRole('button', { name: 'guardar' }));
    const segundo = screen.getByText('Producto guardado');
    expect(segundo).not.toBe(primero);
    expect(screen.getAllByText('Producto guardado')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }));
    expect(screen.queryByText('Producto guardado')).not.toBeInTheDocument();
  });

  it('AV05: el aviso desaparece solo pasados unos segundos', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      montarAvisos();
      await userEvent.click(screen.getByRole('button', { name: 'guardar' }));
      expect(screen.getByText('Producto guardado')).toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(8500);
      });
      expect(screen.queryByText('Producto guardado')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
