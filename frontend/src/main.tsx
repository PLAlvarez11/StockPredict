import '@fontsource-variable/inter';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './app/router';
import { CLAVE_SESION } from './features/auth/useSesion';
import { ApiError } from './lib/apiClient';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';

const sesionVencida = (error: unknown) => {
  if (error instanceof ApiError && error.status === 401 && error.code === 'UNAUTHENTICATED') {
    queryClient.setQueryData(CLAVE_SESION, null);
  }
};

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.queryKey[0] !== CLAVE_SESION[0]) sesionVencida(error);
    },
  }),
  mutationCache: new MutationCache({ onError: sesionVencida }),
  defaultOptions: { queries: { retry: false, staleTime: 30_000, refetchOnWindowFocus: false } },
});

const raiz = document.getElementById('root');
if (!raiz) throw new Error('No se encontró #root');

createRoot(raiz).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
