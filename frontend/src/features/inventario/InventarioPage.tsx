import { Package, Sliders } from '@phosphor-icons/react';
import { Link, useLocation } from 'react-router-dom';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { IconBadge } from '../../components/ui/IconBadge';
import { ListSkeleton } from '../../components/ui/ListSkeleton';
import { Notice } from '../../components/ui/Notice';
import { useProductos } from '../productos/hooks';
import { StockTag } from '../productos/StockTag';

export function InventarioPage() {
  const productos = useProductos();
  const aviso = ((useLocation().state ?? {}) as { aviso?: string }).aviso;

  let lista;
  if (productos.isPending) {
    lista = <ListSkeleton />;
  } else if (productos.isError) {
    lista = <ErrorState onReintentar={() => void productos.refetch()} />;
  } else if (productos.data.datos.length === 0) {
    lista = (
      <EmptyState
        icono={<Package size={26} weight="bold" />}
        titulo="Aún no hay productos"
        accion={
          <Link to="/productos/nuevo" className="btn btn-primary">
            Crear producto
          </Link>
        }
      />
    );
  } else {
    lista = (
      <section className="page" aria-labelledby="stock-actual">
        <h2 id="stock-actual" className="seccion-titulo">
          Stock actual
        </h2>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
          {productos.data.datos.map((p) => (
            <li key={p.id} className="list-row">
              <IconBadge icono={p.categoria.icono} />
              <span className="list-row-main list-row-title">{p.nombre}</span>
              <StockTag stock={p.stock} nivel={p.nivelStock} />
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <>
      <ScreenHeader titulo="Inventario" />
      {aviso && (
        <div className="page" style={{ paddingBottom: 12 }}>
          <Notice>{aviso}</Notice>
        </div>
      )}
      <div className="page" style={{ flexDirection: 'row', paddingBottom: 20 }}>
        <Link to="/inventario/compra" className="accion-tarjeta">
          <Package size={22} weight="bold" aria-hidden="true" />
          <span>Registrar compra</span>
        </Link>
        <Link to="/inventario/ajuste" className="accion-tarjeta">
          <Sliders size={22} weight="bold" aria-hidden="true" />
          <span>Ajustar stock manual</span>
        </Link>
      </div>
      {lista}
    </>
  );
}
