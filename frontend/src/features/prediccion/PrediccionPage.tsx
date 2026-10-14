import { ChartLineUp, ShoppingBag } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { ListSkeleton } from '../../components/ui/ListSkeleton';
import { formatearRangoSemanas } from '../../lib/formato';
import { prediccionApi } from './api';
import { PrediccionCard } from './PrediccionCard';
import { useTitulo } from '../../lib/useTitulo';

export const CLAVE_PREDICCION = ['prediccion'] as const;

export function PrediccionPage() {
  useTitulo('Predicción de compra');
  const prediccion = useQuery({
    queryKey: CLAVE_PREDICCION,
    queryFn: prediccionApi.obtener,
    staleTime: 0,
  });

  const datos = prediccion.data;
  const rango = datos ? formatearRangoSemanas(datos.semanasBase) : null;

  let contenido;
  if (prediccion.isPending) {
    contenido = <ListSkeleton filas={4} />;
  } else if (prediccion.isError) {
    contenido = <ErrorState onReintentar={() => void prediccion.refetch()} />;
  } else if (datos && datos.items.length === 0) {
    contenido = (
      <EmptyState
        icono={<ShoppingBag size={26} weight="bold" />}
        titulo="Aún no hay productos para predecir"
        texto="Crea tus productos y registra ventas para recibir sugerencias de compra."
        accion={
          <Link to="/productos/nuevo" className="btn btn-primary">
            Crear producto
          </Link>
        }
      />
    );
  } else if (datos) {
    contenido = (
      <div className="page" style={{ gap: 12, paddingTop: 20 }}>
        {datos.items.map((item) => (
          <PrediccionCard key={item.producto.id} item={item} />
        ))}
      </div>
    );
  }

  return (
    <>
      <header className="pred-hero">
        <div className="pred-hero-titulo">
          <ChartLineUp size={22} weight="bold" aria-hidden="true" />
          <h1>Predicción de compra</h1>
        </div>
        {datos && datos.totalActivos > 0 && (
          <p>
            {datos.totalAComprar} de {datos.totalActivos}{' '}
            {datos.totalActivos === 1 ? 'producto necesita' : 'productos necesitan'} reabastecerse
            esta semana.
          </p>
        )}
        {rango && (
          <p className="pred-hero-base">Basado en las 3 últimas semanas cerradas ({rango}).</p>
        )}
      </header>
      {contenido}
    </>
  );
}
