import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { simularApi } from '../../test/mockFetch';
import { AjustePage } from './AjustePage';

const producto = {
  id: 1,
  nombre: 'Blusa floral',
  stock: 3,
  descripcion: null,
  estado: true,
  nivelStock: 'bajo',
  categoria: { id: 1, nombre: 'Ropa', icono: 't-shirt' },
  subcategoria: { id: 1, nombre: 'Blusas', icono: 't-shirt' },
};

const listado = { datos: [producto], total: 1, stockBajo: 1, page: 1, limit: 100 };

function montar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={['/inventario/ajuste']}>
        <Routes>
          <Route path="/inventario/ajuste" element={<AjustePage />} />
          <Route path="/inventario" element={<p>Inventario</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AjustePage', () => {
  it('A01: pide confirmación mostrando el stock anterior y el nuevo antes de guardar', async () => {
    const llamadas = simularApi({
      'GET /productos': listado,
      'POST /inventario/ajustes': { stockActual: 10 },
    });
    montar();
    await userEvent.selectOptions(await screen.findByLabelText('Producto'), '1');
    await userEvent.type(screen.getByLabelText('Nuevo stock'), '10');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText(/¿Cambiar el stock de «Blusa floral»\?/)).toBeInTheDocument();
    const dialogo = screen.getByRole('dialog');
    expect(within(dialogo).getByText('3 u.')).toBeInTheDocument();
    expect(within(dialogo).getByText('10 u.')).toBeInTheDocument();
    expect(llamadas.some((l) => l.metodo === 'POST')).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar ajuste' }));
    await waitFor(() => expect(screen.getByText('Inventario')).toBeInTheDocument());
    expect(llamadas.find((l) => l.metodo === 'POST')).toMatchObject({
      ruta: '/inventario/ajustes',
      cuerpo: { productoId: 1, cantidad: 10 },
    });
  });

  it('cancelar la confirmación no guarda nada', async () => {
    const llamadas = simularApi({ 'GET /productos': listado });
    montar();
    await userEvent.selectOptions(await screen.findByLabelText('Producto'), '1');
    await userEvent.type(screen.getByLabelText('Nuevo stock'), '8');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(llamadas.some((l) => l.metodo === 'POST')).toBe(false);
  });

  it('A03 y A04: valida producto, stock negativo y stock sin cambios sin llamar a la API', async () => {
    const llamadas = simularApi({ 'GET /productos': listado });
    montar();
    await screen.findByLabelText('Producto');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Elige un producto.')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Producto'), '1');
    await userEvent.type(screen.getByLabelText('Nuevo stock'), '-2');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('El stock no puede ser negativo.')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('Nuevo stock'));
    await userEvent.type(screen.getByLabelText('Nuevo stock'), '3');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('El stock ya es 3 u.')).toBeInTheDocument();
    expect(llamadas.some((l) => l.metodo === 'POST')).toBe(false);
  });
});
