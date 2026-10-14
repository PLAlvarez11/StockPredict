import {
  ArrowCounterClockwise,
  CaretDown,
  EyeSlash,
  PencilSimple,
  Plus,
  SquaresFour,
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
import { subcategoriasApi, type Subcategoria } from '../subcategorias/api';
import { CLAVE_SUBCATEGORIAS, useSubcategorias } from '../subcategorias/hooks';
import { categoriasApi, type Categoria } from './api';
import { CLAVE_CATEGORIAS, useCategorias } from './hooks';

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

interface PanelProps {
  id: string;
  categoria: Categoria;
  onDesactivar: (sub: Subcategoria) => void;
  onActivar: (sub: Subcategoria) => void;
}

function PanelSubcategorias({ id, categoria, onDesactivar, onActivar }: PanelProps) {
  const subcategorias = useSubcategorias(categoria.id, 'todos');

  let cuerpo;
  if (subcategorias.isPending) {
    cuerpo = <ListSkeleton filas={2} />;
  } else if (subcategorias.isError) {
    cuerpo = <ErrorState onReintentar={() => void subcategorias.refetch()} />;
  } else if (subcategorias.data.length === 0) {
    cuerpo = (
      <p className="list-row-sub">
        Aún no hay subcategorías. Cada producto de «{categoria.nombre}» va en una, por ejemplo
        Blusas o Pantalones.
      </p>
    );
  } else {
    cuerpo = (
      <ul className="acordeon-sub">
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
                  to={`/categorias/${categoria.id}/subcategorias/${s.id}/editar`}
                  className="btn btn-secondary btn-icon"
                  aria-label={`Editar ${s.nombre}`}
                >
                  <PencilSimple size={18} aria-hidden="true" />
                </Link>
                <Button icono aria-label={`Desactivar ${s.nombre}`} onClick={() => onDesactivar(s)}>
                  <EyeSlash size={18} aria-hidden="true" />
                </Button>
              </>
            ) : (
              <Button aria-label={`Activar ${s.nombre}`} onClick={() => onActivar(s)}>
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
    <div id={id} className="acordeon-cuerpo">
      {cuerpo}
      <Link
        to={`/categorias/${categoria.id}/subcategorias/nueva`}
        className="btn btn-secondary"
        style={{ alignSelf: 'flex-start' }}
      >
        <Plus size={16} weight="bold" aria-hidden="true" />
        Agregar subcategoría
      </Link>
    </div>
  );
}

export function CategoriasPage() {
  const [inactivas, setInactivas] = useState(false);
  const categorias = useCategorias(inactivas ? 'inactivos' : 'activos');
  const cliente = useQueryClient();
  const estado = (useLocation().state ?? {}) as { aviso?: string; abrir?: number };
  const [aviso, setAviso] = useState<string | undefined>(estado.aviso);
  const [abiertas, setAbiertas] = useState<number[]>(
    estado.abrir === undefined ? [] : [estado.abrir],
  );
  const [candidata, setCandidata] = useState<Categoria | null>(null);
  const [aActivar, setAActivar] = useState<Categoria | null>(null);
  const [subCandidata, setSubCandidata] = useState<Subcategoria | null>(null);
  const [subAActivar, setSubAActivar] = useState<Subcategoria | null>(null);
  const [fallo, setFallo] = useState<{ titulo: string; texto: string } | null>(null);

  const alternar = (id: number) =>
    setAbiertas((actuales) =>
      actuales.includes(id) ? actuales.filter((x) => x !== id) : [...actuales, id],
    );

  const refrescar = async () => {
    await cliente.invalidateQueries({ queryKey: CLAVE_CATEGORIAS });
    await cliente.invalidateQueries({ queryKey: CLAVE_SUBCATEGORIAS });
  };

  const mensaje = (error: unknown, porDefecto: string) =>
    error instanceof ApiError ? error.message : porDefecto;

  const desactivar = useMutation({
    mutationFn: (id: number) => categoriasApi.inactivar(id),
    onSuccess: async () => {
      await refrescar();
      setCandidata(null);
      setAviso('Categoría desactivada');
    },
    onError: (error) => {
      setCandidata(null);
      setFallo({
        titulo: 'No se puede desactivar',
        texto: mensaje(error, 'No se pudo desactivar la categoría.'),
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
        texto: mensaje(error, 'No se pudo activar la categoría.'),
      });
    },
  });

  const desactivarSub = useMutation({
    mutationFn: (id: number) => subcategoriasApi.inactivar(id),
    onSuccess: async () => {
      await refrescar();
      setSubCandidata(null);
      setAviso('Subcategoría desactivada');
    },
    onError: (error) => {
      setSubCandidata(null);
      setFallo({
        titulo: 'No se puede desactivar',
        texto: mensaje(error, 'No se pudo desactivar la subcategoría.'),
      });
    },
  });

  const activarSub = useMutation({
    mutationFn: (id: number) => subcategoriasApi.activar(id),
    onSuccess: async () => {
      await refrescar();
      setSubAActivar(null);
      setAviso('Subcategoría activada');
    },
    onError: (error) => {
      setSubAActivar(null);
      setFallo({
        titulo: 'No se pudo activar',
        texto: mensaje(error, 'No se pudo activar la subcategoría.'),
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
        {categorias.data.map((c) => {
          const abierta = abiertas.includes(c.id);
          const idPanel = `subcategorias-${c.id}`;
          return (
            <li
              key={c.id}
              className={c.estado ? 'acordeon-item' : 'acordeon-item acordeon-item-inactiva'}
            >
              <div className="list-row">
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
                    <Button
                      icono
                      aria-expanded={abierta}
                      aria-controls={abierta ? idPanel : undefined}
                      aria-label={`Subcategorías de ${c.nombre}`}
                      onClick={() => alternar(c.id)}
                    >
                      <CaretDown
                        className="acordeon-caret"
                        data-abierto={abierta}
                        size={18}
                        aria-hidden="true"
                      />
                    </Button>
                    <Link
                      to={`/categorias/${c.id}/editar`}
                      className="btn btn-secondary btn-icon"
                      aria-label={`Editar ${c.nombre}`}
                    >
                      <PencilSimple size={18} aria-hidden="true" />
                    </Link>
                    <Button
                      icono
                      aria-label={`Desactivar ${c.nombre}`}
                      onClick={() => setCandidata(c)}
                    >
                      <EyeSlash size={18} aria-hidden="true" />
                    </Button>
                  </>
                ) : (
                  <Button aria-label={`Activar ${c.nombre}`} onClick={() => setAActivar(c)}>
                    <ArrowCounterClockwise size={16} aria-hidden="true" />
                    Activar
                  </Button>
                )}
              </div>
              {c.estado && abierta && (
                <PanelSubcategorias
                  id={idPanel}
                  categoria={c}
                  onDesactivar={setSubCandidata}
                  onActivar={setSubAActivar}
                />
              )}
            </li>
          );
        })}
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
        titulo={`¿Desactivar «${candidata?.nombre ?? ''}»?`}
        onCerrar={() => setCandidata(null)}
        acciones={
          <>
            <Button onClick={() => setCandidata(null)}>Cancelar</Button>
            <Button
              variante="danger"
              disabled={desactivar.isPending}
              onClick={() => candidata && desactivar.mutate(candidata.id)}
            >
              Desactivar
            </Button>
          </>
        }
      >
        Dejará de aparecer en las listas y en la predicción. No se borra nada y podrás activarla de
        nuevo. Solo se puede desactivar si no tiene subcategorías activas.
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
        abierto={subCandidata !== null}
        titulo={`¿Desactivar «${subCandidata?.nombre ?? ''}»?`}
        onCerrar={() => setSubCandidata(null)}
        acciones={
          <>
            <Button onClick={() => setSubCandidata(null)}>Cancelar</Button>
            <Button
              variante="danger"
              disabled={desactivarSub.isPending}
              onClick={() => subCandidata && desactivarSub.mutate(subCandidata.id)}
            >
              Desactivar
            </Button>
          </>
        }
      >
        Dejará de aparecer al crear productos. No se borra nada y podrás activarla de nuevo. Solo se
        puede desactivar si no tiene productos activos.
      </Dialog>

      <Dialog
        abierto={subAActivar !== null}
        titulo={`¿Activar «${subAActivar?.nombre ?? ''}»?`}
        onCerrar={() => setSubAActivar(null)}
        acciones={
          <>
            <Button onClick={() => setSubAActivar(null)}>Cancelar</Button>
            <Button
              variante="primary"
              disabled={activarSub.isPending}
              onClick={() => subAActivar && activarSub.mutate(subAActivar.id)}
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
