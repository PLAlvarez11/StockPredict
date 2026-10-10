import { WifiSlash } from '@phosphor-icons/react';
import { Button } from './Button';
import { EmptyState } from './EmptyState';

interface Props {
  onReintentar: () => void;
  texto?: string;
}

export function ErrorState({
  onReintentar,
  texto = 'Revisa tu conexión e inténtalo de nuevo.',
}: Props) {
  return (
    <EmptyState
      icono={<WifiSlash size={26} weight="bold" />}
      titulo="No pudimos cargar los datos"
      texto={texto}
      accion={
        <Button variante="primary" onClick={onReintentar}>
          Reintentar
        </Button>
      }
    />
  );
}
