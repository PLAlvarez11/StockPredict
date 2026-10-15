import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Buscador } from '../components/ui/Buscador';
import { simularApi } from '../test/mockFetch';
import { CategoriasPage } from './categorias/CategoriasPage';
import { InventarioPage } from './inventario/InventarioPage';
import { ProductosPage } from './productos/ProductosPage';

const producto = (id: number, nombre: string) => ({
  id,
  nombre,
  descripcion: null,
  stock: 5,
  estado: true,
  nivelStock: 'ok',
  categoria: { id: 1, nombre: 'Ropa', icono: 't-shirt' },
  subcategoria: { id: 10, nombre: 'Blusas', icono: 't-shirt' },
});
const lista = (datos: unknown[], total = datos.length) => ({
  datos,
  total,
  stockBajo: 0,
  page: 1,
  limit: 100,
});
const categoria = (id: number, nombre: string) => ({
  id,
  nombre,
  icono: 't-shirt',
  estado: true,
  totalSubcategorias: 1,
  totalProductos: 1,
});
const subcategoria = (id: number, nombre: string) => ({
  id,
  categoriaId: 1,
  categoriaNombre: 'Ropa',
  nombre,
  icono: 't-shirt',
  iconoPropio: null,
  estado: true,
  totalProductos: 1,
});

const base = {
  'GET /categorias': [categoria(1, 'Ropa')],
  'GET /subcategorias': [subcategoria(10, 'Blusas')],
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

describe('Buscador (componente)', () => {
  it('BU12: tiene nombre accesible y el botón de limpiar solo aparece con texto', async () => {
    const cambios: string[] = [];
    const { rerender } = render(
      <Buscador etiqueta="Buscar producto" valor="" onCambio={(v) => cambios.push(v)} />,
    );
    expect(screen.getByRole('searchbox', { name: 'Buscar producto' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Limpiar búsqueda' })).not.toBeInTheDocument();
    rerender(
      <Buscador etiqueta="Buscar producto" valor="blusa" onCambio={(v) => cambios.push(v)} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));
    expect(cambios).toEqual(['']);
  });
});

describe('Buscador en Productos', () => {
  it('BU13: envía el texto al servidor, sin tildes ni mayúsculas lo resuelve el servidor', async () => {
    const llamadas = simularApi({
      ...base,
      'GET /productos?limit=100&estado=activos&q=camis%C3%B3n': lista([producto(1, 'Camisón')]),
      'GET /productos': lista([producto(1, 'Camisón'), producto(2, 'Blusa')]),
    });
    montar(<ProductosPage />);
    await userEvent.type(await screen.findByRole('searchbox'), 'camisón');
    await waitFor(() =>
      expect(
        llamadas.some(
          (l) => l.ruta === '/productos?limit=100&estado=activos&q=camis%C3%B3n&page=1',
        ),
      ).toBe(true),
    );
    expect(await screen.findByText('Camisón')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Blusa')).not.toBeInTheDocument());
  });

  it('BU14: sin resultados muestra un mensaje amable y el botón limpia la búsqueda', async () => {
    simularApi({
      ...base,
      'GET /productos?limit=100&estado=activos&q=zzz': lista([]),
      'GET /productos': lista([producto(1, 'Blusa')]),
    });
    montar(<ProductosPage />);
    const caja = await screen.findByRole('searchbox');
    await userEvent.type(caja, 'zzz');
    expect(await screen.findByText('No encontramos nada con esa búsqueda')).toBeInTheDocument();
    expect(screen.getByText(/No hay resultados para «zzz»/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Quitar búsqueda y filtros' }));
    expect(caja).toHaveValue('');
    expect(await screen.findByText('Blusa')).toBeInTheDocument();
  });

  it('BU15: el botón X limpia el texto y vuelve la lista completa', async () => {
    simularApi({
      ...base,
      'GET /productos?limit=100&estado=activos&q=blu': lista([producto(1, 'Blusa')]),
      'GET /productos': lista([producto(1, 'Blusa'), producto(2, 'Pantalón')]),
    });
    montar(<ProductosPage />);
    const caja = await screen.findByRole('searchbox');
    await userEvent.type(caja, 'blu');
    await waitFor(() => expect(screen.queryByText('Pantalón')).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));
    expect(await screen.findByText('Pantalón')).toBeInTheDocument();
  });

  it('BU16: con más de 100 productos muestra "Ver más" y pide la página siguiente', async () => {
    const llamadas = simularApi({
      ...base,
      'GET /productos?limit=100&estado=activos&page=2': {
        ...lista([producto(101, 'Producto 101')], 101),
        page: 2,
      },
      'GET /productos': lista(
        Array.from({ length: 100 }, (_, i) => producto(i + 1, `Producto ${i + 1}`)),
        101,
      ),
    });
    montar(<ProductosPage />);
    expect(await screen.findByText('Mostrando 100 de 101')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ver más' }));
    expect(await screen.findByText('Producto 101')).toBeInTheDocument();
    expect(llamadas.some((l) => l.ruta.endsWith('page=2'))).toBe(true);
    expect(screen.queryByRole('button', { name: 'Ver más' })).not.toBeInTheDocument();
  });

  it('BU17: el filtro de categoría y el texto se envían juntos', async () => {
    const llamadas = simularApi({ ...base, 'GET /productos': lista([producto(1, 'Blusa')]) });
    montar(<ProductosPage />);
    const grupo = await screen.findByRole('group', { name: 'Filtrar por categoría' });
    await userEvent.click(within(grupo).getByRole('button', { name: 'Ropa' }));
    await userEvent.type(screen.getByRole('searchbox'), 'blu');
    await waitFor(() =>
      expect(
        llamadas.some(
          (l) => l.ruta === '/productos?limit=100&estado=activos&categoriaId=1&q=blu&page=1',
        ),
      ).toBe(true),
    );
  });
});

describe('Buscador en Inventario', () => {
  it('BU18: busca por nombre, categoría o subcategoría y permite filtrar por categoría', async () => {
    const llamadas = simularApi({ ...base, 'GET /productos': lista([producto(1, 'Blusa')]) });
    montar(<InventarioPage />);
    await userEvent.type(await screen.findByRole('searchbox'), 'ropa');
    await waitFor(() =>
      expect(
        llamadas.some((l) => l.ruta === '/productos?limit=100&estado=activos&q=ropa&page=1'),
      ).toBe(true),
    );
    const grupo = screen.getByRole('group', { name: 'Filtrar por categoría' });
    await userEvent.click(within(grupo).getByRole('button', { name: 'Ropa' }));
    await waitFor(() =>
      expect(
        llamadas.some(
          (l) => l.ruta === '/productos?limit=100&estado=activos&categoriaId=1&q=ropa&page=1',
        ),
      ).toBe(true),
    );
  });

  it('BU19: sin resultados deja limpiar la búsqueda', async () => {
    simularApi({
      ...base,
      'GET /productos?limit=100&estado=activos&q=zzz': lista([]),
      'GET /productos': lista([producto(1, 'Blusa')]),
    });
    montar(<InventarioPage />);
    await userEvent.type(await screen.findByRole('searchbox'), 'zzz');
    await userEvent.click(await screen.findByRole('button', { name: 'Quitar búsqueda y filtros' }));
    expect(await screen.findByText('Blusa')).toBeInTheDocument();
  });
});

describe('Buscador en Categorías', () => {
  it('BU20: busca categorías y subcategorías: abre las categorías que coinciden y filtra sus subcategorías', async () => {
    const llamadas = simularApi({
      'GET /categorias?estado=activos&q=blusa': [categoria(1, 'Ropa')],
      'GET /categorias': [categoria(1, 'Ropa'), categoria(2, 'Bolsos')],
      'GET /subcategorias?estado=todos&categoriaId=1&q=blusa': [subcategoria(10, 'Blusas')],
      'GET /subcategorias': [],
    });
    montar(<CategoriasPage />);
    await userEvent.type(await screen.findByRole('searchbox'), 'blusa');
    expect(await screen.findByText('Blusas')).toBeInTheDocument();
    expect(screen.queryByText('Bolsos')).not.toBeInTheDocument();
    expect(llamadas.some((l) => l.ruta === '/categorias?estado=activos&q=blusa')).toBe(true);
    expect(screen.getByRole('button', { name: 'Subcategorías de Ropa' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('BU21: sin resultados muestra el mensaje amable y limpia la búsqueda', async () => {
    simularApi({
      'GET /categorias?estado=activos&q=zzz': [],
      'GET /categorias': [categoria(1, 'Ropa')],
      'GET /subcategorias': [],
    });
    montar(<CategoriasPage />);
    await userEvent.type(await screen.findByRole('searchbox'), 'zzz');
    expect(await screen.findByText('No encontramos nada con esa búsqueda')).toBeInTheDocument();
    const botones = screen.getAllByRole('button', { name: 'Limpiar búsqueda' });
    await userEvent.click(botones[botones.length - 1] as HTMLElement);
    expect(await screen.findByText('Ropa')).toBeInTheDocument();
  });
});
