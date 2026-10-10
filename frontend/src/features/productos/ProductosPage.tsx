import { PencilSimple, Plus, ShoppingBag, Trash } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { IconBadge } from '../../components/ui/IconBadge';
import { ListSkeleton } from '../../components/ui/ListSkeleton';
import { Notice } from '../../components/ui/Notice';
import { ApiError } from '../../lib/apiClient';
import { CLAVE_CATEGORIAS, useCategorias } from '../categorias/hooks';
import { productosApi, type Producto } from './api';
import { CLAVE_PRODUCTOS, useProductos } from './hooks';
import { StockTag } from './StockTag';

export function ProductosPage() {
  const [filtro, setFiltro] = useState<number | undefined>(undefined);
  const categorias = useCategorias();
  const productos = useProductos(filtro);
  const cliente = useQueryClient();
  const estado = (useLocation().state ?? {}) as { aviso?: string };
  const [aviso, setAviso] = useState<string | undefined>(estado.aviso);
  const [candidato, setCandidato] = useState<Producto | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  const inactivar = useMutation({
    mutationFn: (id: number) => productosApi.inactivar(id),
    onSuccess: async () => {
      await cliente.invalidateQueries({ queryKey: CLAVE_PRODUCTOS });
      await cliente.invalidateQueries({ queryKey: CLAVE_CATEGORIAS });
      setCandidato(null);
      setAviso('Producto inactivado');
    },
    onError: (error) => {
      setCandidato(null);
      setFallo(error instanceof ApiError ? error.message : 'No se pudo inactivar el producto.');
    },
  });

  const accion = (
    <Link to="/productos/nuevo" className="btn btn-primary btn-icon" aria-label="Nuevo producto">
      <Plus size={20} weight="bold" aria-hidden="true" />
    </Link>
  );

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
  } else if (productos.data.datos.length === 0 && filtro !== undefined) {
    contenido = (
      <EmptyState
        icono={<ShoppingBag size={26} weight="bold" />}
        titulo="No hay productos en esta categoría"
        accion={<Button onClick={() => setFiltro(undefined)}>Ver todas las categorías</Button>}
      />
    );
  } else if (productos.data.datos.length === 0 && categorias.data.length === 0) {
    contenido = (
      <EmptyState
        icono={<ShoppingBag size={26} weight="bold" />}
        titulo="Primero crea una categoría"
        texto="Cada producto pertenece a una categoría."
        accion={
          <Link to="/categorias/nueva" className="btn btn-primary">
            Crear categoría
          </Link>
        }
      />
    );
  } else if (productos.data.datos.length === 0) {
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
      <ul className="page" style={{ listStyle: 'none', margin: 0 }}>
        {productos.data.datos.map((p) => (
          <li key={p.id} className="list-row">
            <IconBadge icono={p.categoria.icono} />
            <div className="list-row-main">
              <div className="list-row-title">{p.nombre}</div>
              <div className="list-row-sub">{p.categoria.nombre}</div>
            </div>
            <StockTag stock={p.stock} nivel={p.nivelStock} />
            <Link
              to={`/productos/${p.id}/editar`}
              className="btn btn-secondary btn-icon"
              aria-label={`Editar ${p.nombre}`}
            >
              <PencilSimple size={18} aria-hidden="true" />
            </Link>
            <Button icono aria-label={`Inactivar ${p.nombre}`} onClick={() => setCandidato(p)}>
              <Trash size={18} aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <ScreenHeader titulo="Productos" accion={accion} />
      {categorias.data && categorias.data.length > 0 && (
        <div className="chips" role="group" aria-label="Filtrar por categoría">
          <Button
            variante={filtro === undefined ? 'primary' : 'secondary'}
            aria-pressed={filtro === undefined}
            onClick={() => setFiltro(undefined)}
          >
            Todas
          </Button>
          {categorias.data.map((c) => (
            <Button
              key={c.id}
              variante={filtro === c.id ? 'primary' : 'secondary'}
              aria-pressed={filtro === c.id}
              onClick={() => setFiltro(c.id)}
            >
              {c.nombre}
            </Button>
          ))}
        </div>
      )}
      {aviso && (
        <div className="page" style={{ paddingBottom: 12 }}>
          <Notice>{aviso}</Notice>
        </div>
      )}
      {contenido}

      <Dialog
        abierto={candidato !== null}
        titulo={`¿Inactivar «${candidato?.nombre ?? ''}»?`}
        onCerrar={() => setCandidato(null)}
        acciones={
          <>
            <Button onClick={() => setCandidato(null)}>Cancelar</Button>
            <Button
              variante="danger"
              disabled={inactivar.isPending}
              onClick={() => candidato && inactivar.mutate(candidato.id)}
            >
              Inactivar
            </Button>
          </>
        }
      >
        Dejará de aparecer en las listas, en las ventas y en la predicción.
      </Dialog>

      <Dialog
        abierto={fallo !== null}
        titulo="No se pudo inactivar"
        onCerrar={() => setFallo(null)}
        acciones={
          <Button variante="primary" onClick={() => setFallo(null)}>
            Entendido
          </Button>
        }
      >
        {fallo}
      </Dialog>
    </>
  );
}
