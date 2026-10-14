import {
  ArrowCounterClockwise,
  PencilSimple,
  Plus,
  ShoppingBag,
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
import { CLAVE_CATEGORIAS, useCategorias } from '../categorias/hooks';
import { CLAVE_SUBCATEGORIAS, useSubcategorias } from '../subcategorias/hooks';
import { productosApi, type Producto } from './api';
import { CLAVE_PRODUCTOS, useProductos } from './hooks';
import { StockTag } from './StockTag';

export function ProductosPage() {
  const [inactivos, setInactivos] = useState(false);
  const [filtro, setFiltro] = useState<number | undefined>(undefined);
  const [filtroSub, setFiltroSub] = useState<number | undefined>(undefined);
  const categorias = useCategorias();
  const subcategorias = useSubcategorias(filtro);
  const productos = useProductos({
    categoriaId: filtro,
    subcategoriaId: filtroSub,
    estado: inactivos ? 'inactivos' : 'activos',
  });
  const cliente = useQueryClient();
  const estado = (useLocation().state ?? {}) as { aviso?: string };
  const [aviso, setAviso] = useState<string | undefined>(estado.aviso);
  const [candidato, setCandidato] = useState<Producto | null>(null);
  const [aActivar, setAActivar] = useState<Producto | null>(null);
  const [fallo, setFallo] = useState<{ titulo: string; texto: string } | null>(null);

  const refrescar = async () => {
    await cliente.invalidateQueries({ queryKey: CLAVE_PRODUCTOS });
    await cliente.invalidateQueries({ queryKey: CLAVE_CATEGORIAS });
    await cliente.invalidateQueries({ queryKey: CLAVE_SUBCATEGORIAS });
    await cliente.invalidateQueries({ queryKey: ['prediccion'] });
  };

  const inactivar = useMutation({
    mutationFn: (id: number) => productosApi.inactivar(id),
    onSuccess: async () => {
      await refrescar();
      setCandidato(null);
      setAviso('Producto desactivado');
    },
    onError: (error) => {
      setCandidato(null);
      setFallo({
        titulo: 'No se pudo desactivar',
        texto: error instanceof ApiError ? error.message : 'No se pudo desactivar el producto.',
      });
    },
  });

  const activar = useMutation({
    mutationFn: (id: number) => productosApi.activar(id),
    onSuccess: async () => {
      await refrescar();
      setAActivar(null);
      setAviso('Producto activado');
    },
    onError: (error) => {
      setAActivar(null);
      setFallo({
        titulo: 'No se pudo activar',
        texto: error instanceof ApiError ? error.message : 'No se pudo activar el producto.',
      });
    },
  });

  const elegirCategoria = (id: number | undefined) => {
    setFiltro(id);
    setFiltroSub(undefined);
  };

  const accion = (
    <Link to="/productos/nuevo" className="btn btn-primary btn-icon" aria-label="Nuevo producto">
      <Plus size={20} weight="bold" aria-hidden="true" />
    </Link>
  );

  const hayFiltro = filtro !== undefined || filtroSub !== undefined;

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
  } else if (productos.data.datos.length === 0 && inactivos) {
    contenido = (
      <EmptyState
        icono={<ShoppingBag size={26} weight="bold" />}
        titulo="No hay productos inactivos"
        texto="Los productos que desactives aparecerán aquí para que puedas activarlos de nuevo."
      />
    );
  } else if (productos.data.datos.length === 0 && hayFiltro) {
    contenido = (
      <EmptyState
        icono={<ShoppingBag size={26} weight="bold" />}
        titulo="No hay productos con este filtro"
        accion={<Button onClick={() => elegirCategoria(undefined)}>Ver todos</Button>}
      />
    );
  } else if (productos.data.datos.length === 0 && categorias.data.length === 0) {
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
          <li key={p.id} className={p.estado ? 'list-row' : 'list-row list-row-inactiva'}>
            <IconBadge icono={p.subcategoria.icono} />
            <div className="list-row-main">
              <div className="list-row-title">{p.nombre}</div>
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
                <Button icono aria-label={`Desactivar ${p.nombre}`} onClick={() => setCandidato(p)}>
                  <Trash size={18} aria-hidden="true" />
                </Button>
              </>
            ) : (
              <>
                <span className="tag tag-inactivo">Inactivo</span>
                <Button aria-label={`Activar ${p.nombre}`} onClick={() => setAActivar(p)}>
                  <ArrowCounterClockwise size={16} aria-hidden="true" />
                  Activar
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <ScreenHeader titulo="Productos" accion={accion} />
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
      {categorias.data && categorias.data.length > 0 && (
        <div className="chips" role="group" aria-label="Filtrar por categoría">
          <Button
            variante={filtro === undefined ? 'primary' : 'secondary'}
            aria-pressed={filtro === undefined}
            onClick={() => elegirCategoria(undefined)}
          >
            Todas
          </Button>
          {categorias.data.map((c) => (
            <Button
              key={c.id}
              variante={filtro === c.id ? 'primary' : 'secondary'}
              aria-pressed={filtro === c.id}
              onClick={() => elegirCategoria(c.id)}
            >
              {c.nombre}
            </Button>
          ))}
        </div>
      )}
      {filtro !== undefined && subcategorias.data && subcategorias.data.length > 0 && (
        <div className="chips chips-sub" role="group" aria-label="Filtrar por subcategoría">
          <Button
            variante={filtroSub === undefined ? 'primary' : 'secondary'}
            aria-pressed={filtroSub === undefined}
            onClick={() => setFiltroSub(undefined)}
          >
            Todas
          </Button>
          {subcategorias.data.map((s) => (
            <Button
              key={s.id}
              variante={filtroSub === s.id ? 'primary' : 'secondary'}
              aria-pressed={filtroSub === s.id}
              onClick={() => setFiltroSub(s.id)}
            >
              {s.nombre}
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
        titulo={`¿Desactivar «${candidato?.nombre ?? ''}»?`}
        onCerrar={() => setCandidato(null)}
        acciones={
          <>
            <Button onClick={() => setCandidato(null)}>Cancelar</Button>
            <Button
              variante="danger"
              disabled={inactivar.isPending}
              onClick={() => candidato && inactivar.mutate(candidato.id)}
            >
              Desactivar
            </Button>
          </>
        }
      >
        Dejará de aparecer en las listas, en las ventas, en el conteo de stock bajo y en la
        predicción. Podrás activarlo de nuevo.
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
        Volverá a aparecer en las listas, en las ventas y en la predicción, con su stock actual de{' '}
        {aActivar?.stock} u.
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
