import { CaretLeft } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface Props {
  titulo: string;
  atras?: string;
  accion?: ReactNode;
}

export function ScreenHeader({ titulo, atras, accion }: Props) {
  return (
    <header className="screen-header">
      {atras && (
        <Link to={atras} className="btn btn-secondary btn-icon" aria-label="Volver">
          <CaretLeft size={18} aria-hidden="true" />
        </Link>
      )}
      <h1>{titulo}</h1>
      {accion}
    </header>
  );
}
