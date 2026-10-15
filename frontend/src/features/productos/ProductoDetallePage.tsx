import { ImageSquare, PencilSimple, Sliders } from '@phosphor-icons/react';
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Field } from '../../components/ui/Field';
import { ListSkeleton } from '../../components/ui/ListSkeleton';
import { Notice } from '../../components/ui/Notice';
import { Switch } from '../../components/ui/Switch';
import { ApiError } from '../../lib/apiClient';
import { useTitulo } from '../../lib/useTitulo';
import { type Producto } from './api';
import { GraficaCompras } from './GraficaCompras';
import { useCompras } from './comprasApi';
import { useProducto } from './hooks';
import { StockTag } from './StockTag';
import { useCambioEstado } from './useCambioEstado';

function Compras({ id }: { id: number }) {
  const compras = useCompras(id);
  if (compras.isPending) return <div className="skeleton" style={{ height: 180 }} />;
  if (compras.isError) return <ErrorState onReintentar={() => void compras.refetch()} />;
  return <GraficaCompras compras={compras.data} idProducto={id} />;
}

function Detalle({ producto }: { producto: Producto }) {
  const estado = (useLocation().state ?? {}) as { aviso?: string };
  const [aviso, setAviso] = useState<string | undefined>(estado.aviso);
  const { pedirDesactivar, pedirActivar, dialogos } = useCambioEstado(setAviso);

  return (
    <div className="page" style={{ gap: 18 }}>
      {aviso && <Notice>{aviso}</Notice>}
      <div className="detalle-cabecera">
        <div className="detalle-imagen" role="img" aria-label="Imagen del producto: próximamente">
          <ImageSquare size={30} aria-hidden="true" />
        </div>
        <div className="detalle-meta">
          <span className={producto.estado ? 'tag tag-ok' : 'tag tag-inactivo'}>
            {producto.estado ? 'Activo' : 'Inactivo'}
          </span>
          <span>
            {producto.categoria.nombre} · {producto.subcategoria.nombre}
          </span>
        </div>
      </div>

      <dl className="detalle-datos">
        <div className="detalle-dato detalle-dato-ancho">
          <dt>Nombre</dt>
          <dd>{producto.nombre}</dd>
        </div>
        <div className="detalle-dato detalle-dato-ancho">
          <dt>Descripción</dt>
          <dd>{producto.descripcion ?? 'Sin descripción'}</dd>
        </div>
        <div className="detalle-dato">
          <dt>Categoría</dt>
          <dd>{producto.categoria.nombre}</dd>
        </div>
        <div className="detalle-dato">
          <dt>Subcategoría</dt>
          <dd>{producto.subcategoria.nombre}</dd>
        </div>
        <div className="detalle-dato detalle-dato-ancho">
          <dt>Stock actual</dt>
          <dd className="detalle-stock">
            <StockTag stock={producto.stock} nivel={producto.nivelStock} />
            {producto.estado ? (
              <Link
                to={`/inventario/ajuste?productoId=${producto.id}`}
                className="btn btn-secondary"
              >
                <Sliders size={16} aria-hidden="true" />
                Ajustar stock
              </Link>
            ) : (
              <span className="list-row-sub">Activa el producto para ajustar su stock</span>
            )}
          </dd>
        </div>
      </dl>

      <Field etiqueta="Precio" placeholder="Próximamente" disabled readOnly value="" />

      <Switch
        etiqueta="Producto activo"
        checked={producto.estado}
        onChange={() => (producto.estado ? pedirDesactivar(producto) : pedirActivar(producto))}
      />

      <Compras id={producto.id} />

      <Link to={`/productos/${producto.id}/editar`} className="btn btn-primary btn-block">
        <PencilSimple size={18} aria-hidden="true" />
        Editar producto
      </Link>
      {dialogos}
    </div>
  );
}

export function ProductoDetallePage() {
  const { id } = useParams();
  const numero = Number(id);
  const producto = useProducto(Number.isInteger(numero) && numero > 0 ? numero : null);
  useTitulo(producto.data ? producto.data.nombre : 'Detalle del producto');

  let contenido;
  if (!Number.isInteger(numero) || numero <= 0) {
    contenido = <NoEncontrado />;
  } else if (producto.isPending) {
    contenido = <ListSkeleton filas={4} />;
  } else if (producto.isError) {
    const noExiste =
      producto.error instanceof ApiError &&
      (producto.error.status === 404 || producto.error.status === 422);
    contenido = noExiste ? (
      <NoEncontrado />
    ) : (
      <ErrorState onReintentar={() => void producto.refetch()} />
    );
  } else {
    contenido = <Detalle producto={producto.data} />;
  }

  return (
    <>
      <ScreenHeader titulo="Detalle del producto" atras="/productos" />
      {contenido}
    </>
  );
}

function NoEncontrado() {
  return (
    <EmptyState
      icono={<span aria-hidden="true">?</span>}
      titulo="No encontramos este producto"
      texto="Puede que ya no exista o que el enlace no sea correcto."
      accion={
        <Link to="/productos" className="btn btn-primary">
          Volver a productos
        </Link>
      }
    />
  );
}
