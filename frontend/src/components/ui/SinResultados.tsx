import { MagnifyingGlass } from '@phosphor-icons/react';
import { Button } from './Button';
import { EmptyState } from './EmptyState';

interface Props {
  busqueda?: string | undefined;
  onLimpiar: () => void;
  etiquetaBoton?: string;
}

export function SinResultados({ busqueda, onLimpiar, etiquetaBoton = 'Limpiar búsqueda' }: Props) {
  return (
    <EmptyState
      icono={<MagnifyingGlass size={26} weight="bold" />}
      titulo="No encontramos nada con esa búsqueda"
      texto={
        busqueda
          ? `No hay resultados para «${busqueda}». Revisa cómo la escribiste o prueba con otra palabra.`
          : 'Prueba con otra palabra o quita los filtros.'
      }
      accion={<Button onClick={onLimpiar}>{etiquetaBoton}</Button>}
    />
  );
}
