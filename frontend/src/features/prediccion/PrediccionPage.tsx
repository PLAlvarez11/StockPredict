import { ChartLineUp, Export, MagnifyingGlass, ShoppingBag } from '@phosphor-icons/react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { ListSkeleton } from '../../components/ui/ListSkeleton';
import { formatearSemana } from '../../lib/formato';
import { useRetraso } from '../../lib/useRetraso';
import { useTitulo } from '../../lib/useTitulo';
import { useCategorias } from '../categorias/hooks';
import { useSubcategorias } from '../subcategorias/hooks';
import { prediccionApi, type FiltroSemaforo } from './api';
import { PrediccionCard } from './PrediccionCard';

export const CLAVE_PREDICCION = ['prediccion'] as const;

const ESTADOS: { id: FiltroSemaforo; etiqueta: string }[] = [
  { id: 'todos', etiqueta: 'Todos' },
  { id: 'rojo', etiqueta: 'Rojo' },
  { id: 'ambar', etiqueta: 'Ámbar' },
  { id: 'verde', etiqueta: 'Verde' },
];

export function PrediccionPage() {
  useTitulo('Predicción de compra');
  const [busqueda, setBusqueda] = useState('');
  const [categoriaId, setCategoriaId] = useState<number | undefined>(undefined);
  const [subcategoriaId, setSubcategoriaId] = useState<number | undefined>(undefined);
  const [estado, setEstado] = useState<FiltroSemaforo>('todos');
  const q = useRetraso(busqueda.trim());
  const filtros = { q: q === '' ? undefined : q, categoriaId, subcategoriaId, estado };

  const categorias = useCategorias();
  const subcategorias = useSubcategorias(categoriaId);
  const prediccion = useQuery({
    queryKey: [...CLAVE_PREDICCION, filtros],
    queryFn: () => prediccionApi.obtener(filtros),
    staleTime: 0,
    placeholderData: keepPreviousData,
  });

  const datos = prediccion.data;
  const hayFiltro = q !== '' || categoriaId !== undefined || estado !== 'todos';

  const elegirCategoria = (id: number | undefined) => {
    setCategoriaId(id);
    setSubcategoriaId(undefined);
  };
  const limpiar = () => {
    setBusqueda('');
    setCategoriaId(undefined);
    setSubcategoriaId(undefined);
    setEstado('todos');
  };

  let contenido;
  if (prediccion.isPending) {
    contenido = <ListSkeleton filas={4} />;
  } else if (prediccion.isError) {
    contenido = <ErrorState onReintentar={() => void prediccion.refetch()} />;
  } else if (datos && datos.totalActivos === 0) {
    contenido = (
      <EmptyState
        icono={<ShoppingBag size={26} weight="bold" />}
        titulo="Aún no hay productos para predecir"
        texto="Crea tus productos y registra ventas para recibir sugerencias de compra."
        accion={
          <Link to="/productos/nuevo" className="btn btn-primary">
            Crear producto
          </Link>
        }
      />
    );
  } else if (datos && datos.items.length === 0) {
    contenido = (
      <EmptyState
        icono={<MagnifyingGlass size={26} weight="bold" />}
        titulo="No encontramos productos con esos filtros"
        accion={<Button onClick={limpiar}>Quitar filtros</Button>}
      />
    );
  } else if (datos) {
    contenido = (
      <div className="page" style={{ gap: 12, paddingTop: 16 }}>
        {datos.items.map((item) => (
          <PrediccionCard key={item.producto.id} item={item} />
        ))}
      </div>
    );
  }

  return (
    <>
      <header className="pred-cabecera">
        <div className="pred-cabecera-titulo">
          <ChartLineUp size={22} weight="bold" aria-hidden="true" />
          <h1>Predicción de compra</h1>
        </div>
        {datos && datos.totalActivos > 0 && (
          <p className="pred-cabecera-resumen">
            {datos.totalAComprar} de {datos.totalActivos}{' '}
            {datos.totalActivos === 1 ? 'producto' : 'productos'} para reabastecer · semana{' '}
            {formatearSemana(datos.semanaActual)}
          </p>
        )}
        <div className="buscador">
          <MagnifyingGlass size={18} aria-hidden="true" />
          <input
            type="search"
            className="input"
            aria-label="Buscar por nombre, categoría o subcategoría"
            placeholder="Buscar por nombre, categoría o subcategoría"
            autoComplete="off"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </header>

      {categorias.data && categorias.data.length > 0 && (
        <div className="chips chips-pred" role="group" aria-label="Filtrar por categoría">
          <Button
            variante={categoriaId === undefined ? 'primary' : 'secondary'}
            aria-pressed={categoriaId === undefined}
            onClick={() => elegirCategoria(undefined)}
          >
            Todas
          </Button>
          {categorias.data.map((c) => (
            <Button
              key={c.id}
              variante={categoriaId === c.id ? 'primary' : 'secondary'}
              aria-pressed={categoriaId === c.id}
              onClick={() => elegirCategoria(c.id)}
            >
              {c.nombre}
            </Button>
          ))}
        </div>
      )}
      {categoriaId !== undefined && subcategorias.data && subcategorias.data.length > 0 && (
        <div className="chips" role="group" aria-label="Filtrar por subcategoría">
          <Button
            variante={subcategoriaId === undefined ? 'primary' : 'secondary'}
            aria-pressed={subcategoriaId === undefined}
            onClick={() => setSubcategoriaId(undefined)}
          >
            Todas
          </Button>
          {subcategorias.data.map((s) => (
            <Button
              key={s.id}
              variante={subcategoriaId === s.id ? 'primary' : 'secondary'}
              aria-pressed={subcategoriaId === s.id}
              onClick={() => setSubcategoriaId(s.id)}
            >
              {s.nombre}
            </Button>
          ))}
        </div>
      )}
      <div className="chips" role="group" aria-label="Filtrar por estado">
        {ESTADOS.map((e) => (
          <Button
            key={e.id}
            variante={estado === e.id ? 'primary' : 'secondary'}
            aria-pressed={estado === e.id}
            onClick={() => setEstado(e.id)}
          >
            <span className={`punto punto-${e.id}`} aria-hidden="true" />
            {e.etiqueta}
          </Button>
        ))}
      </div>
      <div className="page" style={{ paddingBottom: 0 }}>
        <Button bloque disabled aria-describedby="exportar-pronto">
          <Export size={18} aria-hidden="true" />
          Compartir / exportar lista
          <span id="exportar-pronto" className="tag tag-neutral">
            Próximamente
          </span>
        </Button>
      </div>
      <div aria-live="polite" className="sr-only">
        {datos && hayFiltro ? `${datos.totalFiltrados} productos encontrados` : ''}
      </div>
      {contenido}
    </>
  );
}
