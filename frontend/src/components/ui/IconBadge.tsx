import { createElement } from 'react';
import { iconoDe } from '../../lib/iconos';

interface Props {
  icono: string;
  tamano?: number;
}

export function IconBadge({ icono, tamano = 20 }: Props) {
  return (
    <div className="icon-badge" aria-hidden="true">
      {createElement(iconoDe(icono), { size: tamano, weight: 'bold' })}
    </div>
  );
}
