import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { simularApi } from '../../test/mockFetch';
import { InicioPage } from './InicioPage';

const categoria = { id: 1, nombre: 'Ropa', icono: 't-shirt' };
const yo = { id: 1, nombre: 'Valesca', correo: 'v@ejemplo.com' };
const sinPrediccion = { semanasBase: [], totalActivos: 0, totalAComprar: 0, items: [] };
const listado = (total: number, stockBajo: number) => ({
  datos: [],
  total,
  stockBajo,
  page: 1,
  limit: 100,
});

function montar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter>
        <InicioPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('InicioPage', () => {
  it('RF27: saluda a la usuaria por su nombre', async () => {
    simularApi({
      'GET /auth/me': yo,
      'GET /productos': listado(0, 0),
      'GET /prediccion': sinPrediccion,
    });
    montar();
    expect(await screen.findByRole('heading', { name: 'Valesca' })).toBeInTheDocument();
    expect(screen.getByText('Hola,')).toBeInTheDocument();
  });

  it('RF28: muestra productos activos y stock bajo que informa el servidor', async () => {
    simularApi({
      'GET /auth/me': yo,
      'GET /productos': listado(14, 5),
      'GET /prediccion': sinPrediccion,
    });
    montar();
    const resumen = await screen.findByRole('region', { name: 'Resumen del inventario' });
    expect(await within(resumen).findByText('14')).toBeInTheDocument();
    expect(within(resumen).getByText('5')).toBeInTheDocument();
    expect(within(resumen).getByText('Stock bajo')).toBeInTheDocument();
  });

  it('RF29: los atajos no repiten las pestañas de la barra de navegación', async () => {
    simularApi({
      'GET /auth/me': yo,
      'GET /productos': listado(0, 0),
      'GET /prediccion': sinPrediccion,
    });
    montar();
    const atajos = await screen.findByRole('navigation', { name: 'Accesos rápidos' });
    const rutas = within(atajos)
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'));
    expect(rutas).toEqual([
      '/productos/nuevo',
      '/categorias/nueva',
      '/inventario/compra',
      '/inventario/ajuste',
      '/simulador',
    ]);
    const pestanas = ['/', '/categorias', '/productos', '/inventario', '/prediccion'];
    for (const ruta of rutas) expect(pestanas).not.toContain(ruta);
  });

  it('PD01: reutiliza la predicción (con el nombre como enlace al detalle): lista lo que hay que comprar y cuántos de cuántos', async () => {
    simularApi({
      'GET /auth/me': yo,
      'GET /productos': listado(2, 1),
      'GET /prediccion': {
        semanasBase: [],
        totalActivos: 2,
        totalAComprar: 1,
        items: [
          {
            producto: { id: 1, nombre: 'Blusa floral', categoria, subcategoria: categoria },
            stockActual: 3,
            estado: 'comprar',
            origen: 'producto',
            stockSugerido: 10,
            cantidadAComprar: 7,
            calculo: null,
          },
          {
            producto: { id: 2, nombre: 'Vestido', categoria, subcategoria: categoria },
            stockActual: 15,
            estado: 'suficiente',
            origen: 'producto',
            stockSugerido: 7,
            cantidadAComprar: 0,
            calculo: null,
          },
        ],
      },
    });
    montar();
    const seccion = await screen.findByRole('region', { name: 'Para comprar esta semana' });
    expect(within(seccion).getByText('1 de 2')).toBeInTheDocument();
    expect(within(seccion).getByRole('link', { name: 'Blusa floral' })).toHaveAttribute(
      'href',
      '/productos/1',
    );
    expect(within(seccion).getByText('7 u.')).toBeInTheDocument();
    expect(within(seccion).queryByText('Vestido')).not.toBeInTheDocument();
  });
});
