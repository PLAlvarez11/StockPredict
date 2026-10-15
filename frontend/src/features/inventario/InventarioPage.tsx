import { Package, Sliders } from '@phosphor-icons/react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { Buscador } from '../../components/ui/Buscador';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { IconBadge } from '../../components/ui/IconBadge';
import { ListSkeleton } from '../../components/ui/ListSkeleton';
import { SinResultados } from '../../components/ui/SinResultados';
import { VerMas } from '../../components/ui/VerMas';
import { useBusqueda } from '../../lib/useBusqueda';
import { FiltrosCategoria } from '../categorias/FiltrosCategoria';
import { EnlaceProducto } from '../productos/EnlaceProducto';
import { useProductosPaginados } from '../productos/hooks';
import { StockTag } from '../productos/StockTag';

export function InventarioPage() {
  const [categoriaId, setCategoriaId] = useState<number | undefined>(undefined);
  const [subcategoriaId, setSubcategoriaId] = useState<number | undefined>(undefined);
  const busqueda = useBusqueda();
  const productos = useProductosPaginados({ categoriaId, subcategoriaId, q: busqueda.consulta });
  const hayFiltro = categoriaId !== undefined || subcategoriaId !== undefined || busqueda.activa;

  const elegirCategoria = (id: number | undefined) => {
    setCategoriaId(id);
    setSubcategoriaId(undefined);
  };
  const limpiar = () => {
    busqueda.limpiar();
    elegirCategoria(undefined);
  };

  let lista;
  if (productos.isPending) {
    lista = <ListSkeleton />;
  } else if (productos.isError) {
    lista = <ErrorState onReintentar={() => void productos.refetch()} />;
  } else if (productos.datos.length === 0 && hayFiltro) {
    lista = (
      <SinResultados
        busqueda={busqueda.consulta}
        onLimpiar={limpiar}
        etiquetaBoton="Quitar búsqueda y filtros"
      />
    );
  } else if (productos.datos.length === 0) {
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
          {productos.datos.map((p) => (
            <li key={p.id} className="list-row">
              <IconBadge icono={p.subcategoria.icono} />
              <span className="list-row-main list-row-title">
                <EnlaceProducto id={p.id} nombre={p.nombre} />
              </span>
              <StockTag stock={p.stock} nivel={p.nivelStock} />
            </li>
          ))}
        </ul>
        <VerMas
          mostrados={productos.datos.length}
          total={productos.total}
          hayMas={productos.hasNextPage}
          cargando={productos.isFetchingNextPage}
          onVerMas={() => void productos.fetchNextPage()}
        />
      </section>
    );
  }

  return (
    <>
      <ScreenHeader titulo="Inventario" />
      <div className="page" style={{ flexDirection: 'row', flexWrap: 'wrap', paddingBottom: 20 }}>
        <Link to="/inventario/compra" className="accion-tarjeta">
          <Package size={22} weight="bold" aria-hidden="true" />
          <span>Registrar compra</span>
        </Link>
        <Link to="/inventario/ajuste" className="accion-tarjeta">
          <Sliders size={22} weight="bold" aria-hidden="true" />
          <span>Ajustar stock manual</span>
        </Link>
      </div>
      <div className="page" style={{ paddingTop: 0, paddingBottom: 12 }}>
        <Buscador
          etiqueta="Buscar por nombre, categoría o subcategoría"
          valor={busqueda.texto}
          onCambio={busqueda.setTexto}
        />
      </div>
      <FiltrosCategoria
        categoriaId={categoriaId}
        subcategoriaId={subcategoriaId}
        onCategoria={elegirCategoria}
        onSubcategoria={setSubcategoriaId}
      />
      <div className="sr-only" role="status" aria-live="polite">
        {!productos.isPending && hayFiltro ? `${productos.total} productos encontrados` : ''}
      </div>
      {lista}
    </>
  );
}
