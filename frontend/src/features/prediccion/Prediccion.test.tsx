import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { simularApi } from '../../test/mockFetch';
import type { ItemPrediccion } from './api';
import { PrediccionPage } from './PrediccionPage';
import { SimuladorPage } from './SimuladorPage';

const categoria = (id: number, nombre: string) => ({
  id,
  nombre,
  icono: 't-shirt',
  estado: true,
  totalSubcategorias: 1,
  totalProductos: 1,
});
const sub = (id: number, nombre: string) => ({
  id,
  categoriaId: 1,
  categoriaNombre: 'Ropa',
  nombre,
  icono: 't-shirt',
  iconoPropio: null,
  estado: true,
  totalProductos: 1,
});

const calculo = (margenPorCiento: number, productosBase: number) => ({
  v1: 8,
  v2: 6,
  v3: 5,
  ponderado: 6.8,
  factorTendencia: 1.33,
  factorAjustado: 1.17,
  stockAjustado: 7.93,
  margen: margenPorCiento / 100,
  margenPorCiento,
  stockSugerido: 10,
  cantidadAComprar: 7,
  productosBase,
});

const item = (
  nombre: string,
  semaforo: ItemPrediccion['semaforo'],
  extra: Partial<ItemPrediccion> = {},
): ItemPrediccion => ({
  producto: {
    id: nombre.length,
    nombre,
    categoria: { id: 1, nombre: 'Ropa', icono: 't-shirt' },
    subcategoria: { id: 10, nombre: 'Blusas', icono: 't-shirt' },
  },
  stockActual: 3,
  estado: semaforo === 'rojo' ? 'comprar' : semaforo === 'verde' ? 'suficiente' : 'sin_historial',
  semaforo,
  origen: 'producto',
  necesidadPct: 70,
  stockSugerido: 10,
  cantidadAComprar: 7,
  calculo: calculo(20, 1),
  ...extra,
});

const respuesta = (items: ItemPrediccion[], totalFiltrados = items.length) => ({
  semanasBase: [],
  semanaActual: { inicio: '2026-10-12T06:00:00.000Z', fin: '2026-10-19T06:00:00.000Z' },
  totalActivos: 3,
  totalAComprar: 1,
  totalFiltrados,
  items,
});

const completa = respuesta([
  item('Blusa floral', 'rojo'),
  item('Vestido midi', 'verde', {
    necesidadPct: 0,
    cantidadAComprar: 0,
    stockSugerido: 4,
    stockActual: 15,
  }),
  item('Tote lona', 'ambar', {
    origen: null,
    necesidadPct: null,
    stockSugerido: null,
    cantidadAComprar: null,
    calculo: null,
  }),
]);

const base = {
  'GET /categorias': [categoria(1, 'Ropa'), categoria(2, 'Bolsos')],
  'GET /subcategorias': [sub(10, 'Blusas')],
};

function montar(pagina: React.ReactElement) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter>{pagina}</MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PrediccionPage v2', () => {
  it('PR16: el encabezado muestra cuántos productos reabastecer y la semana, y el botón de exportar está deshabilitado', async () => {
    simularApi({ ...base, 'GET /prediccion': completa });
    montar(<PrediccionPage />);
    expect(await screen.findByText(/1 de 3 productos para reabastecer/)).toHaveTextContent(
      'semana del 12 oct al 18 oct',
    );
    const exportar = screen.getByRole('button', { name: /Compartir \/ exportar lista/ });
    expect(exportar).toBeDisabled();
    expect(exportar).toHaveTextContent('Próximamente');
  });

  it('PR13: cada tarjeta muestra el porcentaje con una barra, y se respeta el orden del servidor', async () => {
    simularApi({ ...base, 'GET /prediccion': completa });
    montar(<PrediccionPage />);
    const titulos = await screen.findAllByRole('heading', { level: 2 });
    expect(titulos.map((t) => t.textContent)).toEqual([
      'Blusa floral',
      'Vestido midi',
      'Tote lona',
    ]);
    const barra = screen.getByRole('progressbar', { name: 'Necesidad de compra de Blusa floral' });
    expect(barra).toHaveAttribute('aria-valuenow', '70');
    expect(screen.getByText('70 %')).toBeInTheDocument();
    expect(screen.getByText('0 %')).toBeInTheDocument();
    expect(screen.getByText('Sin dato')).toBeInTheDocument();
    expect(screen.getAllByRole('progressbar')).toHaveLength(2);
  });

  it('PR17: "Ver cálculo" muestra el origen y el margen usado', async () => {
    simularApi({
      ...base,
      'GET /prediccion': respuesta([
        item('Blusa de lino', 'rojo', { origen: 'subcategoria', calculo: calculo(10, 2) }),
      ]),
    });
    montar(<PrediccionPage />);
    await userEvent.click(await screen.findByRole('button', { name: /Ver cálculo/ }));
    expect(screen.getByText('Respaldo por subcategoría')).toBeInTheDocument();
    expect(screen.getByText(/su subcategoría «Blusas» \(2 productos\)/)).toBeInTheDocument();
    expect(screen.getByText('× (1 + 10 %)')).toBeInTheDocument();
    expect(screen.getByText('10 %')).toBeInTheDocument();
  });

  it('PR17: con historial propio el cálculo dice historial propio y margen de 20 %', async () => {
    simularApi({ ...base, 'GET /prediccion': respuesta([item('Blusa floral', 'rojo')]) });
    montar(<PrediccionPage />);
    await userEvent.click(await screen.findByRole('button', { name: /Ver cálculo/ }));
    expect(screen.getByText('Historial propio')).toBeInTheDocument();
    expect(screen.getByText('× (1 + 20 %)')).toBeInTheDocument();
  });

  it('PR14: el buscador envía el texto al servidor', async () => {
    const llamadas = simularApi({ ...base, 'GET /prediccion': completa });
    montar(<PrediccionPage />);
    await userEvent.type(await screen.findByRole('searchbox'), 'floral');
    await waitFor(() => expect(llamadas.some((l) => l.ruta === '/prediccion?q=floral')).toBe(true));
  });

  it('PR14: los filtros de categoría, subcategoría y estado se envían al servidor', async () => {
    const llamadas = simularApi({ ...base, 'GET /prediccion': completa });
    montar(<PrediccionPage />);
    const categorias = await screen.findByRole('group', { name: 'Filtrar por categoría' });
    await userEvent.click(within(categorias).getByRole('button', { name: 'Ropa' }));
    await waitFor(() =>
      expect(llamadas.some((l) => l.ruta === '/prediccion?categoriaId=1')).toBe(true),
    );
    const subcategorias = await screen.findByRole('group', { name: 'Filtrar por subcategoría' });
    await userEvent.click(within(subcategorias).getByRole('button', { name: 'Blusas' }));
    await waitFor(() =>
      expect(llamadas.some((l) => l.ruta === '/prediccion?categoriaId=1&subcategoriaId=10')).toBe(
        true,
      ),
    );
    const estados = screen.getByRole('group', { name: 'Filtrar por estado' });
    expect(
      within(estados)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Todos', 'Rojo', 'Ámbar', 'Verde']);
    await userEvent.click(within(estados).getByRole('button', { name: 'Verde' }));
    await waitFor(() =>
      expect(
        llamadas.some((l) => l.ruta === '/prediccion?categoriaId=1&subcategoriaId=10&estado=verde'),
      ).toBe(true),
    );
    expect(within(estados).getByRole('button', { name: 'Verde' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('PR14: al cambiar de categoría se limpia la subcategoría elegida', async () => {
    const llamadas = simularApi({ ...base, 'GET /prediccion': completa });
    montar(<PrediccionPage />);
    const categorias = await screen.findByRole('group', { name: 'Filtrar por categoría' });
    await userEvent.click(within(categorias).getByRole('button', { name: 'Ropa' }));
    const subcategorias = await screen.findByRole('group', { name: 'Filtrar por subcategoría' });
    await userEvent.click(within(subcategorias).getByRole('button', { name: 'Blusas' }));
    await userEvent.click(within(categorias).getByRole('button', { name: 'Bolsos' }));
    await waitFor(() =>
      expect(llamadas.some((l) => l.ruta === '/prediccion?categoriaId=2')).toBe(true),
    );
  });

  it('PR14: sin resultados dice que no encontró productos y deja quitar los filtros', async () => {
    simularApi({ ...base, 'GET /prediccion': { ...respuesta([], 0) } });
    montar(<PrediccionPage />);
    expect(
      await screen.findByText('No encontramos productos con esos filtros'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar filtros' })).toBeInTheDocument();
  });
});

describe('SimuladorPage', () => {
  const resultado = (extra: object = {}) => ({
    nombre: null,
    categoria: { id: 1, nombre: 'Ropa' },
    subcategoria: { id: 10, nombre: 'Blusas' },
    stockActual: null,
    estado: 'estimado',
    origen: 'subcategoria',
    stockSugerido: 9,
    cantidadAComprar: null,
    necesidadPct: null,
    calculo: calculo(10, 1),
    ...extra,
  });

  it('SM11: aclara que es una simulación y pide elegir categoría antes de calcular', async () => {
    const llamadas = simularApi({ ...base, 'POST /prediccion/simulacion': resultado() });
    montar(<SimuladorPage />);
    expect(
      await screen.findByText(
        'Esto es una simulación. No se guarda ningún cambio en tu inventario.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Subcategoría (opcional)')).toBeDisabled();
    expect(screen.getByText('Elige una categoría para ver la estimación.')).toBeInTheDocument();
    expect(llamadas.some((l) => l.metodo === 'POST')).toBe(false);
  });

  it('SM12: al elegir categoría y subcategoría muestra el stock sugerido estimado y su cálculo', async () => {
    const llamadas = simularApi({ ...base, 'POST /prediccion/simulacion': resultado() });
    montar(<SimuladorPage />);
    await screen.findByLabelText('Categoría');
    await waitFor(() => expect(screen.getByRole('option', { name: 'Ropa' })).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText('Categoría'), '1');
    await waitFor(() => expect(screen.getByLabelText('Subcategoría (opcional)')).toBeEnabled());
    await userEvent.selectOptions(await screen.findByLabelText('Subcategoría (opcional)'), '10');
    expect(await screen.findByText('9 u.')).toBeInTheDocument();
    await waitFor(() =>
      expect(llamadas.filter((l) => l.metodo === 'POST').at(-1)?.cuerpo).toEqual({
        categoriaId: 1,
        subcategoriaId: 10,
      }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Ver cálculo' }));
    expect(screen.getByText('Respaldo por subcategoría')).toBeInTheDocument();
    expect(screen.getByText('× (1 + 10 %)')).toBeInTheDocument();
  });

  it('SM13: con stock actual indica cuánto comprar', async () => {
    simularApi({
      ...base,
      'POST /prediccion/simulacion': resultado({
        stockActual: 4,
        cantidadAComprar: 5,
        necesidadPct: 56,
      }),
    });
    montar(<SimuladorPage />);
    await waitFor(() => expect(screen.getByRole('option', { name: 'Ropa' })).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText('Categoría'), '1');
    await userEvent.type(screen.getByLabelText('Stock actual (opcional)'), '4');
    expect(await screen.findByText(/habría que comprar/)).toHaveTextContent('5 u.');
    expect(screen.getByText(/56 % del sugerido/)).toBeInTheDocument();
  });

  it('SM14: sin historial lo dice en lugar de inventar un valor', async () => {
    simularApi({
      ...base,
      'POST /prediccion/simulacion': resultado({
        estado: 'sin_historial',
        origen: null,
        stockSugerido: null,
        calculo: null,
      }),
    });
    montar(<SimuladorPage />);
    await waitFor(() => expect(screen.getByRole('option', { name: 'Ropa' })).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText('Categoría'), '1');
    expect(await screen.findByText(/Sin historial suficiente/)).toBeInTheDocument();
  });
});
