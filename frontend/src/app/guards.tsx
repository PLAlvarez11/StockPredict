import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { useSesion } from '../features/auth/useSesion';

function Cargando() {
  return (
    <div className="app" aria-busy="true">
      <span className="sr-only" role="status">
        Cargando…
      </span>
      <div style={{ padding: 24, display: 'grid', gap: 12 }}>
        <div className="skeleton" style={{ height: 28, width: '45%' }} />
        <div className="skeleton" style={{ height: 64 }} />
        <div className="skeleton" style={{ height: 64 }} />
      </div>
    </div>
  );
}

export function RutaPrivada() {
  const sesion = useSesion();
  const ubicacion = useLocation();

  if (sesion.isPending) return <Cargando />;
  if (sesion.isError) {
    return (
      <div className="app">
        <EmptyState
          icono={<span aria-hidden="true">!</span>}
          titulo="No pudimos conectar"
          texto="Revisa tu conexión e inténtalo de nuevo."
          accion={
            <Button variante="primary" onClick={() => void sesion.refetch()}>
              Reintentar
            </Button>
          }
        />
      </div>
    );
  }
  if (!sesion.data) {
    const desde = ubicacion.pathname === '/' ? undefined : ubicacion.pathname + ubicacion.search;
    return <Navigate to="/login" replace state={desde ? { desde } : undefined} />;
  }
  return <Outlet />;
}

export function RutaPublica() {
  const sesion = useSesion();
  if (sesion.isPending) return <Cargando />;
  if (sesion.data) return <Navigate to="/" replace />;
  return <Outlet />;
}
