import {
  ArrowCounterClockwise,
  PencilSimple,
  Plus,
  SquaresFour,
  TreeStructure,
  Trash,
} from '@phosphor-icons/react';
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
import { CLAVE_SUBCATEGORIAS } from '../subcategorias/hooks';
import { categoriasApi, type Categoria } from './api';
import { CLAVE_CATEGORIAS, useCategorias } from './hooks';

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export function CategoriasPage() {
  const [inactivas, setInactivas] = useState(false);
  const categorias = useCategorias(inactivas ? 'inactivos' : 'activos');
  const cliente = useQueryClient();
  const estado = (useLocation().state ?? {}) as { aviso?: string };
  const [aviso, setAviso] = useState<string | undefined>(estado.aviso);
  const [candidata, setCandidata] = useState<Categoria | null>(null);
  const [aActivar, setAActivar] = useState<Categoria | null>(null);
  const [fallo, setFallo] = useState<{ titulo: string; texto: string } | null>(null);

  const refrescar = async () => {
    await cliente.invalidateQueries({ queryKey: CLAVE_CATEGORIAS });
    await cliente.invalidateQueries({ queryKey: CLAVE_SUBCATEGORIAS });
  };

  const inactivar = useMutation({
    mutationFn: (id: number) => categoriasApi.inactivar(id),
    onSuccess: async () => {
      await refrescar();
      setCandidata(null);
      setAviso('Categoría inactivada');
    },
    onError: (error) => {
      setCandidata(null);
      setFallo({
        titulo: 'No se puede inactivar',
        texto: error instanceof ApiError ? error.message : 'No se pudo inactivar la categoría.',
      });
    },
  });

  const activar = useMutation({
    mutationFn: (id: number) => categoriasApi.activar(id),
    onSuccess: async () => {
      await refrescar();
      setAActivar(null);
      setAviso('Categoría activada');
    },
    onError: (error) => {
      setAActivar(null);
      setFallo({
        titulo: 'No se pudo activar',
        texto: error instanceof ApiError ? error.message : 'No se pudo activar la categoría.',
      });
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
    contenido = inactivas ? (
      <EmptyState
        icono={<SquaresFour size={26} weight="bold" />}
        titulo="No hay categorías inactivas"
      />
    ) : (
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
          <li key={c.id} className={c.estado ? 'list-row' : 'list-row list-row-inactiva'}>
            <IconBadge icono={c.icono} />
            <div className="list-row-main">
              <div className="list-row-title">{c.nombre}</div>
              <div className="list-row-sub">
                {c.estado
                  ? `${plural(c.totalSubcategorias, 'subcategoría', 'subcategorías')} · ${plural(c.totalProductos, 'producto', 'productos')}`
                  : 'Inactiva'}
              </div>
            </div>
            {c.estado ? (
              <>
                <Link
                  to={`/categorias/${c.id}`}
                  className="btn btn-secondary btn-icon"
                  aria-label={`Subcategorías de ${c.nombre}`}
                >
                  <TreeStructure size={18} aria-hidden="true" />
                </Link>
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
              </>
            ) : (
              <Button aria-label={`Activar ${c.nombre}`} onClick={() => setAActivar(c)}>
                <ArrowCounterClockwise size={16} aria-hidden="true" />
                Activar
              </Button>
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <ScreenHeader titulo="Categorías" accion={accion} />
      <div className="segmento" role="group" aria-label="Estado de las categorías">
        <Button
          variante={inactivas ? 'secondary' : 'primary'}
          aria-pressed={!inactivas}
          onClick={() => setInactivas(false)}
        >
          Activas
        </Button>
        <Button
          variante={inactivas ? 'primary' : 'secondary'}
          aria-pressed={inactivas}
          onClick={() => setInactivas(true)}
        >
          Inactivas
        </Button>
      </div>
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
        Dejará de aparecer en las listas y en la predicción. Solo se puede inactivar si no tiene
        subcategorías activas. Podrás activarla de nuevo.
      </Dialog>

      <Dialog
        abierto={aActivar !== null}
        titulo={`¿Activar «${aActivar?.nombre ?? ''}»?`}
        onCerrar={() => setAActivar(null)}
        acciones={
          <>
            <Button onClick={() => setAActivar(null)}>Cancelar</Button>
            <Button
              variante="primary"
              disabled={activar.isPending}
              onClick={() => aActivar && activar.mutate(aActivar.id)}
            >
              Activar
            </Button>
          </>
        }
      >
        Volverá a aparecer en las listas. Sus subcategorías siguen como estaban.
      </Dialog>

      <Dialog
        abierto={fallo !== null}
        titulo={fallo?.titulo ?? ''}
        onCerrar={() => setFallo(null)}
        acciones={
          <Button variante="primary" onClick={() => setFallo(null)}>
            Entendido
          </Button>
        }
      >
        {fallo?.texto}
      </Dialog>
    </>
  );
}
