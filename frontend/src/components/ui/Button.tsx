import type { ButtonHTMLAttributes } from 'react';

type Variante = 'primary' | 'secondary' | 'ghost' | 'danger';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  bloque?: boolean;
  icono?: boolean;
}

export function Button({
  variante = 'secondary',
  bloque = false,
  icono = false,
  className = '',
  type = 'button',
  ...resto
}: Props) {
  const clases = [
    'btn',
    `btn-${variante}`,
    bloque ? 'btn-block' : '',
    icono ? 'btn-icon' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={clases} {...resto} />;
}
