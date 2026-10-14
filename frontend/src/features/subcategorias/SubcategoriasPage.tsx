import {
  ArrowCounterClockwise,
  PencilSimple,
  Plus,
  TreeStructure,
  Trash,
} from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
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
import { subcategoriasApi, type Subcategoria } from './api';
import { CLAVE_SUBCATEGORIAS, useSubcategorias } from './hooks';

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export function SubcategoriasPage() {
  const { id } = useParams();
  const categoriaId = Number(id);
  const categorias = useCategorias();
  const [inactivas, setInactivas] = useState(false);
  const subcategorias = useSubcategorias(categoriaId, inactivas ? 'inactivos' : 'activos');
  const cliente = useQueryClient();
  const estado = (useLocation().state ?? {}) as { aviso?: string };
  const [aviso, setAviso] = useState<string | undefined>(estado.aviso);
  const [candidata, setCandidata] = useState<Subcategoria | null>(null);
  const [aActivar, setAActivar] = useState<Subcategoria | null>(null);
  const [fallo, setFallo] = useState<{ titulo: string; texto: string } | null>(null);

  const categoria = categorias.data?.find((c) => c.id === categoriaId);

  const refrescar = async () => {
    await cliente.invalidateQueries({ queryKey: CLAVE_SUBCATEGORIAS });
    await cliente.invalidateQueries({ queryKey: CLAVE_CATEGORIAS });
  };

  const inactivar = useMutation({
    mutationFn: (sub: number) => subcategoriasApi.inactivar(sub),
    onSuccess: async () => {
      await refrescar();
      setCandidata(null);
      setAviso('Subcategoría inactivada');
    },
    onError: (error) => {
      setCandidata(null);
      setFallo({
        titulo: 'No se puede inactivar',
        texto: error instanceof ApiError ? error.message : 'No se pudo inactivar la subcategoría.',
      });
    },
  });

  const activar = useMutation({
    mutationFn: (sub: number) => subcategoriasApi.activar(sub),
    onSuccess: async () => {
      await refrescar();
      setAActivar(null);
      setAviso('Subcategoría activada');
    },
    onError: (error) => {
      setAActivar(null);
      setFallo({
        titulo: 'No se pudo activar',
        texto: error instanceof ApiError ? error.message : 'No se pudo activar la subcategoría.',
      });
    },
  });

  let contenido;
  if (categorias.isPending || subcategorias.isPending) {
    contenido = <ListSkeleton />;
  } else if (categorias.isError || subcategorias.isError) {
    contenido = (
      <ErrorState
        onReintentar={() => {
          void categorias.refetch();
          void subcategorias.refetch();
        }}
      />
    );
  } else if (!categoria) {
    contenido = (
      <EmptyState
        icono={<TreeStructure size={26} weight="bold" />}
        titulo="La categoría no existe o está inactiva"
        accion={
          <Link to="/categorias" className="btn btn-primary">
            Volver a categorías
          </Link>
        }
      />
    );
  } else if (subcategorias.data.length === 0) {
    contenido = inactivas ? (
      <EmptyState
        icono={<TreeStructure size={26} weight="bold" />}
        titulo="No hay subcategorías inactivas"
      />
    ) : (
      <EmptyState
        icono={<TreeStructure size={26} weight="bold" />}
        titulo="Aún no hay subcategorías"
        texto={`Cada producto de «${categoria.nombre}» va en una subcategoría, por ejemplo Blusas o Pantalones.`}
        accion={
          <Link to={`/categorias/${categoriaId}/subcategorias/nueva`} className="btn btn-primary">
            Crear subcategoría
          </Link>
        }
      />
    );
  } else {
    contenido = (
      <ul className="page" style={{ listStyle: 'none', margin: 0 }}>
        {subcategorias.data.map((s) => (
          <li key={s.id} className={s.estado ? 'list-row' : 'list-row list-row-inactiva'}>
            <IconBadge icono={s.icono} />
            <div className="list-row-main">
              <div className="list-row-title">{s.nombre}</div>
              <div className="list-row-sub">
                {s.estado ? plural(s.totalProductos, 'producto', 'productos') : 'Inactiva'}
                {s.iconoPropio === null && s.estado && (
                  <span className="nota-herencia"> · ícono heredado</span>
                )}
              </div>
            </div>
            {s.estado ? (
              <>
                <Link
                  to={`/categorias/${categoriaId}/subcategorias/${s.id}/editar`}
                  className="btn btn-secondary btn-icon"
                  aria-label={`Editar ${s.nombre}`}
                >
                  <PencilSimple size={18} aria-hidden="true" />
                </Link>
                <Button icono aria-label={`Inactivar ${s.nombre}`} onClick={() => setCandidata(s)}>
                  <Trash size={18} aria-hidden="true" />
                </Button>
              </>
            ) : (
              <Button aria-label={`Activar ${s.nombre}`} onClick={() => setAActivar(s)}>
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
      <ScreenHeader
        titulo={categoria ? `${categoria.nombre}` : 'Subcategorías'}
        atras="/categorias"
        accion={
          <Link
            to={`/categorias/${categoriaId}/subcategorias/nueva`}
            className="btn btn-primary btn-icon"
            aria-label="Nueva subcategoría"
          >
            <Plus size={20} weight="bold" aria-hidden="true" />
          </Link>
        }
      />
      <div className="segmento" role="group" aria-label="Estado de las subcategorías">
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
        Dejará de aparecer al crear productos. Solo se puede inactivar si no tiene productos
        activos. Podrás activarla de nuevo.
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
        Volverá a estar disponible para crear productos.
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
