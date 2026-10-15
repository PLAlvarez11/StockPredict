import {
  ArrowCounterClockwise,
  EyeSlash,
  PencilSimple,
  Plus,
  ShoppingBag,
} from '@phosphor-icons/react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAviso } from '../../components/layout/Avisos';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { Button } from '../../components/ui/Button';
import { Buscador } from '../../components/ui/Buscador';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { IconBadge } from '../../components/ui/IconBadge';
import { ListSkeleton } from '../../components/ui/ListSkeleton';
import { SinResultados } from '../../components/ui/SinResultados';
import { VerMas } from '../../components/ui/VerMas';
import { useBusqueda } from '../../lib/useBusqueda';
import { useCategorias } from '../categorias/hooks';
import { FiltrosCategoria } from '../categorias/FiltrosCategoria';
import { EnlaceProducto } from './EnlaceProducto';
import { useProductosPaginados } from './hooks';
import { StockTag } from './StockTag';
import { useCambioEstado } from './useCambioEstado';

export function ProductosPage() {
  const [inactivos, setInactivos] = useState(false);
  const [filtro, setFiltro] = useState<number | undefined>(undefined);
  const [filtroSub, setFiltroSub] = useState<number | undefined>(undefined);
  const busqueda = useBusqueda();
  const categorias = useCategorias();
  const productos = useProductosPaginados({
    categoriaId: filtro,
    subcategoriaId: filtroSub,
    estado: inactivos ? 'inactivos' : 'activos',
    q: busqueda.consulta,
  });
  const { pedirDesactivar, pedirActivar, dialogos } = useCambioEstado(useAviso());

  const elegirCategoria = (id: number | undefined) => {
    setFiltro(id);
    setFiltroSub(undefined);
  };
  const limpiar = () => {
    busqueda.limpiar();
    elegirCategoria(undefined);
  };

  const accion = (
    <Link to="/productos/nuevo" className="btn btn-primary btn-icon" aria-label="Nuevo producto">
      <Plus size={20} weight="bold" aria-hidden="true" />
    </Link>
  );

  const hayFiltro = filtro !== undefined || filtroSub !== undefined || busqueda.activa;
  const sinDatos = productos.datos.length === 0;

  let contenido;
  if (productos.isPending || categorias.isPending) {
    contenido = <ListSkeleton />;
  } else if (productos.isError || categorias.isError) {
    contenido = (
      <ErrorState
        onReintentar={() => {
          void productos.refetch();
          void categorias.refetch();
        }}
      />
    );
  } else if (sinDatos && hayFiltro) {
    contenido = (
      <SinResultados
        busqueda={busqueda.consulta}
        onLimpiar={limpiar}
        etiquetaBoton="Quitar búsqueda y filtros"
      />
    );
  } else if (sinDatos && inactivos) {
    contenido = (
      <EmptyState
        icono={<ShoppingBag size={26} weight="bold" />}
        titulo="No hay productos inactivos"
        texto="Los productos que desactives aparecerán aquí para que puedas activarlos de nuevo."
      />
    );
  } else if (sinDatos && categorias.data.length === 0) {
    contenido = (
      <EmptyState
        icono={<ShoppingBag size={26} weight="bold" />}
        titulo="Primero crea una categoría"
        texto="Cada producto pertenece a una subcategoría dentro de una categoría."
        accion={
          <Link to="/categorias/nueva" className="btn btn-primary">
            Crear categoría
          </Link>
        }
      />
    );
  } else if (sinDatos) {
    contenido = (
      <EmptyState
        icono={<ShoppingBag size={26} weight="bold" />}
        titulo="Aún no tienes productos"
        texto="Registra lo que vendes para llevar su stock."
        accion={
          <Link to="/productos/nuevo" className="btn btn-primary">
            Crear producto
          </Link>
        }
      />
    );
  } else {
    contenido = (
      <>
        <ul className="page" style={{ listStyle: 'none', margin: 0 }}>
          {productos.datos.map((p) => (
            <li key={p.id} className={p.estado ? 'list-row' : 'list-row list-row-inactiva'}>
              <IconBadge icono={p.subcategoria.icono} />
              <div className="list-row-main">
                <div className="list-row-title">
                  <EnlaceProducto id={p.id} nombre={p.nombre} />
                </div>
                <div className="list-row-sub">
                  {p.categoria.nombre} · {p.subcategoria.nombre}
                </div>
              </div>
              {p.estado ? (
                <>
                  <StockTag stock={p.stock} nivel={p.nivelStock} />
                  <Link
                    to={`/productos/${p.id}/editar`}
                    className="btn btn-secondary btn-icon"
                    aria-label={`Editar ${p.nombre}`}
                  >
                    <PencilSimple size={18} aria-hidden="true" />
                  </Link>
                  <Button
                    icono
                    aria-label={`Desactivar ${p.nombre}`}
                    onClick={() => pedirDesactivar(p)}
                  >
                    <EyeSlash size={18} aria-hidden="true" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="tag tag-inactivo">Inactivo</span>
                  <Button aria-label={`Activar ${p.nombre}`} onClick={() => pedirActivar(p)}>
                    <ArrowCounterClockwise size={16} aria-hidden="true" />
                    Activar
                  </Button>
                </>
              )}
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
      </>
    );
  }

  return (
    <>
      <ScreenHeader titulo="Productos" accion={accion} />
      <div className="page" style={{ paddingTop: 0, paddingBottom: 12 }}>
        <Buscador
          etiqueta="Buscar por nombre, categoría o subcategoría"
          valor={busqueda.texto}
          onCambio={busqueda.setTexto}
        />
      </div>
      <div className="segmento" role="group" aria-label="Estado de los productos">
        <Button
          variante={inactivos ? 'secondary' : 'primary'}
          aria-pressed={!inactivos}
          onClick={() => setInactivos(false)}
        >
          Activos
        </Button>
        <Button
          variante={inactivos ? 'primary' : 'secondary'}
          aria-pressed={inactivos}
          onClick={() => setInactivos(true)}
        >
          Inactivos
        </Button>
      </div>
      <FiltrosCategoria
        categoriaId={filtro}
        subcategoriaId={filtroSub}
        onCategoria={elegirCategoria}
        onSubcategoria={setFiltroSub}
      />
      <div className="sr-only" role="status" aria-live="polite">
        {!productos.isPending && hayFiltro ? `${productos.total} productos encontrados` : ''}
      </div>
      {contenido}

      {dialogos}
    </>
  );
}
