import { CheckCircle, WarningCircle } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

interface Props {
  tipo?: 'exito' | 'error';
  children: ReactNode;
}

export function Notice({ tipo = 'exito', children }: Props) {
  const error = tipo === 'error';
  return (
    <div className={error ? 'notice notice-error' : 'notice'} role={error ? 'alert' : 'status'}>
      {error ? (
        <WarningCircle size={18} weight="bold" aria-hidden="true" />
      ) : (
        <CheckCircle size={18} weight="bold" aria-hidden="true" />
      )}
      <div>{children}</div>
    </div>
  );
}
