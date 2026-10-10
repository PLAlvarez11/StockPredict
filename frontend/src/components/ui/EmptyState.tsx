import type { ReactNode } from 'react';

interface Props {
  icono: ReactNode;
  titulo: string;
  texto?: string;
  accion?: ReactNode;
}

export function EmptyState({ icono, titulo, texto, accion }: Props) {
  return (
    <div className="empty-state">
      <div className="icon-badge icon-badge-lg" aria-hidden="true">
        {icono}
      </div>
      <h2>{titulo}</h2>
      {texto && <p>{texto}</p>}
      {accion}
    </div>
  );
}
