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

const siguiente = () => userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
const atras = () => userEvent.click(screen.getByRole('button', { name: 'Atrás' }));

async function paso1(nombre = 'Blusa floral', categoriaId = '1') {
  await userEvent.type(await screen.findByLabelText('Nombre del producto'), nombre);
  await userEvent.selectOptions(screen.getByLabelText('Categoría'), categoriaId);
  await siguiente();
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ProductoFormPage como asistente de 4 pasos', () => {
  it('empieza en el paso 1 de 4 con nombre y categoría', async () => {
    simularApi(respuestas);
    montar();
    expect(await screen.findByText('Paso 1 de 4')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre del producto')).toBeInTheDocument();
    expect(screen.getByLabelText('Categoría')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Atrás' })).not.toBeInTheDocument();
  });

  it('valida cada paso antes de avanzar', async () => {
    const llamadas = simularApi(respuestas);
    montar();
    await screen.findByLabelText('Nombre del producto');
    await siguiente();
    expect(await screen.findByText('Ingresa el nombre del producto.')).toBeInTheDocument();
    expect(screen.getByText('Elige una categoría.')).toBeInTheDocument();
    expect(screen.getByText('Paso 1 de 4')).toBeInTheDocument();

    await paso1();
    expect(await screen.findByText('Paso 2 de 4')).toBeInTheDocument();
    await siguiente();
    expect(await screen.findByText('Elige una subcategoría.')).toBeInTheDocument();
    expect(screen.getByText('Paso 2 de 4')).toBeInTheDocument();
    expect(llamadas.some((l) => l.metodo === 'POST')).toBe(false);
  });

  it('la subcategoría depende de la categoría: solo se ofrecen las de la categoría elegida', async () => {
    simularApi(respuestas);
    montar();
    await paso1();
    expect(await screen.findByLabelText('Blusas')).toBeInTheDocument();
    expect(screen.getByLabelText('Pantalones')).toBeInTheDocument();
    expect(screen.queryByLabelText('Totes')).not.toBeInTheDocument();
    expect(screen.getByText('Blusa floral', { selector: 'strong' })).toBeInTheDocument();
  });

  it('al volver no se pierde lo escrito', async () => {
    simularApi(respuestas);
    montar();
    await paso1();
    await userEvent.click(await screen.findByLabelText('Pantalones'));
    await siguiente();
    await userEvent.type(await screen.findByLabelText('Descripción (opcional)'), 'Manga corta');
    await atras();
    expect(await screen.findByLabelText('Pantalones')).toBeChecked();
    await atras();
    expect(screen.getByLabelText('Nombre del producto')).toHaveValue('Blusa floral');
    expect(screen.getByLabelText('Categoría')).toHaveValue('1');
    await siguiente();
    await siguiente();
    expect(await screen.findByLabelText('Descripción (opcional)')).toHaveValue('Manga corta');
  });

  it('al cambiar de categoría se limpia la subcategoría elegida', async () => {
    simularApi(respuestas);
    montar();
    await paso1();
    await userEvent.click(await screen.findByLabelText('Blusas'));
    await atras();
    await userEvent.selectOptions(screen.getByLabelText('Categoría'), '2');
    await siguiente();
    expect(await screen.findByLabelText('Totes')).not.toBeChecked();
  });

  it('muestra el contador de la descripción y limita a 500 caracteres', async () => {
    simularApi(respuestas);
    montar();
    await paso1();
    await userEvent.click(await screen.findByLabelText('Blusas'));
    await siguiente();
    const descripcion = await screen.findByLabelText('Descripción (opcional)');
    expect(descripcion).toHaveAttribute('maxlength', '500');
    await userEvent.type(descripcion, 'Algodón');
    expect(screen.getByText('7/500')).toBeInTheDocument();
  });

  it('el resumen muestra lo capturado y Guardar envía subcategoría, descripción y estado activo', async () => {
    const llamadas = simularApi(respuestas);
    montar();
    await paso1();
    await userEvent.click(await screen.findByLabelText('Blusas'));
    await siguiente();
    await userEvent.type(await screen.findByLabelText('Descripción (opcional)'), 'Manga corta');
    expect(screen.getByRole('switch', { name: 'Producto activo' })).toBeChecked();
    await siguiente();
    expect(await screen.findByText('Paso 4 de 4')).toBeInTheDocument();
    expect(screen.getByText('Ropa · Blusas')).toBeInTheDocument();
    expect(screen.getByText('Manga corta')).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Stock inicial'));
    await userEvent.type(screen.getByLabelText('Stock inicial'), '3');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(screen.getByText('Lista de productos')).toBeInTheDocument());
    expect(llamadas.filter((l) => l.metodo === 'POST')).toHaveLength(1);
    expect(llamadas.find((l) => l.metodo === 'POST')).toMatchObject({
      ruta: '/productos',
      cuerpo: {
        nombre: 'Blusa floral',
        subcategoriaId: 10,
        descripcion: 'Manga corta',
        estado: true,
        stockInicial: 3,
      },
    });
  });

  it('con el interruptor apagado el producto se crea desactivado', async () => {
    const llamadas = simularApi(respuestas);
    montar();
    await paso1();
    await userEvent.click(await screen.findByLabelText('Blusas'));
    await siguiente();
    await userEvent.click(await screen.findByRole('switch', { name: 'Producto activo' }));
    await siguiente();
    expect(await screen.findByText('Inactivo')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'POST')).toBe(true));
    expect(llamadas.find((l) => l.metodo === 'POST')?.cuerpo).toMatchObject({ estado: false });
  });

  it('un error del servidor en el nombre devuelve al paso 1', async () => {
    simularApi({
      ...respuestas,
      'POST /productos': {
        __estado: 409,
        cuerpo: {
          code: 'DUPLICATE_NAME',
          detail: 'Ya tienes un producto activo con ese nombre.',
          errors: [
            {
              field: 'nombre',
              code: 'DUPLICATE_NAME',
              message: 'Ya tienes un producto activo con ese nombre.',
            },
          ],
        },
      },
    });
    montar();
    await paso1();
    await userEvent.click(await screen.findByLabelText('Blusas'));
    await siguiente();
    await siguiente();
    await userEvent.click(await screen.findByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Paso 1 de 4')).toBeInTheDocument();
    expect(screen.getByText('Ya tienes un producto activo con ese nombre.')).toBeInTheDocument();
  });
});
