import { Warning, WarningCircle } from '@phosphor-icons/react';
import type { NivelStock } from './api';

interface Props {
  stock: number;
  nivel: NivelStock;
}

export function StockTag({ stock, nivel }: Props) {
  if (nivel === 'agotado') {
    return (
      <span className="tag tag-danger">
        <WarningCircle size={14} weight="bold" aria-hidden="true" />
        Agotado
      </span>
    );
  }
  return (
    <span className={nivel === 'bajo' ? 'tag tag-warn' : 'tag tag-ok'}>
      {nivel === 'bajo' && (
        <>
          <Warning size={14} weight="bold" aria-hidden="true" />
          <span className="sr-only">Stock bajo: </span>
        </>
      )}
      {stock} u.
    </span>
  );
}
