import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { simularApi } from '../../test/mockFetch';
import { AvisosProvider } from '../../components/layout/Avisos';
import { ProductosPage } from './ProductosPage';

const producto = (id: number, nombre: string, estado: boolean) => ({
  id,
  nombre,
  descripcion: null,
  stock: 3,
  estado,
  nivelStock: 'bajo',
  categoria: { id: 1, nombre: 'Ropa', icono: 't-shirt' },
  subcategoria: { id: 10, nombre: 'Blusas', icono: 't-shirt' },
});
const lista = (datos: unknown[]) => ({
  datos,
  total: datos.length,
  stockBajo: 0,
  page: 1,
  limit: 100,
});

function montar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={cliente}>
      <AvisosProvider>
        <MemoryRouter>
          <ProductosPage />
        </MemoryRouter>
      </AvisosProvider>
    </QueryClientProvider>,
  );
}

const base = {
  'GET /categorias': [
    {
      id: 1,
      nombre: 'Ropa',
      icono: 't-shirt',
      estado: true,
      totalSubcategorias: 1,
      totalProductos: 1,
    },
  ],
  'GET /subcategorias': [],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ProductosPage: activar y desactivar', () => {
  it('desactivar pide confirmación y solo entonces llama al servidor', async () => {
    const llamadas = simularApi({
      ...base,
      'GET /productos': lista([producto(1, 'Blusa floral', true)]),
      'DELETE /productos/1': { __estado: 204, cuerpo: null },
    });
    montar();
    await userEvent.click(await screen.findByRole('button', { name: 'Desactivar Blusa floral' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText(/¿Desactivar «Blusa floral»\?/)).toBeInTheDocument();
    expect(llamadas.some((l) => l.metodo === 'DELETE')).toBe(false);
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Desactivar' }));
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'DELETE')).toBe(true));
    expect(await screen.findByText('Producto desactivado')).toBeInTheDocument();
  });

  it('cancelar la confirmación no cambia nada', async () => {
    const llamadas = simularApi({
      ...base,
      'GET /productos': lista([producto(1, 'Blusa floral', true)]),
    });
    montar();
    await userEvent.click(await screen.findByRole('button', { name: 'Desactivar Blusa floral' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(llamadas.some((l) => l.metodo === 'DELETE')).toBe(false);
  });

  it('la pestaña Inactivos pide los inactivos y activar pide confirmación', async () => {
    const llamadas = simularApi({
      ...base,
      'GET /productos?limit=100&estado=activos': lista([producto(1, 'Blusa floral', true)]),
      'GET /productos?limit=100&estado=inactivos': lista([producto(2, 'Chaleco', false)]),
      'POST /productos/2/activar': producto(2, 'Chaleco', true),
    });
    montar();
    await userEvent.click(await screen.findByRole('button', { name: 'Inactivos' }));
    expect(await screen.findByText('Chaleco')).toBeInTheDocument();
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Activar Chaleco' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText(/¿Activar «Chaleco»\?/)).toBeInTheDocument();
    expect(llamadas.some((l) => l.metodo === 'POST')).toBe(false);
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Activar' }));
    await waitFor(() => expect(llamadas.some((l) => l.ruta === '/productos/2/activar')).toBe(true));
  });

  it('si el servidor rechaza la activación muestra su mensaje', async () => {
    simularApi({
      ...base,
      'GET /productos?limit=100&estado=activos': lista([]),
      'GET /productos?limit=100&estado=inactivos': lista([producto(2, 'Chaleco', false)]),
      'POST /productos/2/activar': {
        __estado: 422,
        cuerpo: {
          code: 'INACTIVE_RESOURCE',
          detail: 'La subcategoría «Blusas» está inactiva. Actívala primero.',
        },
      },
    });
    montar();
    await userEvent.click(await screen.findByRole('button', { name: 'Inactivos' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Activar Chaleco' }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Activar' }),
    );
    expect(await screen.findByText(/está inactiva\. Actívala primero/)).toBeInTheDocument();
  });
});
