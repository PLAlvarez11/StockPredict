import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { simularApi } from '../../test/mockFetch';
import { SubcategoriaFormPage } from './SubcategoriaFormPage';
import { CategoriasPage } from '../categorias/CategoriasPage';

const categoria = {
  id: 1,
  nombre: 'Ropa',
  icono: 't-shirt',
  estado: true,
  totalSubcategorias: 2,
  totalProductos: 3,
};
const sub = (id: number, nombre: string, iconoPropio: string | null, totalProductos: number) => ({
  id,
  categoriaId: 1,
  categoriaNombre: 'Ropa',
  nombre,
  icono: iconoPropio ?? 't-shirt',
  iconoPropio,
  estado: true,
  totalProductos,
});

function montar(ruta: string) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/categorias" element={<CategoriasPage />} />
          <Route path="/categorias/:id/subcategorias/nueva" element={<SubcategoriaFormPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Subcategorías', () => {
  it('lista las subcategorías con su conteo e indica cuáles heredan el ícono de la categoría', async () => {
    simularApi({
      'GET /categorias': [categoria],
      'GET /subcategorias': [sub(10, 'Blusas', null, 2), sub(11, 'Vestidos', 'dress', 1)],
    });
    montar('/categorias');
    await userEvent.click(await screen.findByRole('button', { name: 'Subcategorías de Ropa' }));
    expect(await screen.findByText('Blusas')).toBeInTheDocument();
    expect(screen.getByText('2 productos', { exact: false })).toBeInTheDocument();
    expect(screen.getAllByText(/ícono heredado/)).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Subcategorías de Ropa' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('las subcategorías están ocultas hasta abrir la categoría y se pueden volver a ocultar', async () => {
    simularApi({
      'GET /categorias': [categoria],
      'GET /subcategorias': [sub(10, 'Blusas', null, 2)],
    });
    montar('/categorias');
    const alternar = await screen.findByRole('button', { name: 'Subcategorías de Ropa' });
    expect(alternar).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Blusas')).not.toBeInTheDocument();
    await userEvent.click(alternar);
    expect(await screen.findByText('Blusas')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Agregar subcategoría/ })).toBeInTheDocument();
    await userEvent.click(alternar);
    expect(screen.queryByText('Blusas')).not.toBeInTheDocument();
  });

  it('desactivar una categoría pide confirmación y avisa que no se borra nada', async () => {
    const llamadas = simularApi({
      'GET /categorias': [categoria],
      'DELETE /categorias/1': { __estado: 204, cuerpo: null },
    });
    montar('/categorias');
    await userEvent.click(await screen.findByRole('button', { name: 'Desactivar Ropa' }));
    const confirmacion = await screen.findByRole('dialog');
    expect(within(confirmacion).getByText(/No se borra nada/)).toBeInTheDocument();
    expect(llamadas.some((l) => l.metodo === 'DELETE')).toBe(false);
    await userEvent.click(within(confirmacion).getByRole('button', { name: 'Desactivar' }));
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'DELETE')).toBe(true));
  });

  it('desactivar pide confirmación y muestra el mensaje del servidor si tiene productos activos', async () => {
    const llamadas = simularApi({
      'GET /categorias': [categoria],
      'GET /subcategorias': [sub(10, 'Blusas', null, 2)],
      'DELETE /subcategorias/10': {
        __estado: 409,
        cuerpo: {
          code: 'SUBCATEGORY_HAS_ACTIVE_PRODUCTS',
          detail: 'Tiene 2 productos activos. Desactívalos o muévelos primero.',
        },
      },
    });
    montar('/categorias');
    await userEvent.click(await screen.findByRole('button', { name: 'Subcategorías de Ropa' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Desactivar Blusas' }));
    const confirmacion = await screen.findByRole('dialog');
    expect(llamadas.some((l) => l.metodo === 'DELETE')).toBe(false);
    await userEvent.click(within(confirmacion).getByRole('button', { name: 'Desactivar' }));
    expect(await screen.findByText(/Tiene 2 productos activos/)).toBeInTheDocument();
  });

  it('al crear, la opción "Mismo ícono de la categoría" viene elegida y se envía sin ícono propio', async () => {
    const llamadas = simularApi({
      'GET /categorias': [categoria],
      'GET /subcategorias': [],
      'POST /subcategorias': sub(12, 'Pantalones', null, 0),
    });
    montar('/categorias/1/subcategorias/nueva');
    await userEvent.type(await screen.findByLabelText('Nombre de la subcategoría'), 'Pantalones');
    expect(screen.getByLabelText('Mismo ícono de la categoría')).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'POST')).toBe(true));
    expect(llamadas.find((l) => l.metodo === 'POST')).toMatchObject({
      ruta: '/subcategorias',
      cuerpo: { categoriaId: 1, nombre: 'Pantalones', icono: null },
    });
  });

  it('al elegir un ícono propio se envía ese ícono', async () => {
    const llamadas = simularApi({
      'GET /categorias': [categoria],
      'GET /subcategorias': [],
      'POST /subcategorias': sub(12, 'Vestidos', 'dress', 0),
    });
    montar('/categorias/1/subcategorias/nueva');
    await userEvent.type(await screen.findByLabelText('Nombre de la subcategoría'), 'Vestidos');
    await userEvent.click(screen.getByLabelText('Vestido'));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'POST')).toBe(true));
    expect(llamadas.find((l) => l.metodo === 'POST')?.cuerpo).toMatchObject({ icono: 'dress' });
  });
});
