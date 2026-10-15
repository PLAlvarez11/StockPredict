import { CheckCircle, Info, WarningCircle } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

interface Props {
  tipo?: 'exito' | 'error' | 'aviso';
  children: ReactNode;
}

export function Notice({ tipo = 'exito', children }: Props) {
  const error = tipo === 'error';
  const clase = tipo === 'exito' ? 'notice' : `notice notice-${tipo}`;
  return (
    <div className={clase} role={error ? 'alert' : 'status'}>
      {error && <WarningCircle size={18} weight="bold" aria-hidden="true" />}
      {tipo === 'aviso' && <Info size={18} weight="bold" aria-hidden="true" />}
      {tipo === 'exito' && <CheckCircle size={18} weight="bold" aria-hidden="true" />}
      <div>{children}</div>
    </div>
  );
}
