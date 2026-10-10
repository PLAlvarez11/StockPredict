import { PencilSimple, Plus, SquaresFour, Trash } from '@phosphor-icons/react';
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
import { categoriasApi, type Categoria } from './api';
import { CLAVE_CATEGORIAS, useCategorias } from './hooks';

export function CategoriasPage() {
  const categorias = useCategorias();
  const cliente = useQueryClient();
  const estado = (useLocation().state ?? {}) as { aviso?: string };
  const [aviso, setAviso] = useState<string | undefined>(estado.aviso);
  const [candidata, setCandidata] = useState<Categoria | null>(null);
  const [bloqueo, setBloqueo] = useState<string | null>(null);

  const inactivar = useMutation({
    mutationFn: (id: number) => categoriasApi.inactivar(id),
    onSuccess: async () => {
      await cliente.invalidateQueries({ queryKey: CLAVE_CATEGORIAS });
      setCandidata(null);
      setAviso('Categoría inactivada');
    },
    onError: (error) => {
      setCandidata(null);
      if (error instanceof ApiError && error.code === 'CATEGORY_HAS_ACTIVE_PRODUCTS') {
        setBloqueo(error.message);
      } else {
        setAviso(undefined);
        setBloqueo(
          error instanceof ApiError ? error.message : 'No se pudo inactivar la categoría.',
        );
      }
    },
  });

  const accion = (
    <Link to="/categorias/nueva" className="btn btn-primary btn-icon" aria-label="Nueva categoría">
      <Plus size={20} weight="bold" aria-hidden="true" />
    </Link>
  );

  let contenido;
  if (categorias.isPending) {
    contenido = <ListSkeleton />;
  } else if (categorias.isError) {
    contenido = <ErrorState onReintentar={() => void categorias.refetch()} />;
  } else if (categorias.data.length === 0) {
    contenido = (
      <EmptyState
        icono={<SquaresFour size={26} weight="bold" />}
        titulo="Aún no tienes categorías"
        texto="Agrupa tus productos por tipo, por ejemplo Ropa o Maquillaje."
        accion={
          <Link to="/categorias/nueva" className="btn btn-primary">
            Crear categoría
          </Link>
        }
      />
    );
  } else {
    contenido = (
      <ul className="page" style={{ listStyle: 'none', margin: 0 }}>
        {categorias.data.map((c) => (
          <li key={c.id} className="list-row">
            <IconBadge icono={c.icono} />
            <div className="list-row-main">
              <div className="list-row-title">{c.nombre}</div>
              <div className="list-row-sub">
                {c.totalProductos} {c.totalProductos === 1 ? 'producto' : 'productos'}
              </div>
            </div>
            <Link
              to={`/categorias/${c.id}/editar`}
              className="btn btn-secondary btn-icon"
              aria-label={`Editar ${c.nombre}`}
            >
              <PencilSimple size={18} aria-hidden="true" />
            </Link>
            <Button icono aria-label={`Inactivar ${c.nombre}`} onClick={() => setCandidata(c)}>
              <Trash size={18} aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <ScreenHeader titulo="Categorías" accion={accion} />
      {aviso && (
        <div className="page" style={{ paddingBottom: 12 }}>
          <Notice>{aviso}</Notice>
        </div>
      )}
      {contenido}

      <Dialog
        abierto={candidata !== null}
        titulo={`¿Inactivar «${candidata?.nombre ?? ''}»?`}
        onCerrar={() => setCandidata(null)}
        acciones={
          <>
            <Button onClick={() => setCandidata(null)}>Cancelar</Button>
            <Button
              variante="danger"
              disabled={inactivar.isPending}
              onClick={() => candidata && inactivar.mutate(candidata.id)}
            >
              Inactivar
            </Button>
          </>
        }
      >
        Dejará de aparecer en las listas y en la predicción. Podrás crear otra con el mismo nombre.
      </Dialog>

      <Dialog
        abierto={bloqueo !== null}
        titulo="No se puede inactivar"
        onCerrar={() => setBloqueo(null)}
        acciones={
          <Button variante="primary" onClick={() => setBloqueo(null)}>
            Entendido
          </Button>
        }
      >
        {bloqueo}
      </Dialog>
    </>
  );
}
