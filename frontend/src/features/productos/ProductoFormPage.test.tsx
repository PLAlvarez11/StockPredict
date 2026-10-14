import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { simularApi } from '../../test/mockFetch';
import { ProductoFormPage } from './ProductoFormPage';

const categoria = (id: number, nombre: string) => ({
  id,
  nombre,
  icono: 't-shirt',
  estado: true,
  totalSubcategorias: 1,
  totalProductos: 0,
});
const sub = (id: number, categoriaId: number, nombre: string) => ({
  id,
  categoriaId,
  categoriaNombre: 'x',
  nombre,
  icono: 't-shirt',
  iconoPropio: null,
  estado: true,
  totalProductos: 0,
});

const respuestas = {
  'GET /categorias': [categoria(1, 'Ropa'), categoria(2, 'Bolsos')],
  'GET /subcategorias?estado=activos&categoriaId=1': [
    sub(10, 1, 'Blusas'),
    sub(11, 1, 'Pantalones'),
  ],
  'GET /subcategorias?estado=activos&categoriaId=2': [sub(20, 2, 'Totes')],
  'POST /productos': { id: 99 },
};

function montar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={['/productos/nuevo']}>
        <Routes>
          <Route path="/productos/nuevo" element={<ProductoFormPage />} />
          <Route path="/productos" element={<p>Lista de productos</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ProductoFormPage con subcategorías', () => {
  it('la subcategoría depende de la categoría: primero se elige la categoría', async () => {
    simularApi(respuestas);
    montar();
    const subcategoria = await screen.findByLabelText('Subcategoría');
    expect(subcategoria).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText('Categoría'), '1');
    await waitFor(() => expect(screen.getByLabelText('Subcategoría')).toBeEnabled());
    expect(await screen.findByRole('option', { name: 'Blusas' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Pantalones' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Totes' })).not.toBeInTheDocument();
  });

  it('al cambiar de categoría se limpia la subcategoría elegida', async () => {
    simularApi(respuestas);
    montar();
    await userEvent.selectOptions(await screen.findByLabelText('Categoría'), '1');
    await userEvent.selectOptions(await screen.findByLabelText('Subcategoría'), '10');
    expect(screen.getByLabelText('Subcategoría')).toHaveValue('10');
    await userEvent.selectOptions(screen.getByLabelText('Categoría'), '2');
    await waitFor(() => expect(screen.getByLabelText('Subcategoría')).toHaveValue(''));
  });

  it('exige categoría y subcategoría antes de guardar', async () => {
    const llamadas = simularApi(respuestas);
    montar();
    await userEvent.type(await screen.findByLabelText('Nombre del producto'), 'Blusa floral');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Elige una categoría.')).toBeInTheDocument();
    expect(screen.getByText('Elige una subcategoría.')).toBeInTheDocument();
    expect(llamadas.some((l) => l.metodo === 'POST')).toBe(false);
  });

  it('muestra el contador de la descripción y limita a 500 caracteres', async () => {
    simularApi(respuestas);
    montar();
    const descripcion = await screen.findByLabelText('Descripción (opcional)');
    expect(descripcion).toHaveAttribute('maxlength', '500');
    await userEvent.type(descripcion, 'Algodón');
    expect(screen.getByText('7/500')).toBeInTheDocument();
  });

  it('envía la subcategoría y la descripción al guardar', async () => {
    const llamadas = simularApi(respuestas);
    montar();
    await userEvent.type(await screen.findByLabelText('Nombre del producto'), 'Blusa floral');
    await userEvent.selectOptions(screen.getByLabelText('Categoría'), '1');
    await userEvent.selectOptions(await screen.findByLabelText('Subcategoría'), '10');
    await userEvent.type(screen.getByLabelText('Descripción (opcional)'), 'Manga corta');
    await userEvent.clear(screen.getByLabelText('Stock inicial'));
    await userEvent.type(screen.getByLabelText('Stock inicial'), '3');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(screen.getByText('Lista de productos')).toBeInTheDocument());
    expect(llamadas.find((l) => l.metodo === 'POST')).toMatchObject({
      ruta: '/productos',
      cuerpo: {
        nombre: 'Blusa floral',
        subcategoriaId: 10,
        descripcion: 'Manga corta',
        stockInicial: 3,
      },
    });
  });
});
