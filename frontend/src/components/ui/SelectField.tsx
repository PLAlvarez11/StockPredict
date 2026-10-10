import { CaretDown, WarningCircle } from '@phosphor-icons/react';
import { useId, type Ref, type SelectHTMLAttributes } from 'react';

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  etiqueta: string;
  error?: string | undefined;
  ref?: Ref<HTMLSelectElement>;
}

export function SelectField({ etiqueta, error, id, ref, children, ...resto }: Props) {
  const generado = useId();
  const idCampo = id ?? generado;
  const idError = `${idCampo}-error`;

  return (
    <div className="field">
      <label htmlFor={idCampo}>{etiqueta}</label>
      <div className="select-wrap">
        <select
          id={idCampo}
          ref={ref}
          className="input"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? idError : undefined}
          {...resto}
        >
          {children}
        </select>
        <CaretDown className="select-caret" size={16} aria-hidden="true" />
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
