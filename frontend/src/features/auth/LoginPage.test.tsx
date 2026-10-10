import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';

function montar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<p>Panel</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LoginPage', () => {
  it('muestra errores por campo sin llamar a la API cuando el formulario está vacío', async () => {
    const fetchFalso = vi.fn();
    vi.stubGlobal('fetch', fetchFalso);
    montar();
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByText('Ingresa tu correo electrónico.')).toBeInTheDocument();
    expect(screen.getByText('Ingresa tu contraseña.')).toBeInTheDocument();
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it('muestra el error genérico cuando las credenciales son incorrectas', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 'UNAUTHENTICATED',
            status: 401,
            detail: 'Correo o contraseña incorrectos.',
          }),
          { status: 401, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    );
    montar();
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'a@b.co');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'incorrecta1');
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos.');
  });

  it('navega al panel cuando el login es correcto', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ usuario: { id: 1, nombre: 'Valesca', correo: 'a@b.co' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    montar();
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'a@b.co');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'ClaveSegura1');
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    await waitFor(() => expect(screen.getByText('Panel')).toBeInTheDocument());
  });
});
