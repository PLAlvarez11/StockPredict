import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { simularApi } from '../../test/mockFetch';
import { AjustePage } from '../inventario/AjustePage';
import { InventarioPage } from '../inventario/InventarioPage';
import { PrediccionCard } from '../prediccion/PrediccionCard';
import { GraficaCompras } from './GraficaCompras';
import { ProductoDetallePage } from './ProductoDetallePage';
import { ProductoFormPage } from './ProductoFormPage';
import { ProductosPage } from './ProductosPage';

const producto = (extra: object = {}) => ({
  id: 5,
  nombre: 'Base líquida cobertura media',
  descripcion: 'Cobertura media, acabado natural.',
  stock: 20,
  estado: true,
  nivelStock: 'ok',
  categoria: { id: 2, nombre: 'Maquillaje', icono: 'paint-brush' },
  subcategoria: { id: 20, nombre: 'Bases', icono: 'paint-brush' },
  ...extra,
});
const lista = (datos: unknown[]) => ({
  datos,
  total: datos.length,
  stockBajo: 0,
  page: 1,
  limit: 100,
});

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const semanas = (cantidades: number[]) =>
  cantidades.map((cantidad, i) => {
    const lunes = Date.UTC(2026, 6, 20) + i * 7 * 86_400_000;
    return {
      inicio: iso(lunes),
      fin: iso(lunes + 6 * 86_400_000),
      cantidad,
      enCurso: i === cantidades.length - 1,
    };
  });
const comprasCon = (cantidades: number[]) => {
  const datos = semanas(cantidades);
  const total = cantidades.reduce((a, b) => a + b, 0);
  const mayor = datos.reduce<(typeof datos)[number] | null>(
    (m, s) => (s.cantidad > 0 && (m === null || s.cantidad > m.cantidad) ? s : m),
    null,
  );
  return { semanas: datos, total, semanaMayor: mayor };
};
const CON_COMPRAS = comprasCon([0, 0, 8, 0, 0, 0, 0, 10, 0, 0, 0, 3]);
const SIN_COMPRAS = comprasCon(Array<number>(12).fill(0));

function montar(ruta: string) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/productos" element={<ProductosPage />} />
          <Route path="/productos/:id" element={<ProductoDetallePage />} />
          <Route path="/productos/:id/editar" element={<ProductoFormPage />} />
          <Route path="/inventario" element={<InventarioPage />} />
          <Route path="/inventario/ajuste" element={<AjustePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const base = {
  'GET /categorias': [
    {
      id: 2,
      nombre: 'Maquillaje',
      icono: 'paint-brush',
      estado: true,
      totalSubcategorias: 1,
      totalProductos: 1,
    },
  ],
  'GET /subcategorias': [
    {
      id: 20,
      categoriaId: 2,
      categoriaNombre: 'Maquillaje',
      nombre: 'Bases',
      icono: 'paint-brush',
      iconoPropio: null,
      estado: true,
      totalProductos: 1,
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Navegación al detalle', () => {
  it('PD01: el nombre del producto es un enlace al detalle en Productos, Inventario y Predicción', async () => {
    simularApi({ ...base, 'GET /productos': lista([producto()]) });
    montar('/productos');
    const enProductos = await screen.findByRole('link', { name: 'Base líquida cobertura media' });
    expect(enProductos).toHaveAttribute('href', '/productos/5');
  });

  it('PD01: Inventario enlaza al detalle', async () => {
    simularApi({ ...base, 'GET /productos': lista([producto()]) });
    montar('/inventario');
    expect(
      await screen.findByRole('link', { name: 'Base líquida cobertura media' }),
    ).toHaveAttribute('href', '/productos/5');
  });

  it('PD01: la tarjeta de Predicción enlaza al detalle', () => {
    render(
      <MemoryRouter>
        <PrediccionCard
          item={{
            producto: {
              id: 5,
              nombre: 'Base líquida cobertura media',
              categoria: { id: 2, nombre: 'Maquillaje', icono: 'paint-brush' },
              subcategoria: { id: 20, nombre: 'Bases', icono: 'paint-brush' },
            },
            stockActual: 20,
            estado: 'suficiente',
            semaforo: 'verde',
            origen: 'producto',
            necesidadPct: 0,
            stockSugerido: 3,
            cantidadAComprar: 0,
            calculo: null,
          }}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Base líquida cobertura media' })).toHaveAttribute(
      'href',
      '/productos/5',
    );
  });

  it('PD01: al tocar el nombre en la lista se abre la pantalla de detalle', async () => {
    simularApi({
      ...base,
      'GET /productos/5/compras': CON_COMPRAS,
      'GET /productos/5': producto(),
      'GET /productos': lista([producto()]),
    });
    montar('/productos');
    await userEvent.click(
      await screen.findByRole('link', { name: 'Base líquida cobertura media' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Detalle del producto' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Cobertura media, acabado natural.')).toBeInTheDocument();
  });
});

describe('Pantalla de detalle', () => {
  const respuestas = (extra: Record<string, unknown> = {}) => ({
    ...base,
    'GET /productos/5/compras': CON_COMPRAS,
    'GET /productos/5': producto(),
    ...extra,
  });

  it('PD02: muestra nombre, categoría, subcategoría, descripción, stock y estado', async () => {
    simularApi(respuestas());
    montar('/productos/5');
    expect(await screen.findByText('Base líquida cobertura media')).toBeInTheDocument();
    const datos = screen.getByText('Nombre').closest('dl');
    expect(datos).not.toBeNull();
    expect(
      within(datos as HTMLElement).getByText('Cobertura media, acabado natural.'),
    ).toBeInTheDocument();
    expect(within(datos as HTMLElement).getAllByText('Maquillaje').length).toBeGreaterThan(0);
    expect(within(datos as HTMLElement).getAllByText('Bases').length).toBeGreaterThan(0);
    expect(within(datos as HTMLElement).getByText('20 u.')).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
  });

  it('PD03: deja un espacio de imagen vacío y el precio deshabilitado con "Próximamente"', async () => {
    simularApi(respuestas());
    montar('/productos/5');
    expect(
      await screen.findByRole('img', { name: 'Imagen del producto: próximamente' }),
    ).toBeInTheDocument();
    const precio = screen.getByLabelText('Precio');
    expect(precio).toBeDisabled();
    expect(precio).toHaveAttribute('placeholder', 'Próximamente');
  });

  it('PD04: un producto inexistente o ajeno (404) muestra un mensaje amable', async () => {
    simularApi({
      ...base,
      'GET /productos/99': {
        __estado: 404,
        cuerpo: { code: 'NOT_FOUND', detail: 'El producto no existe.' },
      },
    });
    montar('/productos/99');
    expect(await screen.findByText('No encontramos este producto')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a productos' })).toHaveAttribute(
      'href',
      '/productos',
    );
  });

  it('PD04: un identificador que no es número también se muestra como no encontrado', async () => {
    simularApi(base);
    montar('/productos/abc');
    expect(await screen.findByText('No encontramos este producto')).toBeInTheDocument();
  });

  it('PD05: "Editar producto" abre el mismo asistente de edición', async () => {
    simularApi(respuestas());
    montar('/productos/5');
    expect(await screen.findByRole('link', { name: /Editar producto/ })).toHaveAttribute(
      'href',
      '/productos/5/editar',
    );
  });

  it('PD06: el stock no se edita aquí: se cambia con el ajuste manual, preseleccionando el producto', async () => {
    simularApi(respuestas());
    montar('/productos/5');
    const ajustar = await screen.findByRole('link', { name: /Ajustar stock/ });
    expect(ajustar).toHaveAttribute('href', '/inventario/ajuste?productoId=5');
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('PD06: un producto desactivado no ofrece ajustar stock', async () => {
    simularApi(respuestas({ 'GET /productos/5': producto({ estado: false }) }));
    montar('/productos/5');
    expect(await screen.findByText('Inactivo')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Ajustar stock/ })).not.toBeInTheDocument();
    expect(screen.getByText('Activa el producto para ajustar su stock')).toBeInTheDocument();
  });

  it('PD07: desactivar pide confirmación y solo entonces llama al servidor', async () => {
    const llamadas = simularApi(
      respuestas({ 'DELETE /productos/5': { __estado: 204, cuerpo: null } }),
    );
    montar('/productos/5');
    await userEvent.click(await screen.findByRole('switch', { name: 'Producto activo' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText(/Podrás activarlo de nuevo/)).toBeInTheDocument();
    expect(llamadas.some((l) => l.metodo === 'DELETE')).toBe(false);
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Desactivar' }));
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'DELETE')).toBe(true));
  });

  it('PD07: cancelar la confirmación no cambia nada', async () => {
    const llamadas = simularApi(respuestas());
    montar('/productos/5');
    await userEvent.click(await screen.findByRole('switch', { name: 'Producto activo' }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancelar' }),
    );
    expect(llamadas.some((l) => l.metodo === 'DELETE')).toBe(false);
    expect(screen.getByRole('switch', { name: 'Producto activo' })).toBeChecked();
  });

  it('PD07: activar un desactivado pide confirmación y llama a activar', async () => {
    const llamadas = simularApi(
      respuestas({
        'GET /productos/5': producto({ estado: false }),
        'POST /productos/5/activar': producto(),
      }),
    );
    montar('/productos/5');
    await userEvent.click(await screen.findByRole('switch', { name: 'Producto activo' }));
    const dialogo = await screen.findByRole('dialog');
    expect(llamadas.some((l) => l.ruta === '/productos/5/activar')).toBe(false);
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Activar' }));
    await waitFor(() => expect(llamadas.some((l) => l.ruta === '/productos/5/activar')).toBe(true));
  });

  it('PD08: la gráfica de compras con datos trae un resumen accesible y una tabla por semana', async () => {
    simularApi(respuestas());
    montar('/productos/5');
    const grafica = await screen.findByRole('img', { name: /Total comprado: 21 u\./ });
    expect(grafica).toHaveAccessibleName(/Semana de mayor compra: del .* 10 u\./);
    const tabla = screen.getByRole('table', { name: /Unidades compradas por semana/ });
    expect(within(tabla).getAllByRole('row')).toHaveLength(13);
    expect(within(tabla).getByText(/\(en curso\)/)).toBeInTheDocument();
  });

  it('PD09: sin compras muestra un estado vacío amigable con un enlace para registrar una', async () => {
    simularApi(respuestas({ 'GET /productos/5/compras': SIN_COMPRAS }));
    montar('/productos/5');
    expect(
      await screen.findByText(/Aún no hay compras registradas de este producto/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Total comprado/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Registrar compra/ })).toHaveAttribute(
      'href',
      '/inventario/compra?productoId=5',
    );
  });

  it('PD09: GraficaCompras con una sola semana con datos no falla', () => {
    render(
      <MemoryRouter>
        <GraficaCompras compras={comprasCon([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4])} idProducto={5} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('img', { name: /Total comprado: 4 u\./ })).toBeInTheDocument();
  });
});

describe('Edición desde el detalle', () => {
  it('PD10: un producto desactivado se puede editar con el mismo asistente y vuelve al detalle', async () => {
    const llamadas = simularApi({
      ...base,
      'GET /subcategorias?estado=activos&categoriaId=2': base['GET /subcategorias'],
      'PATCH /productos/5': producto({ estado: false, nombre: 'Base nueva' }),
      'GET /productos/5/compras': CON_COMPRAS,
      'GET /productos/5': producto({ estado: false }),
    });
    montar('/productos/5/editar');
    const nombre = await screen.findByLabelText('Nombre del producto');
    await userEvent.clear(nombre);
    await userEvent.type(nombre, 'Base nueva');
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Siguiente' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Siguiente' }));
    expect(await screen.findByText('Inactivo')).toBeInTheDocument();
    expect(screen.getByLabelText('Stock actual')).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'PATCH')).toBe(true));
    expect(llamadas.find((l) => l.metodo === 'PATCH')?.cuerpo).toEqual({
      nombre: 'Base nueva',
      subcategoriaId: 20,
      descripcion: 'Cobertura media, acabado natural.',
    });
    expect(
      await screen.findByRole('heading', { name: 'Detalle del producto' }),
    ).toBeInTheDocument();
  });
});

describe('Ajuste de stock desde el detalle', () => {
  it('PD11: el ajuste llega con el producto elegido y pide confirmación "de X a Y"', async () => {
    const llamadas = simularApi({
      ...base,
      'POST /inventario/ajustes': { stockActual: 7 },
      'GET /productos': lista([producto()]),
    });
    montar('/inventario/ajuste?productoId=5');
    const select = await screen.findByLabelText('Producto');
    await waitFor(() => expect(select).toHaveValue('5'));
    await userEvent.type(screen.getByLabelText(/stock/i, { selector: 'input' }), '7');
    await userEvent.click(screen.getByRole('button', { name: /Guardar|Ajustar/ }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText(/20/)).toBeInTheDocument();
    expect(llamadas.some((l) => l.metodo === 'POST')).toBe(false);
  });
});
