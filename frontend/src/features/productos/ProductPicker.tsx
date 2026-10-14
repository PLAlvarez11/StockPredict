import { CaretDown, WarningCircle } from '@phosphor-icons/react';
import { useId } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { IconBadge } from '../../components/ui/IconBadge';
import type { Producto } from './api';

interface Props {
  registro: UseFormRegisterReturn;
  productos: Producto[];
  seleccionado: Producto | undefined;
  error?: string | undefined;
}

export function ProductPicker({ registro, productos, seleccionado, error }: Props) {
  const id = useId();
  const idError = `${id}-error`;

  return (
    <div className="field">
      <label htmlFor={id}>Producto</label>
      <div className="picker">
        <IconBadge icono={seleccionado?.subcategoria.icono ?? 'tag'} />
        <div className="select-wrap" style={{ flex: 1 }}>
          <select
            id={id}
            className="input"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? idError : undefined}
            {...registro}
          >
            <option value="">Elige un producto</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
          <CaretDown className="select-caret" size={16} aria-hidden="true" />
        </div>
      </div>
      {error && (
        <p id={idError} className="field-error" role="alert">
          <WarningCircle size={16} weight="bold" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
