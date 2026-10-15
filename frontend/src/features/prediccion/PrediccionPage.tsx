import { ChartLineUp, Export, ShoppingBag } from '@phosphor-icons/react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Buscador } from '../../components/ui/Buscador';
import { SinResultados } from '../../components/ui/SinResultados';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { ListSkeleton } from '../../components/ui/ListSkeleton';
import { formatearSemana } from '../../lib/formato';
import { useBusqueda } from '../../lib/useBusqueda';
import { useTitulo } from '../../lib/useTitulo';
import { FiltrosCategoria } from '../categorias/FiltrosCategoria';
import { prediccionApi, type FiltroSemaforo } from './api';
import { PrediccionCard } from './PrediccionCard';

export const CLAVE_PREDICCION = ['prediccion'] as const;

const ESTADOS: { id: FiltroSemaforo; etiqueta: string }[] = [
  { id: 'todos', etiqueta: 'Todos' },
  { id: 'rojo', etiqueta: 'Rojo' },
  { id: 'ambar', etiqueta: 'Ámbar' },
  { id: 'verde', etiqueta: 'Verde' },
  { id: 'neutro', etiqueta: 'Sin historial' },
];

const LEYENDA: { id: Exclude<FiltroSemaforo, 'todos'>; texto: string }[] = [
  { id: 'rojo', texto: 'Rojo: necesidad de 50 % o más' },
  { id: 'ambar', texto: 'Ámbar: necesidad menor a 50 %' },
  { id: 'verde', texto: 'Verde: no hace falta comprar' },
  { id: 'neutro', texto: 'Sin historial: faltan ventas para sugerir' },
];

export function PrediccionPage() {
  useTitulo('Predicción de compra');
  const busqueda = useBusqueda();
  const [categoriaId, setCategoriaId] = useState<number | undefined>(undefined);
  const [subcategoriaId, setSubcategoriaId] = useState<number | undefined>(undefined);
  const [estado, setEstado] = useState<FiltroSemaforo>('todos');
  const filtros = { q: busqueda.consulta, categoriaId, subcategoriaId, estado };

  const prediccion = useQuery({
    queryKey: [...CLAVE_PREDICCION, filtros],
    queryFn: () => prediccionApi.obtener(filtros),
    staleTime: 0,
    placeholderData: keepPreviousData,
  });

  const datos = prediccion.data;
  const hayFiltro = busqueda.activa || categoriaId !== undefined || estado !== 'todos';

  const elegirCategoria = (id: number | undefined) => {
    setCategoriaId(id);
    setSubcategoriaId(undefined);
  };
  const limpiar = () => {
    busqueda.limpiar();
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
      <SinResultados
        busqueda={busqueda.consulta}
        onLimpiar={limpiar}
        etiquetaBoton="Quitar filtros"
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
        <Buscador
          etiqueta="Buscar por nombre, categoría o subcategoría"
          valor={busqueda.texto}
          onCambio={busqueda.setTexto}
        />
      </header>

      <FiltrosCategoria
        categoriaId={categoriaId}
        subcategoriaId={subcategoriaId}
        onCategoria={elegirCategoria}
        onSubcategoria={setSubcategoriaId}
      />
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
      <ul className="leyenda" aria-label="Significado de los colores">
        {LEYENDA.map((l) => (
          <li key={l.id}>
            <span className={`punto punto-${l.id}`} aria-hidden="true" />
            {l.texto}
          </li>
        ))}
      </ul>
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
